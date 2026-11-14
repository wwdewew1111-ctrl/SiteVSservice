
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { faceitGet, type Json } from "./faceit.ts";

type Phase = "upcoming" | "live" | "finished";
type MatchFormat = "bo1" | "bo3" | "bo5";
export type SyncMode = "full" | "live";

interface MapResult {
  map: string;
  ours: number;
  theirs: number;
  inProgress: boolean;
}

function phaseFromStatus(status: string): Phase | null {
  const normalized = status.toUpperCase();
  if (normalized === "FINISHED") return "finished";
  if (normalized === "ONGOING" || normalized === "LIVE") return "live";
  if (normalized === "CANCELLED" || normalized === "ABORTED") return null;
  return "upcoming";
}

function formatForMapCount(count: number): MatchFormat {
  if (count <= 1) return "bo1";
  return count <= 3 ? "bo3" : "bo5";
}

async function fetchMaps(matchId: string, teamId: string, apiKey: string): Promise<MapResult[]> {
  const stats = await faceitGet(`/matches/${encodeURIComponent(matchId)}/stats`, apiKey);
  const rounds = (Array.isArray(stats.rounds) ? stats.rounds : []) as Json[];
  const maps: MapResult[] = [];
  for (const round of rounds) {
    const teams = (Array.isArray(round.teams) ? round.teams : []) as Json[];
    const ours = teams.find((team) => team.team_id === teamId);
    const opponent = teams.find((team) => team.team_id !== teamId);
    if (!ours || !opponent) continue;
    const ourValue = ours.team_stats?.["Final Score"];
    const opponentValue = opponent.team_stats?.["Final Score"];
    if ((typeof ourValue !== "string" && typeof ourValue !== "number") ||
      (typeof opponentValue !== "string" && typeof opponentValue !== "number") ||
      String(ourValue).trim() === "" || String(opponentValue).trim() === "") continue;
    const ourScore = Number(ourValue);
    const opponentScore = Number(opponentValue);
    if (!Number.isSafeInteger(ourScore) || ourScore < 0 ||
      !Number.isSafeInteger(opponentScore) || opponentScore < 0) continue;
    maps.push({
      map: String(round.round_stats?.Map ?? "Карта"),
      ours: ourScore,
      theirs: opponentScore,
      inProgress: false,
    });
  }

  return maps;
}

async function refreshMatch(db: SupabaseClient, apiKey: string, teamId: string, matchId: string): Promise<void> {
  const details = await faceitGet(`/matches/${encodeURIComponent(matchId)}`, apiKey);
  const phase = phaseFromStatus(String(details.status ?? ""));
  if (!phase) return;

  const teams = (details.teams ?? {}) as Record<string, Json | undefined>;

  const factions = [teams.faction1, teams.faction2].filter((faction): faction is Json => Boolean(faction));
  const opponent = factions.find((faction) => faction.faction_id !== teamId);
  if (!opponent || !factions.some((faction) => faction.faction_id === teamId)) {
    console.error("FACEIT match does not include our team", { matchId });
    return;
  }

  let maps: MapResult[] = [];
  if (phase !== "upcoming") {
    try {
      maps = await fetchMaps(matchId, teamId, apiKey);
    } catch (error) {
      if (phase === "finished") throw error;
      console.error("FACEIT live stats unavailable", { matchId, error });
    }
  }
  if (phase === "finished" && maps.length === 0) {
    throw new Error(`Итоги матча ${matchId} ещё не опубликованы`);
  }

  const { data: existing, error: existingError } = await db.from("matches")
    .select("match_format, phase, maps, team_score, opponent_score")
    .eq("id", matchId).maybeSingle();
  if (existingError) throw existingError;
  const format: MatchFormat = phase === "finished" ? formatForMapCount(maps.length) : existing?.match_format ?? "bo1";
  const row: Record<string, unknown> = {
    id: matchId,
    tournament: String(details.competition_name ?? ""),
    opponent: String(opponent.name ?? ""),
    starts_at: typeof details.scheduled_at === "number" ? new Date(details.scheduled_at * 1000).toISOString() : null,
    phase,
    is_archived: phase === "finished",
  };
  if (phase === "upcoming") {
    Object.assign(row, { maps: [], team_score: null, opponent_score: null });
  } else if (maps.length > 0) {
    // The stats response does not identify whether its last map is currently being played.
    row.maps = maps;
    if (format === "bo1") {
      // FACEIT's stats endpoint does not indicate whether a map is still live.
      // Do not display a potentially stale completed map as the current round score.
      row.team_score = phase === "finished" ? maps[0].ours : null;
      row.opponent_score = phase === "finished" ? maps[0].theirs : null;
    } else {
      // Exclude the ambiguous last map until the series ends.
      const completed = phase === "live" ? maps.slice(0, -1) : maps;
      row.team_score = completed.length ? completed.filter((map) => map.ours > map.theirs).length : null;
      row.opponent_score = completed.length ? completed.filter((map) => map.theirs > map.ours).length : null;
    }
  } else if (existing?.phase === "live") {
    // Preserve completed maps if FACEIT temporarily omits statistics, but do not claim a stale live score.
    Object.assign(row, {
      maps: existing.maps,
      team_score: format === "bo1" ? null : existing.team_score,
      opponent_score: format === "bo1" ? null : existing.opponent_score,
    });
  } else {
    // Never turn an absent live score into 0:0 or carry over an upcoming match's stale score.
    Object.assign(row, { maps: [], team_score: null, opponent_score: null });
  }
  if (typeof opponent.avatar === "string" && opponent.avatar) row.opponent_logo = opponent.avatar;
  if (phase === "finished") row.match_format = formatForMapCount(maps.length);

  const { error } = await db.from("matches").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

const FACEIT_MATCH_ID_RE = /^1-[0-9a-f-]{36}$/i;
const CHAMPIONSHIP_PAGE_SIZE = 100;
const CHAMPIONSHIP_MAX_PAGES = 5;

async function trackedMatchIds(db: SupabaseClient, phases: Phase[]): Promise<string[]> {
  const { data, error } = await db.from("matches").select("id").in("phase", phases);
  if (error) throw error;
  return (data ?? []).map((row) => String(row.id));
}

async function championshipIdOf(matchId: string, apiKey: string): Promise<string | null> {
  const details = await faceitGet(`/matches/${encodeURIComponent(matchId)}`, apiKey);
  if (details.competition_type !== "championship" || typeof details.competition_id !== "string") return null;
  return details.competition_id;
}

async function championshipTeamMatchIds(
  championshipId: string,
  teamId: string,
  apiKey: string,
  type: "upcoming" | "ongoing",
): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 0; page < CHAMPIONSHIP_MAX_PAGES; page++) {
    const offset = page * CHAMPIONSHIP_PAGE_SIZE;
    const response = await faceitGet(
      `/championships/${encodeURIComponent(championshipId)}/matches?type=${type}&offset=${offset}&limit=${CHAMPIONSHIP_PAGE_SIZE}`,
      apiKey,
    );
    const items = (Array.isArray(response.items) ? response.items : []) as Json[];
    for (const item of items) {
      const teams = (item.teams ?? {}) as Record<string, Json | undefined>;
      const ourTeamPlays = [teams.faction1, teams.faction2].some((faction) => faction?.faction_id === teamId);
      if (ourTeamPlays && typeof item.match_id === "string") ids.push(item.match_id);
    }
    if (items.length < CHAMPIONSHIP_PAGE_SIZE) break;
  }
  return ids;
}

async function scheduledMatchIds(db: SupabaseClient, teamId: string, apiKey: string, anchorMatchIds: string[]): Promise<string[]> {
  const tracked = await trackedMatchIds(db, ["upcoming", "live"]);
  const anchor = anchorMatchIds.find((id) => FACEIT_MATCH_ID_RE.test(id));
  let discovered: string[] = [];
  try {
    const championshipId = anchor ? await championshipIdOf(anchor, apiKey) : null;
    if (championshipId) {
      const upcoming = await championshipTeamMatchIds(championshipId, teamId, apiKey, "upcoming");
      const ongoing = await championshipTeamMatchIds(championshipId, teamId, apiKey, "ongoing");
      discovered = [...upcoming, ...ongoing];
    }
  } catch (error) {
    console.error("FACEIT match discovery failed; refreshing tracked matches", { error });
  }
  return [...new Set([...tracked, ...discovered])];
}

export async function syncTeamMatches(
  db: SupabaseClient,
  apiKey: string,
  teamId: string,
  mode: SyncMode,
  anchorMatchIds: string[] = [],
): Promise<void> {
  const ids = mode === "live" ? await trackedMatchIds(db, ["upcoming", "live"]) : await scheduledMatchIds(db, teamId, apiKey, anchorMatchIds);
  let failures = 0;
  for (const id of ids) {
    if (!FACEIT_MATCH_ID_RE.test(id)) continue;
    try {
      await refreshMatch(db, apiKey, teamId, id);
    } catch (error) {
      failures++;
      console.error("FACEIT match sync failed", { matchId: id, error });
    }
  }
  if (failures > 0) throw new Error(`FACEIT match sync failed for ${failures} match(es)`);
}
