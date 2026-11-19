import { syncTeamMatches } from "./matchSync.ts";

const matchId = "1-2b607119-bc88-4a28-9035-bd2562a68822";
const ourId = "our-team";
const opponentId = "opponent-team";

type Score = { faction1?: unknown; faction2?: unknown } | null;

async function syncMatch(options: {
  phase?: string;
  format?: string;
  ourFaction?: 1 | 2;
  score?: Score;
  maps?: unknown[];
  existingPhase?: string;
  existingScore?: number;
}) {
  const ourFaction = options.ourFaction ?? 2;
  const details = {
    status: options.phase ?? "ONGOING",
    teams: {
      faction1: { faction_id: ourFaction === 1 ? ourId : opponentId, name: "First" },
      faction2: { faction_id: ourFaction === 2 ? ourId : opponentId, name: "Second" },
    },
    results: options.score === null ? null : { score: options.score ?? { faction1: 2, faction2: 3 } },
  };
  let saved: Record<string, unknown> | undefined;
  const existing = {
    match_format: options.format ?? "bo1",
    phase: options.existingPhase ?? "upcoming",
    maps: [],
    team_score: options.existingScore ?? null,
    opponent_score: options.existingScore ?? null,
  };
  const db = {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [{ id: matchId }], error: null }),
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => {
        saved = row;
        return Promise.resolve({ error: null });
      },
    }),
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/stats")) {
      return options.maps
        ? Response.json({ rounds: options.maps })
        : new Response("not found", { status: 404 });
    }
    return Response.json(details);
  };
  try {
    await syncTeamMatches(db as never, "test-key", ourId, "live");
  } finally {
    globalThis.fetch = previousFetch;
  }
  if (!saved) throw new Error("Expected match to be saved");
  return saved;
}

function assertScores(row: Record<string, unknown>, ours: unknown, theirs: unknown) {
  if (row.team_score !== ours || row.opponent_score !== theirs) {
    throw new Error(`Expected ${ours}:${theirs}, got ${row.team_score}:${row.opponent_score}`);
  }
}

Deno.test("live BO1 maps FACEIT factions to our team, including zero", async () => {
  assertScores(await syncMatch({}), 3, 2);
  assertScores(await syncMatch({ ourFaction: 1, score: { faction1: 0, faction2: 4 } }), 0, 4);
});

Deno.test("missing or invalid live scores never preserve a stale BO1 score", async () => {
  for (const score of [null, {}, { faction1: 3 }, { faction1: -1, faction2: 2 }, { faction1: "3", faction2: 2 }]) {
    assertScores(await syncMatch({ score, existingPhase: "live", existingScore: 9 }), null, null);
  }
});

Deno.test("BO3 does not use round score as series score", async () => {
  assertScores(await syncMatch({ format: "bo3" }), null, null);
});

Deno.test("finished BO1 uses final map stats instead of live result", async () => {
  const row = await syncMatch({
    phase: "FINISHED",
    score: { faction1: 2, faction2: 3 },
    maps: [{
      round_stats: { Map: "de_mirage" },
      teams: [
        { team_id: ourId, team_stats: { "Final Score": "13" } },
        { team_id: opponentId, team_stats: { "Final Score": "8" } },
      ],
    }],
  });
  assertScores(row, 13, 8);
  if (row.phase !== "finished" || row.is_archived !== true) throw new Error("Expected archived finished match");
});
