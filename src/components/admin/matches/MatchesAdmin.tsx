import { useState } from 'react';
import { Archive, ArchiveRestore, ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSite } from '@/context/siteStore';
import { createId, isMatchFinished } from '@/lib/format';
import { DEFAULT_TEAM_LOGO } from '@/lib/teamLogo';
import { Modal } from '@/components/ui/Modal';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { SortableList } from '@/components/admin/SortableList';
import { MatchForm } from './MatchForm';
import { MatchScoreEditor } from './MatchScoreEditor';
import { FaceitSources } from './FaceitSources';
import type { Match } from '@/types';

const DEFAULT_STREAM_URL = 'https://www.twitch.tv/babaklawa';

function createBlankMatch(): Match {
  return {
    id: createId(),
    tournament: '',
    opponent: '',
    tournamentLogo: '',
    opponentLogo: '',
    teamLogo: '',
    startsAt: '',
    streamUrl: DEFAULT_STREAM_URL,
    format: 'bo1',
    phase: 'upcoming',
    maps: [],
    teamScore: null,
    opponentScore: null,
    isArchived: false,
  };
}

export function MatchesAdmin() {
  const { data, actions } = useSite();
  const [draft, setDraft] = useState<Match | null>(null);

  const handleDelete = (match: Match) => {
    if (window.confirm(`Удалить матч «${match.tournament}» против ${match.opponent}?`)) {
      actions.deleteMatch(match.id);
    }
  };

  const handleArchiveToggle = (match: Match) => {
    void actions.saveMatch({ ...match, isArchived: !match.isArchived });
  };

  return (
    <div>
      <AdminToolbar
        title="Матчи"
        description="Турнир, дата и время, ссылка на трансляцию и логотипы. Укажите счёт после матча, а завершённые можно отправить в архив. Матчи FACEIT обновляются автоматически."
        action={
          <button type="button" onClick={() => setDraft(createBlankMatch())} className="btn-primary">
            <Plus className="h-4 w-4" />
            Добавить матч
          </button>
        }
      />

      <FaceitSources />

      {data.matches.length === 0 ? (
        <div className="card p-10 text-center text-muted">Матчей пока нет. Нажмите «Добавить матч», чтобы создать первый.</div>
      ) : (
        <SortableList
          items={data.matches}
          label="матч"
          onReorder={actions.reorderMatches}
          renderItem={(match) => {
            const finished = isMatchFinished(match);
            return (
              <div className="card space-y-5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex shrink-0 gap-2">
                    <LogoPreview src={match.tournamentLogo} />
                    <LogoPreview src={match.teamLogo || DEFAULT_TEAM_LOGO} />
                    <LogoPreview src={match.opponentLogo} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs font-semibold uppercase tracking-wider text-accent">{match.tournament}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted">
                        {match.format.toUpperCase()}
                      </span>
                      {match.phase === 'live' && (
                        <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-red-500">
                          Текущий матч
                        </span>
                      )}
                      {match.isArchived && (
                        <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                          В архиве
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-semibold text-text">КАБАНЫ ЕСПОРТС vs {match.opponent}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button type="button" onClick={() => setDraft(match)} className="btn-icon" aria-label={`Редактировать матч против ${match.opponent}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {(finished || match.isArchived) && (
                      <button
                        type="button"
                        onClick={() => handleArchiveToggle(match)}
                        className="btn-icon"
                        aria-label={match.isArchived ? `Вернуть из архива матч против ${match.opponent}` : `В архив: матч против ${match.opponent}`}
                        title={match.isArchived ? 'Вернуть из архива' : 'В архив'}
                      >
                        {match.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(match)}
                      className="btn-icon hover:border-error-500 hover:text-error-500"
                      aria-label={`Удалить матч против ${match.opponent}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <MatchScoreEditor key={match.id} match={match} onSave={actions.saveMatch} />
              </div>
            );
          }}
        />
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.tournament || draft?.opponent ? 'Редактирование матча' : 'Новый матч'}
        widthClass="max-w-2xl"
      >
        {draft && (
          <MatchForm
            key={draft.id}
            initial={draft}
            onCancel={() => setDraft(null)}
            onSave={async (match) => {
              if (await actions.saveMatch(match)) setDraft(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function LogoPreview({ src }: { src: string }) {
  return (
    <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-md border border-border bg-elevated">
      {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-4 w-4 text-muted" />}
    </div>
  );
}
