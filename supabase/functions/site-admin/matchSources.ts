import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { faceitGet, RequestError } from "./faceit.ts";
import { CHAMPIONSHIP_ID_RE, FACEIT_MATCH_ID_RE, championshipTeamMatchIds, refreshMatch } from "./matchSync.ts";

export interface FaceitSource {
  id: string;
  name: string;
}

const SOURCES_KEY = "match_championships";
const MAX_SOURCES = 20;

function parseReference(input: unknown): { matchId: string; championshipId: string } {
  if (typeof input !== "string" || input.trim().length > 500) throw new RequestError("Укажите ссылку или ID FACEIT.", 400);
  const value = input.trim();
  if (FACEIT_MATCH_ID_RE.test(value)) return { matchId: value.toLowerCase(), championshipId: "" };
  if (CHAMPIONSHIP_ID_RE.test(value)) return { matchId: "", championshipId: value.toLowerCase() };
  let url: URL;
  try { url = new URL(value); } catch { throw new RequestError("Укажите корректную ссылку FACEIT или ID.", 400); }
  if (url.protocol !== "https:" || !["faceit.com", "www.faceit.com"].includes(url.hostname.toLowerCase())) {
    throw new RequestError("Укажите ссылку на faceit.com.", 400);
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const room = parts.findIndex((part) => part.toLowerCase() === "room");
  if (room >= 0 && FACEIT_MATCH_ID_RE.test(parts[room + 1] ?? "")) {
    return { matchId: parts[room + 1].toLowerCase(), championshipId: "" };
  }
  const championship = parts.findIndex((part) => ["championship", "championships"].includes(part.toLowerCase()));
  if (championship >= 0 && CHAMPIONSHIP_ID_RE.test(parts[championship + 1] ?? "")) {
    return { matchId: "", championshipId: parts[championship + 1].toLowerCase() };
  }
  throw new RequestError("Не найден ID. Для турнира используйте ссылку с ID турнира или ссылку на его матч.", 400);
}

export async function readFaceitSources(db: SupabaseClient): Promise<FaceitSource[]> {
  const { data, error } = await db.from("esea_state").select("value").eq("key", SOURCES_KEY).maybeSingle();
  if (error) throw error;
  if (!Array.isArray(data?.value)) return [];
  return data.value.filter((item: unknown): item is FaceitSource => {
    if (!item || typeof item !== "object") return false;
    const source = item as Record<string, unknown>;
    return typeof source.id === "string" && CHAMPIONSHIP_ID_RE.test(source.id) && typeof source.name === "string";
  });
}

async function writeSources(db: SupabaseClient, sources: FaceitSource[]): Promise<void> {
  const { error } = await db.from("esea_state").upsert({ key: SOURCES_KEY, value: sources, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export async function addFaceitSource(db: SupabaseClient, apiKey: string, teamId: string, kind: unknown, input: unknown): Promise<{ sources: FaceitSource[]; message: string }> {
  if (kind !== "championship" && kind !== "match") throw new RequestError("Выберите турнир или матч.", 400);
  const reference = parseReference(input);
  if (kind === "match") {
    if (!reference.matchId) throw new RequestError("Для отдельного матча укажите ссылку на комнату или ID матча.", 400);
    const sources = await readFaceitSources(db);
    await refreshMatch(db, apiKey, teamId, reference.matchId, true);
    return { sources, message: "Матч добавлен. Предстоящие и текущие матчи обновляются автоматически до завершения." };
  }

  let championshipId = reference.championshipId;
  if (reference.matchId) {
    const details = await faceitGet(`/matches/${encodeURIComponent(reference.matchId)}`, apiKey);
    const teams = details.teams as Record<string, { faction_id?: unknown }> | null;
    if (![teams?.faction1, teams?.faction2].some((team) => team?.faction_id === teamId)) {
      throw new RequestError("В матче FACEIT не найдена настроенная команда.", 400);
    }
    championshipId = details.competition_type === "championship" && typeof details.competition_id === "string"
      ? details.competition_id.toLowerCase() : "";
  }
  if (!CHAMPIONSHIP_ID_RE.test(championshipId)) throw new RequestError("Матч не относится к чемпионату FACEIT.", 400);
  const current = await readFaceitSources(db);
  if (current.some((source) => source.id.toLowerCase() === championshipId)) throw new RequestError("Этот турнир уже добавлен.", 400);
  if (current.length >= MAX_SOURCES) throw new RequestError(`Можно добавить не более ${MAX_SOURCES} турниров.`, 400);
  const details = await faceitGet(`/championships/${encodeURIComponent(championshipId)}`, apiKey);
  const name = typeof details.name === "string" && details.name.trim() ? details.name.trim() : championshipId;
  const sources = [...current, { id: championshipId, name }];
  await writeSources(db, sources);
  const ids: string[] = [];
  let errors = 0;
  for (const type of ["upcoming", "ongoing"] as const) {
    try { ids.push(...await championshipTeamMatchIds(championshipId, teamId, apiKey, type)); }
    catch (error) { errors++; console.error("FACEIT initial championship discovery failed", { championshipId, type, error }); }
  }
  let imported = 0;
  for (const id of new Set(ids)) {
    try { await refreshMatch(db, apiKey, teamId, id, true); imported++; }
    catch (error) { errors++; console.error("FACEIT initial match import failed", { id, error }); }
  }
  const note = errors ? " Некоторые данные пока недоступны — сервер повторит попытку." : "";
  return { sources, message: `Турнир добавлен. Загружено активных матчей: ${imported}.${note}` };
}

export async function removeFaceitSource(db: SupabaseClient, id: unknown): Promise<FaceitSource[]> {
  if (typeof id !== "string" || !CHAMPIONSHIP_ID_RE.test(id)) throw new RequestError("Некорректный ID турнира.", 400);
  const sources = (await readFaceitSources(db)).filter((source) => source.id.toLowerCase() !== id.toLowerCase());
  await writeSources(db, sources);
  return sources;
}
