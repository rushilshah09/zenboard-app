'use client';
// UploadZone — the design-system image drop target (dashed well, drag highlight,
// click-to-browse). Used by the icon picker and the cover picker so upload
// affordances look and behave identically everywhere.
import { useRef, useState } from 'react';
import { Image } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";

export function UploadZone({ hint, height = 120, error, onFile }: {
  hint: string; height?: number; error?: string | null; onFile: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      <button onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height, border: `1.5px dashed ${dragOver ? 'var(--accent-border)' : 'var(--line-3)'}`, borderRadius: 'var(--r-md)', background: dragOver ? 'var(--accent-soft)' : 'transparent', cursor: 'pointer', transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)' }}>
        <Icon icon={Image} size={20} style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: 'var(--text-small-size)', fontWeight: 500, color: 'var(--text-secondary)' }}>Upload an image</span>
        <span style={{ fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>{hint}</span>
      </button>
      {error && <div role="alert" style={{ fontSize: 'var(--text-caption-size)', color: 'var(--red-text)', paddingTop: 6 }}>{error}</div>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}
