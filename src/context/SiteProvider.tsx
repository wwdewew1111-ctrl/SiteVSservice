import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SiteContext, type SiteActions, type SiteContextValue } from './siteStore';
import { getAdminToken } from '@/lib/adminAuth';
import { ApiError, deleteRow, fetchSiteData, reorderRows, upsertRow } from '@/lib/siteApi';
import { supabase } from '@/lib/supabase';
import {
  matchFromRow,
  matchToRow,
  type MatchRow,
  newsToRow,
  photoToRow,
  playerToRow,
  productToRow,
  settingsToRow,
} from '@/lib/siteMapping';
import { SiteStatus } from '@/components/ui/SiteStatus';
import type { SiteData } from '@/types';

const FALLBACK_SITE_DATA: SiteData = {
  matches: [],
  news: [],
  players: [],
  gallery: [],
  merch: { mode: 'comingSoon', products: [] },
  settings: {
    heroTitle: 'KAB6ANbl ESPORTS',
    heroSubtitle: 'Киберспортивная команда по CS2',
    heroImage: '',
    socials: { vk: '', telegram: '', twitch: '' },
    partners: [],
  },
};

export function getFallbackSiteData(): SiteData {
  return FALLBACK_SITE_DATA;
}

const SESSION_EXPIRED = 'Сессия входа истекла. Выйдите из админки и войдите снова.';
const SAVE_FAILED = 'Не удалось сохранить изменения. Проверьте интернет и попробуйте ещё раз.';

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((x) => x.id === item.id)
    ? items.map((x) => (x.id === item.id ? item : x))
    : [...items, item];
}

function describeSaveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return SESSION_EXPIRED;
  if (error instanceof ApiError && error.status > 0 && error.status < 500) return error.message;
  return SAVE_FAILED;
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    fetchSiteData()
      .then((next) => {
        if (active) setData(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message.includes('Не настроено')) {
          setData(getFallbackSiteData());
          setLoadError('config');
        } else {
          setLoadError('data');
        }
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('public-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = String((payload.old as Partial<MatchRow>).id ?? '');
          if (id) setData((current) => (current ? { ...current, matches: current.matches.filter((m) => m.id !== id) } : current));
          return;
        }
        const row = payload.new as MatchRow;
        if (typeof row.id !== 'string') return;
        const match = matchFromRow(row);
        setData((current) => (current ? { ...current, matches: upsert(current.matches, match) } : current));
      })
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, []);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const actions = useMemo<SiteActions>(() => {
    const updateData = (change: (d: SiteData) => SiteData) =>
      setData((current) => (current ? change(current) : current));

    const persist = async (write: (token: string) => Promise<void>, apply: () => void): Promise<boolean> => {
      try {
        const token = getAdminToken();
        if (!token) throw new ApiError(SESSION_EXPIRED, 401);
        await write(token);
        apply();
        setSaveError(null);
        return true;
      } catch (error) {
        setSaveError(describeSaveError(error));
        return false;
      }
    };

    return {
      saveMatch: (match) =>
        persist(
          (token) => upsertRow(token, 'matches', matchToRow(match)),
          () => updateData((d) => ({ ...d, matches: upsert(d.matches, match) })),
        ),
      deleteMatch: (id) =>
        persist(
          (token) => deleteRow(token, 'matches', id),
          () => updateData((d) => ({ ...d, matches: d.matches.filter((m) => m.id !== id) })),
        ),
      saveNews: (item) =>
        persist(
          (token) => upsertRow(token, 'news', newsToRow(item)),
          () => updateData((d) => ({ ...d, news: upsert(d.news, item) })),
        ),
      deleteNews: (id) =>
        persist(
          (token) => deleteRow(token, 'news', id),
          () => updateData((d) => ({ ...d, news: d.news.filter((n) => n.id !== id) })),
        ),
      savePlayer: (player) =>
        persist(
          (token) => upsertRow(token, 'players', playerToRow(player)),
          () => updateData((d) => ({ ...d, players: upsert(d.players, player) })),
        ),
      deletePlayer: (id) =>
        persist(
          (token) => deleteRow(token, 'players', id),
          () => updateData((d) => ({ ...d, players: d.players.filter((p) => p.id !== id) })),
        ),
      addPhoto: (photo) =>
        persist(
          (token) => upsertRow(token, 'gallery_photos', photoToRow(photo)),
          () => updateData((d) => ({ ...d, gallery: [...d.gallery, photo] })),
        ),
      deletePhoto: (id) =>
        persist(
          (token) => deleteRow(token, 'gallery_photos', id),
          () => updateData((d) => ({ ...d, gallery: d.gallery.filter((p) => p.id !== id) })),
        ),
      setMerchMode: (mode) =>
        persist(
          (token) => upsertRow(token, 'merch_settings', { id: 'main', mode }),
          () => updateData((d) => ({ ...d, merch: { ...d.merch, mode } })),
        ),
      saveProduct: (product) =>
        persist(
          (token) => upsertRow(token, 'merch_products', productToRow(product)),
          () =>
            updateData((d) => ({
              ...d,
              merch: { ...d.merch, products: upsert(d.merch.products, product) },
            })),
        ),
      deleteProduct: (id) =>
        persist(
          (token) => deleteRow(token, 'merch_products', id),
          () =>
            updateData((d) => ({
              ...d,
              merch: { ...d.merch, products: d.merch.products.filter((p) => p.id !== id) },
            })),
        ),
      saveSettings: (settings) =>
        persist(
          (token) => upsertRow(token, 'site_settings', settingsToRow(settings)),
          () => updateData((d) => ({ ...d, settings })),
        ),
      reorderMatches: (matches) =>
        persist(
          (token) => reorderRows(token, 'matches', matches.map((m) => m.id)),
          () => updateData((d) => ({ ...d, matches })),
        ),
      reorderNews: (news) =>
        persist(
          (token) => reorderRows(token, 'news', news.map((n) => n.id)),
          () => updateData((d) => ({ ...d, news })),
        ),
      reorderPlayers: (players) =>
        persist(
          (token) => reorderRows(token, 'players', players.map((p) => p.id)),
          () => updateData((d) => ({ ...d, players })),
        ),
      reorderPhotos: (gallery) =>
        persist(
          (token) => reorderRows(token, 'gallery_photos', gallery.map((p) => p.id)),
          () => updateData((d) => ({ ...d, gallery })),
        ),
      reorderProducts: (products) =>
        persist(
          (token) => reorderRows(token, 'merch_products', products.map((p) => p.id)),
          () => updateData((d) => ({ ...d, merch: { ...d.merch, products } })),
        ),
    };
  }, []);

  const value = useMemo<SiteContextValue | null>(
    () => (data ? { data, saveError, actions } : null),
    [data, saveError, actions],
  );

  if (!value) {
    return <SiteStatus failed={Boolean(loadError)} reason={loadError ?? undefined} onRetry={retryLoad} />;
  }

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
