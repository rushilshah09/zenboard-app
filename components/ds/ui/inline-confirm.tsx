import * as React from "react";
import { Button } from "./button";
import { cn } from "@/lib/cn";

// Inline confirm — the row-level destructive confirmation. Swaps a row's
// hover actions for "Delete? [Delete] [Keep]" IN PLACE — no modal for
// row-scale objects (events, habits, list items); Modal's confirm pattern is
// for anything bigger. Extracted from Today's schedule/habit rows so the
// pattern has one implementation.
//
// Rules (button-spec.md §2): the confirm action is `dangerGhost` — solid
// `danger` stays reserved for dialog CTAs. Cancel is ghost. Both `xs` (24px)
// so the pair sits inside 36px rows without stretching them.
export interface InlineConfirmProps {
  /** The question, meta ink-500. Sentence case. */
  question?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function InlineConfirm({
  question = "Delete?",
  confirmLabel = "Delete",
  cancelLabel = "Keep",
  onConfirm,
  onCancel,
  className,
}: InlineConfirmProps) {
  return (
    <span role="group" className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-meta text-ink-500">{question}</span>
      <Button size="xs" variant="dangerGhost" onClick={onConfirm}>{confirmLabel}</Button>
      <Button size="xs" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
    </span>
  );
}
