"use client";

import * as React from "react";
import { ConfirmModal, type ConfirmModalProps } from "./modal";

// The imperative face of <ConfirmModal> (§4.36).
//
// WHY THIS EXISTS: ConfirmModal was already correct, and almost nobody used it.
// Ten permanent deletes across Forms, Documents and Projects fired on a single
// click because wiring the modal meant three pieces of state per call site —
// `open`, the pending target, and the copy — and a delete handler that had to
// be split in half around a re-render. So the modules skipped it, and the app
// grew two standards for the same act.
//
// This removes the reason to skip it. A handler stays one readable function:
//
//   const [confirm, confirmUI] = useConfirm();
//
//   async function remove(f: Form) {
//     const ok = await confirm({
//       title: `Delete “${f.title}”?`,
//       body: 'Its 24 responses are deleted too. This can’t be undone.',
//       actionLabel: 'Delete form',
//     });
//     if (!ok) return;
//     …
//   }
//
//   return <>{…}{confirmUI}</>;
//
// It is a hook rather than a global host on purpose: the portal and the app
// shell are different trees, and a global would have to be mounted in both.
//
// Not every delete belongs here. Recoverable acts (a builder block, a database
// row) should act immediately and offer Undo on the toast instead — a confirm
// on a reversible action is just a speed bump. See INTERACTION_STANDARDS §2.2.

export type ConfirmOptions = Pick<ConfirmModalProps, "title" | "body" | "actionLabel" | "tone" | "confirmText">;

export function useConfirm(): readonly [(opts: ConfirmOptions) => Promise<boolean>, React.ReactElement] {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const [open, setOpen] = React.useState(false);
  const resolveRef = React.useRef<((ok: boolean) => void) | null>(null);

  const confirm = React.useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second ask while one is open cancels the first — the caller of the
        // superseded promise must never be left hanging on a dialog nobody sees.
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOpts(next);
        setOpen(true);
      }),
    [],
  );

  const settle = React.useCallback((ok: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    // `opts` deliberately survives the close so the dialog keeps its text
    // through the exit animation instead of blanking for a frame.
    resolve?.(ok);
  }, []);

  const ui = (
    <ConfirmModal
      open={open}
      onOpenChange={(o) => { if (!o) settle(false); }}
      tone={opts?.tone}
      title={opts?.title ?? ""}
      body={opts?.body ?? ""}
      actionLabel={opts?.actionLabel ?? ""}
      confirmText={opts?.confirmText}
      onConfirm={() => settle(true)}
    />
  );

  return [confirm, ui] as const;
}
