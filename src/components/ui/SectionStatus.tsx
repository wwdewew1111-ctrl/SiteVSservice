import type { SectionStatus as LoadStatus } from '@/context/siteStore';

export function SectionStatus({ status, onRetry }: { status: LoadStatus; onRetry: () => void }) {
  if (status === 'loaded') return null;
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>Не удалось загрузить раздел.</span>
        <button type="button" onClick={onRetry} className="font-semibold text-accent underline">Попробовать снова</button>
      </div>
    );
  }
  return <p role="status" className="text-sm text-muted">Загружаем данные...</p>;
}
