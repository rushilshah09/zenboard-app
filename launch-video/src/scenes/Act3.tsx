import React from "react";
import { useCurrentFrame } from "remotion";
import { AppWindow } from "../components/AppWindow";
import { Sfx } from "../components/Audio";
import { Camera } from "../components/Camera";
import { Place, during } from "../components/DebugZones";
import { Icon } from "../components/Glyph";
import { Headline } from "../components/Headline";
import { Tile } from "../components/Tile";
import { FONT } from "../brand/fonts";
import { EASE, clamp, leave, rise } from "../brand/motion";
import { colour, radius, shadow, space, tint, type } from "../brand/tokens";
import { frames } from "../brand/timeline";
import { APPS, BIG, HEADLINE_LEFT, KEYCAP, Scene, pillRect, switchCount, switchesIn, tabRect, tileRect, tileSlot } from "./shared";

/**
 * Act 3 — constant switching (S05–S07). The camera is locked; the chaos is
 * tempo: hard switches (0-frame cuts with a click) that come faster and
 * faster. Every frame stays gridded and clean.
 */

type Id = "S05" | "S06" | "S07";
/** S06 retypes the Acme line in these five apps, in this order. */
const ACME_APPS = [0, 4, 2, 5, 6];

const appAt = (id: Id, n: number) => (id === "S05" ? n % 8 : id === "S06" ? ACME_APPS[n % ACME_APPS.length] : (n * 3) % 8);

const HEADLINES: Record<Id, { text: string; at: number; exitAt?: number }> = {
  S05: { text: "So you switch.", at: 20, exitAt: frames("S05") - 18 },
  S06: { text: "And type it all again.", at: 16, exitAt: frames("S06") - 18 },
  S07: { text: "More time managing work than doing it.", at: 16 },
};

const Switcher: React.FC<{ id: Id }> = ({ id }) => {
  const frame = useCurrentFrame();
  const switches = switchesIn(id);
  const done = switches.filter((s) => s <= frame);
  const n = done.length;
  const last = done[done.length - 1] ?? -99;
  const app = appAt(id, n);
  const intro = id === "S05";
  // S05 opens by turning S04's tiles into the tab strip, then the window rises.
  const tileOut = intro ? leave(frame, 0) : { opacity: 0, translate: "0 0px" };
  const pulse = 1 - clamp(frame, [last, last + 8], [0, 1], EASE.settle);
  // Whip-pan: every switch lands the next app from the right, already moving, with
  // horizontal motion blur that clears as it settles.
  const whip = n > 0 ? 1 - clamp(frame, [last, last + 12], [0, 1], EASE.settle) : 0;
  const prevApp = appAt(id, Math.max(0, n - 1));
  const glide = clamp(frame, [last, last + 10], [0, 1], EASE.settle);
  const dotX = tabRect(tileSlot(prevApp)).x + (tabRect(tileSlot(app)).x - tabRect(tileSlot(prevApp)).x) * (n > 0 ? glide : 1);
  const h = HEADLINES[id];
  const acme = id === "S06" ? clamp(frame, [last, last + 6], [0, 1], EASE.snap) : undefined;
  return (
    <Scene>
      <Camera locked>
        {intro
          ? APPS.map((a, i) => (
              <div key={a.label} style={{ position: "absolute", left: 0, top: 0, ...tileOut }}>
                <div style={{ position: "absolute", left: tileRect(tileSlot(i)).x, top: tileRect(0).y }}>
                  <Tile category={a.category} label={a.short} width={tileRect(0).w} height={tileRect(0).h} />
                </div>
                <div style={{ position: "absolute", left: pillRect(tileSlot(i)).x, top: pillRect(0).y, width: pillRect(i).w, height: pillRect(i).h, borderRadius: radius.pill, background: tint.ink06 }} />
              </div>
            ))
          : null}
        {intro ? (
          <Place id="tile-row" rect={{ x: tileRect(0).x, y: tileRect(0).y, w: tabRect(7).x + tabRect(7).w - tileRect(0).x, h: pillRect(0).y + pillRect(0).h - tileRect(0).y }} moving={frame < 18} visible={tileOut.opacity > 0.3}>
            <div />
          </Place>
        ) : null}
        {/* The tab strip counts as one object. */}
        <Place id="tab-strip" rect={{ x: tabRect(0).x, y: tabRect(0).y, w: tabRect(7).x + tabRect(7).w - tabRect(0).x, h: tabRect(0).h }} moving={intro && during(frame, [18, 52])}>
          <div />
        </Place>
        {APPS.map((a, i) => (
          <div key={a.label} style={{ position: "absolute", left: tabRect(tileSlot(i)).x, top: tabRect(0).y, ...(intro ? rise(frame, 18 + tileSlot(i) * 2, { dist: 24, dur: 20, easing: EASE.snap }) : null) }}>
            <Tile category={a.category} label={a.short} width={tabRect(0).w} height={tabRect(0).h} tab />
          </div>
        ))}
        {/* The active-tab indicator: an Ink dot that jumps along the strip. */}
        <div
          style={{
            position: "absolute",
            left: dotX + tabRect(0).w / 2 - 5,
            top: tabRect(0).y + tabRect(0).h + 12,
            width: 10,
            height: 10,
            borderRadius: radius.pill,
            background: colour.ink,
            opacity: intro ? clamp(frame, [30, 40], [0, 1], EASE.settle) : 1,
          }}
        />
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={`whip-${id}`} x="-20%" y="0" width="140%" height="100%">
            <feGaussianBlur stdDeviation={`${whip * 28} 0`} />
          </filter>
        </svg>
        <Place
          id="window"
          rect={BIG}
          style={{
            ...(intro ? rise(frame, 28, { dur: 20, easing: EASE.snap, scale: true }) : null),
            translate: `${whip * 140}px 0px`,
            filter: whip > 0.01 ? `url(#whip-${id})` : undefined,
          }}
        >
          <AppWindow
            counterKick={n > 0 ? 1 - clamp(frame, [last, last + 10], [0, 1], EASE.settle) : 0}
            category={APPS[app].category}
            label={APPS[app].label}
            width={BIG.w}
            height={BIG.h}
            acme={acme}
            counter={`Switches today · ${switchCount(id, frame).toLocaleString("en-US")}`}
          />
        </Place>
        <Place id="keycap" rect={KEYCAP} style={intro ? rise(frame, 36, { dist: 24, dur: 20, easing: EASE.snap }) : undefined}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radius.pill,
              background: colour.card,
              boxShadow: shadow,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: space.s1,
              fontFamily: FONT,
              ...type.uiStrong,
              color: colour.ink,
              position: "relative",
              overflow: "hidden",
              scale: String(1 - pulse * 0.04),
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: tint.ink10, opacity: pulse }} />
            <Icon name="command" size={22} style={{ position: "relative" }} />
            <span style={{ position: "relative" }}>+ Tab</span>
          </div>
        </Place>
        <Place id="headline" rect={HEADLINE_LEFT} visible={frame >= h.at} moving={during(frame, [h.at, h.at + 60], [h.exitAt ?? 1e9, (h.exitAt ?? 1e9) + 18])}>
          <Headline text={h.text} at={h.at} exitAt={h.exitAt} width={HEADLINE_LEFT.w} />
        </Place>
      </Camera>
      {switches.map((s, i) => (
        <Sfx key={s} at={s} sound={i % 3 === 0 ? "cmd-tab" : "key"} variant={i % 4} volume={id === "S05" ? 0.22 : id === "S06" ? 0.2 : 0.17} />
      ))}
    </Scene>
  );
};

export const S05: React.FC = () => <Switcher id="S05" />;
export const S06: React.FC = () => <Switcher id="S06" />;
export const S07: React.FC = () => <Switcher id="S07" />;

