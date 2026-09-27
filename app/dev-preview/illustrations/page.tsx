'use client';
// Dev-only board of every product illustration, in both tones. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { SegmentedControl } from '@/components/ds/ui/segmented';
import { BrandMark } from '@/components/illustrations/primitives';
import { ILLUSTRATIONS } from '@/components/illustrations/scenes';
import { FeatureGrid } from '@/components/illustrations/feature-grid';

type Tone = 'light' | 'dark';
type Motion = 'hover' | 'always';

export default function IllustrationsBoardPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const [tone, setTone] = useState<Tone>('light');
  const [motion, setMotion] = useState<Motion>('hover');

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3 md:px-10">
        <div className="mr-auto">
          <h1 className="text-h2 text-ink">Illustrations</h1>
          <p className="text-caption text-ink-4">{ILLUSTRATIONS.length} scenes · hover a feature to play it</p>
        </div>
        <SegmentedControl
          aria-label="Tone"
          value={tone}
          onValueChange={(v) => setTone(v as Tone)}
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        />
        <SegmentedControl
          aria-label="Motion"
          value={motion}
          onValueChange={(v) => setMotion(v as Motion)}
          options={[{ value: 'hover', label: 'On hover' }, { value: 'always', label: 'Always' }]}
        />
      </header>

      <main className="ill-scope bg-ill-page px-4 py-10 md:px-10 md:py-16" data-ill-tone={tone} data-ill-motion={motion}>
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 flex flex-col items-center gap-3 text-center md:mb-16">
            <span className="ill-t-caption inline-flex items-center gap-2 rounded-full bg-ill-accent-soft px-3 py-1 font-medium text-ill-accent">
              <BrandMark size={12} /> Product illustrations
            </span>
            <h2 className="ill-t-display max-w-[560px]">
              <span className="text-ill-ink-3">One calm place</span> for the work and the day around it
            </h2>
          </div>

          <FeatureGrid />
        </div>
      </main>
    </div>
  );
}
