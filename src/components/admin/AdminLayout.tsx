import { useState } from 'react';
import { AlertTriangle, BarChart3, LogOut, Newspaper, Settings, ShoppingBag, Swords, Users, Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { MatchesAdmin } from '@/components/admin/matches/MatchesAdmin';
import { NewsAdmin } from '@/components/admin/news/NewsAdmin';
import { RosterAdmin } from '@/components/admin/roster/RosterAdmin';
import { GalleryAdmin } from '@/components/admin/gallery/GalleryAdmin';
import { MerchAdmin } from '@/components/admin/merch/MerchAdmin';
import { SettingsAdmin } from '@/components/admin/SettingsAdmin';
import { EseaAdminTab } from '@/components/EseaStats';
import { ServiceAdmin } from '@/components/admin/service/ServiceAdmin';

const TABS = [
  { id: 'matches', label: 'Матчи', Icon: Swords },
  { id: 'news', label: 'Новости', Icon: Newspaper },
  { id: 'roster', label: 'Состав CS2', Icon: Users },
  { id: 'gallery', label: 'Галерея', Icon: Images },
  { id: 'merch', label: 'Мерч', Icon: ShoppingBag },
  { id: 'service', label: 'Сервис', Icon: BarChart3 },
  { id: 'esea', label: 'Статистика ESEA', Icon: BarChart3 },
  { id: 'settings', label: 'Настройки сайта', Icon: Settings },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface AdminLayoutProps {
  saveError: string | null;
  onLogout: () => void;
}

export function AdminLayout({ saveError, onLogout }: AdminLayoutProps) {
  const [tab, setTab] = useState<TabId>('matches');

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="container-site flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="hidden rounded bg-accent/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent sm:inline">
              Админ-панель
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/" className="btn-outline hidden sm:inline-flex">
              На сайт
            </Link>
            <button type="button" onClick={onLogout} className="btn-outline">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container-site grid gap-8 py-8 lg:grid-cols-[240px_1fr] lg:py-10">
        <nav aria-label="Разделы админ-панели" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition duration-200 ${
                  isActive
                    ? 'border-accent bg-accent text-white shadow-[0_0_20px_rgb(var(--c-accent)/0.35)]'
                    : 'border-transparent text-muted hover:border-border hover:bg-card hover:text-text'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <main className="min-w-0">
          {saveError && (
            <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-error-500/50 bg-error-500/10 p-4 text-sm text-error-700 dark:text-error-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{saveError}</p>
            </div>
          )}
          {tab === 'matches' && <MatchesAdmin />}
          {tab === 'news' && <NewsAdmin />}
          {tab === 'roster' && <RosterAdmin />}
          {tab === 'gallery' && <GalleryAdmin />}
          {tab === 'merch' && <MerchAdmin />}
          {tab === 'service' && <ServiceAdmin />}
          {tab === 'esea' && <EseaAdminTab />}
          {tab === 'settings' && <SettingsAdmin />}
        </main>
      </div>
    </div>
  );
}
