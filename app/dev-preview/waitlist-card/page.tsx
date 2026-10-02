'use client';
// Dev-only: the waitlist card with its own shine made interactive, on the
// storyboard grounds, plus the scroll mode. 404s in prod.
import { notFound } from 'next/navigation';
import { ShineCard } from '@/components/site/shine-card';

const GROUNDS = ['#FFFFFF', '#6E6E6E', '#000000'];
const CARD = { src: '/waitlist/card-matte.png', alt: 'Zenboard waitlist card', width: 429, height: 278.5 };

export default function WaitlistCardPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main style={{ display: 'grid' }}>
      {GROUNDS.map((bg) => (
        <section key={bg} data-ground={bg} style={{ background: bg, display: 'grid', placeItems: 'center', padding: '64px 16px' }}>
          <ShineCard {...CARD} />
        </section>
      ))}
      <section data-mode="scroll" style={{ background: '#F2F1EB', display: 'grid', placeItems: 'center', padding: '50vh 16px' }}>
        <ShineCard {...CARD} mode="scroll" />
      </section>
    </main>
  );
}
