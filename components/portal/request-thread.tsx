'use client';
// The client↔team conversation on a request. Presentational only — each surface
// (owner inbox, portal) maps its data to ThreadMessage[] and owns its composer.
// Team messages sit left with a quiet label; client messages sit right, tinted.
// Internal notes (owner side only) carry a subtle "Internal" tag.
import { cn } from '@/lib/cn';
import { formatAgo } from '@/lib/date';

export type ThreadMessage = {
  author: 'team' | 'client';
  body: string;
  createdAt: string;
  internal?: boolean; // team-only note, never shown in the portal
};

// A client thread wants sub-day resolution — that is what `precise` is for.
const relTime = (iso: string) => formatAgo(iso, { precise: true }) ?? '';

export function RequestThread({ messages, className }: { messages: ThreadMessage[]; className?: string }) {
  if (messages.length === 0) return null;
  return (
    <div className={cn('grid gap-2', className)}>
      {messages.map((m, i) => {
        const fromClient = m.author === 'client';
        return (
          <div key={i} className={cn('flex', fromClient ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2',
                fromClient
                  ? 'bg-accent-soft text-ink-900'
                  : m.internal
                    ? 'border border-dashed border-line-strong bg-surface-sunken text-ink-700'
                    // The request card's own tone (`surface-raised`), edged by the
                    // border — one fill, not a card inside a card. `bg-surface`
                    // was never a token, so this bubble had no fill at all.
                    : 'border border-line-soft bg-surface-raised text-ink-800',
              )}
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-overline text-ink-500">{fromClient ? 'Client' : 'You'}</span>
                {m.internal && <span className="text-overline text-ink-500">· Internal</span>}
                <span className="text-caption tabular-nums text-ink-500">{relTime(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-ui leading-relaxed">{m.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
