import type { CSSProperties, ReactNode } from "react";
import type { IconType } from "@/components/ds/icons";
import tokens from "./site-tokens.module.css";
import s from "./section.module.css";

// Site section primitives for zenboard.app — the hairline-grid language the
// public site already speaks (rounded cells on a 1px grid, lavender feature
// tiles, one illustration stage per cell). Every marketing section is built
// from these; illustrations never style their own chrome.

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export type SiteTheme = "light" | "dark";

export function SiteSection({
  id,
  labelledBy,
  theme = "light",
  children,
}: {
  id?: string;
  labelledBy: string;
  theme?: SiteTheme;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-theme={theme}
      className={cx(tokens.site, s.section)}
    >
      <div className={s.container}>{children}</div>
    </section>
  );
}

export function FeatureGrid({ children }: { children: ReactNode }) {
  return <div className={s.grid}>{children}</div>;
}

export function SectionHeader({
  id,
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  eyebrowIcon: IconType;
  title: ReactNode;
  lead: string;
}) {
  return (
    <header className={s.header}>
      <div className={s.headerInner}>
        <div className={s.headerMain}>
          <div className={s.eyebrow}>
            <span className={s.eyebrowTile} aria-hidden="true">
              <EyebrowIcon size={16} />
            </span>
            {eyebrow}
          </div>
          <h2 id={id} className={s.title}>
            {title}
          </h2>
        </div>
        <p className={s.lead}>{lead}</p>
      </div>
    </header>
  );
}

const SPAN = { wide: s.spanWide, narrow: s.spanNarrow, third: s.spanThird } as const;

export function FeatureCard({
  icon: Icon,
  title,
  description,
  span,
  hint,
  children,
}: {
  icon: IconType;
  title: string;
  description: string;
  /** Desktop width: wide = 7/12, narrow = 5/12, third = 4/12. Tablet halves, mobile stacks. */
  span: keyof typeof SPAN;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <article className={cx(s.card, SPAN[span])}>
      <div className={s.cardInner}>
        <div className={s.cardHead}>
          <span className={s.tile} aria-hidden="true">
            <Icon size={22} />
          </span>
          <div className={s.cardText}>
            <h3 className={s.cardTitle}>{title}</h3>
            <p className={s.cardDesc}>{description}</p>
          </div>
        </div>
        {children}
        {hint ? <p className={s.hint}>{hint}</p> : null}
      </div>
    </article>
  );
}

type StageSize = { w: number; h: number };

/**
 * An illustration drawn at a fixed design size and scaled to its card.
 * `fit` picks the scale table: "436" for third-width cards; "wide" (764) and
 * "mid" (545) also swap to a `compact` design on narrow cards, where the
 * illustration's own CSS re-lays it out at the compact size.
 */
export function Stage({
  fit,
  size,
  compact,
  bleed = true,
  label,
  children,
}: {
  fit: "436" | "wide" | "mid";
  size: StageSize;
  compact?: StageSize;
  /** Run the stage into the card's bottom edge (illustrations that crop). */
  bleed?: boolean;
  /** Accessible description; omit only when the stage holds real controls. */
  label?: string;
  children: ReactNode;
}) {
  const fitClass = fit === "wide" ? s.fitWide : fit === "mid" ? s.fitMid : s.fit436;
  const vars = {
    "--stage-w-wide": `${size.w}px`,
    "--stage-h-wide": `${size.h}px`,
    "--stage-w-compact": `${(compact ?? size).w}px`,
    "--stage-h-compact": `${(compact ?? size).h}px`,
  } as CSSProperties;
  return (
    <div
      className={cx(s.stage, fitClass, bleed && s.stageBleed)}
      style={vars}
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      <div className={s.stageInner}>{children}</div>
    </div>
  );
}
