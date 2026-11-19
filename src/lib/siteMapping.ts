import type { GalleryPhoto, Match, MatchFormat, MatchMap, MatchPhase, MerchProduct, NewsItem, Partner, Player, SiteData, SiteSettings, SocialLinks } from '@/types';
import { normalizeTeamName } from '@/lib/brand';

export interface MatchRow {
  id: string;
  tournament: string;
  opponent: string;
  tournament_logo: string;
  opponent_logo: string;
  team_logo: string;
  starts_at: string | null;
  stream_url: string;
  match_format: MatchFormat;
  team_score: number | null;
  opponent_score: number | null;
  is_archived: boolean;
  phase: MatchPhase;
  maps: MatchMap[];
}

export interface NewsRow {
  id: string;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
  content: string;
  cover: string;
}

export interface PlayerRow {
  id: string;
  nickname: string;
  name: string;
  role: string;
  photo: string;
  is_coach: boolean;
}

export interface GalleryRow {
  id: string;
  src: string;
  caption: string;
}

export interface ProductRow {
  id: string;
  title: string;
  price: string;
  image: string;
  url: string;
}

export interface SettingsRow {
  id: 'main';
  hero_title: string;
  hero_subtitle: string;
  hero_image: string;
  socials: SocialLinks;
  partners: Partner[];
}

export interface MerchModeRow {
  id: 'main';
  mode: SiteData['merch']['mode'];
}

export const matchToRow = (match: Match): Omit<MatchRow, 'phase' | 'maps'> => ({
  id: match.id,
  tournament: match.tournament,
  opponent: match.opponent,
  tournament_logo: match.tournamentLogo,
  opponent_logo: match.opponentLogo,
  team_logo: match.teamLogo,
  starts_at: match.startsAt || null,
  stream_url: match.streamUrl,
  match_format: match.format,
  team_score: match.teamScore,
  opponent_score: match.opponentScore,
  is_archived: match.isArchived,
});

export const matchFromRow = (row: MatchRow): Match => ({
  id: row.id,
  tournament: row.tournament,
  opponent: row.opponent,
  tournamentLogo: row.tournament_logo,
  opponentLogo: row.opponent_logo,
  teamLogo: row.team_logo,
  startsAt: row.starts_at ?? '',
  streamUrl: row.stream_url,
  format: row.match_format,
  teamScore: row.team_score,
  opponentScore: row.opponent_score,
  isArchived: row.is_archived,
  phase: row.phase,
  maps: row.maps,
});

export const newsToRow = (item: NewsItem): NewsRow => ({ ...item });

export const newsFromRow = (row: NewsRow): NewsItem => ({
  ...row,
  title: normalizeTeamName(row.title),
  tag: normalizeTeamName(row.tag),
  excerpt: normalizeTeamName(row.excerpt),
  content: normalizeTeamName(row.content),
});

export const playerToRow = (player: Player): PlayerRow => ({
  id: player.id,
  nickname: player.nickname,
  name: player.name,
  role: player.role,
  photo: player.photo,
  is_coach: player.isCoach,
});

export const playerFromRow = (row: PlayerRow): Player => ({
  id: row.id,
  nickname: row.nickname,
  name: row.name,
  role: row.role,
  photo: row.photo,
  isCoach: row.is_coach,
});

export const photoToRow = (photo: GalleryPhoto): GalleryRow => ({ ...photo });

export const photoFromRow = (row: GalleryRow): GalleryPhoto => ({ ...row, caption: normalizeTeamName(row.caption) });

export const productToRow = (product: MerchProduct): ProductRow => ({ ...product });

export const productFromRow = (row: ProductRow): MerchProduct => ({ ...row, title: normalizeTeamName(row.title) });

export const settingsToRow = (settings: SiteSettings): SettingsRow => ({
  id: 'main',
  hero_title: settings.heroTitle,
  hero_subtitle: settings.heroSubtitle,
  hero_image: settings.heroImage,
  socials: settings.socials,
  partners: settings.partners,
});

export const settingsFromRow = (row: SettingsRow): SiteSettings => ({
  heroTitle: normalizeTeamName(row.hero_title),
  heroSubtitle: normalizeTeamName(row.hero_subtitle),
  heroImage: row.hero_image,
  socials: row.socials,
  partners: row.partners,
});
