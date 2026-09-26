"use client";

import { useId, useState } from "react";
import { SiteEye, SiteLock } from "@/components/ds/icons";
import { Stage } from "../section";
import { cx, Dots, STORY } from "./parts";
import ill from "./portal-illustrations.module.css";

// 02 · You choose what they see — the share switches work: visitors can try
// them. Behind them, what never crosses to the client, hatched as private.

const SHARES = [
  { key: "progress", label: "Progress", on: true },
  { key: "done", label: "Finished work", on: true },
  { key: "open", label: "Open tasks", on: false },
  { key: "docs", label: "Documents", on: true },
  { key: "invoices", label: "Invoices", on: true },
] as const;

type ShareKey = (typeof SHARES)[number]["key"];

const INTERNAL = [
  { label: "Internal notes", value: "6" },
  { label: "Time logged", value: "14h 20m" },
  { label: "Costs", value: "$1,240" },
];

export function VisibilityIllustration() {
  const [on, setOn] = useState<Record<ShareKey, boolean>>(
    () => Object.fromEntries(SHARES.map((s) => [s.key, s.on])) as Record<ShareKey, boolean>,
  );
  const count = SHARES.filter((s) => on[s.key]).length;
  const titleId = useId();

  return (
    <Stage fit="mid" size={{ w: 545, h: 372 }} compact={{ w: 436, h: 372 }} bleed={false}>
      <Dots />

      <div className={cx(ill.panel, ill.internal)}>
        <div className={ill.internalHead}>
          <SiteLock size={12} aria-hidden="true" />
          Stays with you
        </div>
        {INTERNAL.map((row) => (
          <div key={row.label} className={ill.internalRow}>
            {row.label}
            <span>{row.value}</span>
          </div>
        ))}
      </div>

      <div className={cx(ill.panel, ill.sees)} role="group" aria-labelledby={titleId}>
        <div className={ill.seesHead}>
          <SiteEye size={14} aria-hidden="true" />
          <span id={titleId}>What {STORY.client} sees</span>
          <span className={ill.seesCount} aria-live="polite">
            {count} of {SHARES.length} on
          </span>
        </div>
        {SHARES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="switch"
            aria-checked={on[s.key]}
            className={ill.toggle}
            onClick={() => setOn((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
          >
            {s.label}
            <span className={ill.track} aria-hidden="true">
              <span className={ill.knob} />
            </span>
          </button>
        ))}
      </div>
    </Stage>
  );
}
