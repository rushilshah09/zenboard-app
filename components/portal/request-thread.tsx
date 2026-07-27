'use client';
// The client↔team conversation on a request. Presentational only — each surface
// (owner inbox, portal) maps its data to ThreadMessage[] and owns its composer.
// Team messages sit left with a quiet label; client messages sit right, tinted.
// Internal notes (owner side only) carry a subtle "Internal" tag.
import { cn } from '@/lib/cn';

export type ThreadMessage = {
  author: 'team' | 'client';
  body: string;
  createdAt: string;
  internal?: boolean; // team-only note, never shown in the portal
};

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
                    : 'border border-line-soft bg-surface text-ink-800',
              )}
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="text-overline uppercase text-ink-500">{fromClient ? 'Client' : 'You'}</span>
                {m.internal && <span className="text-overline uppercase text-ink-400">· Internal</span>}
                <span className="text-caption tabular-nums text-ink-400">{relTime(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-ui leading-relaxed">{m.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
