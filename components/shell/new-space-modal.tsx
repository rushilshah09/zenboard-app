'use client';
// Create a new space (workspace / "organization"). Name + emoji + color + tag.
// createSpace inserts the row and switches into it (sets the active-space cookie);
// the parent refreshes so the new, empty space loads.
import { useState } from 'react';
import { X } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { Input } from '@/components/ui/primitives';
import { createSpace } from '@/lib/actions/spaces';
import type { SpaceTag } from '@/types/database';

const COLORS = ['#9A1B6F', '#7B8B5F', '#C88A3B', '#3086FF', '#55964A', '#5C4FB8'];
const EMOJIS = ['✦', '🌿', '💼', '🚀', '🎯', '📚', '🏢', '🎨'];
const TAGS: SpaceTag[] = ['WORK', 'LIFE', 'SIDE'];

export function NewSpaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✦');
  const [color, setColor] = useState(COLORS[0]);
  const [tag, setTag] = useState<SpaceTag>('WORK');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await createSpace({ name, emoji, color, tag });
    if ('error' in res) { setBusy(false); setErr(res.error); return; }
    onCreated();
  }

  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'color-mix(in srgb, var(--scrim-color) 40%, transparent)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', animation: 'fadein 140ms' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(420px, 92vw)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: color, color: 'var(--on-accent)', display: 'grid', placeItems: 'center', fontSize: 'var(--text-body-lg-size)' }}>{emoji}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-body-lg-size)', fontWeight: 500, color: 'var(--ink)' }}>New space</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Close" style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Icon icon={X} size={16} /></button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>Name</Label>
            <Input autoFocus value={name} onChange={(e) => { setName(e.target.value); if (err) setErr(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              placeholder="e.g. Acme Studio, Side projects…" autoComplete="off" invalid={!!err} />
          </div>
          <div>
            <Label>Icon</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 'var(--text-body-lg-size)', background: emoji === e ? 'var(--accent-soft)' : 'var(--paper-3)', border: '1px solid ' + (emoji === e ? 'var(--accent-border)' : 'var(--line-2)') }}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c} style={{ width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: c, border: color === c ? '2px solid var(--ink)' : '2px solid var(--line)', outline: color === c ? '2px solid var(--paper-2)' : 'none', outlineOffset: -4 }} />
              ))}
            </div>
          </div>
          <div>
            <Label>Type</Label>
            <div style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--paper-3)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)' }}>
              {TAGS.map((t) => (
                <button key={t} onClick={() => setTag(t)} style={{ height: 28, padding: '0 14px', borderRadius: 'var(--r-sm)', border: '1px solid ' + (tag === t ? 'var(--line)' : 'transparent'), background: tag === t ? 'var(--paper-2)' : 'transparent', color: tag === t ? 'var(--ink)' : 'var(--text-secondary)', fontSize: 'var(--text-caption-size)', fontWeight: tag === t ? 600 : 500, cursor: 'pointer', letterSpacing: '0.04em' }}>{t}</button>
              ))}
            </div>
          </div>
          {err && <div style={{ fontSize: 'var(--text-caption-size)', color: 'var(--red-text)' }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--line-2)' }}>
          <button onClick={onClose} style={{ height: 34, padding: '0 14px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', borderRadius: 'var(--r-md)', fontSize: 'var(--text-small-size)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={busy || !name.trim()} style={{ height: 34, padding: '0 16px', background: name.trim() ? 'var(--primary)' : 'var(--paper-3)', color: name.trim() ? 'var(--on-primary)' : 'var(--text-secondary)', border: '1px solid ' + (name.trim() ? 'var(--primary-deep)' : 'var(--line)'), borderRadius: 'var(--r-md)', fontSize: 'var(--text-small-size)', fontWeight: 600, cursor: name.trim() ? 'pointer' : 'default' }}>{busy ? 'Creating…' : 'Create space'}</button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 'var(--text-label-size)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>{children}</div>;
}
