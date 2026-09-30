'use client';
// Dev-only gallery for the Zen Ink illustration set — spots and scenes on the
// light paper ground and on a dark surface. 404s in prod.
import { notFound } from 'next/navigation';
import {
  Spot, Scene, IconBadge, BoldScene, SPOTS, SCENES, BADGES, BOLD_SCENES,
  type SpotName, type SceneName, type BadgeName, type BoldSceneName,
} from '@/components/illustrations/ink';

function Board({ dark }: { dark?: boolean }) {
  return (
    <section
      className={dark ? 'ill-on-dark' : undefined}
      style={{ background: dark ? '#1B1A18' : '#F7F5F0', color: dark ? '#E9E4DA' : '#3A3632', padding: 48, borderRadius: 16 }}
    >
      <h2 style={{ margin: '0 0 24px', font: '600 14px/1 var(--font-ui)', letterSpacing: '0.02em', opacity: 0.6 }}>
        Spots {dark ? '· dark surface' : '· paper'}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 32 }}>
        {(Object.keys(SPOTS) as SpotName[]).map((n) => (
          <figure key={n} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Spot name={n} size={112} />
            <figcaption style={{ font: '12px var(--font-ui)', opacity: 0.55 }}>{n}</figcaption>
          </figure>
        ))}
      </div>
      {Object.keys(SCENES).length > 0 && (
        <>
          <h2 style={{ margin: '48px 0 24px', font: '600 14px/1 var(--font-ui)', letterSpacing: '0.02em', opacity: 0.6 }}>Scenes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 40 }}>
            {(Object.keys(SCENES) as SceneName[]).map((n) => (
              <figure key={n} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Scene name={n} size={340} />
                <figcaption style={{ font: '12px var(--font-ui)', opacity: 0.55 }}>{n}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BoldBoard() {
  return (
    <section style={{ background: '#FFFFFF', color: '#3A3632', padding: 48, borderRadius: 16 }}>
      <h2 style={{ margin: '0 0 24px', font: '600 14px/1 var(--font-ui)', letterSpacing: '0.02em', opacity: 0.6 }}>Zen Bold · icon badges</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 32 }}>
        {(Object.keys(BADGES) as BadgeName[]).map((n) => (
          <figure key={n} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <IconBadge name={n} size={112} />
            <figcaption style={{ font: '12px var(--font-ui)', opacity: 0.55 }}>{n}</figcaption>
          </figure>
        ))}
      </div>
      <h2 style={{ margin: '48px 0 24px', font: '600 14px/1 var(--font-ui)', letterSpacing: '0.02em', opacity: 0.6 }}>Zen Bold · scenes</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 32 }}>
        {(Object.keys(BOLD_SCENES) as BoldSceneName[]).map((n) => (
          <figure key={n} style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <BoldScene name={n} size={280} />
            <figcaption style={{ font: '12px var(--font-ui)', opacity: 0.55 }}>{n}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function IllustrationsPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main style={{ minHeight: '100dvh', background: '#EDEAE3', padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <BoldBoard />
      <Board />
      <Board dark />
    </main>
  );
}
