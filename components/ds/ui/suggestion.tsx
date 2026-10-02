import * as React from "react";
import { Check, X } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Icon } from "./icon";

// ── A PROPOSAL ──────────────────────────────────────────────────────────────
// Something Zenboard inferred and is ASKING about, never something it did (MASTER_PRODUCT_PLAN
// §7Q: "AI proposes, never writes silently; every suggestion is a one-tap accept"). One row, the
// same wherever the clerk asks, so a proposal is recognisable before it is read:
//
//   · the claim, worded as it will read once accepted;
//   · the RECEIPT under it: the evidence, always visible, never behind a hover or a tooltip. It is
//     the difference between an inference you can check and one you have to take on faith;
//   · two answers, both real buttons in the tab order. Accept is labelled with what it does
//     ("Add", "Remember"); dismiss is a named icon.
//
// Callers: the Noticed band (components/memory/noticed-band.tsx) and meeting suggestions
// (components/meetings/meeting-panel.tsx). It renders an <li>; the caller owns the list.
export interface SuggestionRowProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, "children"> {
  /** The proposal, worded as it will read once accepted. */
  children: React.ReactNode;
  /** The evidence it rests on. */
  receipt: React.ReactNode;
  /** What accepting does, as a verb: "Add", "Remember". */
  acceptLabel: string;
  onAccept: () => void;
  /** The dismiss control's accessible name and tooltip. Name the item: "Dismiss: Send the palette". */
  dismissLabel: string;
  onDismiss: () => void;
  /** An answer is in flight: accept shows it, and neither can be pressed twice. */
  busy?: boolean;
  className?: string;
}

export function SuggestionRow({
  children, receipt, acceptLabel, onAccept, dismissLabel, onDismiss, busy, className, ...props
}: SuggestionRowProps) {
  return (
    <li className={cn("flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-3", className)} {...props}>
      <div className="min-w-0 flex-1">
        <p className="text-ui text-ink-800">{children}</p>
        <p className="pt-0.5 text-caption text-ink-500">{receipt}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="secondary" loading={busy} onClick={onAccept} icon={<Icon icon={Check} size={16} />}>
          {acceptLabel}
        </Button>
        <IconButton size="sm" variant="ghost" label={dismissLabel} icon={<Icon icon={X} size={16} />} onClick={onDismiss} disabled={busy} />
      </div>
    </li>
  );
}
