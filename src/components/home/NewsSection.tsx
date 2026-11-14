import { useState } from 'react';
import { useSite } from '@/context/siteStore';
import { useLazySection } from '@/context/useLazySection';
import { SectionStatus } from '@/components/ui/SectionStatus';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { NewsCard } from './NewsCard';
import { NewsArticle } from './NewsArticle';
import { Modal } from '@/components/ui/Modal';

export function NewsSection() {
  const { data } = useSite();
  const { ref, status, retry } = useLazySection('news');
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = data.news.find((item) => item.id === activeId) ?? null;

  return (
    <section ref={ref} id="news" className="min-h-80 scroll-mt-20 py-20 sm:py-28">
      <div className="container-site">
        <SectionHeading
          eyebrow="Новости команды"
          title="Последние события"
          description="Турниры, победы, составы и закулисье KAB6ANbl ESPORTS."
        />

        {status !== 'loaded' ? <SectionStatus status={status} onRetry={retry} /> : data.news.length === 0 ? (
          <p className="text-muted">Новостей пока нет. Загляните позже.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.news.map((item) => (
              <NewsCard key={item.id} item={item} onOpen={() => setActiveId(item.id)} />
            ))}
          </div>
        )}
      </div>

      <Modal open={active !== null} onClose={() => setActiveId(null)} title={active?.title ?? 'Новость'} widthClass="max-w-3xl">
        {active && <NewsArticle item={active} />}
      </Modal>
    </section>
  );
}
