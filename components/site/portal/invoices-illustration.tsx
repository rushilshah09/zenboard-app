import { Stage } from "../section";
import { Bar, Chip, cx, Dots, Stamp } from "./parts";
import ill from "./portal-illustrations.module.css";

// 05 · Invoices, next to the work — balance due, one invoice sent, one paid.

const INVOICES = [
  { id: "INV-002", name: "Venue deposit", sum: "$2,800", status: "Sent", tone: "warning" },
  { id: "INV-001", name: "Planning", sum: "$3,500", status: "Paid", tone: "success" },
] as const;

export function InvoicesIllustration() {
  return (
    <Stage
      fit="436"
      size={{ w: 436, h: 388 }}
      label="The project's invoices in the portal: $2,800 due on October 5, one invoice sent and one paid on September 14"
    >
      <Dots />

      <div className={cx(ill.panel, ill.panelQuiet, ill.paper)}>
        <span className={ill.paperTitle}>INVOICE</span>
        <Bar width={72} />
        <Bar width={112} />
        <Bar width={92} />
        <span className={ill.paperRule} />
        <div className={ill.paperFoot}>
          <Bar width={36} />
          <Bar width={52} className={ill.barStrong} />
        </div>
      </div>

      <div className={cx(ill.panel, ill.invoices)}>
        <div className={ill.invLabel}>Balance due</div>
        <div className={ill.invAmount}>$2,800</div>
        <div className={ill.invLabel}>Due Oct 5</div>
        <div className={ill.invRule} />
        {INVOICES.map((inv) => (
          <div key={inv.id} className={ill.invRow}>
            <span className={ill.invId}>{inv.id}</span>
            <span className={ill.invName}>{inv.name}</span>
            <span className={ill.invSum}>{inv.sum}</span>
            <Chip tone={inv.tone} className={ill.invChip}>
              {inv.status}
            </Chip>
          </div>
        ))}
      </div>

      <Stamp className={ill.paidStamp} strong="INV-001 paid" meta="Sep 14" />
    </Stage>
  );
}
