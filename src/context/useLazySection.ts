import { useEffect, useRef } from 'react';
import { useSite, type SiteSection } from '@/context/siteStore';

export function useLazySection(section: SiteSection, enabled = true) {
  const ref = useRef<HTMLElement>(null);
  const { sectionStatus, loadSection } = useSite();

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || sectionStatus[section] !== 'idle') return;
    if (!('IntersectionObserver' in window)) {
      void loadSection(section);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadSection(section);
        observer.disconnect();
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [section, enabled, sectionStatus, loadSection]);

  return { ref, status: sectionStatus[section], retry: () => void loadSection(section) };
}
