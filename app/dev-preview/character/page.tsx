'use client';
// Dev-only: one character at a time — full figure and its avatar. 404s in prod.
import { notFound } from 'next/navigation';
import { Ink } from '@/components/illustrations/ink';
import { MAYA, MAYA_AVATAR } from '@/components/illustrations/ink/character';

export default function CharacterPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main style={{ background: '#F2F1EB', minHeight: '100dvh', padding: 40, display: 'flex', gap: 48, alignItems: 'flex-end' }}>
      <div id="figure"><Ink art={MAYA} size={240} /></div>
      <div id="avatar" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Ink art={MAYA_AVATAR} size={240} style={{ borderRadius: 12 }} />
        <Ink art={MAYA_AVATAR} size={96} style={{ borderRadius: '50%' }} />
        <Ink art={MAYA_AVATAR} size={40} style={{ borderRadius: '50%' }} />
      </div>
    </main>
  );
}
