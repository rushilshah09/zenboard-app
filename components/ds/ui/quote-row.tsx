import * as React from "react";
import { ArrowUpRight } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

// ── A RECEIPT YOU CAN FOLLOW ────────────────────────────────────────────────
// Words from a source, where they came from, and a press that opens the source AT those words.
//
// The house's other receipts are text: the line under a `<SuggestionRow>`, the quote under a
// write-up's decision. They say "this rests on what was said". This one is a door, because the
// answer above it is a claim about a conversation, and the one thing a person checking that claim
// wants is to see the sentence in its place — who said it, what came before, what came after.
// Granola and Otter put a numbered citation after the prose; here the words themselves are the
// citation, so the reader can check without opening anything, and open when they want more.
//
// Two lines, NEVER truncated. A receipt cut to fit one line is a receipt that can no longer be
// checked, which is the only thing it is for. It wraps, and the source sits under it in the
// caption role, tabular so a column of times does not shuffle.
//
// A real <button> in the tab order with the house press (`zb-press`: the hover wash, the pressed
// wash, the 0.97 scale on the shared curve) — not a link styled as a row, because what it does is
// navigate within the product the way every other row that opens a record does.

export interface QuoteRowProps {
  /** The words, as said. Drawn whole, between quotation marks. */
  children: React.ReactNode;
  /** Where they came from: "Them · 4:31", "Your notes". */
  source: React.ReactNode;
  /** Open the source at these words. Absent ⇒ the receipt is text, not a door. */
  onOpen?: () => void;
  className?: string;
}

export function QuoteRow({ children, source, onOpen, className }: QuoteRowProps) {
  const body = (
    <span className="min-w-0 flex-1">
      <span className="block text-ui text-ink-800">“{children}”</span>
      <span className="block pt-0.5 text-caption tabular-nums text-ink-500">{source}</span>
    </span>
  );
  if (!onOpen) return <div className={cn("flex px-2.5 py-1.5", className)}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        // The small button's radius and inset (`Button size="sm"`), because a receipt sits in a
        // column of those rows ("Open …" under it) and two row kinds must share one text edge.
        "zb-press focus-ring flex w-full items-start gap-2 rounded-sm px-2.5 py-1.5 text-start",
        // 44px reach on a touch screen, without growing the row for a mouse (WCAG 2.5.5).
        "[@media(pointer:coarse)]:min-h-11",
        className,
      )}
    >
      {body}
      <Icon icon={ArrowUpRight} size={14} className="mt-0.5 shrink-0 text-ink-500" />
    </button>
  );
}
