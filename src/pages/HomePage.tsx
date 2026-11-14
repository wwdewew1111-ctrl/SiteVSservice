import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { MatchesSection } from '@/components/home/MatchesSection';
import { NewsSection } from '@/components/home/NewsSection';
import { RosterSection } from '@/components/home/RosterSection';
import { GallerySection } from '@/components/home/GallerySection';
import { MerchSection } from '@/components/home/MerchSection';
import { EseaPublicSection } from '@/components/EseaStats';

export function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Header />
      <main>
        <Hero />
        <MatchesSection />
        <NewsSection />
        <RosterSection />
        <EseaPublicSection />
        <GallerySection />
        <MerchSection />
      </main>
      <Footer />
    </div>
  );
}
