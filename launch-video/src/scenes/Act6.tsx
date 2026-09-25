import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Cursor } from "../components/Cursor";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { APPS as REVEAL_APPS, LogoReveal, REVEAL_FILM, RevealGeometry, RevealTiming, retime } from "../components/LogoReveal";
import { CONTENT, EVENING, EVENING_CHECK, EveningView, LifeView, NAV, ProductWindow, ROW, ROW_H, ROW_Y0, WIN } from "../components/Product";
import { FONT } from "../brand/fonts";
import { Rect, col, span } from "../brand/layout";
import { lookIn } from "../brand/look";
import { EASE, clamp, rise } from "../brand/motion";
import { LEAD, spokenAt, syncWords, syncedSpan } from "../brand/sync";
import { VO_AT, frames } from "../brand/timeline";
import { colour, radius, type } from "../brand/tokens";
import { GEOMETRY, TAGLINE, TAGLINE_TEXT } from "./Act4";
import { Scene } from "./shared";

/**
 * Act 6 — the end (TREATMENT.md §6). S17: back to one calm workspace in the
 * evening; one interaction completes the day. S18: the sidebar icons lift out
 * of the window and converge into the mark; the gradient floods; the identity.
 */

/** The calm window: 56% size, anchored to the right margin, leaving the left for the words. */
const K = 0.56;
const O = { x: WIN.x + WIN.w, y: WIN.y + WIN.h / 2 };
/** Window-local point → screen, in the calm framing. */
const toScreen = (p: { x: number; y: number }, k = K) => ({ x: O.x + (WIN.x + p.x - O.x) * k, y: O.y + (WIN.y + p.y - O.y) * k });

const S17_TEXT = "One workspace.|One subscription.|One focus.";
const S17_WORDS = syncWords(S17_TEXT, "S17", VO_AT.S17);
const WORDS_RECT: Rect = { x: col(1), y: 400, w: span(5), h: 260 };
const EVENING_AT = 12; // view-local offset in S17

export const S17: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S17");
  const settle = clamp(frame, [0, 56], [0, 1], EASE.settle);
  const swap = clamp(frame, [10, 40], [0, 1], EASE.settle);
  const f = frame - EVENING_AT;
  // The cursor drifts in from below-left, overshoots the checkbox a hair, corrects, clicks.
  const target = { x: CONTENT.x + EVENING_CHECK.x, y: CONTENT.y + EVENING_CHECK.y };
  const click = EVENING_AT + EVENING.clickAt;
  const t1 = clamp(frame, [click - 50, click - 8], [0, 1], EASE.settle);
  const t2 = clamp(frame, [click - 8, click - 2], [0, 1], EASE.settle);
  const cur = { x: 560 + (target.x + 6 - 560) * t1 - 6 * t2, y: 640 + (target.y + 4 - 640) * t1 - 4 * t2 };
  const press = clamp(frame, [click - 3, click], [0, 1], EASE.snap) * (1 - clamp(frame, [click + 2, click + 9], [0, 1], EASE.settle));
  const cursorIn = clamp(frame, [click - 56, click - 40], [0, 1]) * (1 - clamp(frame, [click + 40, click + 56], [0, 1]));
  const tl = toScreen({ x: 0, y: 0 });
  return (
    <Scene>
      <Place id="window" rect={{ x: tl.x, y: tl.y, w: WIN.w * K, h: WIN.h * K }} moving={frame < 56}>
        <div />
      </Place>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${O.x}px ${O.y}px`, scale: String(1 + (K - 1) * settle) }}>
        <ProductWindow
          rows={NAV.map(() => 1)}
          colours={NAV.map(() => 1)}
          selected={ROW.life + (ROW.today - ROW.life) * swap}
          content={
            <>
              <div style={{ position: "absolute", inset: 0, opacity: 1 - swap, filter: `blur(${swap * 6}px)` }}>
                <LifeView f={999} />
              </div>
              <div style={{ position: "absolute", inset: 0, opacity: swap, filter: `blur(${(1 - swap) * 6}px)` }}>
                <EveningView f={f} />
              </div>
            </>
          }
          overlay={<Cursor x={cur.x} y={cur.y} pressed={press} opacity={cursorIn} />}
        />
      </div>
      <Place id="headline" rect={WORDS_RECT} visible={frame >= S17_WORDS[0]} moving={during(frame, syncedSpan(S17_WORDS), [len - 24, len])}>
        <Headline text={S17_TEXT} at={S17_WORDS[0]} wordAt={S17_WORDS} stack exitAt={len - 24} width={WORDS_RECT.w} />
      </Place>
      <Sfx at={4} sound="breath" volume={0.06} />
      <Sfx at={click} sound="ui-click" volume={0.2} />
      <Sfx at={click + 6} sound="tick-tuned" variant={6} volume={0.22} />
    </Scene>
  );
};

/** The reprise: the eight sidebar icons, where they sit in the calm window, are the tiles. */
const NAV_OF: Record<string, number> = Object.fromEntries(NAV.map((n, i) => [n.category, i]));
const END_GEOMETRY: RevealGeometry = {
  ...GEOMETRY,
  row: REVEAL_APPS.map((c) => toScreen({ x: 16 + 16 + 20, y: ROW_Y0 + NAV_OF[c] * ROW_H + ROW_H / 2 })),
  startSize: 40 * K,
  colour: 1,
};
const REPRISE: RevealTiming = retime(REVEAL_FILM, 1.8, 14);
const CTA: Rect = { x: 960 - 150, y: 700, w: 300, h: 64 };
const CTA_AT = spokenAt("S18", 1, VO_AT.S18) - LEAD;
const TAG_AT = REPRISE.slide[1] - 6;
const LOCKUP_RECT: Rect = { x: GEOMETRY.lockup.x, y: GEOMETRY.lockup.y, w: GEOMETRY.markSize * (152 / 32), h: GEOMETRY.markSize };

export const S18: React.FC = () => {
  const frame = useCurrentFrame();
  const look = lookIn("S18", frame);
  // The container dissolves as its icons lift away.
  const dissolve = clamp(frame, [REPRISE.lift[0] - 6, REPRISE.lift[0] + 30], [0, 1], EASE.settle);
  return (
    <Scene>
      {dissolve < 1 ? (
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${O.x}px ${O.y}px`, scale: String(K * (1 - 0.04 * dissolve)), opacity: 1 - dissolve, filter: `blur(${dissolve * 10}px)` }}>
          <ProductWindow rows={NAV.map(() => 0)} colours={NAV.map(() => 1)} selected={ROW.today} selectedOpacity={1 - dissolve} content={<EveningView f={999} />} />
        </div>
      ) : null}
      <LogoReveal
        frame={frame}
        geometry={END_GEOMETRY}
        timing={REPRISE}
        dark={0}
        brand={look.brand}
        tagline={
          <Place id="tagline" rect={TAGLINE} visible={frame >= TAG_AT} moving={during(frame, [TAG_AT, TAG_AT + 60])}>
            <Headline text={TAGLINE_TEXT} at={TAG_AT} style="subhead" tone="whiteMuted" emphasisFrom="whiteMuted" emphasisTo="white" emphasisStagger={10} align="center" width={TAGLINE.w} />
          </Place>
        }
      />
      <Place id="lockup" rect={LOCKUP_RECT} visible={frame >= REPRISE.fuse[1]} moving={frame < REPRISE.slide[1] + 20}>
        <div />
      </Place>
      {/* "Available today" rises slowly in a glass pill with a soft glowing edge, on the spoken word. */}
      <Place id="cta" rect={CTA} visible={frame >= CTA_AT} moving={during(frame, [CTA_AT, CTA_AT + 60])} style={rise(frame, CTA_AT, { dist: 40, dur: 60 })}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: radius.pill,
            background: "rgba(255, 255, 255, 0.16)",
            border: "1px solid rgba(255, 255, 255, 0.55)",
            backdropFilter: "blur(24px) saturate(1.3)",
            boxShadow: "0 0 32px rgba(255, 255, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 20px 50px rgba(60, 20, 90, 0.25)",
            color: colour.white,
            fontFamily: FONT,
            ...type.uiStrong,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Available today
        </div>
      </Place>
      <Sfx at={REPRISE.lift[0]} sound="whoosh-soft" volume={0.2} />
      <Sfx at={REPRISE.pink[0]} sound="chime-resolved" volume={0.9} />
      <Sfx at={CTA_AT} sound="ui-click" volume={0.14} />
    </Scene>
  );
};
