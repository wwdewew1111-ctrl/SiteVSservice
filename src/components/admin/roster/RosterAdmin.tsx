import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useSite } from '@/context/siteStore';
import { createId } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { SortableList } from '@/components/admin/SortableList';
import { PlayerForm } from './PlayerForm';
import type { Player } from '@/types';

function createBlankPlayer(isStaff: boolean): Player {
  return {
    id: createId(),
    nickname: '',
    name: '',
    surname: '',
    role: '',
    bio: '',
    quote: '',
    photo: '',
    isCoach: isStaff,
  };
}

export function RosterAdmin() {
  const { data, actions } = useSite();
  const [draft, setDraft] = useState<Player | null>(null);
  const [tab, setTab] = useState<'players' | 'staff'>('players');
  const visiblePlayers = data.players.filter((player) => player.isCoach === (tab === 'staff'));

  const handleDelete = (player: Player) => {
    if (window.confirm(`Удалить ${player.isCoach ? 'сотрудника' : 'игрока'} ${player.nickname}?`)) {
      actions.deletePlayer(player.id);
    }
  };

  return (
    <div>
      <AdminToolbar
        title="Состав и Staff"
        description="Управляйте игроками и сотрудниками команды: добавляйте, редактируйте и меняйте порядок карточек."
        action={
          <button type="button" onClick={() => setDraft(createBlankPlayer(tab === 'staff'))} className="btn-primary">
            <Plus className="h-4 w-4" />
            {tab === 'staff' ? 'Добавить сотрудника' : 'Добавить игрока'}
          </button>
        }
      />

      <div role="group" aria-label="Раздел команды" className="mb-6 inline-flex rounded-lg border border-border bg-elevated p-1">
        {([
          { value: 'players', label: 'Состав по CS2' },
          { value: 'staff', label: 'Staff' },
        ] as const).map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              tab === item.value ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visiblePlayers.length === 0 ? (
        <div className="card p-10 text-center text-muted">{tab === 'staff' ? 'Сотрудники пока не добавлены.' : 'В составе пока никого нет.'}</div>
      ) : (
        <SortableList
          items={visiblePlayers}
          label={tab === 'staff' ? 'сотрудник' : 'игрок'}
          onReorder={(ordered) => {
            let index = 0;
            void actions.reorderPlayers(data.players.map((player) => player.isCoach === (tab === 'staff') ? ordered[index++] : player));
          }}
          renderItem={(player) => (
            <div className="card flex items-center gap-4 p-4">
              {player.photo ? (
                <img src={player.photo} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="grid h-20 w-16 shrink-0 place-items-center rounded-md bg-elevated font-display text-2xl uppercase text-muted">
                  {player.nickname.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg uppercase text-text">{player.nickname}</p>
                <p className="truncate text-sm text-muted">{[player.name, player.surname].filter(Boolean).join(' ')}</p>
                <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-accent">{player.role}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setDraft(player)} className="btn-icon" aria-label={`Редактировать ${player.nickname}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(player)}
                  className="btn-icon hover:border-error-500 hover:text-error-500"
                  aria-label={`Удалить ${player.nickname}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        />
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.nickname ? `Редактирование ${draft.isCoach ? 'сотрудника' : 'игрока'}` : draft?.isCoach ? 'Новый сотрудник' : 'Новый игрок'}
        widthClass="max-w-2xl"
      >
        {draft && (
          <PlayerForm
            key={draft.id}
            initial={draft}
            onCancel={() => setDraft(null)}
            onSave={async (player) => {
              if (await actions.savePlayer(player)) setDraft(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
