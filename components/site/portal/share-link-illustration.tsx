import { SiteCheck, SiteCheckCircle, SiteFileText, SiteLock } from "@/components/ds/icons";
import { Stage } from "../section";
import { Chip, cx, Cursor, Dots, Glow, Stamp, STORY } from "./parts";
import ill from "./portal-illustrations.module.css";

const UPDATES = [
  { title: "Invitations sent", when: "2d" },
  { title: "Venue booked", when: "4d" },
  { title: "Kickoff call", when: "6d" },
];

// 01 · One link, no login — the client's portal page, opened from a copied
// link, with Maya's cursor on the plan that waits for her.
export function ShareLinkIllustration() {
  return (
    <Stage
      fit="wide"
      size={{ w: 764, h: 452 }}
      compact={{ w: 436, h: 452 }}
      label={`The ${STORY.project} portal open in a browser from a copied link, with ${STORY.client} looking at the ${STORY.review.toLowerCase()} that waits for her review`}
    >
      <Dots />
      <Glow className={ill.linkGlow} />

      <div className={cx(ill.panel, ill.window)}>
        <div className={ill.winBar}>
          <div className={ill.winDots}>
            <span />
            <span />
            <span />
          </div>
          <div className={ill.winUrl}>
            <SiteLock size={10} />
            <span>{STORY.link}</span>
          </div>
        </div>

        <div className={ill.winBody}>
          <div className={ill.winSide}>
            <div className={ill.brand}>
              <span className={ill.brandMark}>{STORY.studioInitial}</span>
              {STORY.studio}
            </div>
            <div className={cx(ill.navItem, ill.navItemActive)}>Overview</div>
            <div className={ill.navItem}>
              To review<span className={ill.count}>1</span>
            </div>
            <div className={ill.navItem}>Requests</div>
            <div className={ill.navItem}>Work</div>
            <div className={ill.navItem}>Invoices</div>
          </div>

          <div className={ill.winMain}>
            <div className={ill.projHead}>
              <div className={ill.projTitleRow}>
                <span className={ill.projTitle}>{STORY.project}</span>
                <Chip tone="success">
                  <span className={ill.chipDot} />
                  Active
                </Chip>
              </div>
              <span className={ill.projSub}>Here is where things stand. No login needed.</span>
            </div>

            <div className={ill.progress}>
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle className={ill.ringTrack} cx="22" cy="22" r="18" fill="none" strokeWidth="4" />
                <circle
                  className={ill.ringValue}
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="72.4 113.1"
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <div className={ill.progressText}>
                <span className={ill.progressValue}>64%</span>
                <span className={ill.progressMeta}>18 of 28 tasks done</span>
              </div>
            </div>

            <div className={ill.block}>
              <span className={ill.label}>To review</span>
              <div className={ill.review}>
                <SiteFileText size={14} />
                <span className={ill.reviewTitle}>{STORY.review}</span>
                <Chip tone="accent">Awaiting you</Chip>
              </div>
            </div>

            <div className={ill.updates}>
              <span className={ill.label}>Recent updates</span>
              {UPDATES.map((u) => (
                <div key={u.title} className={ill.update}>
                  <SiteCheckCircle size={13} className={ill.ok} />
                  <span>{u.title}</span>
                  <span className={ill.meta}>{u.when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={cx(ill.panel, ill.share)}>
        <div className={ill.shareHead}>
          Share with client
          <span className={ill.switchOn}>
            <span />
          </span>
        </div>
        <span className={ill.shareSub}>Anyone with the link can view it.</span>
        <div className={ill.shareRow}>
          <div className={ill.shareField}>{STORY.link}</div>
          <div className={ill.shareCopied}>
            <SiteCheck size={12} />
            Copied
          </div>
        </div>
      </div>

      <Stamp className={ill.copiedChip} strong="Link copied" />

      <Cursor className={ill.linkCursor} label={`${STORY.client} · ${STORY.company}`} />
      <div className={ill.fade} />
    </Stage>
  );
}
