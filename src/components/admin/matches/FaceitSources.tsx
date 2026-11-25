import { useEffect, useState, type FormEvent } from 'react';
import { getAdminToken } from '@/lib/adminAuth';
import { ApiError, callSiteFunction } from '@/lib/siteApi';
import { supabase } from '@/lib/supabase';

type Source = { id: string; name: string };
type Kind = 'championship' | 'match';

function sourceError(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 400 && error.message === 'Неизвестное действие') {
    return 'На сервере установлена старая версия site-admin. Разверните обновлённую Edge Function и повторите попытку.';
  }
  return error instanceof Error ? error.message : fallback;
}

export function FaceitSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [kind, setKind] = useState<Kind>('championship');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) throw new Error('Не настроено подключение к базе данных сайта');
      const { data, error } = await supabase.from('esea_state').select('value').eq('key', 'match_championships').maybeSingle();
      if (error) throw error;
      if (active) {
        setSources(Array.isArray(data?.value) ? data.value : []);
        setLoaded(true);
      }
    }
    void load().catch(() => {
      if (active) { setFailed(true); setMessage('Не удалось загрузить список турниров. Обновите страницу.'); }
    });
    return () => { active = false; };
  }, []);

  const run = async (body: Record<string, unknown>) => {
    const token = getAdminToken();
    if (!token) throw new Error('Сессия входа истекла. Войдите в админку снова.');
    return callSiteFunction<{ ok: true; sources: Source[]; message?: string }>({ ...body, token });
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !input.trim()) return;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const result = await run({ action: 'match_source_add', kind, input: input.trim() });
      setSources(result.sources); setInput(''); setMessage(result.message ?? 'Добавлено.');
    } catch (error) {
      setFailed(true); setMessage(sourceError(error, 'Не удалось добавить источник.'));
    } finally { setBusy(false); }
  };

  const remove = async (source: Source) => {
    if (busy || !window.confirm(`Остановить поиск новых матчей турнира «${source.name}»? Уже добавленные матчи останутся.`)) return;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const result = await run({ action: 'match_source_remove', id: source.id });
      setSources(result.sources); setMessage('Турнир удалён из поиска. Уже добавленные матчи сохранены.');
    } catch (error) {
      setFailed(true); setMessage(sourceError(error, 'Не удалось удалить турнир.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="card mb-6 space-y-4 p-5">
      <div>
        <h2 className="text-xl text-text">Автоматическое добавление FACEIT</h2>
        <p className="mt-1 text-sm text-muted">Чемпионат FACEIT: ссылка с ID чемпионата, ID или ссылка на матч команды в чемпионате. Отдельный матч: ссылка на комнату или ID матча. Ключ FACEIT и ID команды настраиваются в разделе «Статистика ESEA». Матчи попадут в раздел «Матчи», но не в статистику ESEA.</p>
      </div>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
        <select aria-label="Тип источника FACEIT" value={kind} onChange={(event) => setKind(event.target.value as Kind)} className="input">
          <option value="championship">Турнир FACEIT</option>
          <option value="match">Отдельный матч</option>
        </select>
        <input aria-label="Ссылка или ID FACEIT" value={input} onChange={(event) => setInput(event.target.value)} placeholder={kind === 'championship' ? 'Ссылка на турнир или матч команды / ID турнира' : 'Ссылка на комнату матча / ID матча'} className="input min-w-0" />
        <button type="submit" disabled={busy || !loaded || !input.trim()} className="btn-primary">{busy ? 'Обработка...' : 'Добавить'}</button>
      </form>
      <p className="text-sm text-muted">Ищутся предстоящие и текущие матчи (до 500 на категорию в каждом чемпионате); завершённые можно добавить отдельно. Удаление турнира не удаляет матчи и не отключает прежний поиск ESEA.</p>
      {sources.length > 0 && (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
              <span className="min-w-0 break-all text-text">{source.name} <span className="text-muted">· {source.id}</span></span>
              <button type="button" disabled={busy} onClick={() => void remove(source)} className="btn-outline">Убрать из поиска</button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role={failed ? 'alert' : 'status'} className={`text-sm ${failed ? 'text-error-700 dark:text-error-500' : 'text-muted'}`}>{message}</p>}
    </section>
  );
}
