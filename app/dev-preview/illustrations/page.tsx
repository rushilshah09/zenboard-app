'use client';
// Dev-only board of every product illustration, in both tones. 404s in prod.
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { SegmentedControl } from '@/components/ds/ui/segmented';
import { BrandMark } from '@/components/illustrations/primitives';
import { ILLUSTRATIONS, type IllustrationEntry } from '@/components/illustrations/scenes';

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
          <p className="text-caption text-ink-4">{ILLUSTRATIONS.length} scenes · hover a tile to play it</p>
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
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-10 flex flex-col items-center gap-3 text-center md:mb-16">
            <span className="ill-t-caption inline-flex items-center gap-2 rounded-full bg-ill-accent-soft px-3 py-1 font-medium text-ill-accent">
              <BrandMark size={12} /> Product illustrations
            </span>
            <h2 className="ill-t-display max-w-[560px]">
              <span className="text-ill-ink-3">One calm place</span> for the work and the day around it
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-5">
            {ILLUSTRATIONS.map((entry) => (
              <IllustrationTile key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function IllustrationTile({ entry }: { entry: IllustrationEntry }) {
  const { Scene } = entry;
  return (
    <article
      tabIndex={0}
      aria-labelledby={`ill-${entry.id}`}
      className={`ill-tile flex flex-col gap-3 rounded-2xl bg-ill-tile p-3 shadow-ill-1 ${entry.wide ? 'md:col-span-2 lg:col-span-3' : ''}`}
    >
      <div className="overflow-hidden rounded-xl">
        <Scene />
      </div>
      <div className="px-2 pb-2">
        <h3 id={`ill-${entry.id}`} className="ill-t-h4">{entry.title}</h3>
        <p className="ill-t-small mt-1 text-ill-ink-3">{entry.description}</p>
      </div>
    </article>
  );
}
