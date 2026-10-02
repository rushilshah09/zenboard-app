'use client';
// "Preview as client" (Surface B). Fetches the EXACT projection via the same
// loader the public portal uses (getPortalPreview → loadPortalPreview) and
// renders it with the shared PortalDocument, inside a framed chrome with a
// "Previewing as client" bar so the owner trusts what's exposed.
//
// Tokens only: scrim/z/ink-solid ladder utilities — no legacy Paper-OS vars.
import { useEffect, useState } from 'react';
import { X, Eye } from "@/components/ds/icons";
import { Icon, FullScreenLayer } from "@/components/ds/ui";
import { getPortalPreview } from '@/lib/actions/portal';
import { PortalDocument } from '@/components/portal/portal-document';
import type { PortalView } from '@/lib/portal';

export function PreviewOverlay({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [view, setView] = useState<PortalView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    getPortalPreview(projectId)
      .then((v) => { if (!alive) return; if (v) { setView(v); setState('ready'); } else setState('error'); })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [projectId]);

  // Escape, the scrim, the z value, the dialog role, focus in and focus back are
  // all the layer's now — this overlay only had two of those six.
  return (
    <FullScreenLayer label="Preview as client" onClose={onClose} surface="scrim" dismissOnBackdrop
      className="flex flex-col items-center overflow-y-auto p-[clamp(12px,3vw,32px)]">
      {/* Previewing bar — the ink-solid fill with its onsolid ink/line steps */}
      <div className="flex w-full max-w-[1080px] shrink-0 items-center gap-2.5 rounded-t-lg bg-ink-900 px-4 py-2.5 text-onsolid">
        <Icon icon={Eye} size={16} />
        <span className="flex-1 text-ui font-medium">Previewing as client</span>
        <span className="text-caption">This is exactly what they see</span>
        <button onClick={onClose} aria-label="Close preview"
          className="focus-ring grid size-6 place-items-center rounded-sm border border-line-onsolid text-onsolid transition-colors duration-fast hover:bg-ink-700">
          <Icon icon={X} size={14} />
        </button>
      </div>

      {/* Framed portal — a windowed view of the live client dashboard. The
          shell owns its own background + padding, so the frame just clips it to
          the rounded bottom and caps the height to scroll internally. */}
      <div
        className="w-full max-w-[1080px] shrink-0 overflow-y-auto rounded-b-lg border border-t-0 border-line-soft"
        style={{ maxHeight: 'calc(100dvh - 96px)' }}>
        {state === 'loading' && <Center>Loading preview…</Center>}
        {state === 'error' && <Center>Couldn’t load the preview. Try again.</Center>}
        {state === 'ready' && view && <PortalDocument view={view} preview embedded />}
      </div>
    </FullScreenLayer>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center text-body text-ink-500">{children}</div>;
}
