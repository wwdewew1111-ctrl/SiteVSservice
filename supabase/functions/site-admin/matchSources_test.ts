import { addFaceitSource, readFaceitSources, removeFaceitSource } from "./matchSources.ts";
import { syncTeamMatches } from "./matchSync.ts";

const ourId = "our-team";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const match = "1-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherMatch = "1-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Row = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function rejects(task: () => Promise<unknown>, expected: string) {
  try { await task(); } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `Unexpected error: ${String(error)}`);
    return;
  }
  throw new Error(`Expected error containing ${expected}`);
}

function mockDb() {
  let sources: unknown = [];
  const matches = new Map<string, Row>();
  const db = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              return { maybeSingle: () => Promise.resolve({ data: table === "esea_state" ? { value: sources } : matches.get(value) ?? null, error: null }) };
            },
            in(_column: string, phases: string[]) {
              const data = [...matches.values()].filter((row) => phases.includes(String(row.phase))).map((row) => ({ id: row.id }));
              return Promise.resolve({ data, error: null });
            },
          };
        },
        upsert(row: Row) {
          if (table === "esea_state") sources = row.value;
          else matches.set(String(row.id), { ...matches.get(String(row.id)), ...row });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { db: db as never, matches };
}

function details(id: string, team = ourId, status = "READY") {
  return {
    match_id: id,
    competition_type: "championship",
    competition_id: first,
    competition_name: "Test Cup",
    status,
    teams: { faction1: { faction_id: team, name: "Кабаны" }, faction2: { faction_id: "opponent", name: "Opponent" } },
  };
}

async function withFetch(handler: (url: URL) => Response | Promise<Response>, task: () => Promise<void>) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => handler(new URL(String(input)));
  try { await task(); } finally { globalThis.fetch = previous; }
}

Deno.test("add tournament by ID and match URL, deduplicate, and remove without deleting matches", async () => {
  const { db, matches } = mockDb();
  await withFetch((url) => {
    if (url.pathname.endsWith(`/championships/${first}`)) return Response.json({ name: "Test Cup" });
    if (url.pathname.includes(`/championships/${first}/matches`)) {
      return Response.json({ items: url.searchParams.get("type") === "upcoming" ? [details(match)] : [] });
    }
    if (url.pathname.endsWith(`/matches/${match}`)) return Response.json(details(match));
    return new Response("not found", { status: 404 });
  }, async () => {
    const added = await addFaceitSource(db, "key", ourId, "championship", `https://www.faceit.com/en/championship/${first}/test`);
    assert(added.sources.length === 1 && added.sources[0].name === "Test Cup", "Tournament was not stored");
    assert(matches.has(match) && added.message.includes("1"), "Upcoming match was not imported");
    await rejects(() => addFaceitSource(db, "key", ourId, "championship", `https://www.faceit.com/en/cs2/room/${match}`), "уже добавлен");
    const removed = await removeFaceitSource(db, first);
    assert(removed.length === 0 && matches.has(match), "Removal must retain imported matches");
    const fromMatch = await addFaceitSource(db, "key", ourId, "championship", `https://www.faceit.com/en/cs2/room/${match}`);
    assert(fromMatch.sources[0].id === first, "Tournament was not resolved from match");
  });
});

Deno.test("standalone match validates team, URL host and cancelled status", async () => {
  const { db, matches } = mockDb();
  let team = ourId;
  let status = "READY";
  await withFetch(() => Response.json(details(match, team, status)), async () => {
    await rejects(() => addFaceitSource(db, "key", ourId, "match", `https://evil.example/en/cs2/room/${match}`), "faceit.com");
    team = "other-team";
    await rejects(() => addFaceitSource(db, "key", ourId, "match", match), "не найдена настроенная команда");
    team = ourId; status = "CANCELLED";
    await rejects(() => addFaceitSource(db, "key", ourId, "match", match), "отменён");
    status = "READY";
    await addFaceitSource(db, "key", ourId, "match", `https://www.faceit.com/ru/cs2/room/${match}`);
    assert(matches.has(match), "Match was not imported");
    assert((await readFaceitSources(db)).length === 0, "Standalone match must not add a tournament");
  });
});

Deno.test("full sync discovers all configured tournaments, deduplicates and isolates failures", async () => {
  const { db, matches } = mockDb();
  const calls: string[] = [];
  const originalError = console.error;
  console.error = () => {};
  try {
    await withFetch((url) => {
      calls.push(url.pathname + url.search);
      if (url.pathname.endsWith(`/championships/${first}/matches`)) {
        if (url.searchParams.get("type") === "upcoming") return new Response("failure", { status: 503 });
        return Response.json({ items: [details(match)] });
      }
      if (url.pathname.endsWith(`/championships/${second}/matches`)) {
        return Response.json({ items: [details(match), details(otherMatch), details("1-cccccccc-cccc-4ccc-8ccc-cccccccccccc", "unrelated")] });
      }
      if (url.pathname.endsWith(`/matches/${match}`)) return Response.json(details(match));
      if (url.pathname.endsWith(`/matches/${otherMatch}`)) return Response.json(details(otherMatch));
      return new Response("not found", { status: 404 });
    }, async () => {
      await syncTeamMatches(db, "key", ourId, "full", [], [first, second, first]);
      assert(matches.size === 2, "Expected only team matches from both championships");
      assert(calls.filter((path) => path === `/data/v4/matches/${match}`).length === 1, "Duplicate match was refreshed twice");
      assert(calls.filter((path) => path.includes(`/championships/${first}/matches`)).length === 2, "Duplicate tournament was searched twice");
      calls.length = 0;
      await syncTeamMatches(db, "key", ourId, "live", [], [first, second]);
      assert(calls.every((path) => !path.includes("/championships/")), "Live mode must not search championships");
      assert(calls.length === 2, "Live mode must refresh tracked matches");
    });
  } finally { console.error = originalError; }
});

Deno.test("failed initial discovery retains tournament for scheduled retry", async () => {
  const { db } = mockDb();
  const originalError = console.error;
  console.error = () => {};
  try {
    await withFetch((url) => url.pathname.endsWith(`/championships/${first}`)
      ? Response.json({ name: "Test Cup" }) : new Response("unavailable", { status: 503 }), async () => {
        const result = await addFaceitSource(db, "key", ourId, "championship", first);
        assert(result.sources.length === 1 && result.message.includes("повторит"), "Tournament must be saved despite temporary discovery failure");
      });
  } finally { console.error = originalError; }
});

Deno.test("legacy championship stays active alongside added tournaments", async () => {
  const { db, matches } = mockDb();
  const calls: string[] = [];
  await withFetch((url) => {
    calls.push(url.pathname);
    if (url.pathname.endsWith(`/matches/${match}`)) return Response.json(details(match));
    if (url.pathname.endsWith(`/matches/${otherMatch}`)) return Response.json(details(otherMatch));
    if (url.pathname.endsWith(`/championships/${first}/matches`)) return Response.json({ items: [details(match)] });
    if (url.pathname.endsWith(`/championships/${second}/matches`)) return Response.json({ items: [details(otherMatch)] });
    return new Response("not found", { status: 404 });
  }, async () => {
    await syncTeamMatches(db, "key", ourId, "full", [match], [second]);
    assert(matches.size === 2, "Legacy and newly added championship matches must both be imported");
    assert(calls.filter((path) => path.endsWith(`/championships/${first}/matches`)).length === 2, "Legacy championship was not searched");
  });
});

Deno.test("finished match archives, while unavailable final stats never create a record", async () => {
  const { db, matches } = mockDb();
  let available = false;
  const originalError = console.error;
  console.error = () => {};
  try {
    await withFetch((url) => {
      if (url.pathname.endsWith("/stats")) {
        return available ? Response.json({ rounds: [{ round_stats: { Map: "de_mirage" }, teams: [
          { team_id: ourId, team_stats: { "Final Score": "13" } },
          { team_id: "opponent", team_stats: { "Final Score": "8" } },
        ] }] }) : new Response("not found", { status: 404 });
      }
      return Response.json(details(match, ourId, "FINISHED"));
    }, async () => {
      await rejects(() => addFaceitSource(db, "key", ourId, "match", match), "не нашёл");
      assert(!matches.has(match), "Unpublished results must not create an incomplete match");
      available = true;
      await addFaceitSource(db, "key", ourId, "match", match);
      const row = matches.get(match);
      assert(row?.is_archived === true && row.team_score === 13 && row.opponent_score === 8, "Finished match was not correctly archived");
    });
  } finally { console.error = originalError; }
});
