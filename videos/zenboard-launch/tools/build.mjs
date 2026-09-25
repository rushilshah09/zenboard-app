// Assembles index.html: one stage, one timeline. Markup is generated here from the approved UI fragments
// (build/fragments.json, rendered from launch-video/src/v4); motion lives in src/film.js.
// Run: node tools/fragments (see README) && node tools/build.mjs
import { readFileSync, writeFileSync } from "fs";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");
const F = JSON.parse(read("build/fragments.json"));
const clean = (h) => h.replace(/<link [^>]*>/g, "");
const ic = (name, w = "fill") => {
  const s = F.icons[`${name}:${w}`];
  if (!s) throw new Error(`missing icon ${name}:${w}`);
  return s;
};
const BERRY = "#C41C72";
const FIELD = { petal: "#EAB9CB", apricot: "#ECBF9B", butter: "#E5D494", sage: "#B7CEAB", sky: "#A6D1E0", peri: "#B8BDEE", sand: "#EEE7D9", mist: "#E7EAEC" };

/* ---------- A · orbit tiles (two rings) ---------- */
const INNER = [0, 2, 5, 6]; // mail, tasks, calendar, invoices
const OUTER = [1, 3, 4, 7]; // chat, docs, crm, notes
const R_IN = 250, R_OUT = 410;
const BADGES = [[3, 7, 12], [2, 5, 9], [1, 4, 8], [2, 6, 11], [4, 9, 14], [1, 3, 6], [2, 4, 7], [3, 5, 10]];
const tileA = (k, i, n, r, size) => {
  const [icon, bg, fg] = F.kinds[k];
  const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (r === R_OUT ? Math.PI / 4 : 0);
  const x = Math.round(r * Math.cos(a)), y = Math.round(r * Math.sin(a));
  const b = BADGES[k];
  return `<div class="arm" data-k="${k}" data-dx="${x}" data-dy="${y}" style="left:${x}px;top:${y}px">
    <div class="tspin"><div class="ttilt"><div class="tface">
      <div class="tile" style="width:${size}px;height:${size}px;--s:${size}px;--bg:${bg};color:${fg}"><span class="tico">${ic(icon)}</span>
        <span class="badge odo"><span class="odo-s">${["", ...b].map((v) => `<b>${v}</b>`).join("")}</span></span></div>
    </div></div></div></div>`;
};
const orbitA = `<div id="orbitA"><div id="tiltA">
  <div class="hring" id="hrIn" style="width:${2 * R_IN}px;height:${2 * R_IN}px;margin:-${R_IN}px 0 0 -${R_IN}px"></div>
  <div class="hring" id="hrOut" style="width:${2 * R_OUT}px;height:${2 * R_OUT}px;margin:-${R_OUT}px 0 0 -${R_OUT}px"></div>
  <div class="spin" id="spinIn">${INNER.map((k, i) => tileA(k, i, 4, R_IN, 104)).join("")}</div>
  <div class="spin" id="spinOut">${OUTER.map((k, i) => tileA(k, i, 4, R_OUT, 116)).join("")}</div>
</div></div>`;

/* ---------- B · calm orbit (flat, evenly spaced) + flyers ---------- */
const R_B = 236;
const tileB = (k, i) => {
  const [icon, bg, fg] = F.kinds[k];
  return `<div class="armB" data-i="${i}"><div class="tspinB"><div class="tile sm" style="--bg:${bg};color:${fg}"><span class="tico">${ic(icon)}</span></div></div></div>`;
};
const orbitB = `<div id="orbitB"><div class="spin" id="spinB">${F.kinds.map((_, k) => tileB(k, k)).join("")}</div></div>`;
const flyers = `<div id="flyers">${F.kinds.map(([icon, bg, fg], k) => `<div class="flyer" data-k="${k}"><div class="tile sm" style="--bg:${bg};color:${fg}"><span class="tico">${ic(icon)}</span></div></div>`).join("")}</div>`;

/* ---------- D · feature list + panel ---------- */
const pill = (j) => {
  const i = (((j - 2) % 8) + 8) % 8;
  const Ft = F.feats[i];
  const pico = (on) => `<span class="pico" style="width:2.5cqw;height:2.5cqw;background:${on ? `color-mix(in srgb, ${Ft.m} 12%, #fff)` : `color-mix(in srgb, ${Ft.l} 30%, #fff)`};color:${on ? Ft.tone : Ft.m}">${ic(Ft.icon, "duotone")}</span>`;
  return `<div class="fpw" data-j="${j}"><div class="fpin"><div class="fp">${pico(false)}${Ft.name}</div>
    <div class="fp on fpon" style="background:${Ft.m};border-color:${Ft.m};box-shadow:0 .8cqw 2cqw ${Ft.m}55">${pico(true)}${Ft.name}</div></div></div>`;
};
const list = `<div id="flist">${Array.from({ length: 13 }, (_, j) => pill(j)).join("")}</div>`;
const fstage = (Ft, i) => `<div class="fstage" data-i="${i}">
  <div class="fbg" style="background:radial-gradient(130% 120% at 100% 100%,${Ft.l} 0%,${Ft.m} 38%,${Ft.d} 100%)"></div>
  <svg class="flobe" viewBox="0 0 32 32" style="left:62%;top:54%;width:46cqw"><path d="${F.mark}" fill="#fff"/></svg>
  <svg class="flobe" viewBox="0 0 32 32" style="left:30%;top:-12%;width:30cqw"><path d="${F.mark}" fill="#fff"/></svg>
  <div class="tcard" style="color:${Ft.tone};--tone:${Ft.tone};--light:${Ft.l}">${clean(Ft.ui)}</div>
  <div class="fcard" style="--tone:${Ft.tone}">${clean(Ft.float)}</div>
</div>`;
const rpanel = `<div id="rpanel"><div class="rp-in">${F.feats.map(fstage).join("")}</div></div>`;

/* ---------- E · automation ---------- */
const chars = [...F.prompt].map((c) => `<span class="ch">${c === " " ? " " : c}</span>`).join("");
const auto = `<div id="auto">
  <div class="a-head cap" id="autoHead">${words("Effortless automation")}</div>
  <div class="a-sub cap" id="autoSub">${words("Describe it once. Zenboard does the work.")}</div>
  <div class="a-prompt anc"><div class="acard prompt" id="prompt"><small>Describe a task for Zenboard</small><p>${chars}<span class="caret" id="caret"></span></p>
    <span class="cbtn" id="create">${ic("sparkle")} Create</span></div></div>
  <div class="a-steps anc" id="stepsWrap">${clean(F.steps)}</div>
  <div class="a-toast anc" id="toast"><div class="toast">${ic("check-circle")} Reminder sent to Fernwood Hotels</div></div>
</div>`;

/* ---------- F · pill wall ---------- */
const PILLS = [
  ["Tasks", "sky", "check-square"], ["Projects", "sand", "kanban"], ["Invoices", "apricot", "receipt"], ["Calendar", "berry", "calendar-blank"],
  ["Notes", "butter", "note-pencil"], ["Habits", "petal", "plant"], ["Focus", "sky", "timer"], ["Clients", "peri", "users-three"],
  ["Docs", "peri", "file-text"], ["Goals", "sand", "target"], ["Payments", "berry", "credit-card"], ["Time tracking", "sage", "clock"],
  ["Proposals", "sand", "paper-plane-tilt"], ["Life", "sage", "sun"], ["Files", "petal", "folder"], ["Automations", "petal", "lightning"],
  ["Insights", "sand", "chart-line"], ["Messages", "sky", "chat-circle"], ["Reminders", "peri", "bell"],
];
const wp = ([t, c, icn], extra = "") => {
  const glass = c === "berry";
  return `<span class="wp${glass ? " glass" : ""}" ${extra} style="background:${glass ? "rgba(255,255,255,.14)" : FIELD[c]};color:${glass ? "#FBFAF6" : "#191919"}"><i class="wpi">${ic(icn)}</i>${t}</span>`;
};
const ROWS = 5;
const wall = `<div id="wall">${Array.from({ length: ROWS }, (_, r) => {
  const n = 15;
  const items = Array.from({ length: n }, (_, k) => {
    if (r === 2 && k === 7) return wp(PILLS[15], 'id="heroPill"');
    return wp(PILLS[(r * 5 + k + 3) % PILLS.length]);
  }).join("");
  return `<div class="wrowW" data-r="${r}" style="top:${540 + (r - 2) * 118}px"><div class="wrow">${items}</div></div>`;
}).join("")}</div>`;

/* ---------- G/H · carousel ring → circles → mark ---------- */
const STRIP = [
  ["Tasks", "#F5F1EA", BERRY, "check-square"], ["Projects", BERRY, "#fff", "kanban"], ["Money", FIELD.sage, "#fff", "currency-circle-dollar"],
  ["Habits", "#E07AAE", "#fff", "plant"], ["Focus", FIELD.peri, "#fff", "timer"], ["Docs", "#8FC3D6", "#fff", "file-text"],
  ["Invoices", FIELD.apricot, "#fff", "receipt"], ["Calendar", FIELD.sky, "#fff", "calendar-blank"],
];
const R_CAR = 470;
const car = `<div id="car"><div id="carTilt"><div id="carSpin">${STRIP.map(([n, c, g, icn], i) => `
  <div class="cslot" style="transform:rotateY(${i * 45}deg) translateZ(${R_CAR}px) rotateY(${-i * 45}deg)">
    <div class="cbill2" data-i="${i}"><div class="cbill3"><div class="cface">
      <div class="i3" style="width:220px;height:220px;--c:${c};color:${g}"><span class="i3g">${ic(icn)}</span></div>
      <div class="dotc${i % 2 ? " odd" : ""}"></div>
    </div></div></div></div>`).join("")}</div></div></div>`;

const letters = F.letters.map((d, i) => `<path class="lt" data-i="${i}" d="${d}" fill="#191919"/>`).join("");
const logo = `<div id="logo">
  <div class="stage" id="night"></div>
  <div id="appicon"></div>
  <svg id="mark" viewBox="0 0 32 32"><path id="markPath" d="${F.mark}" fill="${BERRY}"/></svg>
  <svg id="letters" viewBox="0 0 152 32">${letters}</svg>
  <div class="tagw cap" id="tagline">${words("The single platform to manage work, life, and business.")}</div>
  <div class="availw cap" id="avail">${words("Available today.")}</div>
</div>`;

/* ---------- captions ---------- */
function words(t) { return t.split(" ").map((w) => `<span class="w">${w}</span>`).join(" "); }
const CAPS = [
  ["capApps", "Your work lives in eight apps.", "low"], ["capAll", "And you live in all of them.", "low"],
  ["capMeet", "Meet Zenboard.", "mid big"], ["capJuggle", "Everything you juggle.", "mid"],
  ["capDay", "Your whole day. One view.", "low"], ["capNeed", "Everything you need.", "low light"],
  ["capMade", "Beautifully made.", "low light"], ["capOne", "Work, life, and business. One workspace.", "low light"],
];
const caps = CAPS.map(([id, t, cls]) => `<div class="capw ${cls}" id="${id}"><div class="cap">${words(t)}</div></div>`).join("");

const cursor = `<svg id="cursor" viewBox="0 0 24 24"><path d="M1 1 L1 19 L6 14.5 L9.5 22 L12.6 20.6 L9.2 13.3 L16 13.3 Z" fill="#191919" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const stage = `
<div class="stage paper" id="bg"><div class="dots"></div><div class="glow" id="glow"></div></div>
<div class="stage" id="berryField"></div>
<div class="stage" id="ink"><div class="stage floorglow"></div><div class="stage rays"></div></div>
<div id="cam">
  <svg id="diag" viewBox="0 0 1920 1080"><line pathLength="1" id="diag1" x1="2040" y1="-120" x2="960" y2="540"/><line pathLength="1" id="diag2" x1="2160" y1="-240" x2="-240" y2="1320"/></svg>
  <div class="ripple" id="rip1"></div><div class="ripple" id="rip2"></div>
  ${orbitA}
  <div id="bead"></div><div id="core"><div class="portrait" id="portrait"><img src="assets/v4/portrait.jpg" alt=""/></div><div id="berryDisc"></div></div>
  ${orbitB}
  <div id="winWrap"><div id="win">${clean(F.dashboard)}<div id="winBerry"></div></div></div>
  ${flyers}
</div>
${rpanel}
${list}
${auto}
${wall}
${car}
<svg id="diagEnd" viewBox="0 0 1920 1080"><line pathLength="1" id="diag3" x1="2160" y1="-240" x2="-240" y2="1320"/></svg>
${logo}
<div class="ripple" id="clickRip"></div>
${cursor}
${caps}
<div class="stage" id="black"></div>`;

/* ---------- audio ---------- */
const LINES = JSON.parse(readFileSync(root + "../../launch-video/public/audio/vo4/lines.json", "utf8"));
const VO = [
  ["apps", 2.3], ["all", 6.2], ["meet", 11.2], ["juggle", 13.0], ["place", 14.6], ["day", 17.2],
  ["tasks", 22.2], ["projects", 23.7], ["docs", 25.2], ["calendar", 26.7], ["clients", 28.2], ["money", 29.7], ["habits", 31.2], ["focus", 32.7],
  ["auto", 34.6], ["work", 36.6], ["need", 42.3], ["made", 49.3], ["one", 54.6], ["zenboard", 59.8], ["tagline", 61.0], ["today", 66.6],
];
const r = (a, n, step) => Array.from({ length: n }, (_, i) => a + i * step);
const SFX = [
  ["whoosh-soft", 0.15, 0.35], ["pen-tap", 1.55, 0.35], ["lift", 1.7, 0.45],
  ...r(2.4, 8, 0.28).map((t, i) => [`tick-tuned-${i}`, t, 0.4]),
  ...r(4.7, 8, 0.2).map((t, i) => [`notify-${i}`, t, 0.22]),
  ["thread", 5.0, 0.35], ["whoosh-soft", 7.4, 0.4], ["whoosh-soft", 8.6, 0.55],
  ["breath", 9.5, 0.45], ["whoosh-soft", 9.9, 0.6], ["snap", 10.55, 0.5], ["chime-single", 10.7, 0.45],
  ...r(13.0, 8, 0.07).map((t, i) => [`tick-tuned-${i}`, t, 0.25]),
  ["whoosh-soft", 14.5, 0.55], ...r(15.0, 8, 0.05).map((t, i) => [`key-${i % 4}`, t, 0.18]),
  ["lift", 15.9, 0.4], ...r(17.0, 6, 0.22).map((t, i) => [`tick-tuned-${(i + 3) % 8}`, t, 0.2]),
  ["whoosh-soft", 19.0, 0.4], ["click-1", 20.55, 0.7], ["chime-single", 20.65, 0.35],
  ["whoosh-soft", 21.3, 0.5], ["paper-slide", 21.7, 0.4],
  ...r(22.2, 8, 1.5).map((t, i) => [`tick-tuned-${i}`, t, 0.5]), ...r(22.3, 8, 1.5).map((t) => ["snap", t, 0.22]),
  ["whoosh-soft", 33.9, 0.55], ["lift", 35.2, 0.4], ...r(35.3, 14, 0.09).map((t, i) => [`key-${i % 4}`, t, 0.16]),
  ["ui-click", 37.72, 0.8], ["whoosh-soft", 37.9, 0.4],
  ...r(38.4, 4, 0.4).map((t, i) => [`tick-tuned-${(i * 2 + 1) % 8}`, t, 0.45]), ["notify-2", 39.95, 0.45],
  ["whoosh-soft", 41.4, 0.5], ["paper-slide", 41.9, 0.4], ...r(42.9, 14, 0.26).map((t, i) => [`tick-tuned-${i % 8}`, t, 0.16]),
  ["whoosh-soft", 46.7, 0.6], ["lift", 48.1, 0.5], ["snap", 49.9, 0.3], ["snap", 51.6, 0.3],
  ["breath", 54.3, 0.45], ["whoosh-soft", 55.2, 0.45], ...r(56.6, 4, 0.12).map((t) => ["pen-tap", t, 0.3]),
  ["thread", 57.7, 0.45], ["snap", 58.1, 0.45], ["chime-resolved", 58.7, 0.7],
  ...r(59.95, 8, 0.05).map((t, i) => [`key-${i % 4}`, t, 0.14]), ["whoosh-soft", 65.1, 0.4], ["lift", 65.7, 0.45], ["click-0", 66.5, 0.35],
];
const dur = (f) => {
  const b = readFileSync(root + `assets/audio/${f}.wav`);
  const rate = b.readUInt32LE(24), bytes = b.readUInt32LE(28);
  let o = 12; while (o < b.length) { const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4); if (id === "data") return sz / bytes; o += 8 + sz; }
  return b.length / bytes;
};
const TOTAL = 70;
const cues = [
  { file: "score", t: 0, vol: 0.2, fadeIn: 1.5, fadeOut: 5, dur: TOTAL },
  ...VO.map(([id, t]) => ({ file: id, t, vol: 1 })),
  ...SFX.map(([f, t, v]) => ({ file: f, t, vol: v })),
];

const font = (fam, w, file) => `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;font-display:block;src:url(assets/fonts/${file}) format('woff2')}`;
const fonts = [
  font("Geist", 400, "geist-latin-400-normal.woff2"), font("Geist", 500, "geist-latin-500-normal.woff2"),
  font("Geist", 600, "geist-latin-600-normal.woff2"), font("Geist", 700, "geist-latin-700-normal.woff2"),
  font("Geist Mono", 400, "geist-mono-latin-400-normal.woff2"), font("Geist Mono", 500, "geist-mono-latin-500-normal.woff2"),
].join("\n");
const v4css = read("../../launch-video/src/v4/v4.css");

const html = `<!doctype html>
<!-- GENERATED by tools/build.mjs from src/film.css, src/film.js and build/fragments.json. Edit those, then rebuild. Render with tools/render.cjs. -->
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>Zenboard launch film</title>
<script src="assets/vendor/gsap.min.js"></script>
<style>
${fonts}
${v4css}
${read("src/film.css")}
</style>
</head>
<body>
<div id="root">
<div class="fr" id="fr">
${clean(F.defs)}
${stage}
</div>
</div>
<script>
const GEO = ${JSON.stringify({ R_IN, R_OUT, R_B, R_CAR, TOTAL })};
${read("src/film.js")}
</script>
</body>
</html>
`;
writeFileSync(root + "film.html", html);
writeFileSync(root + "build/audio-cues.json", JSON.stringify({ total: TOTAL, cues }, null, 1));
console.log(`film.html ${(html.length / 1024).toFixed(0)} KB, ${VO.length} VO, ${SFX.length} SFX`);
