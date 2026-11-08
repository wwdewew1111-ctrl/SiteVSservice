import { AlertTriangle, Database, Loader2, RotateCw } from 'lucide-react';

interface SiteStatusProps {
  failed: boolean;
  onRetry: () => void;
  reason?: string;
}

export function SiteStatus({ failed, onRetry, reason }: SiteStatusProps) {
  if (failed) {
    const notConfigured = reason === 'config';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
        {notConfigured ? <Database className="h-12 w-12 text-accent" /> : <AlertTriangle className="h-12 w-12 text-accent" />}
        <div className="max-w-xl">
          <p className="font-display text-2xl text-text">{notConfigured ? 'Не настроено подключение к базе данных' : 'Не удалось загрузить данные сайта'}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {notConfigured
              ? 'Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файл .env в корне проекта и перезапустите Vite.'
              : 'Проверьте доступность Supabase и настройки таблиц, затем попробуйте снова.'}
          </p>
          {notConfigured && <code className="mt-4 block rounded-md bg-elevated px-4 py-3 text-left text-xs text-muted">VITE_SUPABASE_URL=https://ваш-проект.supabase.co{`\n`}VITE_SUPABASE_ANON_KEY=ваш-anon-key</code>}
        </div>
        <button type="button" onClick={onRetry} className="btn-primary">
          <RotateCw className="h-4 w-4" />
          Попробовать снова
        </button>
      </div>
    );
  }

  return <div className="flex min-h-screen items-center justify-center bg-bg" role="status" aria-live="polite"><Loader2 className="h-10 w-10 animate-spin text-accent" aria-label="Загрузка" /></div>;
}
