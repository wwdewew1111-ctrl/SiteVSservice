import { useEffect, useState, type ReactNode } from 'react';
import { CalendarClock, ExternalLink, Shield, Trophy } from 'lucide-react';
import { useSite } from '@/context/siteStore';
import { useLazySection } from '@/context/useLazySection';
import { SectionStatus } from '@/components/ui/SectionStatus';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { formatMatchDateTime, isMatchFinished, matchUnitLabel, scoreToneClass } from '@/lib/format';
import { DEFAULT_TEAM_LOGO } from '@/lib/teamLogo';
import type { Match, MatchMap, MatchPhase } from '@/types';

type MatchTab = 'active' | 'archive';

const TABS: { value: MatchTab; label: string }[] = [
  { value: 'active', label: 'Активные матчи' },
  { value: 'archive', label: 'Архив' },
];

export function MatchesSection() {
  const { data, sectionStatus, loadSection } = useSite();
  const [tab, setTab] = useState<MatchTab>('active');
  const { ref, status, retry } = useLazySection('matches');
  const currentStatus = tab === 'archive' ? sectionStatus.archive : status;
  useEffect(() => {
    if (tab === 'archive' && sectionStatus.archive === 'idle') void loadSection('archive');
  }, [tab, sectionStatus.archive, loadSection]);

  const visibleMatches = data.matches
    .filter((match) => (tab === 'archive' ? match.isArchived : !match.isArchived))
    .sort((a, b) => Number(b.phase === 'live') - Number(a.phase === 'live'));

  return (
    <section ref={ref} id="matches" className="min-h-80 scroll-mt-20 py-20 sm:py-28">
      <div className="container-site">
        <SectionHeading
          eyebrow="Календарь"
          title="Предстоящие матчи"
          description="Ближайшие игры Ka6aHbl на турнирах. Следите за расписанием и поддерживайте команду."
        />

        <div role="tablist" aria-label="Список матчей" className="mb-10 inline-flex rounded-lg border border-border bg-elevated p-1">
          {TABS.map((item) => {
            const selected = tab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.value)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-text'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {currentStatus !== 'loaded' ? (
          <SectionStatus status={currentStatus} onRetry={tab === 'archive' ? () => void loadSection('archive') : retry} />
        ) : visibleMatches.length === 0 ? (
          <p className="text-muted">
            {tab === 'archive' ? 'В архиве пока пусто.' : 'Ближайших матчей пока нет. Загляните позже.'}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MatchCard({ match }: { match: Match }) {
  const live = match.phase === 'live';
  const finished = !live && isMatchFinished(match);

  return (
    <article className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_18px_40px_-18px_rgba(255,30,30,0.55)]">
      <div className="flex items-center gap-3">
        <LogoBox src={match.tournamentLogo} fallback={<Trophy className="h-5 w-5 text-muted" />} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wider text-accent">{match.tournament}</p>
        {!match.isArchived && !finished && <PhaseBadge phase={match.phase} />}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center gap-2">
          <LogoBox src={match.teamLogo || DEFAULT_TEAM_LOGO} fallback={<Shield className="h-5 w-5 text-muted" />} />
          <p className="w-full truncate text-center font-display text-sm text-text">Ka6aHbl</p>
        </div>
        {finished || live ? (
          <ScoreBlock match={match} />
        ) : (
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">vs</span>
        )}
        <div className="flex min-w-0 flex-col items-center gap-2">
          <LogoBox src={match.opponentLogo} fallback={<Shield className="h-5 w-5 text-muted" />} />
          <p className="w-full truncate text-center text-sm font-semibold text-text">{match.opponent}</p>
        </div>
      </div>

      {match.maps.length > 0 && <MapResults maps={match.maps} />}

      {(match.startsAt || match.streamUrl) && (
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {match.startsAt && (
            <p className="flex items-center gap-2 text-sm font-medium text-muted">
              <CalendarClock className="h-4 w-4 text-accent" />
              <time dateTime={match.startsAt}>{formatMatchDateTime(match.startsAt)}</time>
            </p>
          )}
          {match.streamUrl && (
            <a
              href={match.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-accent transition duration-200 hover:bg-accent hover:text-white"
            >
              Трансляция
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function ScoreBlock({ match }: { match: Match }) {
  const currentMap = match.format === 'bo1' ? match.maps.find((map) => map.inProgress) ?? (match.phase === 'finished' ? match.maps[0] : undefined) : undefined;
  const team = currentMap?.ours ?? match.teamScore;
  const opponent = currentMap?.theirs ?? match.opponentScore;
  if (team === null || opponent === null) {
    return <p className="text-center text-xs text-muted">Счёт недоступен</p>;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="flex items-center gap-2 font-display text-3xl leading-none">
        <span className={scoreToneClass(team, opponent)}>{team}</span>
        <span className="text-muted">:</span>
        <span className={scoreToneClass(opponent, team)}>{opponent}</span>
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {match.format.toUpperCase()} · {matchUnitLabel(match.format)}
      </p>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: MatchPhase }) {
  if (phase === 'live') {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        Текущий матч
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
      Предстоящий
    </span>
  );
}

function MapResults({ maps }: { maps: MatchMap[] }) {
  return (
    <ul className="grid gap-2 rounded-lg border border-border bg-elevated/50 p-3">
      {maps.map((map, index) => (
        <li key={`${map.map}-${index}`} className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-text">
            {map.map}
            {map.inProgress ? ' · идёт' : ''}
          </span>
          <span className={`font-display tabular-nums ${scoreToneClass(map.ours, map.theirs)}`}>
            {map.ours} : {map.theirs}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LogoBox({ src, fallback }: { src: string; fallback: ReactNode }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-elevated">
      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : fallback}
    </div>
  );
}
