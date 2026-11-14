import { SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL, supabase } from '@/lib/supabase';
import {
  matchFromRow,
  newsFromRow,
  photoFromRow,
  playerFromRow,
  productFromRow,
  settingsFromRow,
  type GalleryRow,
  type MatchRow,
  type MerchModeRow,
  type NewsRow,
  type PlayerRow,
  type ProductRow,
  type SettingsRow,
} from '@/lib/siteMapping';
import type { SiteData } from '@/types';
import type { SiteSection } from '@/context/siteStore';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data?: unknown) {
    super(message);
  }
}

const NETWORK_ERROR = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';

export async function callSiteFunction<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_FUNCTIONS_URL}/site-admin`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    console.error(`site-admin ${String(body.action)} failed`, { status: response.status, data: payload });
    throw new ApiError(payload?.error ?? 'Не удалось выполнить действие. Попробуйте ещё раз.', response.status, payload);
  }
  return payload as T;
}


export async function fetchSiteSection(section: SiteSection): Promise<Partial<SiteData>> {
  if (!supabase) throw new Error('Не настроено подключение к базе данных сайта');

  switch (section) {
    case 'settings': {
      const { data, error } = await supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle();
      if (error || !data) throw new Error('Не удалось загрузить настройки сайта');
      return { settings: settingsFromRow(data as SettingsRow) };
    }
    case 'merch': {
      const { data: merchMode, error: modeError } = await supabase.from('merch_settings').select('id, mode').eq('id', 'main').maybeSingle();
      if (modeError || !merchMode) throw new Error('Не удалось загрузить настройки мерча');
      const mode = (merchMode as MerchModeRow).mode;
      if (mode !== 'shop') return { merch: { mode, products: [] } };
      const { data, error } = await supabase.from('merch_products').select('*').order('position', { ascending: true });
      if (error) throw error;
      return { merch: { mode, products: (data as ProductRow[]).map(productFromRow) } };
    }
    case 'matches': {
      const { data, error } = await supabase.from('matches').select('*').eq('is_archived', false).order('position', { ascending: true });
      if (error) throw error;
      return { matches: (data as MatchRow[]).map(matchFromRow) };
    }
    case 'archive': {
      const { data, error } = await supabase.from('matches').select('*').eq('is_archived', true).order('position', { ascending: true });
      if (error) throw error;
      return { matches: (data as MatchRow[]).map(matchFromRow) };
    }
    case 'news': {
      const { data, error } = await supabase.from('news').select('*').order('position', { ascending: true });
      if (error) throw error;
      return { news: (data as NewsRow[]).map(newsFromRow) };
    }
    case 'players': {
      const { data, error } = await supabase.from('players').select('*').order('position', { ascending: true });
      if (error) throw error;
      return { players: (data as PlayerRow[]).map(playerFromRow) };
    }
    case 'gallery': {
      const { data, error } = await supabase.from('gallery_photos').select('*').order('position', { ascending: true });
      if (error) throw error;
      return { gallery: (data as GalleryRow[]).map(photoFromRow) };
    }
  }
}

export async function fetchSiteData(): Promise<SiteData> {
  if (!supabase) throw new Error('Не настроено подключение к базе данных сайта');
  const [matches, news, players, gallery, products, merchMode, settings] = await Promise.all([
    supabase.from('matches').select('*').order('position', { ascending: true }),
    supabase.from('news').select('*').order('position', { ascending: true }),
    supabase.from('players').select('*').order('position', { ascending: true }),
    supabase.from('gallery_photos').select('*').order('position', { ascending: true }),
    supabase.from('merch_products').select('*').order('position', { ascending: true }),
    supabase.from('merch_settings').select('id, mode').eq('id', 'main').maybeSingle(),
    supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
  ]);

  const failed = [matches, news, players, gallery, products, merchMode, settings].some((result) => result.error);
  if (failed || !settings.data || !merchMode.data) {
    throw new Error('Не удалось загрузить данные сайта');
  }

  return {
    matches: (matches.data as MatchRow[]).map(matchFromRow),
    news: (news.data as NewsRow[]).map(newsFromRow),
    players: (players.data as PlayerRow[]).map(playerFromRow),
    gallery: (gallery.data as GalleryRow[]).map(photoFromRow),
    merch: {
      mode: (merchMode.data as MerchModeRow).mode,
      products: (products.data as ProductRow[]).map(productFromRow),
    },
    settings: settingsFromRow(settings.data as SettingsRow),
  };
}

export async function adminLogin(password: string): Promise<string> {
  const result = await callSiteFunction<{ ok: true; token: string }>({ action: 'login', password });
  return result.token;
}

export async function adminLogout(token: string): Promise<void> {
  await callSiteFunction<{ ok: true }>({ action: 'logout', token });
}

export async function upsertRow(token: string, table: string, row: object): Promise<void> {
  await callSiteFunction<{ ok: true }>({ action: 'upsert', token, table, row });
}

export async function deleteRow(token: string, table: string, id: string): Promise<void> {
  await callSiteFunction<{ ok: true }>({ action: 'delete', token, table, id });
}

export async function reorderRows(token: string, table: string, ids: string[]): Promise<void> {
  await callSiteFunction<{ ok: true }>({ action: 'reorder', token, table, ids });
}
