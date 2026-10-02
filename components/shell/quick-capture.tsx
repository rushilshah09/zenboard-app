'use client';
// Quick Capture — the daily-habit hook. Press "C" anywhere (or the header
// Capture button) to drop a thought into the Inbox without leaving what you're
// doing. Capture stays zero-decision: plain text lands in the Inbox. But typed
// intent is honored — "call Sam tomorrow !high ~30m #acme" parses into chips
// (lib/task-parse.ts) shown under the input; a chip is the confirmation, and
// dismissing it keeps the words as literal title text. Keyboard-first: Enter
// saves & closes, Shift/⌘+Enter saves & keeps the field open, Esc closes.
//
// MEMORY (§7X §4.3, M2) rides on the SAME ONE FIELD. It is not a mode: there is
// no Task/Memory toggle, because a toggle taxes every ordinary capture — which
// is nearly all of them — to serve the rare one. The choice is made at COMMIT
// time instead (⌥↵, or the Remember button), which is the moment you actually
// know which of the two you typed.
//
// A fact captured here is about YOU (`self`) — there is no record context in a
// global box, and it is the subject with no other surface in the product. The
// footer says so out loud rather than filing it somewhere you did not expect;
// facts about a CLIENT are captured on the client, where the subject is known.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusReturn } from '@/lib/use-focus-return';
import { useRouter } from 'next/navigation';
import { Inbox, Sun, CornerDownLeft, Check, Brain } from "@/components/ds/icons";
import { Button, Icon, toast } from "@/components/ds/ui";
import { ParsedChips } from '@/components/ui/parsed-chips';
import { addTask } from '@/lib/actions/tasks';
import { remember, forgetMemory } from '@/lib/actions/memory';
import { SELF, bodyProblem, BODY_MAX } from '@/lib/memory';
import { createClient } from '@/lib/supabase/client';
import { parseTask, type ChipKind } from '@/lib/task-parse';

export const CAPTURE_EVENT = 'zb:capture';

export function QuickCapture() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useFocusReturn(open);
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

  /**
   * The same words, committed as a FACT instead of a task.
   *
   * It takes the RAW text, not `parsed.title`: the task grammar strips `!high`,
   * `~30m` and `#acme` because a task carries those as fields, but a fact is one
   * sentence and stripping words out of it would change what it claims.
   */
  async function rememberIt() {
    if (busy) return;
    const body = val;
    const problem = bodyProblem(body);
    if (problem) {
      setErr(problem === 'empty'
        ? 'Write the fact first.'
        : `A memory is one line, trim this to ${BODY_MAX} characters.`);
      return;
    }
    setBusy(true);
    let res: Awaited<ReturnType<typeof remember>>;
    try {
      res = await remember({ body, subject: SELF });
    } catch {
      setBusy(false);
      setErr('That didn’t save. Check your connection and try again.');
      return;
    }
    setBusy(false);
    if ('error' in res) { setErr(res.error); return; }

    const created = res.memory;
    setVal('');
    setCount((c) => c + 1);
    router.refresh(); // /memory reflects it if that is the page behind this
    close();
    toast({
      message: 'Remembered, about you.',
      action: {
        label: 'Undo',
        onAction: () => { forgetMemory(created.id); router.refresh(); },
      },
    });
  }

  if (!open) return null;
  const dest = parsed.scheduledDate ? (parsed.chips.find((c) => c.kind === 'when')?.label ?? 'Scheduled') : 'Inbox';
  const canRemember = !bodyProblem(val);
  // No entrance animation: the global "C" composer is a keyboard surface, and
  // the same argument as the command palette applies — see its note.
  return (
    <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-modal)', background: 'color-mix(in srgb, var(--scrim-color) 38%, transparent)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '16vh' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: 'var(--color-surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lift-3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
          <Icon icon={parsed.scheduledDate ? Sun : Inbox} size={20} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => { setVal(e.target.value); if (err) setErr(null); }}
            onKeyDown={(e) => {
              // ⌥↵ commits the same text as a memory. Checked BEFORE the plain
              // Enter branch, and deliberately not ⌘↵ — that already means
              // "save and keep the field open".
              if (e.key === 'Enter' && e.altKey) { e.preventDefault(); rememberIt(); }
              else if (e.key === 'Enter') { e.preventDefault(); save(e.shiftKey || e.metaKey || e.ctrlKey); }
              else if (e.key === 'Escape') { e.preventDefault(); close(); }
            }}
            // Short, because the Remember button took the room the old
            // placeholder ran into — it clipped mid-word ("…call Sam tomorr").
            // The typed-grammar example moved to the footer, which has space
            // for it and is the surface already teaching this dialog.
            placeholder="Capture a thought…"
            autoComplete="off" data-1p-ignore data-lpignore="true"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-h2-size)', color: 'var(--ink)' }}
          />
          {/* THE DS BUTTON, at the toolbar's size. These were hand-rolled: 30px tall (a height on no
              ladder), a 5px icon gap, caption type at 600, and a field-tier edge on a ghost action. */}
          <Button size="sm" variant="ghost" onClick={rememberIt} disabled={busy || !canRemember} aria-label="Remember this about you"
            title="Remember this about you  ⌥↵" icon={<Icon icon={Brain} size={16} />}>
            Remember
          </Button>
          <Button size="sm" variant="primary" onClick={() => save(false)} disabled={busy || !parsed.title} aria-label={`Save to ${dest}`}
            icon={<Icon icon={CornerDownLeft} size={16} />}>
            Save
          </Button>
        </div>

        {/* Parsed chips — the confirmation layer (shared component). */}
        <ParsedChips chips={parsed.chips} className="px-4 pb-3"
          onDismiss={(k) => { setIgnored((s) => new Set(s).add(k)); inputRef.current?.focus(); }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderTop: '1px solid var(--line-2)', fontSize: 'var(--text-label-size)', color: 'var(--text-muted)' }}>
          {err ? (
            <span style={{ color: 'var(--red-text)' }}>{err}</span>
          ) : !val.trim() ? (
            // An empty field does not need to be told what Enter does — it needs
            // to be told what it accepts. The commit keys take over the moment
            // there is something to commit.
            <span>Try <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>call Sam tomorrow !high 30m</b>: dates, priority and #project are parsed</span>
          ) : (
            <>
              <span><b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Enter</b> saves to <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{dest}</b> · <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Shift+Enter</b> adds another · <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>⌥Enter</b> remembers it about you</span>
              <span style={{ flex: 1 }} />
              {count > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-text)' }}><Icon icon={Check} size={12} /> {count} captured</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
