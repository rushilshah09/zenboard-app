import * as React from "react";
import * as RDlg from "@radix-ui/react-dialog";
import { OctagonAlert, TriangleAlert, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { TextInput } from "./input";

// design-system.md §4.36 — a decision or focused task that must not be
// interrupted. Focus goes to the first input, never the × and never the
// destructive button. Dirty forms turn Esc/outside-click into "Discard changes?"
// — the only legal nested modal.

const SIZE = {
  sm: "w-[400px]",
  md: "w-[560px]",
  lg: "w-[720px]",
  full: "w-[calc(100vw-64px)] max-w-[1200px]",
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  size?: keyof typeof SIZE;
  title: string;
  description?: string;
  /** When true, Esc/outside-click ask "Discard changes?" instead of closing. */
  dirty?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal({ open, onOpenChange, size = "md", title, description, dirty, footer, children }: ModalProps) {
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);

  const guard = (e: { preventDefault: () => void }) => {
    if (dirty) {
      e.preventDefault();
      setConfirmDiscard(true);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  return (
    <>
      <RDlg.Root open={open} onOpenChange={onOpenChange}>
        <RDlg.Portal>
          <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]" />
          <RDlg.Content
            onEscapeKeyDown={guard}
            onPointerDownOutside={guard}
            onOpenAutoFocus={(e) => {
              // First input, else the panel — never the × (§4.36).
              const panel = e.currentTarget as HTMLElement | null;
              const first = panel?.querySelector<HTMLElement>("input, textarea, select, [contenteditable]");
              if (first) {
                e.preventDefault();
                first.focus();
              }
            }}
            className={cn(
              "fixed left-1/2 top-1/2 z-modal flex max-h-[calc(100vh-96px)] -translate-x-1/2 -translate-y-1/2 flex-col",
              "rounded-xl border border-line bg-surface-raised shadow-lift-3",
              "data-[state=open]:animate-rise data-[state=closed]:animate-exit",
              // Never wider than the viewport — the fixed SIZE widths (up to 720px)
              // otherwise overflow small screens off both edges.
              "max-w-[calc(100vw-2rem)]",
              SIZE[size],
            )}
          >
            <header className="flex items-start gap-3 px-5 pb-3 pt-5">
              <div className="min-w-0 flex-1">
                <RDlg.Title className="text-[20px] font-semibold leading-7 tracking-[-0.008em] text-ink-900">{title}</RDlg.Title>
                {description && <RDlg.Description className="mt-0.5 text-meta text-ink-500">{description}</RDlg.Description>}
              </div>
              <RDlg.Close asChild>
                <IconButton label="Close" tooltip="Close · Esc" icon={<X className="size-4" />} variant="ghost" size="sm" />
              </RDlg.Close>
            </header>
            <div
              ref={bodyRef}
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-5 pb-5 [overscroll-behavior:contain]",
                overflowing && "border-y border-line-soft pb-4 pt-1",
              )}
            >
              {children}
            </div>
            {footer && (
              <footer className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-line-soft bg-paper-2 px-5 py-4 sm:flex-row sm:justify-end">
                {footer}
              </footer>
            )}
          </RDlg.Content>
        </RDlg.Portal>
      </RDlg.Root>

      {/* The only legal nested modal (§4.36). */}
      <ConfirmModal
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        tone="warning"
        title="Discard changes?"
        body="Your edits haven't been saved. This can't be undone."
        actionLabel="Discard changes"
        onConfirm={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

// ── Confirmation modal (§4.36) ───────────────────────────────────────────────
export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tone?: "warning" | "danger";
  /** Asks the real question: "Delete 'Q3 Retainer'?" */
  title: string;
  /** States the consequence: "This removes 14 tasks. This can't be undone." */
  body: string;
  /** A verb, never "Yes": "Delete project". */
  actionLabel: string;
  onConfirm: () => void;
  /** Extremely destructive: require typing this exact name to enable the button. */
  confirmText?: string;
}

export function ConfirmModal({ open, onOpenChange, tone = "danger", title, body, actionLabel, onConfirm, confirmText }: ConfirmModalProps) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const blocked = confirmText !== undefined && typed !== confirmText;

  return (
    <RDlg.Root open={open} onOpenChange={onOpenChange}>
      <RDlg.Portal>
        <RDlg.Overlay className="fixed inset-0 z-overlay bg-[var(--color-scrim)] backdrop-blur-[2px] data-[state=open]:animate-[fadein_var(--duration-base)_var(--ease-out-quiet)]" />
        <RDlg.Content
          onOpenAutoFocus={(e) => {
            // Never auto-focus the destructive button (§4.36).
            e.preventDefault();
            (e.currentTarget as HTMLElement)?.focus();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-modal w-[400px] -translate-x-1/2 -translate-y-1/2 outline-none",
            "rounded-xl border border-line bg-surface-raised p-5 shadow-lift-3",
            "data-[state=open]:animate-rise data-[state=closed]:animate-exit",
          )}
          tabIndex={-1}
        >
          <div className="flex gap-3">
            {tone === "danger" ? (
              <OctagonAlert className="mt-0.5 size-5 shrink-0 text-danger-500" aria-hidden />
            ) : (
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning-500" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <RDlg.Title className="text-title-4 text-ink-900">{title}</RDlg.Title>
              <RDlg.Description className="text-body text-ink-700">{body}</RDlg.Description>
              {confirmText !== undefined && (
                <div className="mt-2">
                  <TextInput
                    aria-label={`Type "${confirmText}" to confirm`}
                    placeholder={confirmText}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <RDlg.Close asChild>
              <Button variant="quiet">Cancel</Button>
            </RDlg.Close>
            <Button variant={tone === "danger" ? "danger" : "primary"} disabled={blocked} onClick={onConfirm}>
              {actionLabel}
            </Button>
          </div>
        </RDlg.Content>
      </RDlg.Portal>
    </RDlg.Root>
  );
}
