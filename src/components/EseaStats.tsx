import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Save, Trophy } from 'lucide-react';
import { getAdminToken } from '@/lib/adminAuth';
import { ApiError } from '@/lib/siteApi';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { EseaSyncCountdown } from '@/components/EseaSyncCountdown';
import {
  fetchEseaState,
  getActiveSeason,
  parseMatchId,
  parseTeamId,
  playerKd,
  saveEsea,
  startNewSeason,
  syncEsea,
  winratePercent,
  AUTO_SYNC_INTERVAL_MS,
  type EseaConfig,
  type EseaSeason,
  type EseaState,
  type EseaSyncResult,
  type PlayerStat,
  type TeamStats,
} from '@/services/eseaService';

type SortKey = 'nickname' | 'maps' | 'kills' | 'diff' | 'kd' | 'adr' | 'hsPercent' | 'rating';
type SortDir = 'asc' | 'desc';

const SORT_VALUES: Record<SortKey, (player: PlayerStat) => number | string> = {
  nickname: (player) => player.nickname.toLowerCase(),
  maps: (player) => player.maps,
  kills: (player) => player.kills,
  diff: (player) => player.kills - player.deaths,
  kd: (player) => playerKd(player),
  adr: (player) => player.adr,
  hsPercent: (player) => player.hsPercent,
  rating: (player) => player.rating,
};

const TABLE_COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'nickname', label: 'Игрок', align: 'left' },
  { key: 'maps', label: 'Карты', align: 'right' },
  { key: 'kills', label: 'K - D', align: 'right' },
  { key: 'diff', label: '+/-', align: 'right' },
  { key: 'kd', label: 'K/D', align: 'right' },
  { key: 'adr', label: 'ADR', align: 'right' },
  { key: 'hsPercent', label: 'HS%', align: 'right' },
  { key: 'rating', label: 'Rating', align: 'right' },
];

function diffClass(diff: number): string {
  if (diff > 0) return 'text-green-500';
  if (diff < 0) return 'text-red-500';
  return 'text-muted';
}

function ratingClass(rating: number): string {
  return rating < 1.06 ? 'text-muted' : 'text-green-500';
}

function nextSeasonTag(tag: string): string {
  const match = /S(\d+)/i.exec(tag);
  return match ? `S${Number(match[1]) + 1}` : `${tag}-next`;
}

export function EseaPublicSection() {
  const [state, setState] = useState<EseaState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<'active' | 'archive'>('active');
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [matchSelection, setMatchSelection] = useState<{ seasonId: string; matchId: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let cancelled = false;
    fetchEseaState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const archived = state?.seasons.filter((season) => season.isArchived) ?? [];
  const active = state ? getActiveSeason(state) ?? state.seasons.find((season) => !season.isArchived) : undefined;
  const season: EseaSeason | undefined =
    view === 'active' ? active : archived.find((item) => item.id === archiveId) ?? archived[0];

  const selectedMatch = season && matchSelection && season.id === matchSelection.seasonId
    ? season.matches?.find((match) => match.id === matchSelection.matchId)
    : undefined;

  const rows = useMemo(() => {
    if (!season) return [];
    const getValue = SORT_VALUES[sortKey];
    return [...(selectedMatch ? selectedMatch.players ?? [] : season.players)].sort((a, b) => {
      const left = getValue(a);
      const right = getValue(b);
      const result = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right);
      return sortDir === 'asc' ? result : -result;
    });
  }, [season, selectedMatch, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'nickname' ? 'asc' : 'desc');
    }
  };

  return (
    <section id="statistics" className="scroll-mt-20 border-y border-border bg-elevated/50 py-20 sm:py-28">
      <div className="container-site">
        <SectionHeading
          eyebrow="Турнирные показатели"
          title="Статистика ESEA"
          description="Результаты команды и игроков в текущем сезоне ESEA League, а также архив прошлых сезонов."
        />

        {loadError && <p className="text-muted">Не удалось загрузить статистику. Обновите страницу.</p>}
        {!state && !loadError && <p className="text-muted">Загружаем статистику...</p>}

        {state && (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="Сезоны" className="inline-flex rounded-lg border border-border bg-card p-1">
                {[
                  { value: 'active' as const, label: `Сезон ${active?.seasonTag ?? ''}`.trim(), disabled: !active },
                  { value: 'archive' as const, label: 'Архив', disabled: archived.length === 0 },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={view === item.value}
                    disabled={item.disabled}
                    onClick={() => setView(item.value)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${
                      view === item.value ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-text'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {view === 'archive' &&
                archived.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setArchiveId(item.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                      season?.id === item.id ? 'border-accent text-accent' : 'border-border text-muted hover:text-text'
                    }`}
                  >
                    {item.seasonTag}
                  </button>
                ))}
            </div>

            {!season ? (
              <p className="text-muted">Сезон пока не создан.</p>
            ) : (
              <>
                <div className="mb-6">
                  <label htmlFor="esea-match" className="mb-2 block text-sm font-semibold text-muted">Статистика за матч</label>
                  <select
                    id="esea-match"
                    value={selectedMatch?.id ?? ''}
                    onChange={(event) => setMatchSelection(event.target.value ? { seasonId: season.id, matchId: event.target.value } : null)}
                    className="input w-full max-w-md"
                  >
                    <option value="">Весь сезон</option>
                    {(season.matches ?? []).map((match) => (
                      <option key={match.id} value={match.id}>
                        {match.date ? `${match.date} · ` : ''}vs {match.opponent}{match.score ? ` · ${match.score}` : ''}
                      </option>
                    ))}
                  </select>
                  {!season.matches?.length && <p className="mt-2 text-sm text-muted">Статистика матчей появится после синхронизации сезона.</p>}
                </div>
                <TeamOverview season={season} />
                {selectedMatch && (
                  <p className="mt-6 text-sm font-semibold text-muted">Статистика матча против {selectedMatch.opponent}{selectedMatch.score ? ` · ${selectedMatch.score}` : ''}</p>
                )}
                {selectedMatch && rows.length === 0 && <p className="mt-4 text-muted">Статистика игроков за этот матч недоступна.</p>}

                <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-elevated/60 text-xs uppercase tracking-wider text-muted">
                        {TABLE_COLUMNS.map((column) => (
                          <th
                            key={column.key}
                            scope="col"
                            aria-sort={sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            className={`px-4 py-3 font-semibold ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(column.key)}
                              className={`inline-flex items-center gap-1 transition hover:text-accent ${sortKey === column.key ? 'text-accent' : ''}`}
                            >
                              {column.label}
                              {sortKey === column.key && <span aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((player) => {
                        const diff = player.kills - player.deaths;
                        return (
                          <tr key={player.nickname} className="border-b border-border last:border-b-0 transition hover:bg-elevated/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="font-display uppercase text-text">{player.nickname}</span>
                                <span className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                                  {player.role}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted">{player.maps}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-text">
                              {player.kills} - {player.deaths}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold tabular-nums ${diffClass(diff)}`}>
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-text">{playerKd(player).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-text">{player.adr.toFixed(1)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-text">{player.hsPercent.toFixed(1)}%</td>
                            <td className={`px-4 py-3 text-right font-display tabular-nums ${ratingClass(player.rating)}`}>{player.rating.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TeamOverview({ season }: { season: EseaSeason }) {
  const stats = season.teamStats;
  const winrate = winratePercent(stats);

  return (
    <div className="grid gap-6 rounded-xl border border-border bg-card p-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-border bg-elevated">
          <Trophy className="h-6 w-6 text-accent" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{season.name}</p>
          <p className="mt-1 font-display text-2xl text-text">
            {stats.wins} - {stats.losses}
          </p>
          {season.eseaUrl && (
            <a
              href={season.eseaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-accent"
            >
              Профиль ESEA
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Винрейт</p>
          <p className="mt-1 font-display text-2xl text-text">{winrate}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-red-500 transition-all duration-700" style={{ width: `${winrate}%` }} />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Серия</p>
          <p className="mt-1 font-display text-2xl text-text">{stats.streak}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Разница раундов</p>
          <p className={`mt-1 font-display text-2xl ${diffClass(stats.roundDiff)}`}>
            {stats.roundDiff > 0 ? `+${stats.roundDiff}` : stats.roundDiff}
          </p>
        </div>
      </div>
    </div>
  );
}

interface Status {
  tone: 'ok' | 'error';
  text: string;
}

export function EseaAdminTab() {
  const [draft, setDraft] = useState<EseaState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [matchUrl, setMatchUrl] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchEseaState()
      .then((next) => {
        if (cancelled) return;
        setDraft(next);
        setSelectedId(getActiveSeason(next)?.id ?? next.seasons[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requireToken = (): string => {
    const token = getAdminToken();
    if (!token) throw new Error('Сессия входа истекла. Войдите в админку снова.');
    return token;
  };

  const run = async (task: () => Promise<string>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ tone: 'ok', text: await task() });
    } catch (error) {
      console.error('FACEIT sync error', error instanceof ApiError ? { status: error.status, data: error.data } : error);
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Не удалось выполнить действие' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const applySync = (result: EseaSyncResult) => {
    setDraft((prev) => (prev ? { ...prev, seasons: result.seasons, config: { ...prev.config, lastSync: result.lastSync } } : prev));
    return result.newSeasonDetected
      ? `Найден матч следующего сезона. Нажмите «Начать новый сезон», чтобы не смешивать статистику. Матчей в сезоне: ${result.matchesFound}.`
      : `Синхронизировано матчей: ${result.matchesFound}.`;
  };

  const persistAndSync = (state: EseaState, sync: boolean) => {
    const normalized: EseaState = { ...state, config: { ...state.config, teamId: parseTeamId(state.config.teamId) } };
    setDraft(normalized);
    void run(async () => {
      const token = requireToken();
      await saveEsea(token, normalized, apiKey.trim() || undefined);
      setApiKey('');
      if (!sync) return 'Настройки и статистика сохранены.';
      const result = await syncEsea(token);
      return applySync(result);
    });
  };

  if (loadError) return <div className="card p-10 text-center text-muted">Не удалось загрузить статистику ESEA. Обновите страницу.</div>;
  if (!draft) return <div className="card p-10 text-center text-muted">Загружаем статистику...</div>;

  const season = draft.seasons.find((item) => item.id === selectedId) ?? getActiveSeason(draft);
  const locked = season?.isArchived ?? false;

  const updateSeason = (patch: Partial<EseaSeason>) => {
    if (!season) return;
    setDraft((prev) =>
      prev ? { ...prev, seasons: prev.seasons.map((item) => (item.id === season.id ? { ...item, ...patch } : item)) } : prev,
    );
  };

  const updateStats = (patch: Partial<TeamStats>) => {
    if (season) updateSeason({ teamStats: { ...season.teamStats, ...patch } });
  };

  const updatePlayer = (index: number, patch: Partial<PlayerStat>) => {
    if (season) updateSeason({ players: season.players.map((player, i) => (i === index ? { ...player, ...patch } : player)) });
  };

  const updateConfig = (patch: Partial<EseaConfig>) => {
    setDraft((prev) => (prev ? { ...prev, config: { ...prev.config, ...patch } } : prev));
  };

  const addMatch = () => {
    const id = parseMatchId(matchUrl);
    if (!id) {
      setStatus({ tone: 'error', text: 'Вставьте ссылку на комнату матча FACEIT или ID матча.' });
      return;
    }
    if (draft.config.extraMatchIds.includes(id)) {
      setStatus({ tone: 'error', text: 'Этот матч уже добавлен.' });
      return;
    }
    setMatchUrl('');
    persistAndSync(
      { ...draft, config: { ...draft.config, extraMatchIds: [...draft.config.extraMatchIds, id] } },
      true,
    );
  };

  const startSeason = () => {
    const active = getActiveSeason(draft);
    if (!active) return;
    const next = nextSeasonTag(active.seasonTag);
    if (!window.confirm(`Архивировать ${active.seasonTag} и начать ${next} с нулевой статистикой?`)) return;
    const state = startNewSeason(draft, {
      name: active.name.replace(/S\d+/i, next),
      seasonTag: next,
      startDate: new Date().toISOString().slice(0, 10),
      eseaUrl: active.eseaUrl,
    });
    setSelectedId(state.config.activeSeasonId);
    persistAndSync(state, false);
  };

  return (
    <div className="space-y-8">
      <section className="card flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block min-w-0 flex-1">
            <span className="label">Сезон</span>
            <select value={season?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)} className="input">
              {draft.seasons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.seasonTag} · {item.name}
                  {item.isArchived ? ' (архив)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={startSeason} disabled={busy || !season || locked} className="btn-primary">
            <Plus className="h-4 w-4" />
            Начать новый сезон
          </button>
        </div>

        {season && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Название сезона</span>
              <input type="text" value={season.name} disabled={locked} onChange={(e) => updateSeason({ name: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="label">Метка для фильтра (S59 / S60)</span>
              <input type="text" value={season.seasonTag} disabled={locked} onChange={(e) => updateSeason({ seasonTag: e.target.value.trim() })} className="input" />
            </label>
            <label className="block">
              <span className="label">Дата начала</span>
              <input type="date" value={season.startDate} disabled={locked} onChange={(e) => updateSeason({ startDate: e.target.value })} className="input" />
            </label>
            <label className="block">
              <span className="label">Ссылка на профиль ESEA</span>
              <input type="url" value={season.eseaUrl} disabled={locked} onChange={(e) => updateSeason({ eseaUrl: e.target.value.trim() })} placeholder="https://..." className="input" />
            </label>
          </div>
        )}
      </section>

      <section className="card space-y-5 p-6">
        <div>
          <h3 className="text-xl text-text">Синхронизация с FACEIT</h3>
          <p className="mt-1 text-sm text-muted">Статистика берется из матчей FACEIT, у которых в названии турнира есть метка сезона.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">API-ключ FACEIT</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Оставьте пустым, чтобы не менять"
              autoComplete="off"
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">ID команды или ссылка на команду</span>
            <input
              type="text"
              value={draft.config.teamId}
              onChange={(event) => updateConfig({ teamId: event.target.value })}
              placeholder="https://www.faceit.com/.../teams/..."
              className="input"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            role="switch"
            aria-checked={draft.config.autoSync}
            onClick={() => persistAndSync({ ...draft, config: { ...draft.config, autoSync: !draft.config.autoSync } }, false)}
            disabled={busy}
            className="flex items-center gap-3 text-sm font-medium text-text"
          >
            <span
              className={`relative h-6 w-11 rounded-full border transition duration-300 ${
                draft.config.autoSync ? 'border-accent bg-accent' : 'border-border bg-elevated'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  draft.config.autoSync ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
            Авто-обновление на сервере (каждые {AUTO_SYNC_INTERVAL_MS / 60000} мин)
          </button>
          <button type="button" onClick={() => persistAndSync(draft, true)} disabled={busy} className="btn-outline">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            СИНХРОНИЗИРОВАТЬ СЕЗОН
          </button>
        </div>

        <EseaSyncCountdown autoSync={draft.config.autoSync} lastSync={draft.config.lastSync} />

        <div className="space-y-2">
          <span className="label">Быстрый импорт матча</span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={matchUrl}
              onChange={(event) => setMatchUrl(event.target.value)}
              placeholder="Ссылка на комнату матча FACEIT"
              className="input flex-1"
            />
            <button type="button" onClick={addMatch} disabled={busy || matchUrl.trim() === ''} className="btn-outline">
              Добавить матч
            </button>
          </div>
        </div>

        {status && (
          <p role={status.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${status.tone === 'error' ? 'text-error-700 dark:text-error-500' : 'text-muted'}`}>
            {status.text}
          </p>
        )}
      </section>

      <section className="card space-y-6 p-6">
        <div>
          <h3 className="text-xl text-text">Ручная корректировка</h3>
          <p className="mt-1 text-sm text-muted">Поля заполняются автоматически после синхронизации, но их можно поправить вручную.</p>
        </div>

        {season && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <NumberField label="W" value={season.teamStats.wins} disabled={locked} onChange={(wins) => updateStats({ wins })} />
              <NumberField label="L" value={season.teamStats.losses} disabled={locked} onChange={(losses) => updateStats({ losses })} />
              <NumberField label="FFW" value={season.teamStats.ffw} disabled={locked} onChange={(ffw) => updateStats({ ffw })} />
              <NumberField label="FFL" value={season.teamStats.ffl} disabled={locked} onChange={(ffl) => updateStats({ ffl })} />
              <label className="block">
                <span className="label">Серия</span>
                <input type="text" value={season.teamStats.streak} disabled={locked} onChange={(e) => updateStats({ streak: e.target.value })} className="input" />
              </label>
              <NumberField label="Разница раундов" value={season.teamStats.roundDiff} disabled={locked} onChange={(roundDiff) => updateStats({ roundDiff })} />
            </div>

            <div className="space-y-4">
              {season.players.map((player, index) => {
                const diff = player.kills - player.deaths;
                return (
                  <div key={player.nickname} className="rounded-lg border border-border bg-elevated/40 p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="font-display uppercase text-text">{player.nickname}</span>
                      <span className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                        {player.role}
                      </span>
                      <span className={`text-sm font-semibold tabular-nums ${diffClass(diff)}`}>
                        {diff > 0 ? `+${diff}` : diff} · K/D {playerKd(player).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                      <label className="block lg:col-span-2">
                        <span className="label">Ник на FACEIT</span>
                        <input type="text" value={player.faceitNick} disabled={locked} onChange={(e) => updatePlayer(index, { faceitNick: e.target.value.trim() })} className="input" />
                      </label>
                      <NumberField label="Карты" value={player.maps} disabled={locked} onChange={(maps) => updatePlayer(index, { maps })} />
                      <NumberField label="Убийства" value={player.kills} disabled={locked} onChange={(kills) => updatePlayer(index, { kills })} />
                      <NumberField label="Смерти" value={player.deaths} disabled={locked} onChange={(deaths) => updatePlayer(index, { deaths })} />
                      <NumberField label="ADR" value={player.adr} step={0.1} disabled={locked} onChange={(adr) => updatePlayer(index, { adr })} />
                      <NumberField label="HS%" value={player.hsPercent} step={0.1} disabled={locked} onChange={(hsPercent) => updatePlayer(index, { hsPercent })} />
                      <NumberField label="Rating" value={player.rating} step={0.01} disabled={locked} onChange={(rating) => updatePlayer(index, { rating })} />
                    </div>
                  </div>
                );
              })}
            </div>

            {!locked && (
              <div className="flex justify-end border-t border-border pt-6">
                <button type="button" onClick={() => persistAndSync(draft, false)} disabled={busy} className="btn-primary">
                  <Save className="h-4 w-4" />
                  СОХРАНИТЬ
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="input"
      />
    </label>
  );
}
