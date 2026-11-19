import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loginAdmin } from '@/lib/adminAuth';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await loginAdmin(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <div className="container-site flex h-16 items-center justify-between">
        <Link to="/" aria-label="КАБАНЫ ЕСПОРТС, на главную" className="text-text">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="card w-full max-w-md p-6 shadow-xl animate-slide-up sm:p-10">
          <div className="mb-8 grid h-14 w-14 place-items-center rounded-xl bg-accent text-white shadow-[0_0_24px_rgb(var(--c-accent)/0.45)]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl">Вход в админ-панель</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Введите пароль, чтобы управлять новостями, составом, галереей и мерчем.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="admin-password" className="label">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoFocus
                  autoComplete="current-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  aria-invalid={error ? true : undefined}
                  className="input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted transition hover:text-accent"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-2 text-sm text-error-700 dark:text-error-500">
                  {error}
                </p>
              )}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Проверяем...' : 'Войти'}
            </button>
          </form>

          <Link to="/" className="mt-6 block text-center text-sm text-muted transition hover:text-accent">
            Вернуться на сайт
          </Link>
        </div>
      </div>
    </div>
  );
}
