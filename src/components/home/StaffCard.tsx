import type { Player } from '@/types';

export function StaffCard({ member }: { member: Player }) {
  return (
    <article className="group w-full overflow-hidden rounded-xl border border-ink-800 bg-ink-950 text-white transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_20px_50px_-20px_rgba(255,30,30,0.6)]">
      <div className="relative aspect-[4/5] overflow-hidden">
        {member.photo ? (
          <img src={member.photo} alt={member.nickname} loading="lazy" className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-ink-900">
            <span className="font-display text-7xl uppercase text-ink-700 transition duration-500 group-hover:text-accent">{member.nickname.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-75 bg-accent transition duration-500 group-hover:scale-x-100" />
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-2xl uppercase tracking-wide text-white">{member.nickname}</h3>
          {member.name && <p className="mt-1 text-sm text-ink-300">{member.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {member.role.trim().split(/\s+/).filter(Boolean).map((role, index) => (
            <span key={`${role}-${index}`} className="max-w-full break-words rounded border border-accent/60 bg-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">{role}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
