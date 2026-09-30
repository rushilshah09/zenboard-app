import type { ReactNode } from "react";
import { SiteCheckCircle } from "@/components/ds/icons";
import ill from "./portal-illustrations.module.css";

// Small drawing parts shared by the portal illustrations.

export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** The one story every portal illustration tells. */
export const STORY = {
  studio: "Meridian",
  studioInitial: "M",
  client: "Maya",
  clientInitial: "M",
  company: "Ridgeline",
  project: "Ridgeline launch event",
  link: "zenboard.app/p/ridgeline",
  review: "Event plan and budget",
  request: "Could we add 20 more guests to the list?",
  task: "Add 20 guests to the list",
} as const;

/** Dotted texture behind an illustration, fading out from the middle. */
export function Dots() {
  return <div className={ill.dots} aria-hidden="true" />;
}

/** A soft lavender glow placed by `className`. */
export function Glow({ className }: { className: string }) {
  return <div className={cx(ill.glow, className)} aria-hidden="true" />;
}

/** The client's cursor, optionally with a name tag. */
export function Cursor({ className, label }: { className: string; label?: string }) {
  return (
    <div className={cx(ill.cursor, className)} aria-hidden="true">
      <svg width="20" height="22" viewBox="0 0 20 22">
        <path
          d="M3 2 L3 17 L7.4 13.2 L10.4 19.6 L13.1 18.4 L10.1 12.1 L16 12.1 Z"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {label ? <span className={ill.cursorLabel}>{label}</span> : null}
    </div>
  );
}

/** A result stamp: "Approved by Maya · Thu 10:42". */
export function Stamp({
  className,
  strong,
  meta,
  small,
  icon = true,
}: {
  className: string;
  strong: string;
  meta?: string;
  small?: boolean;
  icon?: boolean;
}) {
  return (
    <div className={cx(ill.stamp, small && ill.stampSmall, className)}>
      {icon ? <SiteCheckCircle size={small ? 13 : 15} aria-hidden="true" /> : null}
      <span className={ill.stampStrong}>{strong}</span>
      {meta ? <span className={ill.stampMeta}>{meta}</span> : null}
    </div>
  );
}

/** Skeleton bar at a given width. */
export function Bar({ width, className }: { width: number; className?: string }) {
  return <span className={cx(ill.bar, className)} style={{ width }} />;
}

export function Chip({
  tone,
  className,
  children,
}: {
  tone: "accent" | "success" | "warning";
  className?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "accent" ? ill.chipAccent : tone === "success" ? ill.chipSuccess : ill.chipWarning;
  return <span className={cx(ill.chip, toneClass, className)}>{children}</span>;
}
