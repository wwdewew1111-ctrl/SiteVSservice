import { Link } from 'react-router-dom';
import { useSite } from '@/context/siteStore';
import { SocialIcons } from '@/components/ui/SocialIcons';
import { Logo } from './Logo';

const FOOTER_LINKS = [
  { href: '#news', label: 'Новости' },
  { href: '#roster', label: 'О нас' },
  { href: '#gallery', label: 'Галерея' },
  { href: '#merch', label: 'Мерч' },
];

export function Footer() {
  const { data } = useSite();
  const { socials, partners } = data.settings;

  return (
    <footer className="border-t border-accent/40 bg-ink-950 text-ink-100">
      <div className="container-site py-14">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="space-y-6">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-ink-300">
              Профессиональная киберспортивная команда по CS2. Играем на результат и держим марку.
            </p>
            <SocialIcons links={socials} />
          </div>

          <div>
            <h3 className="mb-5 font-display text-sm uppercase tracking-wider text-white">Разделы</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-ink-300 transition hover:text-accent">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-5 font-display text-sm uppercase tracking-wider text-white">Партнеры</h3>
            {partners.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3">
                {partners.map((partner) => {
                  const content = partner.logo ? (
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      loading="lazy"
                      className="max-h-14 w-auto max-w-full object-contain opacity-80 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
                    />
                  ) : (
                    <span className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink-100">
                      {partner.name}
                    </span>
                  );
                  const className =
                    'group flex h-24 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 transition duration-300 hover:border-accent hover:bg-white/10';
                  return (
                    <li key={partner.id}>
                      {partner.url ? (
                        <a href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={partner.name} className={className}>
                          {content}
                        </a>
                      ) : (
                        <div className={className}>{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-300">Партнеры скоро появятся здесь.</p>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-800 pt-6 text-xs text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} КАБАНЫ ЕСПОРТС. Все права защищены.</p>
          <Link to="/admin" className="transition hover:text-accent">
            Вход для администратора
          </Link>
        </div>
      </div>
    </footer>
  );
}
