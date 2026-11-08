import { createClient } from "npm:@supabase/supabase-js@2";
import { faceitGet, parseTeamGuid, RequestError, type Json } from "./faceit.ts";
import { syncTeamMatches } from "./matchSync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WRITABLE_TABLES = new Set([
  "matches",
  "news",
  "players",
  "gallery_photos",
  "merch_products",
  "merch_settings",
  "site_settings",
]);

const REORDERABLE_TABLES = new Set([
  "matches",
  "news",
  "players",
  "gallery_photos",
  "merch_products",
]);

const SESSION_HOURS = 12;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length < 20) {
    throw new RequestError("Сессия входа истекла. Войдите в админку снова.", 401);
  }
  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new RequestError("Сессия входа истекла. Войдите в админку снова.", 401);
}

async function login(password: unknown): Promise<Response> {
  if (typeof password !== "string" || password.length === 0) {
    throw new RequestError("Введите пароль", 400);
  }
  const { data, error } = await supabase
    .from("admin_config")
    .select("value")
    .eq("key", "admin_password_sha256")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new RequestError("Вход временно недоступен", 500);

  if ((await sha256Hex(password)) !== data.value) {
    throw new RequestError("Неверный пароль. Попробуйте ещё раз.", 401);
  }

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase
    .from("admin_sessions")
    .insert({ token_hash: await sha256Hex(token), expires_at: expiresAt });
  if (insertError) throw insertError;

  await supabase.from("admin_sessions").delete().lt("expires_at", new Date().toISOString());
  return json({ ok: true, token });
}

async function logout(token: unknown): Promise<Response> {
  if (typeof token === "string" && token.length >= 20) {
    await supabase.from("admin_sessions").delete().eq("token_hash", await sha256Hex(token));
  }
  return json({ ok: true });
}

async function upsertRow(table: unknown, row: unknown): Promise<Response> {
  if (typeof table !== "string" || !WRITABLE_TABLES.has(table)) {
    throw new RequestError("Неизвестный раздел сайта", 400);
  }
  if (!row || typeof row !== "object" || typeof (row as { id?: unknown }).id !== "string") {
    throw new RequestError("Некорректные данные", 400);
  }
  const { error } = await supabase.from(table).upsert(row, { onConflict: "id" });
  if (error) throw error;
  return json({ ok: true });
}

async function deleteRow(table: unknown, id: unknown): Promise<Response> {
  if (typeof table !== "string" || !WRITABLE_TABLES.has(table)) {
    throw new RequestError("Неизвестный раздел сайта", 400);
  }
  if (typeof id !== "string" || id.length === 0) {
    throw new RequestError("Некорректные данные", 400);
  }
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  return json({ ok: true });
}

async function reorderRows(table: unknown, ids: unknown): Promise<Response> {
  if (typeof table !== "string" || !REORDERABLE_TABLES.has(table)) {
    throw new RequestError("Неизвестный раздел сайта", 400);
  }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new RequestError("Некорректные данные", 400);
  }
  const results = await Promise.all(
    ids.map((id, index) => supabase.from(table).update({ position: index + 1 }).eq("id", id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return json({ ok: true });
}

const FACEIT_KEY_NAME = "faceit_api_key";
const CRON_SECRET_KEY = "cron_secret";
const ESEA_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const LIVE_REFRESH_DELAY_MS = 30 * 1000;
// HLTV 1.0 baseline kills-per-round; rating = KPR / baseline
const RATING_KPR_BASELINE = 0.679;

const FACEIT_PLAYER_MAP: { local: string; url: string }[] = [
  { local: "Babaklawa", url: "https://www.faceit.com/ru/players/babaKlawa" },
  { local: "Pinwud", url: "https://www.faceit.com/ru/players/-420vs" },
  { local: "ramaccoti", url: "https://www.faceit.com/ru/players/ramaccoti" },
  { local: "12-tango", url: "https://www.faceit.com/ru/players/12-tango" },
  { local: "grekxejezzz", url: "https://www.faceit.com/ru/players/grekxejezzz" },
];

function faceitNickFromUrl(url: string): string {
  return decodeURIComponent(/\/players\/([^/?#]+)/.exec(url)?.[1] ?? url);
}

function mappedFaceitNick(localNick: string): string | null {
  const entry = FACEIT_PLAYER_MAP.find((item) => item.local.toLowerCase() === localNick.toLowerCase());
  return entry ? faceitNickFromUrl(entry.url) : null;
}

async function resolvePlayerIds(nicks: string[], apiKey: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const nick of nicks) {
    try {
      const player = await faceitGet(`/players?nickname=${encodeURIComponent(nick)}`, apiKey);
      if (typeof player.player_id === "string") ids.set(nick.toLowerCase(), player.player_id);
    } catch (error) {
      console.error(`FACEIT player lookup failed for ${nick}`, error);
    }
  }
  return ids;
}

async function readEseaState(key: string): Promise<unknown> {
  const { data, error } = await supabase.from("esea_state").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function writeEseaState(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from("esea_state")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

async function saveEsea(body: Json): Promise<Response> {
  if (!Array.isArray(body.seasons) || body.seasons.some((season: Json) => typeof season?.id !== "string")) {
    throw new RequestError("Некорректные данные сезонов", 400);
  }
  const config = (body.config ?? {}) as Json;
  await writeEseaState("seasons", body.seasons);
  await writeEseaState("config", {
    teamId: parseTeamGuid(config.teamId),
    autoSync: config.autoSync === true,
    activeSeasonId: typeof config.activeSeasonId === "string" ? config.activeSeasonId : "",
    lastSync: typeof config.lastSync === "number" ? config.lastSync : 0,
    extraMatchIds: Array.isArray(config.extraMatchIds)
      ? config.extraMatchIds.filter((id: unknown) => typeof id === "string" && /^[\w-]{3,64}$/.test(id)).slice(0, 50)
      : [],
  });
  if (typeof body.apiKey === "string" && body.apiKey.trim().length > 0) {
    const { error } = await supabase
      .from("esea_secrets")
      .upsert({ key: FACEIT_KEY_NAME, value: body.apiKey.trim() }, { onConflict: "key" });
    if (error) throw error;
  }
  return json({ ok: true });
}

async function fetchTeamMatches(teamId: string, playerIds: string[], apiKey: string): Promise<Json[]> {
  const matches = new Map<string, Json>();
  for (const playerId of playerIds) {
    const history = await faceitGet(`/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=100`, apiKey);
    const items = (Array.isArray(history.items) ? history.items : []) as Json[];
    for (const item of items) {
      const isOurs = Object.values(item.teams ?? {}).some((faction) => (faction as Json)?.team_id === teamId);
      if (isOurs && typeof item.match_id === "string") matches.set(item.match_id, item);
    }
  }
  return [...matches.values()];
}

function seasonNumber(text: string): number | null {
  const match = /(?:^|[^A-Za-z0-9])S(\d+)(?![A-Za-z0-9])/i.exec(text);
  return match ? Number(match[1]) : null;
}

function hasSeasonTag(competition: string, tag: string): boolean {
  return competition.toUpperCase().split(/[^A-Z0-9]+/).includes(tag.toUpperCase());
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

async function syncEsea(): Promise<Response> {
  const { data: secret, error: secretError } = await supabase
    .from("esea_secrets")
    .select("value")
    .eq("key", FACEIT_KEY_NAME)
    .maybeSingle();
  if (secretError) throw secretError;
  const apiKey = String(secret?.value ?? "").trim();
  const config = ((await readEseaState("config")) ?? {}) as Json;
  const seasons = ((await readEseaState("seasons")) ?? []) as Json[];
  const season = seasons.find((item) => item.id === config.activeSeasonId);
  const teamId = parseTeamGuid(config.teamId, season?.eseaUrl);
  const missing = [!apiKey && "ключ FACEIT", !teamId && "ID команды", !season && "активный сезон"].filter(Boolean);
  if (missing.length > 0) {
    console.error("esea_sync precondition failed", { missing, rawTeamId: config.teamId });
    throw new RequestError(`Не хватает данных для синхронизации: ${missing.join(", ")}.`, 400);
  }
  if (apiKey.toLowerCase() === teamId) {
    throw new RequestError("В поле ключа API сохранён ID команды. Вставьте настоящий ключ FACEIT.", 400);
  }

  const rosterNicks = ((season.players ?? []) as Json[]).map(
    (player) => mappedFaceitNick(String(player.nickname ?? "")) ?? String(player.faceitNick ?? ""),
  );
  const playerIds = await resolvePlayerIds(rosterNicks.filter(Boolean), apiKey);
  const idToNick = new Map([...playerIds].map(([nick, id]) => [id, nick]));
  const items = await fetchTeamMatches(teamId, [...playerIds.values()], apiKey);
  const extraIds = (Array.isArray(config.extraMatchIds) ? config.extraMatchIds : []).filter(
    (id: unknown): id is string => typeof id === "string" && id !== apiKey && id.toLowerCase() !== teamId,
  );
  const extraItems: Json[] = [];
  for (const id of extraIds) {
    const details = await faceitGet(`/matches/${encodeURIComponent(id)}`, apiKey);
    extraItems.push({ ...details, match_id: id, manual: true });
  }
  const candidates = [...items, ...extraItems.filter((extra) => !items.some((item) => item.match_id === extra.match_id))];
  const activeNumber = seasonNumber(String(season.seasonTag ?? ""));
  const newSeasonDetected =
    activeNumber !== null &&
    items.some((item) => {
      const number = seasonNumber(String(item.competition_name ?? ""));
      return number !== null && number > activeNumber;
    });

  const startMs = Date.parse(`${String(season.startDate ?? "")}T00:00:00Z`) || 0;
  const seasonMatches = candidates
    .filter(
      (item) =>
        item.manual === true ||
        (Number(item.finished_at ?? 0) * 1000 >= startMs &&
          hasSeasonTag(String(item.competition_name ?? ""), String(season.seasonTag ?? ""))),
    )
    .sort((a, b) => Number(a.finished_at ?? 0) - Number(b.finished_at ?? 0));

  let wins = 0;
  let losses = 0;
  let roundDiff = 0;
  const results: string[] = [];
  const playerTotals = new Map<string, { maps: number; kills: number; deaths: number; rounds: number; adr: number; hs: number }>();

  for (const match of seasonMatches) {
    const stats = await faceitGet(`/matches/${String(match.match_id)}/stats`, apiKey);
    const rounds = (Array.isArray(stats.rounds) ? stats.rounds : []) as Json[];
    let ourMaps = 0;
    let oppMaps = 0;

    for (const round of rounds) {
      const teams = (Array.isArray(round.teams) ? round.teams : []) as Json[];
      const ours = teams.find((team) => team.team_id === teamId);
      const opp = teams.find((team) => team.team_id !== teamId);
      if (!ours || !opp) continue;

      const ourScore = Number(ours.team_stats?.["Final Score"] ?? 0);
      const oppScore = Number(opp.team_stats?.["Final Score"] ?? 0);
      roundDiff += ourScore - oppScore;
      if (ourScore > oppScore) ourMaps++;
      if (oppScore > ourScore) oppMaps++;

      for (const player of (Array.isArray(ours.players) ? ours.players : []) as Json[]) {
        const key = idToNick.get(String(player.player_id ?? "")) ?? String(player.nickname ?? "").toLowerCase();
        const playerStats = (player.player_stats ?? {}) as Json;
        const total = playerTotals.get(key) ?? { maps: 0, kills: 0, deaths: 0, rounds: 0, adr: 0, hs: 0 };
        total.maps += 1;
        total.kills += Number(playerStats.Kills ?? 0);
        total.deaths += Number(playerStats.Deaths ?? 0);
        total.rounds += Number(playerStats.Rounds ?? ourScore + oppScore);
        total.adr += Number(playerStats.ADR ?? 0);
        total.hs += Number(playerStats["Headshots %"] ?? 0);
        playerTotals.set(key, total);
      }
    }

    if (ourMaps > oppMaps) {
      wins++;
      results.push("W");
    } else if (oppMaps > ourMaps) {
      losses++;
      results.push("L");
    }
  }

  let streak = "0";
  if (results.length > 0) {
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++;
    streak = `${count}${last}`;
  }

  const players = ((season.players ?? []) as Json[]).map((player, index) => {
    const faceitNick = rosterNicks[index];
    const total = playerTotals.get(faceitNick.toLowerCase());
    if (!total || total.maps === 0) {
      return { ...player, faceitNick, maps: 0, kills: 0, deaths: 0, adr: 0, hsPercent: 0, rating: 0 };
    }
    const kpr = total.rounds > 0 ? total.kills / total.rounds : 0;
    return {
      ...player,
      faceitNick,
      maps: total.maps,
      kills: total.kills,
      deaths: total.deaths,
      adr: round1(total.adr / total.maps),
      hsPercent: round1(total.hs / total.maps),
      rating: Number((kpr / RATING_KPR_BASELINE).toFixed(2)),
    };
  });

  const updatedSeasons = seasons.map((item) =>
    item.id === season.id
      ? {
          ...item,
          teamStats: {
            wins,
            losses,
            ffw: Number(item.teamStats?.ffw ?? 0),
            ffl: Number(item.teamStats?.ffl ?? 0),
            streak,
            roundDiff,
          },
          players,
        }
      : item,
  );
  const lastSync = Date.now();
  await writeEseaState("seasons", updatedSeasons);
  await writeEseaState("config", { ...config, teamId, extraMatchIds: extraIds, lastSync });

  return json({
    ok: true,
    seasons: updatedSeasons,
    lastSync,
    matchesFound: seasonMatches.length,
    newSeasonDetected,
  });
}

async function readSecret(key: string): Promise<string> {
  const { data, error } = await supabase.from("esea_secrets").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return String(data?.value ?? "").trim();
}

async function serviceFaceit(body: Record<string, unknown>): Promise<Response> {
  const matchId = typeof body.matchId === "string" && /^1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.matchId) ? body.matchId : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  let path: string;
  if ((body.resource === "match" || body.resource === "stats") && matchId) {
    path = `/matches/${encodeURIComponent(matchId)}${body.resource === "stats" ? "/stats" : ""}`;
  } else if (body.resource === "player" && nickname.length > 0 && nickname.length <= 100) {
    path = `/players?nickname=${encodeURIComponent(nickname)}`;
  } else {
    throw new RequestError("Некорректный запрос к FACEIT.", 400);
  }
  const apiKey = await readSecret(FACEIT_KEY_NAME);
  if (!apiKey) throw new RequestError("Сначала сохраните ключ FACEIT в разделе «Статистика ESEA».", 400);
  return json({ ok: true, data: await faceitGet(path, apiKey) });
}

async function runStep(label: string, task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error(`${label} failed`, error);
  }
}

async function runSyncTick(): Promise<void> {
  try {
    const apiKey = await readSecret(FACEIT_KEY_NAME);
    const config = ((await readEseaState("config")) ?? {}) as Json;
    const teamId = parseTeamGuid(config.teamId);
    if (!apiKey || !teamId) return;

    const anchorMatchIds = Array.isArray(config.extraMatchIds) ? config.extraMatchIds.map(String) : [];
    await runStep("Синхронизация матчей", () => syncTeamMatches(supabase, apiKey, teamId, "full", anchorMatchIds));
    const lastSync = Number(config.lastSync ?? 0);
    if (config.autoSync === true && Date.now() - lastSync > ESEA_SYNC_INTERVAL_MS) {
      await runStep("Автообновление статистики ESEA", () => syncEsea());
    }
    await new Promise((resolve) => setTimeout(resolve, LIVE_REFRESH_DELAY_MS));
    await runStep("Обновление live-матчей", () => syncTeamMatches(supabase, apiKey, teamId, "live"));
  } catch (error) {
    console.error("Sync tick failed", error);
  }
}

async function cronTick(req: Request): Promise<Response> {
  const expected = await readSecret(CRON_SECRET_KEY);
  if (expected.length < 20 || req.headers.get("x-cron-secret") !== expected) {
    throw new RequestError("Доступ запрещён", 403);
  }
  EdgeRuntime.waitUntil(runSyncTick());
  return json({ ok: true, started: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") throw new RequestError("Метод не поддерживается", 405);
    const body = (await req.json()) as Record<string, unknown>;

    switch (body.action) {
      case "login":
        return await login(body.password);
      case "logout":
        return await logout(body.token);
      case "upsert":
        await requireAdmin(body.token);
        return await upsertRow(body.table, body.row);
      case "delete":
        await requireAdmin(body.token);
        return await deleteRow(body.table, body.id);
      case "reorder":
        await requireAdmin(body.token);
        return await reorderRows(body.table, body.ids);
      case "cron_tick":
        return await cronTick(req);
      case "service_faceit":
        await requireAdmin(body.token);
        return await serviceFaceit(body);
      case "esea_save":
        await requireAdmin(body.token);
        return await saveEsea(body);
      case "esea_sync":
        await requireAdmin(body.token);
        return await syncEsea();
      default:
        throw new RequestError("Неизвестное действие", 400);
    }
  } catch (err) {
    if (err instanceof RequestError) {
      return json({ error: err.message }, err.status);
    }
    console.error(err);
    return json({ error: "Что-то пошло не так на сервере. Попробуйте ещё раз." }, 500);
  }
});
