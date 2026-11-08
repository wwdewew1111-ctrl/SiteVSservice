import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { href: '#matches', label: 'Матчи' },
  { href: '#news', label: 'Новости' },
  { href: '#roster', label: 'Состав' },
  { href: '#statistics', label: 'Статистика' },
  { href: '#gallery', label: 'Галерея' },
  { href: '#merch', label: 'Мерч' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <a href="#top" aria-label="KAB6ANbl ESPORTS, на главную" className="text-text">
          <Logo />
        </a>

        <nav className="hidden items-center md:flex" aria-label="Основная навигация">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative px-4 py-2 text-sm font-medium uppercase tracking-wider text-text transition hover:text-accent"
            >
              {link.label}
              <span className="absolute inset-x-4 bottom-0 h-0.5 origin-left scale-x-0 bg-accent transition duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            className="btn-icon md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border bg-bg animate-fade-in md:hidden" aria-label="Мобильная навигация">
          <div className="container-site flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-border py-4 text-sm font-semibold uppercase tracking-wider text-text transition last:border-b-0 hover:text-accent"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
