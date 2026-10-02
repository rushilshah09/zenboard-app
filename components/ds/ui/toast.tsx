"use client";
// A client module: the Toaster reads the store through `useSyncExternalStore`, so a server page
// (the website) can render it and a server never runs it.
import * as React from "react";
import { X } from "@/lib/icons";

// design-system.md §4.41 — transient confirmation of the user's OWN action,
// bottom-right of the CONTENT PANE. Info/success 4s · with action 8s · error
// never auto-dismisses. Hover, focus and a hidden tab pause ALL timers (for real:
// see THE TOAST CLOCK). Max 3 + "+N more". Identical
// toasts within 2s increment a counter. Undo is the most important affordance.

export interface ToastData {
  id: number;
  variant: "info" | "success" | "error";
  message: string;
  action?: { label: string; onAction: () => void };
  count: number;
  /** Wall-clock time of the latest identical message: the DEDUPE window reads this. */
  createdAt: number;
  /** When its life began on the TOAST clock (see `toastLife`): expiry reads this. */
  bornAt: number;
  /**
   * On its way out: still rendered, running its exit, not yet removed. It stops
   * counting as a dedupe target the moment it starts leaving — a repeat of a
   * dying message is a new event, not a ×2 on a corpse.
   */
  leaving?: boolean;
}

type Listener = () => void;
let toasts: ToastData[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

/** The store's read side — the Toaster subscribes through these, and so do tests. */
export const subscribeToasts = (cb: Listener) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const getToasts = (): readonly ToastData[] => toasts;

// ── THE TOAST CLOCK ─────────────────────────────────────────────────────────
// Milliseconds that COUNT toward a toast's life. It advances only while a toast can
// be read and is not being read: never while the pointer or focus rests on the stack,
// never while the tab is hidden. Expiry used to be measured on the wall clock from
// creation, so pausing only POSTPONED it. Measured on the Undo toast: nine seconds of
// resting on it, then gone 700ms after the pointer left; nine seconds in a hidden tab,
// then gone on return — the one affordance you switched away to think about.
// (Emil Kowalski, from building Sonner: "Pause toast timers when the tab is hidden.")
let life = 0;
/** Now, on the toast clock. */
export const toastLife = () => life;
/** Let `ms` of reading time pass. The Toaster calls this; tests call it directly. */
export function liveFor(ms: number) { life += Math.max(0, ms); }
/** How much of a tick's elapsed wall time counts: none while held or hidden. */
export function lifeTick(elapsedMs: number, { held, visible }: { held: boolean; visible: boolean }): number {
  return held || !visible ? 0 : Math.max(0, elapsedMs);
}

/**
 * §4.41's clocks as a pure function of the list: info/success 4s · with an
 * action 8s · error never. A toast already on its way out is not dismissed
 * twice. Pure so the rule can be tested instead of eyeballed through a timer.
 * `now` is the TOAST clock (`toastLife()`), not the wall clock.
 */
export function expiredIds(list: readonly ToastData[], now: number): number[] {
  return list
    .filter((t) => !t.leaving && t.variant !== "error" && now - t.bornAt >= (t.action ? 8000 : 4000))
    .map((t) => t.id);
}

export function toast(opts: {
  message: string;
  variant?: ToastData["variant"];
  action?: ToastData["action"];
  /**
   * How long an identical message counts as the SAME event rather than a new
   * one. §4.41's 2s is right for a confirmation ("Task added" twice really is
   * twice), but some messages report a standing condition instead — "what's on
   * screen may be out of date" is not more true for being said three times.
   * Those pass a longer window and collect a ×N on one toast.
   */
  dedupeMs?: number;
}) {
  const now = Date.now();
  // Dedupe: identical message within the window increments the counter (§4.41).
  const dup = toasts.find((t) => !t.leaving && t.message === opts.message && now - t.createdAt < (opts.dedupeMs ?? 2000));
  if (dup) {
    // A repeat is news: it restarts the window AND the toast's life.
    toasts = toasts.map((t) => (t.id === dup.id ? { ...t, count: t.count + 1, createdAt: now, bornAt: life } : t));
    emit();
    return dup.id;
  }
  const t: ToastData = { id: nextId++, variant: opts.variant ?? "success", message: opts.message, action: opts.action, count: 1, createdAt: now, bornAt: life };
  toasts = [...toasts, t];
  emit();
  return t.id;
}
// A toast used to leave the array the moment its time was up, so it ENTERED on
// a rise and then vanished mid-air. The exit is not decoration: it is the half
// of the gesture that says where the thing went, and it should go back down the
// edge it came up from (§4.41's bottom-right).
//
// So a dismissal is two steps. `leaving` keeps the row on screen running its
// exit; `remove` takes it out for good. The card reports its own `transitionend`,
// so nothing here restates a duration the token already owns — and a floor timer
// runs underneath, because a card whose animation never runs (a hidden tab, a
// reader on reduced motion) must still leave. First one wins; `remove` is
// idempotent.
const EXIT_FLOOR_MS = 400;
function remove(id: number) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}
export function dismissToast(id: number) {
  const t = toasts.find((x) => x.id === id);
  if (!t || t.leaving) return;
  toasts = toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x));
  emit();
  if (typeof setTimeout === "function") setTimeout(() => remove(id), EXIT_FLOOR_MS);
  else remove(id);
}

/**
 * An optimistic edit the server refused, and which is therefore being taken back
 * OFF the screen.
 *
 * This is a separate function from `toast` because it is a different speech act.
 * A plain error toast says "that didn't work". This one has to say *two* things,
 * because a revert is the one failure the interface performs silently by
 * default: what went wrong, AND that the tick you are watching un-tick is the
 * app agreeing with you rather than your finger having missed. Twenty-five
 * surfaces reverted without the second half — you would press again, and again,
 * and never find out why.
 *
 * The wording lives here rather than at the call sites so that the queued path
 * (components/shell/mutation-worker.tsx, which gets there minutes later and from
 * a different tab) and the direct path use the same sentence. They are the same
 * event to the person; only our plumbing differs.
 *
 * Two sentences, not one clause: every server error in this codebase is already
 * a capitalised sentence ("Could not reach the server."), so the earlier
 * `didn’t save — ${reason}` composition read as a capital letter mid-sentence.
 */
export function toastReverted(reason?: string | null) {
  return toast({ message: revertedMessage(reason), variant: "error" });
}

/**
 * The sentence itself, pure so it can be tested rather than eyeballed.
 * See `app/design-system.test.ts` — "a revert says two things".
 */
export function revertedMessage(reason?: string | null): string {
  const why = reason?.trim();
  // Server errors in this codebase are already whole sentences, but a few are
  // written without the stop; one is added rather than assumed so the two
  // sentences never run together.
  const said = why ? (/[.!?]$/.test(why) ? why : `${why}.`) : "Something went wrong.";
  return `${said} Your change was undone.`;
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
      data-leaving={t.leaving ? "" : undefined}
      // TRANSITIONS, not keyframes - Emil Kowalski's rule from building Sonner.
      // Toasts arrive in quick succession; a keyframe restarts from zero when it is
      // interrupted, while a transition retargets from wherever the card already
      // is. The entrance comes from @starting-style (`starting:`), the exit from
      // `leaving`, and the card reports its own transitionend on opacity.
      onTransitionEnd={(e) => { if (t.leaving && e.propertyName === "opacity") remove(t.id); }}
      // A card on its way out stops taking clicks: an Undo pressed as it fades
      // is an Undo you cannot tell whether you got.
      // `before:` bridges the 8px gap above the card, so the pointer never "leaves" the
      // stack between two toasts: it used to, which resumed every clock and collapsed
      // an expanded "+N more" stack mid-reach (Sonner fills the gaps the same way).
      className={`flex w-[360px] relative items-start gap-3 rounded-md border border-line-soft bg-surface-raised px-4 py-3 shadow-lift-2 before:absolute before:inset-x-0 before:-top-2 before:h-2 before:content-[''] transition-[opacity,translate,scale] ease-out-quiet starting:translate-y-2 starting:scale-[0.98] starting:opacity-0 ${t.leaving ? "pointer-events-none translate-y-2 scale-[0.98] opacity-0 duration-fast" : "pointer-events-auto duration-slow"}`}
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
        className="focus-ring -m-1 grid size-6 shrink-0 place-items-center rounded-xs text-ink-500 hover:text-ink-700"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Mount ONCE inside the content pane (absolute bottom-right — §4.41). */
export function Toaster() {
  // getServerSnapshot is the same reader: no toasts exist during SSR, and
  // handing back the identical array keeps the store SSR-safe.
  const list = React.useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const [expanded, setExpanded] = React.useState(false);
  // Pointer or focus resting on the stack. A ref, not state: the clock reads it on
  // every tick, and holding the stack must not re-render every toast.
  const held = React.useRef(false);

  // One clock for the stack, feeding the toast clock above: each tick adds only the
  // time that counts (lifeTick), then dismisses whatever has lived its span.
  React.useEffect(() => {
    let last = performance.now();
    const iv = setInterval(() => {
      const now = performance.now();
      const counted = lifeTick(now - last, { held: held.current, visible: document.visibilityState === "visible" });
      last = now;
      if (!counted) return;
      liveFor(counted);
      // Expiry DISMISSES rather than deletes, so a toast that runs out of time
      // leaves exactly the way one closed by hand does.
      expiredIds(toasts, toastLife()).forEach(dismissToast);
    }, 250);
    // A hidden tab throttles the interval, so the first tick back would carry the
    // whole absence in one delta: count again from the moment the tab returns.
    const onVisibility = () => { last = performance.now(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const visible = expanded ? list : list.slice(-3);
  const hidden = list.length - visible.length;

  return (
    <div
      data-toaster
      // Beside an open side peek rather than on it (`--peek-inset`, page-view.tsx) — but never pushed off the
      // screen: where there is no room beside it (a phone), the toast stays in the corner, over the peek.
      style={{ right: "max(16px, min(calc(var(--peek-inset, 0px) + 16px), calc(100% - 376px)))" }}
      className="pointer-events-none absolute bottom-4 z-toast flex flex-col items-end gap-2"
      onMouseEnter={() => { held.current = true; }}
      onMouseLeave={() => {
        held.current = false;
        setExpanded(false);
      }}
      onFocusCapture={() => { held.current = true; }}
      onBlurCapture={() => { held.current = false; }}
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
