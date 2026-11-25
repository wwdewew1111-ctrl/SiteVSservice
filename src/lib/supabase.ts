import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authStorageKey = 'kab6anbl-admin-project';
const READ_TIMEOUT_MS = 12_000;
const READ_RETRY_DELAYS_MS = [500, 1_500];
const useProxy = import.meta.env.VITE_SUPABASE_PROXY === 'true' && typeof window !== 'undefined';
const proxyBase = useProxy ? `${window.location.origin}/supabase-proxy.php` : '';
export const usesSupabaseProxy = useProxy;

// Bound only Data API reads; retrying writes could repeat an admin action.
const fetchWithReadRetry: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const requestUrl = new URL(request.url);
  const isDataRead = request.method === 'GET' && requestUrl.pathname.startsWith('/rest/v1/');
  if (!isDataRead) return fetch(request);
  const target = useProxy && requestUrl.origin === new URL(url).origin
    ? new Request(`${proxyBase}${requestUrl.pathname}${requestUrl.search}`, request)
    : request;

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const abort = () => controller.abort(request.signal.reason);
    if (request.signal.aborted) abort();
    else request.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);

    try {
      const response = await fetch(target.clone(), { signal: controller.signal });
      if (response.ok || ![502, 503, 504].includes(response.status) || attempt >= READ_RETRY_DELAYS_MS.length) {
        return response;
      }
      await response.body?.cancel();
    } catch (error) {
      if (request.signal.aborted || attempt >= READ_RETRY_DELAYS_MS.length) throw error;
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', abort);
    }

    await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]));
  }
};

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
  ? createClient(url, anonKey, { auth: { persistSession: false }, global: { fetch: fetchWithReadRetry } })
  : null;

export const SUPABASE_FUNCTIONS_URL = url ? `${useProxy ? proxyBase : url}/functions/v1` : '';
export const SUPABASE_ANON_KEY = anonKey ?? '';
export const isSupabaseConfigured = Boolean(url && anonKey);
