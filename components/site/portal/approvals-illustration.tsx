import { Stage } from "../section";
import { cx, Cursor, Dots, Glow, Stamp, STORY } from "./parts";
import ill from "./portal-illustrations.module.css";

// 04 · Approvals, on the record — the event plan and budget (version 3)
// sent for sign-off, Maya's cursor on Approve, the answer stamped below.

const LEGEND = [
  { label: "Venue", value: "$4,200", swatch: ill.segVenue },
  { label: "Catering", value: "$2,600", swatch: ill.segCatering },
  { label: "Other", value: "$1,400", swatch: ill.segOther },
];

export function ApprovalsIllustration() {
  return (
    <Stage
      fit="436"
      size={{ w: 436, h: 388 }}
      label={`${STORY.client} approving the ${STORY.review.toLowerCase()} in the portal: a four-week plan to the May 12 event and an $8,200 budget. The approval is saved with the file.`}
    >
      <Dots />
      <Glow className={ill.approvalGlow} />

      <div className={cx(ill.panel, ill.sheetBack2)} />
      <div className={cx(ill.panel, ill.sheetBack1)} />

      <div className={cx(ill.panel, ill.sheet)}>
        <div className={ill.plan}>
          <svg className={ill.svg} width="260" height="132" viewBox="0 0 260 132">
            <g className={ill.planGrid}>
              <line x1="54.5" y1="42" x2="54.5" y2="122" />
              <line x1="84.5" y1="42" x2="84.5" y2="122" />
              <line x1="114.5" y1="42" x2="114.5" y2="122" />
              <line x1="144.5" y1="42" x2="144.5" y2="122" />
            </g>
            <line className={ill.planDivider} x1="170.5" y1="30" x2="170.5" y2="122" />
            <rect className={ill.planDone} x="54" y="50" width="28" height="8" rx="4" />
            <rect className={ill.planDone} x="72" y="68" width="36" height="8" rx="4" />
            <rect className={ill.planNext} x="96" y="86" width="40" height="8" rx="4" />
            <rect className={ill.planMark} x="140" y="99.5" width="9" height="9" rx="2" transform="rotate(45 144.5 104)" />
            <line className={ill.planToday} x1="104.5" y1="44" x2="104.5" y2="118" />
            <circle className={ill.planTodayDot} cx="104.5" cy="44" r="2.5" />
          </svg>

          <div className={ill.planTabs}>
            <span>v1</span>
            <span>v2</span>
            <span className={ill.planTabOn}>v3</span>
          </div>
          <span className={ill.planName}>Event plan</span>

          <div className={ill.planWeeks}>
            <span>Apr 21</span>
            <span>28</span>
            <span>May 5</span>
            <span className={ill.planWeekEvent}>12</span>
          </div>
          <div className={ill.planRows}>
            <span>Venue</span>
            <span>Invites</span>
            <span>Catering</span>
            <span className={ill.planRowEvent}>Event</span>
          </div>
          <span className={ill.planTodayLabel}>Today</span>

          <div className={ill.budget}>
            <span className={ill.budgetLabel}>Budget</span>
            <span className={ill.budgetValue}>$8,200</span>
            <div className={ill.budgetBar}>
              {LEGEND.map((l) => (
                <span key={l.label} className={l.swatch} />
              ))}
            </div>
            <div className={ill.legend}>
              {LEGEND.map((l) => (
                <div key={l.label}>
                  <span className={l.swatch} />
                  {l.label}
                  <span>{l.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={ill.sheetBody}>
          <div className={ill.sheetTitle}>{STORY.review}</div>
          <div className={ill.sheetMeta}>Version 3 · shared Tuesday</div>
          <div className={ill.actions}>
            <span className={cx(ill.action, ill.actionGhost)}>Request changes</span>
            <span className={cx(ill.action, ill.actionPrimary)}>Approve</span>
          </div>
        </div>
      </div>

      <Cursor className={ill.approvalCursor} label={STORY.client} />
      <Stamp className={ill.approvalStamp} strong={`Approved by ${STORY.client}`} meta="Thu 10:42" />
    </Stage>
  );
}
