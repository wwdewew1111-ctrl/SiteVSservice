import { callSiteFunction } from '@/lib/siteApi';
import { supabase } from '@/lib/supabase';
import { createId } from '@/lib/format';

export interface TeamStats {
  wins: number;
  losses: number;
  ffw: number;
  ffl: number;
  streak: string;
  roundDiff: number;
}

export interface PlayerStat {
  nickname: string;
  faceitNick: string;
  role: string;
  maps: number;
  kills: number;
  deaths: number;
  adr: number;
  hsPercent: number;
  rating: number;
}

export interface EseaSeason {
  id: string;
  name: string;
  seasonTag: string;
  startDate: string;
  eseaUrl: string;
  isArchived: boolean;
  teamStats: TeamStats;
  players: PlayerStat[];
}

export interface EseaConfig {
  teamId: string;
  autoSync: boolean;
  activeSeasonId: string;
  lastSync: number;
  extraMatchIds: string[];
}

export interface EseaState {
  seasons: EseaSeason[];
  config: EseaConfig;
}

export interface EseaSyncResult {
  seasons: EseaSeason[];
  lastSync: number;
  matchesFound: number;
  newSeasonDetected: boolean;
}

export const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;

export const FACEIT_PLAYER_LINKS: Record<string, string> = {
  BABAKLAWA: 'https://www.faceit.com/ru/players/babaKlawa',
  PINWUD: 'https://www.faceit.com/ru/players/-420vs',
  RAMACCOTI: 'https://www.faceit.com/ru/players/ramaccoti',
  '12-TANGO': 'https://www.faceit.com/ru/players/12-tango',
  GREKXEJEZZZ: 'https://www.faceit.com/ru/players/grekxejezzz',
};

export function faceitNickFromLink(link: string): string {
  return decodeURIComponent(/\/players\/([^/?#]+)/.exec(link)?.[1] ?? link.trim());
}

const ROSTER_TEMPLATE: Pick<PlayerStat, 'nickname' | 'faceitNick' | 'role'>[] = [
  { nickname: 'BABAKLAWA', faceitNick: faceitNickFromLink(FACEIT_PLAYER_LINKS.BABAKLAWA), role: 'IGL' },
  { nickname: 'RAMACCOTI', faceitNick: faceitNickFromLink(FACEIT_PLAYER_LINKS.RAMACCOTI), role: 'RIFLER' },
  { nickname: 'PINWUD', faceitNick: faceitNickFromLink(FACEIT_PLAYER_LINKS.PINWUD), role: 'RIFLER' },
  { nickname: '12-TANGO', faceitNick: faceitNickFromLink(FACEIT_PLAYER_LINKS['12-TANGO']), role: 'RIFLER' },
  { nickname: 'GREKXEJEZZZ', faceitNick: faceitNickFromLink(FACEIT_PLAYER_LINKS.GREKXEJEZZZ), role: 'AWPER' },
];

const EMPTY_TEAM_STATS: TeamStats = { wins: 0, losses: 0, ffw: 0, ffl: 0, streak: '0', roundDiff: 0 };

function zeroedPlayers(): PlayerStat[] {
  return ROSTER_TEMPLATE.map((player) => ({ ...player, maps: 0, kills: 0, deaths: 0, adr: 0, hsPercent: 0, rating: 0 }));
}

export const DEFAULT_ESEA_STATE: EseaState = {
  seasons: [
    {
      id: 's59',
      name: 'S59 EU MAIN A - REGULAR SEASON',
      seasonTag: 'S59',
      startDate: '2026-09-01',
      eseaUrl: '',
      isArchived: false,
      teamStats: { wins: 8, losses: 4, ffw: 0, ffl: 0, streak: '3W', roundDiff: 24 },
      players: [
        { ...ROSTER_TEMPLATE[0], maps: 12, kills: 231, deaths: 198, adr: 71.3, hsPercent: 44.8, rating: 1.04 },
        { ...ROSTER_TEMPLATE[1], maps: 12, kills: 262, deaths: 221, adr: 79.6, hsPercent: 51.2, rating: 1.17 },
        { ...ROSTER_TEMPLATE[2], maps: 12, kills: 238, deaths: 225, adr: 73.1, hsPercent: 47.5, rating: 1.02 },
        { ...ROSTER_TEMPLATE[3], maps: 11, kills: 205, deaths: 203, adr: 68.9, hsPercent: 42.0, rating: 0.97 },
        { ...ROSTER_TEMPLATE[4], maps: 12, kills: 226, deaths: 214, adr: 75.4, hsPercent: 33.9, rating: 1.01 },
      ],
    },
  ],
  config: { teamId: '', autoSync: false, activeSeasonId: 's59', lastSync: 0, extraMatchIds: [] },
};

export function getActiveSeason(state: EseaState): EseaSeason | undefined {
  return state.seasons.find((season) => season.id === state.config.activeSeasonId);
}

export function winratePercent(stats: TeamStats): number {
  const total = stats.wins + stats.losses;
  return total === 0 ? 0 : Math.round((stats.wins / total) * 100);
}

export function playerKd(player: PlayerStat): number {
  return player.deaths === 0 ? player.kills : Number((player.kills / player.deaths).toFixed(2));
}

export function startNewSeason(
  state: EseaState,
  input: { name: string; seasonTag: string; startDate: string; eseaUrl: string },
): EseaState {
  const archived = state.seasons.map((season) =>
    season.id === state.config.activeSeasonId ? { ...season, isArchived: true } : season,
  );
  const season: EseaSeason = {
    id: createId(),
    ...input,
    isArchived: false,
    teamStats: { ...EMPTY_TEAM_STATS },
    players: zeroedPlayers(),
  };
  return {
    seasons: [...archived, season],
    config: { ...state.config, activeSeasonId: season.id, lastSync: 0 },
  };
}

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseTeamId(input: string): string {
  return GUID_RE.exec(input)?.[0].toLowerCase() ?? '';
}

export function parseMatchId(input: string): string | null {
  const trimmed = input.trim();
  const roomMatch = /\/room\/([\w-]+)/.exec(trimmed);
  if (roomMatch) return roomMatch[1];
  return /^1-[0-9a-f-]{36}$/i.test(trimmed) ? trimmed : null;
}

export async function fetchEseaState(): Promise<EseaState> {
  if (!supabase) throw new Error('Не настроено подключение к базе данных сайта');
  const { data, error } = await supabase.from('esea_state').select('key, value');
  if (error) throw new Error('Не удалось загрузить статистику ESEA');
  const seasons = data?.find((row) => row.key === 'seasons')?.value;
  const config = data?.find((row) => row.key === 'config')?.value;
  if (!Array.isArray(seasons) || seasons.length === 0 || !config || typeof config !== 'object') {
    return DEFAULT_ESEA_STATE;
  }
  return { seasons: seasons as EseaSeason[], config: { ...DEFAULT_ESEA_STATE.config, ...(config as Partial<EseaConfig>) } };
}

export async function saveEsea(token: string, state: EseaState, apiKey?: string): Promise<void> {
  await callSiteFunction<{ ok: true }>({ action: 'esea_save', token, seasons: state.seasons, config: state.config, apiKey });
}

export async function syncEsea(token: string): Promise<EseaSyncResult> {
  const result = await callSiteFunction<EseaSyncResult & { ok: true }>({ action: 'esea_sync', token });
  if (!Array.isArray(result.seasons)) throw new Error('Сервер вернул неожиданный ответ при синхронизации');
  return result;
}
