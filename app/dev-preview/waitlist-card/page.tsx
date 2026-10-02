'use client';
// Dev-only: the waitlist card (supplied SVG) — its real shine follows the
// mouse, and the storyboard plays on demand. 404s in prod.
import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { WaitlistCard, type WaitlistStep } from '@/components/site/waitlist-card/waitlist-card';

const INTRO: [WaitlistStep, number][] = [['back', 0], ['rise', 900], ['settle', 900], ['card', 650]];
const JOIN: [WaitlistStep, number][] = [['dispense', 250], ['ticket', 900]];

export default function WaitlistCardPreview() {
  const [step, setStep] = useState<WaitlistStep>('card');
  const [name, setName] = useState('');
  const [timers, setTimers] = useState<number[]>([]);
  const play = (list: [WaitlistStep, number][], after?: () => void) => {
    timers.forEach(clearTimeout);
    let t = 0;
    const ids = list.map(([s, wait]) => window.setTimeout(() => setStep(s), (t += wait)));
    if (after) ids.push(window.setTimeout(after, t + 800));
    setTimers(ids);
  };
  useEffect(() => () => timers.forEach(clearTimeout), [timers]);
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main style={{ display: 'grid', gap: 0 }}>
      {['#000000', '#6E6E6E', '#FFFFFF'].map((bg) => (
        <section key={bg} data-ground={bg} style={{ background: bg, display: 'grid', placeItems: 'center', padding: '96px 16px' }}>
          <WaitlistCard step={bg === '#000000' ? step : 'card'} name={bg === '#000000' ? name : undefined} />
        </section>
      ))}
      <div style={{ position: 'fixed', left: 16, bottom: 16, display: 'flex', gap: 8 }}>
        <button id="intro" onClick={() => { setName(''); setStep('enter'); requestAnimationFrame(() => play(INTRO)); }}>Play intro</button>
        <button id="join" onClick={() => { setName(''); setStep('card'); play(JOIN, () => setName('Maya Shah')); }}>Join</button>
      </div>
    </main>
  );
}
