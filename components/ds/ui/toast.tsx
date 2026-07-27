import * as React from "react";
import { X } from "@/lib/icons";

// design-system.md §4.41 — transient confirmation of the user's OWN action,
// bottom-right of the CONTENT PANE. Info/success 4s · with action 8s · error
// never auto-dismisses. Hover pauses ALL timers. Max 3 + "+N more". Identical
// toasts within 2s increment a counter. Undo is the most important affordance.

export interface ToastData {
  id: number;
  variant: "info" | "success" | "error";
  message: string;
  action?: { label: string; onAction: () => void };
  count: number;
  createdAt: number;
}

type Listener = () => void;
let toasts: ToastData[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function toast(opts: { message: string; variant?: ToastData["variant"]; action?: ToastData["action"] }) {
  const now = Date.now();
  // Dedupe: identical message within 2s increments the counter (§4.41).
  const dup = toasts.find((t) => t.message === opts.message && now - t.createdAt < 2000);
  if (dup) {
    toasts = toasts.map((t) => (t.id === dup.id ? { ...t, count: t.count + 1, createdAt: now } : t));
    emit();
    return dup.id;
  }
  const t: ToastData = { id: nextId++, variant: opts.variant ?? "success", message: opts.message, action: opts.action, count: 1, createdAt: now };
  toasts = [...toasts, t];
  emit();
  return t.id;
}
export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// Handoff Toast: a 3px coloured left bar carries the variant (no leading icon).
const BAR: Record<ToastData["variant"], string> = {
  info: "bg-info-600",
  success: "bg-success-600",
  error: "bg-danger-600",
};

function ToastCard({ t }: { t: ToastData }) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-[360px] items-start gap-3 rounded-lg border border-line-soft bg-surface-raised px-4 py-3 shadow-lift-2 animate-rise"
    >
      <span aria-hidden className={`w-[3px] shrink-0 self-stretch rounded-full ${BAR[t.variant]}`} />
      <p className="min-w-0 flex-1 text-body text-ink-800">
        {t.message}
        {t.count > 1 && <span className="text-ink-500"> ×{t.count}</span>}
      </p>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action!.onAction();
            dismissToast(t.id);
          }}
          className="focus-ring shrink-0 rounded-xs text-body font-medium text-berry-600 underline-offset-2 hover:underline"
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(t.id)}
        className="focus-ring -m-1 grid size-6 shrink-0 place-items-center rounded-xs text-ink-400 hover:text-ink-700"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Mount ONCE inside the content pane (absolute bottom-right — §4.41). */
export function Toaster() {
  const list = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts, // getServerSnapshot — no toasts exist during SSR; keeps the store SSR-safe
  );
  const [paused, setPaused] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // One ticking clock; each toast expires by its own duration unless paused.
  React.useEffect(() => {
    if (paused) return;
    const iv = setInterval(() => {
      const now = Date.now();
      const keep = toasts.filter((t) => {
        if (t.variant === "error") return true; // never auto-dismiss (§4.41)
        const dur = t.action ? 8000 : 4000;
        return now - t.createdAt < dur;
      });
      if (keep.length !== toasts.length) {
        toasts = keep;
        emit();
      }
    }, 250);
    return () => clearInterval(iv);
  }, [paused]);

  const visible = expanded ? list : list.slice(-3);
  const hidden = list.length - visible.length;

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-toast flex flex-col items-end gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setExpanded(false);
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {hidden > 0 && (
        <button
          type="button"
          onMouseEnter={() => setExpanded(true)}
          className="pointer-events-auto rounded-full bg-paper-4 px-2.5 py-1 text-caption font-medium text-ink-600 shadow-lift-1"
        >
          +{hidden} more
        </button>
      )}
      {visible.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  );
}
