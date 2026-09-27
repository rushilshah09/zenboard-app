import { SiteChat } from "@/components/ds/icons";
import { Stage } from "../section";
import { Bar, Chip, cx, Dots, Stamp, STORY } from "./parts";
import ill from "./portal-illustrations.module.css";

// 03 · Requests become tasks — a timeline rail hands Maya's request to you:
// lavender while it is hers, ink once you approve it and it becomes a task.
export function RequestsIllustration() {
  return (
    <Stage
      fit="436"
      size={{ w: 436, h: 388 }}
      label={`A request from ${STORY.client} in the portal, sent Monday at 9:14, approved by you at 11:02 and turned into a task linked back to her request`}
    >
      <Dots />

      <svg className={ill.svg} width="436" height="388" viewBox="0 0 436 388">
        <path className={ill.railClient} d="M 60 138 V 196" />
        <path className={ill.railYou} d="M 60 196 V 254 Q 60 266 72 266 H 121" />
        <path className={ill.railYou} d="M 119.5 261.5 L 124.5 266 L 119.5 270.5" />
        <circle className={ill.nodeSocket} cx="60" cy="136" r="4" />
        <circle className={ill.nodeDot} cx="60" cy="162" r="3" />
        <circle className={ill.nodeGlow} cx="60" cy="196" r="16" />
        <circle className={ill.nodeDone} cx="60" cy="196" r="10" />
        <path className={ill.nodeTick} d="M 55.5 196.2 L 58.6 199.2 L 64.5 193" />
      </svg>

      <div className={cx(ill.panel, ill.panelQuiet, ill.request)}>
        <div className={ill.person}>
          <span className={ill.avatar}>{STORY.clientInitial}</span>
          <span className={ill.personName}>{STORY.client}</span>
          <span className={ill.personVia}>via portal</span>
          <span className={ill.personWhen}>Mon</span>
        </div>
        <p className={ill.requestText}>{STORY.request}</p>
        <div className={ill.requestFoot}>
          <Chip tone="accent">
            <span className={ill.halfDot} />
            In progress
          </Chip>
        </div>
      </div>

      <span className={ill.sent}>Sent · Mon 9:14</span>
      <Stamp className={ill.approved} small icon={false} strong="Approved by you" meta="Mon 11:02" />

      <div className={cx(ill.panel, ill.task)}>
        <div className={ill.taskHead}>
          Your tasks<span>{STORY.company}</span>
        </div>
        <div className={ill.taskBody}>
          <div className={ill.taskRow}>
            <span className={ill.checkbox} />
            <span className={ill.taskTitle}>{STORY.task}</span>
          </div>
          <div className={ill.taskMeta}>
            <span className={ill.origin}>
              <SiteChat size={11} />
              From {STORY.client}’s request
            </span>
            <span className={ill.meta}>Fri</span>
          </div>
        </div>
        <div className={ill.taskGhost}>
          <span className={ill.checkbox} />
          <Bar width={124} />
          <Bar width={24} />
        </div>
      </div>
    </Stage>
  );
}
