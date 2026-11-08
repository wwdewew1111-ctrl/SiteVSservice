import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authStorageKey = 'kab6anbl-admin-project';

if (typeof window !== 'undefined' && url) {
  try {
    if (window.sessionStorage.getItem(authStorageKey) !== url) {
      window.sessionStorage.removeItem('kab6anbl-admin-token');
      window.sessionStorage.setItem(authStorageKey, url);
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null;

export const SUPABASE_FUNCTIONS_URL = url ? `${url}/functions/v1` : '';
export const SUPABASE_ANON_KEY = anonKey ?? '';
export const isSupabaseConfigured = Boolean(url && anonKey);
