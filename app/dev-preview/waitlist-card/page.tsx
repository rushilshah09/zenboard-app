'use client';
// Dev-only: the waitlist card with its mouse-following reflection, on the
// three grounds from the storyboard. 404s in prod.
import { notFound } from 'next/navigation';
import { ShineCard } from '@/components/site/shine-card';

const GROUNDS = ['#FFFFFF', '#6E6E6E', '#000000'];

export default function WaitlistCardPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main style={{ display: 'grid', minHeight: '100dvh' }}>
      {GROUNDS.map((bg) => (
        <section key={bg} data-ground={bg} style={{ background: bg, display: 'grid', placeItems: 'center', padding: '64px 16px' }}>
          <ShineCard src="/waitlist/card.png" alt="Zenboard waitlist card" width={429} height={278.5} />
        </section>
      ))}
    </main>
  );
}
