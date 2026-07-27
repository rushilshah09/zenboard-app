'use client';
// Quick Capture — the daily-habit hook. Press "C" anywhere (or the header
// Capture button) to drop a thought into the Inbox without leaving what you're
// doing. Capture stays zero-decision: plain text lands in the Inbox. But typed
// intent is honored — "call Sam tomorrow !high ~30m #acme" parses into chips
// (lib/task-parse.ts) shown under the input; a chip is the confirmation, and
// dismissing it keeps the words as literal title text. Keyboard-first: Enter
// saves & closes, Shift/⌘+Enter saves & keeps the field open, Esc closes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Sun, CornerDownLeft, Check } from "@/components/ds/icons";
import { Icon } from "@/components/ds/ui";
import { ParsedChips } from '@/components/ui/parsed-chips';
import { addTask } from '@/lib/actions/tasks';
import { createClient } from '@/lib/supabase/client';
import { parseTask, type ChipKind } from '@/lib/task-parse';

export const CAPTURE_EVENT = 'zb:capture';

export function QuickCapture() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0); // captured this session (subtle feedback)
  const [err, setErr] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<Set<ChipKind>>(new Set());
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => { setErr(null); setCount(0); setIgnored(new Set()); setOpen(true); };
    window.addEventListener(CAPTURE_EVENT, onOpen);
    return () => window.removeEventListener(CAPTURE_EVENT, onOpen);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); }, [open]);

  // Project names for #tag matching — fetched once per open, quietly.
  useEffect(() => {
    if (!open || projects.length) return;
    let gone = false;
    createClient().from('projects').select('id, name').eq('status', 'active').limit(50)
      .then(({ data }) => { if (!gone && data) setProjects(data); });
    return () => { gone = true; };
  }, [open, projects.length]);

  const parsed = useMemo(() => parseTask(val, projects, ignored), [val, projects, ignored]);

  function close() { setOpen(false); setVal(''); setErr(null); setIgnored(new Set()); }

  async function save(keepOpen: boolean) {
    if (!parsed.title || busy) return;
    const spec = parsed;
    setVal('');
    setIgnored(new Set());
    setBusy(true);
    const res = await addTask({
      title: spec.title,
      isInbox: !spec.scheduledDate, // a typed date is the one thing that skips the Inbox
      scheduledDate: spec.scheduledDate,
      dueDate: spec.dueDate,
      priority: spec.priority ?? undefined,
      estimateMinutes: spec.estimateMinutes,
      projectId: spec.projectId,
      recurrence: spec.recurrence,
    });
    setBusy(false);
    if ('error' in res) { setErr(res.error); setVal(spec.title); return; }
    setCount((c) => c + 1);
    router.refresh(); // reflect in the Inbox view if it's open
    if (keepOpen) inputRef.current?.focus();
    else close();
  }

  if (!open) return null;
  const dest = parsed.scheduledDate ? (parsed.chips.find((c) => c.kind === 'when')?.label ?? 'Scheduled') : 'Inbox';
  return (
    <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'color-mix(in srgb, var(--scrim-color) 38%, transparent)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '16vh', animation: 'fadein 140ms' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
          <Icon icon={parsed.scheduledDate ? Sun : Inbox} size={20} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => { setVal(e.target.value); if (err) setErr(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(e.shiftKey || e.metaKey || e.ctrlKey); }
              else if (e.key === 'Escape') { e.preventDefault(); close(); }
            }}
            placeholder="Capture a thought…  (try: call Sam tomorrow !high 30m)"
            autoComplete="off" data-1p-ignore data-lpignore="true"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-h2-size)', color: 'var(--ink)' }}
          />
          <button onClick={() => save(false)} disabled={busy || !parsed.title} aria-label={`Save to ${dest}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--primary-deep)', background: parsed.title ? 'var(--primary)' : 'var(--paper-3)', color: parsed.title ? 'var(--on-primary)' : 'var(--text-secondary)', fontSize: 'var(--text-caption-size)', fontWeight: 600, cursor: parsed.title ? 'pointer' : 'default', transition: 'background 120ms, color 120ms' }}>
            <Icon icon={CornerDownLeft} size={14} /> Save
          </button>
        </div>

        {/* Parsed chips — the confirmation layer (shared component). */}
        <ParsedChips chips={parsed.chips} className="px-4 pb-3"
          onDismiss={(k) => { setIgnored((s) => new Set(s).add(k)); inputRef.current?.focus(); }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderTop: '1px solid var(--line-2)', fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>
          {err ? (
            <span style={{ color: 'var(--red-text)' }}>{err}</span>
          ) : (
            <>
              <span><b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Enter</b> saves to <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{dest}</b> · <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Shift+Enter</b> to save &amp; add another · <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Esc</b> to close</span>
              <span style={{ flex: 1 }} />
              {count > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-text)' }}><Icon icon={Check} size={12} /> {count} captured</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
