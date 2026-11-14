import type { Player } from '@/types';

export function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Статистика игрока ${player.nickname}`} className="group w-full overflow-hidden rounded-xl border border-ink-800 bg-ink-950 text-left text-white transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_20px_50px_-20px_rgba(255,30,30,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <div className="relative aspect-[4/5] overflow-hidden">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.nickname}
            loading="lazy"
            className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-ink-900">
            <span className="font-display text-7xl uppercase text-ink-700 transition duration-500 group-hover:text-accent">
              {player.nickname.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-75 bg-accent transition duration-500 group-hover:scale-x-100" />
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-2xl uppercase tracking-wide text-white">{player.nickname}</h3>
          <p className="mt-1 text-sm text-ink-300">{player.name}</p>
        </div>
        <span className="inline-flex rounded border border-accent/60 bg-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          {player.role}
        </span>
      </div>
    </button>
  );
}
