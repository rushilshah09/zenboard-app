import React from "react";
import { useCurrentFrame } from "remotion";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Headline } from "../components/Headline";
import { Illustration } from "../components/Illustration";
import { LogoReveal, REVEAL_FILM, RevealTiming, retime } from "../components/LogoReveal";
import { FONT } from "../brand/fonts";
import { Rect, ZONES } from "../brand/layout";
import { EASE, clamp, leave, rise } from "../brand/motion";
import { colour, radius, type } from "../brand/tokens";
import { LEAD, spokenAt, syncWords, syncedSpan } from "../brand/sync";
import { VO_AT, frames, sceneStart } from "../brand/timeline";
import { plateRect } from "./Act1";
import { GEOMETRY, TAGLINE, TAGLINE_TEXT } from "./Act4";
import { S16_HEADLINE } from "./Act5";
import { Scene, drift } from "./shared";

/** Act 6 — Zenboard (S17–S18). S17 mirrors S01: same desk, now evening. */

const S17_TEXT = "One workspace.|One subscription.|One focus.";
const S17_WORDS = syncWords(S17_TEXT, "S17", VO_AT.S17);

export const S17: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S17");
  const g = sceneStart("S17") + frame;
  const plate = plateRect("IMG-07");
  const out = leave(frame, len - 24);
  return (
    <Scene>
      <Camera scale={drift(g, [sceneStart("S17"), sceneStart("S17") + len], 1, 1.04)}>
        {/* S16's line leaves first. */}
        <Place id="s16-headline" rect={ZONES.headlineTop} moving={frame < 18} visible={frame < 18}>
          <Headline text={S16_HEADLINE} at={-400} align="center" width={ZONES.headlineTop.w} exitAt={0} />
        </Place>
        <Place id="IMG-07" rect={plate} style={{ opacity: out.opacity }}>
          <Illustration
            code="IMG-07"
            rect={{ x: 0, y: 0, w: plate.w, h: plate.h }}
            draw={clamp(frame, [8, 120], [0, 1], EASE.settle)}
            parallax={clamp(frame, [0, len], [0, -28], EASE.breathe)}
          />
        </Place>
        <Place id="headline" rect={ZONES.headlineLeft} moving={during(frame, syncedSpan(S17_WORDS), [len - 24, len])}>
          <Headline text={S17_TEXT} at={S17_WORDS[0]} wordAt={S17_WORDS} stack exitAt={len - 24} width={ZONES.headlineLeft.w} />
        </Place>
      </Camera>
      <Sfx at={4} sound="breath" volume={0.06} />
    </Scene>
  );
};

/** The end card reprises the reveal on a faster clock; "Zenboard" is spoken as the letters land. */
const REPRISE: RevealTiming = { ...retime(REVEAL_FILM, 1.8, 14), enter: 0 };
const CTA: Rect = { x: 960 - 140, y: 700, w: 280, h: 64 };
const CTA_AT = spokenAt("S18", 1, VO_AT.S18) - LEAD;
const TAG_AT = REPRISE.slide[1] - 6;
const LOCKUP_RECT: Rect = { x: GEOMETRY.lockup.x, y: GEOMETRY.lockup.y, w: GEOMETRY.markSize * (152 / 32), h: GEOMETRY.markSize };

export const S18: React.FC = () => {
  const frame = useCurrentFrame();
  const len = frames("S18");
  return (
    <Scene>
      <Camera scale={1 + 0.03 * clamp(frame, [REPRISE.slide[0], len], [0, 1], EASE.breathe)}>
        <LogoReveal
          frame={frame}
          geometry={GEOMETRY}
          timing={REPRISE}
          tagline={
            <Place id="tagline" rect={TAGLINE} visible={frame >= TAG_AT} moving={during(frame, [TAG_AT, TAG_AT + 60])}>
              <Headline text={TAGLINE_TEXT} at={TAG_AT} style="subhead" tone="stone" emphasisTo="ink" emphasisStagger={10} align="center" width={TAGLINE.w} />
            </Place>
          }
        />
        <Place id="ring" rect={{ x: 560, y: 100, w: 800, h: 800 }} visible={frame < REPRISE.fuse[1]} moving>
          <div />
        </Place>
        <Place id="lockup" rect={LOCKUP_RECT} visible={frame >= REPRISE.fuse[1]} moving={frame < REPRISE.slide[1] + 20}>
          <div />
        </Place>
        <Place id="cta" rect={CTA} visible={frame >= CTA_AT} moving={during(frame, [CTA_AT, CTA_AT + 42])} style={rise(frame, CTA_AT, { dist: 24, scale: true })}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radius.pill,
              background: colour.ink,
              color: colour.paper,
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
      </Camera>
      <Sfx at={REPRISE.lift[0]} sound="whoosh-soft" volume={0.2} />
      <Sfx at={REPRISE.pink[0]} sound="chime-resolved" volume={0.9} />
      <Sfx at={CTA_AT} sound="ui-click" volume={0.16} />
    </Scene>
  );
};
