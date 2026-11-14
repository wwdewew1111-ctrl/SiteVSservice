import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { useSite } from '@/context/siteStore';
import { useLazySection } from '@/context/useLazySection';
import { SectionStatus } from '@/components/ui/SectionStatus';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Lightbox } from './Lightbox';

export function GallerySection() {
  const { data } = useSite();
  const { ref, status, retry } = useLazySection('gallery');
  const photos = data.gallery;
  const [index, setIndex] = useState<number | null>(null);

  return (
    <section ref={ref} id="gallery" className="min-h-80 scroll-mt-20 py-20 sm:py-28">
      <div className="container-site">
        <SectionHeading
          eyebrow="Галерея"
        />

        {status !== 'loaded' ? <SectionStatus status={status} onRetry={retry} /> : photos.length === 0 ? (
          <p className="text-muted">Фотографий пока нет.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Открыть фото: ${photo.caption || `№${i + 1}`}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <img
                  src={photo.src}
                  alt={photo.caption}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-lg">
                    <ZoomIn className="h-5 w-5" />
                  </span>
                </div>
                {photo.caption && (
                  <p className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-left text-sm font-medium text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {photo.caption}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {index !== null && photos[index] && (
        <Lightbox photos={photos} index={index} onNavigate={setIndex} onClose={() => setIndex(null)} />
      )}
    </section>
  );
}
