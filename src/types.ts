export type ThemeMode = 'dark' | 'light';

export type SocialKey = 'twitch' | 'telegram' | 'vk';

export type SocialLinks = Partial<Record<SocialKey, string>>;

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  tag: string;
  excerpt: string;
  content: string;
  cover: string;
}

export interface Player {
  id: string;
  nickname: string;
  name: string;
  surname: string;
  role: string;
  bio: string;
  quote: string;
  photo: string;
  faceitProfile: string;
  isCoach: boolean;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  caption: string;
}

export interface MerchProduct {
  id: string;
  title: string;
  price: string;
  image: string;
  url: string;
}

export type MatchFormat = 'bo1' | 'bo3' | 'bo5';

export type MatchPhase = 'upcoming' | 'live' | 'finished';

export interface MatchMap {
  map: string;
  ours: number;
  theirs: number;
  inProgress: boolean;
}

export interface Match {
  id: string;
  phase: MatchPhase;
  maps: MatchMap[];
  tournament: string;
  opponent: string;
  tournamentLogo: string;
  opponentLogo: string;
  teamLogo: string;
  startsAt: string;
  streamUrl: string;
  format: MatchFormat;
  teamScore: number | null;
  opponentScore: number | null;
  isArchived: boolean;
}

export type MerchMode = 'shop' | 'comingSoon';

export interface MerchState {
  mode: MerchMode;
  products: MerchProduct[];
}

export interface Partner {
  id: string;
  name: string;
  logo: string;
  url: string;
}

export interface SiteSettings {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  socials: SocialLinks;
  partners: Partner[];
}

export interface SiteData {
  matches: Match[];
  news: NewsItem[];
  players: Player[];
  gallery: GalleryPhoto[];
  merch: MerchState;
  settings: SiteSettings;
}
