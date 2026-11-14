import { createContext, useContext } from 'react';
import type { GalleryPhoto, Match, MerchMode, MerchProduct, NewsItem, Player, SiteData, SiteSettings } from '@/types';

export interface SiteActions {
  saveMatch: (match: Match) => Promise<boolean>;
  deleteMatch: (id: string) => Promise<boolean>;
  saveNews: (item: NewsItem) => Promise<boolean>;
  deleteNews: (id: string) => Promise<boolean>;
  savePlayer: (player: Player) => Promise<boolean>;
  deletePlayer: (id: string) => Promise<boolean>;
  addPhoto: (photo: GalleryPhoto) => Promise<boolean>;
  deletePhoto: (id: string) => Promise<boolean>;
  setMerchMode: (mode: MerchMode) => Promise<boolean>;
  saveProduct: (product: MerchProduct) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  saveSettings: (settings: SiteSettings) => Promise<boolean>;
  reorderMatches: (matches: Match[]) => Promise<boolean>;
  reorderNews: (news: NewsItem[]) => Promise<boolean>;
  reorderPlayers: (players: Player[]) => Promise<boolean>;
  reorderPhotos: (photos: GalleryPhoto[]) => Promise<boolean>;
  reorderProducts: (products: MerchProduct[]) => Promise<boolean>;
}

export type SiteSection = 'settings' | 'matches' | 'archive' | 'news' | 'players' | 'gallery' | 'merch';
export type SectionStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SiteContextValue {
  data: SiteData;
  saveError: string | null;
  actions: SiteActions;
  sectionStatus: Record<SiteSection, SectionStatus>;
  loadSection: (section: SiteSection) => Promise<void>;
}

export const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSite must be used inside SiteProvider');
  return value;
}
