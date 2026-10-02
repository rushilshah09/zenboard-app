import * as React from "react";
import { cn } from "@/lib/cn";
import { Logo, Mark } from "./icon";

// THE LOCKUP, in one place.
//
// It was spelled by hand on the two screens that show it (sign-up, onboarding): a <Mark> beside
// the word "Zenboard" set in the UI's display face. That is not a logo — it is the name typed in
// whatever font happens to be loaded, at whatever tracking the last person chose, and it changed
// shape the day the titling face changed (user, 2026-09-25: "this is our logo, you are using the
// wrong logo"). The real artwork is `illustration/logo.svg`; `Logo` draws it.
//
// The mark wears the brand hue and the lettering takes the ink of wherever it sits, so the same
// component works on a white sign-up page and in a dark sidebar.
export interface WordmarkProps extends React.ComponentProps<"span"> {
  /** `md` is a page header (24px tall); `lg` is the boot screen (32px). */
  size?: "md" | "lg";
  /** The mark alone — for a narrow header or a rail. */
  markOnly?: boolean;
}

const HEIGHT = { md: 24, lg: 32 } as const;

export function Wordmark({ size = "md", markOnly, className, ...props }: WordmarkProps) {
  return (
    <span data-slot="wordmark" className={cn("inline-flex items-center text-ink-900 select-none", className)} {...props}>
      {markOnly ? <Mark size={HEIGHT[size]} tone="brand" /> : <Logo height={HEIGHT[size]} />}
    </span>
  );
}
