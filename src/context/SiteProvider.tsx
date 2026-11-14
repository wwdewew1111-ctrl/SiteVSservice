import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SiteContext, type SectionStatus, type SiteActions, type SiteContextValue, type SiteSection } from './siteStore';
import { getAdminToken } from '@/lib/adminAuth';
import { ApiError, deleteRow, fetchSiteData, fetchSiteSection, reorderRows, upsertRow } from '@/lib/siteApi';
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
  const isAdmin = useLocation().pathname === '/admin';
  const [data, setData] = useState<SiteData>(getFallbackSiteData);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sectionStatus, setSectionStatus] = useState<Record<SiteSection, SectionStatus>>({
    settings: 'idle', matches: 'idle', archive: 'idle', news: 'idle', players: 'idle', gallery: 'idle', merch: 'idle',
  });
  const sectionStatusRef = useRef(sectionStatus);
  const pending = useRef<Partial<Record<SiteSection, Promise<void>>>>({});
  const matchChanges = useRef(new Map<string, MatchRow | null>());
  const generation = useRef(0);

  const updateSectionStatus = useCallback((section: SiteSection, status: SectionStatus) => {
    sectionStatusRef.current = { ...sectionStatusRef.current, [section]: status };
    setSectionStatus(sectionStatusRef.current);
  }, []);

  const loadSection = useCallback((section: SiteSection): Promise<void> => {
    if (pending.current[section]) return pending.current[section];
    if (sectionStatusRef.current[section] === 'loaded') return Promise.resolve();
    const requestGeneration = generation.current;
    updateSectionStatus(section, 'loading');
    const request = fetchSiteSection(section).then((result) => {
      if (requestGeneration !== generation.current) return;
      setData((current) => {
        if (section === 'settings') return { ...current, settings: result.settings! };
        if (section === 'matches' || section === 'archive') {
          const archived = section === 'archive';
          let matches = [...current.matches.filter((match) => match.isArchived !== archived), ...(result.matches ?? [])];
          for (const [id, row] of matchChanges.current) {
            matches = matches.filter((match) => match.id !== id);
            if (row) matches.push(matchFromRow(row));
          }
          return { ...current, matches };
        }
        return { ...current, ...result };
      });
      updateSectionStatus(section, 'loaded');
    }).catch(() => {
      if (requestGeneration === generation.current) updateSectionStatus(section, 'error');
    }).finally(() => {
      if (pending.current[section] === request) delete pending.current[section];
    });
    pending.current[section] = request;
    return request;
  }, [updateSectionStatus]);

  useEffect(() => {
    if (isAdmin) {
      let active = true;
      generation.current += 1;
      pending.current = {};
      setAdminLoaded(false);
      sectionStatusRef.current = { settings: 'idle', matches: 'idle', archive: 'idle', news: 'idle', players: 'idle', gallery: 'idle', merch: 'idle' };
      setSectionStatus(sectionStatusRef.current);
      setLoadError(null);
      fetchSiteData().then((next) => {
        if (!active) return;
        setData(() => {
          let matches = next.matches;
          for (const [id, row] of matchChanges.current) {
            matches = matches.filter((match) => match.id !== id);
            if (row) matches.push(matchFromRow(row));
          }
          return { ...next, matches };
        });
        setAdminLoaded(true);
      }).catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error && error.message.includes('Не настроено') ? 'config' : 'data');
      });
      return () => { active = false; };
    }
    void loadSection('settings');
  }, [isAdmin, loadAttempt, loadSection]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('public-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = String((payload.old as Partial<MatchRow>).id ?? '');
          if (id) {
            matchChanges.current.set(id, null);
            setData((current) => ({ ...current, matches: current.matches.filter((m) => m.id !== id) }));
          }
          return;
        }
        const row = payload.new as MatchRow;
        if (typeof row.id !== 'string') return;
        matchChanges.current.set(row.id, row);
        const match = matchFromRow(row);
        setData((current) => ({ ...current, matches: upsert(current.matches, match) }));
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

  const value = useMemo<SiteContextValue>(
    () => ({ data, saveError, actions, sectionStatus, loadSection }),
    [data, saveError, actions, sectionStatus, loadSection],
  );

  if (isAdmin && !adminLoaded) {
    return <SiteStatus failed={Boolean(loadError)} reason={loadError ?? undefined} onRetry={retryLoad} />;
  }

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
