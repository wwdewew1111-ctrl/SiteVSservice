import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Swords } from 'lucide-react';
import { useSite } from '@/context/siteStore';
import { useLazySection } from '@/context/useLazySection';
import { SectionStatus } from '@/components/ui/SectionStatus';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Modal } from '@/components/ui/Modal';
import { fetchEseaState, getActiveSeason, playerKd, type EseaMatch, type EseaState, type PlayerStat } from '@/services/eseaService';
import type { Player } from '@/types';
import { PlayerCard } from './PlayerCard';

function findPlayer(players: PlayerStat[], nickname: string): PlayerStat | undefined {
  const normalized = nickname.trim().toLowerCase();
  return players.find((player) => player.nickname.toLowerCase() === normalized || player.faceitNick?.toLowerCase() === normalized);
}

function matchResult(score: string): { label: string; short: string; tone: string } {
  const parts = /^\s*(\d+)\s*[:-]\s*(\d+)\s*$/.exec(score);
  if (!parts) return { label: 'Результат неизвестен', short: '—', tone: 'border-border bg-elevated text-muted' };
  const ours = Number(parts[1]);
  const theirs = Number(parts[2]);
  if (ours > theirs) return { label: 'Победа', short: 'В', tone: 'border-green-500/30 bg-green-500/10 text-green-500' };
  if (ours < theirs) return { label: 'Поражение', short: 'П', tone: 'border-red-500/30 bg-red-500/10 text-red-500' };
  return { label: 'Ничья', short: 'Н', tone: 'border-border bg-elevated text-muted' };
}

function matchDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-elevated/50 px-3 py-4 sm:px-4">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted sm:text-xs">{label}</dt>
      <dd className={`mt-2 font-display text-xl tabular-nums sm:text-2xl ${accent ? 'text-accent' : 'text-text'}`}>{value}</dd>
    </div>
  );
}

function PlayerMatch({ match, stats }: { match: EseaMatch; stats: PlayerStat }) {
  const result = matchResult(match.score);
  return (
    <details className="group overflow-hidden rounded-lg border border-border bg-elevated/30 transition-colors open:border-accent/40">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden sm:gap-4 sm:p-4">
        <span title={result.label} aria-label={result.label} className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border text-sm font-bold ${result.tone}`}>{result.short}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">vs {match.opponent || 'Соперник'}</span>
          <span className="mt-1 block text-xs text-muted">{match.date ? matchDate(match.date) : 'Дата неизвестна'} · {result.label}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-base tabular-nums text-text">{match.score || '—'}</span>
          <span className="mt-1 block text-[11px] tabular-nums text-muted">K/D {playerKd(stats).toFixed(2)}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-4 border-t border-border px-4 py-4 sm:grid-cols-6">
        {[
          ['Карты', String(stats.maps)],
          ['K–D', `${stats.kills}–${stats.deaths}`],
          ['K/D', playerKd(stats).toFixed(2)],
          ['ADR', stats.adr.toFixed(1)],
          ['HS', `${stats.hsPercent.toFixed(1)}%`],
          ['Rating', stats.rating.toFixed(2)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-text">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function RosterSection() {
  const { data } = useSite();
  const { ref, status, retry } = useLazySection('players');
  const [selected, setSelected] = useState<Player | null>(null);
  const [state, setState] = useState<EseaState | null>(null);
  const [error, setError] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    fetchEseaState().then((next) => {
      if (active) { setState(next); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [selected]);

  const season = state ? getActiveSeason(state) ?? state.seasons.find((item) => !item.isArchived) : undefined;
  const player = selected && season ? findPlayer(season.players, selected.nickname) : undefined;
  const matches = player && season ? (season.matches ?? []).flatMap((match) => {
    const stats = findPlayer(match.players, player.faceitNick || player.nickname);
    return stats ? [{ match, stats }] : [];
  }).sort((a, b) => b.match.date.localeCompare(a.match.date)) : [];

  return (
    <section ref={ref} id="roster" className="min-h-96 scroll-mt-20 border-y border-border bg-elevated/50 py-20 sm:py-28">
      <div className="container-site">
        <SectionHeading eyebrow="Состав по CS2" title="Наша команда" />
        {status !== 'loaded' ? <SectionStatus status={status} onRetry={retry} /> : data.players.length === 0 ? (
          <p className="text-muted">Состав пока не добавлен.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.players.map((item) => (
              <PlayerCard key={item.id} player={item} onClick={() => { opener.current = document.activeElement as HTMLElement; setState(null); setError(false); setSelected(item); }} />
            ))}
          </div>
        )}
      </div>
      <Modal open={Boolean(selected)} onClose={() => { setSelected(null); opener.current?.focus(); }} title={`Статистика ${selected?.nickname ?? ''}`} stickyClose>
        {selected && (
          <>
            <div className="sticky top-0 z-20 overflow-hidden border-b border-ink-800 bg-ink-950 text-white">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-transparent" />
              <div className="relative flex items-center gap-4 px-5 py-4 pr-14 sm:gap-5 sm:px-7 sm:py-5 sm:pr-16">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-900 sm:h-24 sm:w-20">
                  {selected.photo ? (
                    <img src={selected.photo} alt="" className="h-full w-full object-cover object-top grayscale" />
                  ) : (
                    <div className="grid h-full w-full place-items-center font-display text-3xl uppercase text-ink-700">{selected.nickname.charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Профиль игрока · CS2</p>
                  <h3 className="mt-1 break-words font-display text-xl uppercase leading-tight sm:text-3xl">{selected.nickname}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {selected.role && <span className="rounded border border-accent/50 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{selected.role}</span>}
                    {selected.name && <span className="text-xs text-ink-300 sm:text-sm">{selected.name}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-7 p-5 sm:p-7">
              {error ? <p role="status" className="text-sm text-muted">Не удалось загрузить статистику. Попробуйте ещё раз.</p> : !state ? (
                <p role="status" className="text-sm text-muted">Загружаем статистику...</p>
              ) : !player ? (
                <p className="text-sm text-muted">Статистика игрока за текущий сезон недоступна.</p>
              ) : (
                <>
                  <section aria-label={`Статистика сезона ${season?.seasonTag ?? ''}`}>
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Обзор игрока</p>
                        <h4 className="mt-1 text-lg text-text">Сезон {season?.seasonTag}</h4>
                      </div>
                      <p className="text-xs text-muted">Карт сыграно: <span className="font-semibold tabular-nums text-text">{player.maps}</span></p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                      <Metric label="Rating" value={player.rating.toFixed(2)} accent />
                      <Metric label="K/D" value={playerKd(player).toFixed(2)} />
                      <Metric label="ADR" value={player.adr.toFixed(1)} />
                      <Metric label="HS" value={`${player.hsPercent.toFixed(1)}%`} />
                    </dl>
                    <p className="mt-3 text-xs text-muted">Убийства / смерти: <span className="font-semibold tabular-nums text-text">{player.kills} / {player.deaths}</span></p>
                  </section>
                  <section aria-label="Последние матчи">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Swords aria-hidden="true" className="h-4 w-4 text-accent" />
                        <h4 className="text-lg text-text">Последние матчи</h4>
                      </div>
                      <span className="text-xs text-muted">{matches.length}</span>
                    </div>
                    {matches.length === 0 ? <p className="text-sm text-muted">Статистика матчей игрока пока недоступна.</p> : (
                      <div className="space-y-2">
                        {matches.map(({ match, stats }) => <PlayerMatch key={match.id} match={match} stats={stats} />)}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
