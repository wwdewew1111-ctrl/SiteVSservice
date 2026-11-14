import { ArrowRight } from 'lucide-react';
import { useSite } from '@/context/siteStore';

export function Hero() {
  const { heroTitle, heroSubtitle, heroImage } = useSite().data.settings;
  const [firstWord, ...restWords] = heroTitle.split(' ');
  const accentWords = restWords.join(' ');
  const marqueeItem = 'КАБАНЫ ЕСПОРТС • CS2 • Сила в команде • ';

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-ink-950 text-white"
    >
      {heroImage ? <img
        src={heroImage}
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45"
      /> : <div className="absolute inset-0 -z-20 bg-ink-950" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/50" />
      <div className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.035)_0px,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_4px)]" />
      <div className="absolute -right-16 top-0 -z-10 hidden h-full w-64 -skew-x-12 bg-accent/90 shadow-[0_0_60px_rgba(255,30,30,0.5)] lg:block" />
      <div className="absolute right-[15rem] top-0 -z-10 hidden h-full w-1 -skew-x-12 bg-accent lg:block" />

      <div className="container-site relative pb-32 pt-20">
        <p className="animate-fade-up flex items-center gap-3 border-l-4 border-accent pl-3 text-xs font-semibold uppercase tracking-[0.3em] text-ink-100">
          Counter-Strike 2 • Официальный сайт
        </p>

        <h1 className="animate-fade-up mt-6 font-display text-5xl uppercase leading-[1.05] sm:text-7xl lg:text-8xl [animation-delay:120ms]">
          <span className="block text-white">{firstWord}</span>
          <span
            className="block text-accent [text-shadow:0_0_28px_rgba(255,30,30,0.55)]"
          >
            {accentWords}
          </span>
        </h1>

        <p className="animate-fade-up mt-8 max-w-xl text-lg leading-relaxed text-ink-300 [animation-delay:240ms]">
          {heroSubtitle}
        </p>

        <div className="animate-fade-up mt-10 flex flex-col gap-3 sm:flex-row [animation-delay:360ms]">
          <a href="#roster" className="btn-primary">
            Смотреть состав
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#news"
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/30 px-5 text-sm font-semibold uppercase tracking-wider text-white transition duration-200 hover:border-accent hover:text-accent"
          >
            Последние новости
          </a>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-y border-accent/50 bg-accent/10 py-3 backdrop-blur-sm">
        <div className="flex w-max animate-marquee whitespace-nowrap">
          {[0, 1].map((group) => (
            <div key={group} className="flex shrink-0 items-center font-display text-sm uppercase tracking-[0.3em] text-white/85">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="pr-2">
                  {marqueeItem}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
