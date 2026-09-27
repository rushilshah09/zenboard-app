/* Zenboard — one continuous launch film. One paused timeline, one motion system.
 *
 * Motion language (used everywhere, nothing else):
 *   travel   power2/3.inOut          accelerate softly, decelerate naturally
 *   arrive   SETTLE (critically damped spring) — no overshoot
 *   hero     HERO (spring, ζ 0.8)     ≈1.5% overshoot, only on hero landings (portrait, Berry circle, mark, icon)
 *   tick     TICK (spring, ζ 0.72)    the feature list's clock tick
 *   depart   power2.in                exits accelerate away, faster than entrances
 *   spin     integrated angular velocity — every spin ramps up and coasts down, never switches speed
 */
function buildFilm() {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // Baked damped spring as a seek-safe ease (closed form, pure function of progress).
  function springEase({ response = 0.5, dampingFraction = 1 } = {}) {
    const w = (2 * Math.PI) / response, z = dampingFraction;
    let pos;
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      pos = (t) => 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
    } else pos = (t) => 1 - Math.exp(-w * t) * (1 + w * t);
    const rate = z <= 1 ? z * w : w, SCAN = 12 / rate, N = 4800;
    let T = SCAN;
    for (let i = N; i >= 0; i--) { const t = (i / N) * SCAN; if (Math.abs(1 - pos(t)) > 0.001) { T = ((i + 1) / N) * SCAN; break; } }
    const xT = pos(T);
    return { duration: T, ease: (p) => pos(p * T) + p * (1 - xT) };
  }
  const HERO = springEase({ response: 0.55, dampingFraction: 0.8 });
  const TICK = springEase({ response: 0.3, dampingFraction: 0.72 });
  const SETTLE = springEase({ response: 0.45, dampingFraction: 1 });

  // Spin with a smooth angular-velocity profile [[t, deg/s], ...]; velocity eases between keys (smoothstep),
  // so the angle is C2-continuous: spins build momentum and coast, never jump speed.
  function spinSegs(profile, base = 0) {
    const segs = []; let a = base;
    for (let i = 0; i < profile.length - 1; i++) {
      const [t0, v0] = profile[i], [t1, v1] = profile[i + 1], T = t1 - t0;
      const d = ((v0 + v1) / 2) * T;
      const f = (p) => T * (v0 * p + (v1 - v0) * (p ** 3 - p ** 4 / 2));
      segs.push({ t0, t1, a0: a, a1: a + d, f, d });
      a += d;
    }
    return segs;
  }
  const angleAt = (segs, t) => {
    if (t <= segs[0].t0) return segs[0].a0;
    for (const s of segs) if (t <= s.t1) return s.a0 + s.f((t - s.t0) / (s.t1 - s.t0));
    return segs[segs.length - 1].a1;
  };
  function addSpin(tl, targets, prop, segs, sign = 1) {
    for (const s of segs) {
      if (Math.abs(s.d) < 1e-6) continue;
      tl.to(targets, { [prop]: sign * s.a1, duration: s.t1 - s.t0, ease: (p) => s.f(p) / s.d }, s.t0);
    }
  }

  // Measure layout once, before any tween touches a transform (scale-safe for Studio's scaled preview).
  const frR = $("#fr").getBoundingClientRect();
  const K = 1920 / frR.width;
  const pt = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - frR.left + r.width / 2) * K, y: (r.top - frR.top + r.height / 2) * K }; };

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out", duration: 0.6 } });

  /* ---------- captions ---------- */
  $$(".capw .w, .tagw .w, .availw .w, #autoHead .w, #autoSub .w").forEach((w) => tl.set(w, { opacity: 0 }, 0));
  const wordsIn = (sel, at, stagger = 0.07) =>
    tl.fromTo(`${sel} .w`, { opacity: 0, y: 16, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, stagger, ease: "power3.out", immediateRender: false }, at);
  const wordsOut = (sel, at) => tl.to(`${sel} .w`, { opacity: 0, y: -12, filter: "blur(8px)", duration: 0.4, stagger: 0.03, ease: "power2.in" }, at);

  /* ================= A · Orbit (0 – 9.4) ================= */
  const CX = 960, CY = 540;
  tl.set("#diag1", { attr: { "stroke-dashoffset": 1 } }, 0);
  tl.set("#diag2", { attr: { "stroke-dashoffset": 0.24 } }, 0);
  tl.set("#diag3", { attr: { "stroke-dashoffset": 1 } }, 0);
  tl.set("#bead", { x: 2040, y: -120, scale: 1, opacity: 1 }, 0);
  tl.set("#portrait", { scale: 0.08, opacity: 0 }, 0);
  tl.set("#portrait img", { opacity: 0 }, 0);
  tl.set("#berryDisc", { scale: 0.825, opacity: 0 }, 0);
  // anticipation: the bead eases back a hair, then shoots down the line as it draws
  tl.to("#bead", { x: 2062, y: -134, duration: 0.3, ease: "power2.inOut" }, 0.15);
  tl.to("#bead", { x: CX, y: CY, duration: 1.15, ease: "power3.inOut" }, 0.45);
  tl.to("#diag1", { attr: { "stroke-dashoffset": 0 }, duration: 1.15, ease: "power3.inOut" }, 0.45);
  // landing: the bead opens into the portrait; the line draws off behind it (follow-through)
  tl.to("#portrait", { opacity: 1, duration: 0.2, ease: "power1.out" }, 1.55);
  tl.to("#portrait", { scale: 1, duration: HERO.duration, ease: HERO.ease }, 1.55);
  tl.to("#bead", { scale: 10, opacity: 0, duration: 0.35, ease: "power2.out" }, 1.58);
  tl.to("#portrait img", { opacity: 1, duration: 0.6, ease: "power2.inOut" }, 1.9);
  tl.to("#diag1", { attr: { "stroke-dashoffset": -1 }, duration: 0.9, ease: "power2.inOut" }, 1.65);

  // two rings of apps, thrown into orbit one by one
  const arms = $$("#orbitA .arm");
  const armsIn = $$("#spinIn .arm"), armsOut = $$("#spinOut .arm");
  const order = [armsIn[0], armsOut[0], armsIn[1], armsOut[1], armsIn[2], armsOut[2], armsIn[3], armsOut[3]];
  arms.forEach((a) => {
    tl.set(a, { x: -a.dataset.dx, y: -a.dataset.dy }, 0);
    tl.set(a.querySelector(".tface"), { scale: 0.4, opacity: 0 }, 0);
    tl.set(a.querySelector(".badge"), { scale: 0 }, 0);
  });
  tl.set(".hring", { scale: 0.85, opacity: 0 }, 0);
  tl.to("#hrIn", { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out" }, 2.3);
  tl.to("#hrOut", { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out" }, 2.55);
  order.forEach((a, i) => {
    const at = 2.45 + i * 0.26;
    tl.to(a, { x: 0, y: 0, duration: 0.95, ease: "power3.out" }, at);
    tl.to(a.querySelector(".tface"), { scale: 1, opacity: 1, duration: 0.7, ease: "power3.out" }, at);
  });
  const spinIn = spinSegs([[2.4, 0], [4.4, 38], [6.2, 55], [8.8, 230], [9.6, 290], [10.6, 520]]);
  const spinOut = spinSegs([[2.6, 0], [4.6, -26], [6.2, -40], [8.8, -170], [9.6, -220], [10.6, -400]]);
  addSpin(tl, "#spinIn", "rotation", spinIn);
  addSpin(tl, armsIn.map((a) => a.querySelector(".tspin")), "rotation", spinIn, -1);
  addSpin(tl, "#spinOut", "rotation", spinOut);
  addSpin(tl, armsOut.map((a) => a.querySelector(".tspin")), "rotation", spinOut, -1);
  // the rings tilt into depth as they fill; tiles stay facing camera
  tl.to("#tiltA", { rotationX: 62, duration: 2.8, ease: "power2.inOut" }, 3.6);
  tl.to(".ttilt", { rotationX: -62, duration: 2.8, ease: "power2.inOut" }, 3.6);
  tl.to("#tiltA", { rotationX: 68, duration: 2.6, ease: "power2.inOut" }, 6.6);
  tl.to(".ttilt", { rotationX: -68, duration: 2.6, ease: "power2.inOut" }, 6.6);
  // unread badges climb (odometer)
  order.forEach((a, i) => {
    const b = a.querySelector(".badge"), s = a.querySelector(".odo-s"), at = 4.7 + i * 0.2;
    tl.to(b, { scale: 1, duration: SETTLE.duration, ease: SETTLE.ease }, at);
    tl.fromTo(s, { y: 0 }, { y: "-2.1cqw", duration: 0.35, immediateRender: false }, at);
    tl.to(s, { y: "-4.2cqw", duration: 0.35 }, at + 1.1);
    tl.to(s, { y: "-6.3cqw", duration: 0.35 }, at + 2.3);
  });
  // the diagonal passes through the rings; where it meets them, the ring answers
  tl.to("#diag2", { attr: { "stroke-dashoffset": -1.06 }, duration: 1.3, ease: "power2.inOut" }, 4.8);
  tl.set(".ripple", { scale: 0.2, opacity: 0 }, 0);
  tl.fromTo("#rip1", { scale: 0.2, opacity: 0.8 }, { scale: 3.2, opacity: 0, duration: 1.1, ease: "power2.out", immediateRender: false }, 5.2);
  tl.fromTo("#rip2", { scale: 0.2, opacity: 0.8 }, { scale: 3.2, opacity: 0, duration: 1.1, ease: "power2.out", immediateRender: false }, 5.55);
  tl.to("#hrOut", { borderColor: "rgba(196,28,114,.55)", duration: 0.25, ease: "power2.out" }, 5.2);
  tl.to("#hrOut", { borderColor: "rgba(196,28,114,.22)", duration: 0.8, ease: "power2.inOut" }, 5.45);
  tl.to("#hrIn", { borderColor: "rgba(196,28,114,.55)", duration: 0.25, ease: "power2.out" }, 5.35);
  tl.to("#hrIn", { borderColor: "rgba(196,28,114,.22)", duration: 0.8, ease: "power2.inOut" }, 5.6);
  // tension: the camera leans in and rolls as the spin accelerates
  tl.set("#cam", { transformOrigin: "960px 540px" }, 0);
  tl.to("#cam", { scale: 1.13, rotation: -4, duration: 3.1, ease: "power2.inOut" }, 6.2);
  wordsIn("#capApps", 2.35); wordsOut("#capApps", 5.7);
  wordsIn("#capAll", 6.25); wordsOut("#capAll", 8.9);

  /* ================= B · One (9.4 – 15.6) ================= */
  arms.forEach((a, i) => {
    tl.to(a, { x: -a.dataset.dx, y: -a.dataset.dy, duration: 0.9, ease: "power3.in" }, 9.55 + i * 0.04);
    tl.to(a.querySelector(".tface"), { scale: 0.35, opacity: 0, duration: 0.45, ease: "power2.in" }, 10.0 + i * 0.04);
  });
  tl.to(".hring", { scale: 0.3, opacity: 0, duration: 0.95, ease: "power3.in" }, 9.5);
  tl.to("#cam", { scale: 1, rotation: 0, duration: 1.6, ease: "power2.inOut" }, 9.6);
  // anticipation squeeze, then one Berry circle swells out of the portrait
  tl.to("#portrait", { scale: 0.9, duration: 0.32, ease: "power2.inOut" }, 10.12);
  tl.to("#berryDisc", { opacity: 1, duration: 0.18, ease: "power1.out" }, 10.42);
  tl.to("#berryDisc", { scale: 1, duration: HERO.duration, ease: HERO.ease }, 10.44);
  tl.to("#portrait", { opacity: 0, duration: 0.1 }, 10.6);
  wordsIn("#capMeet", 11.2); wordsOut("#capMeet", 12.6);

  // the same apps return, calm: one flat orbit, evenly spaced
  const armsB = $$("#orbitB .armB");
  const RB = GEO.R_B;
  armsB.forEach((a, i) => {
    const ang = (i * 45 - 90) * Math.PI / 180;
    a.style.left = `${Math.round(RB * Math.cos(ang))}px`;
    a.style.top = `${Math.round(RB * Math.sin(ang))}px`;
    tl.set(a, { x: -Math.round(RB * Math.cos(ang)), y: -Math.round(RB * Math.sin(ang)) }, 0);
    tl.set(a.querySelector(".tile"), { scale: 0.5, opacity: 0 }, 0);
    tl.to(a, { x: 0, y: 0, duration: 0.85, ease: "power3.out" }, 12.9 + i * 0.05);
    tl.to(a.querySelector(".tile"), { scale: 1, opacity: 1, duration: 0.6, ease: "power3.out" }, 12.9 + i * 0.05);
  });
  const spinB = spinSegs([[12.9, 0], [13.8, 26], [14.45, 30]]);
  addSpin(tl, "#spinB", "rotation", spinB);
  addSpin(tl, $$("#orbitB .tspinB"), "rotation", spinB, -1);
  wordsIn("#capJuggle", 13.0); wordsOut("#capJuggle", 14.3);

  // "In one place." — the Berry circle stretches into the product window, the apps fly into its sidebar
  const DW = 1267.2, DH = 710.4, WS = 1.1, WL = CX - DW / 2, WT = CY - DH / 2;
  const toScreen = (lx, ly) => ({ x: CX + (lx - DW / 2) * WS, y: CY + (ly - DH / 2) * WS });
  const navIcons = $$("#win .ds .dn svg");
  const NAV_FOR = [1, 0, 2, 4, 6, 5, 7, 3]; // mail→Inbox, chat→Today, tasks, docs, crm→Clients, cal, money, notes→Projects
  const aB = angleAt(spinB, 14.45);
  $$("#flyers .flyer").forEach((fl, k) => {
    const ang = (k * 45 - 90 + aB) * Math.PI / 180;
    const p = pt(navIcons[NAV_FOR[k]]);
    const tgt = toScreen(p.x - WL, p.y - WT);
    tl.set(fl, { x: CX + RB * Math.cos(ang), y: CY + RB * Math.sin(ang), opacity: 0, scale: 1 }, 0);
    tl.set(fl, { opacity: 1 }, 14.45);
    tl.to(fl, { x: tgt.x, y: tgt.y, scale: 0.32, duration: 0.95, ease: "power3.inOut" }, 14.5 + k * 0.035);
    tl.to(fl, { opacity: 0, duration: 0.25, ease: "power1.in" }, 15.25 + k * 0.035);
  });
  tl.set("#orbitB", { opacity: 0 }, 14.45);
  tl.to("#berryDisc", { scale: 0.94, duration: 0.25, ease: "power2.inOut" }, 14.3);
  const r0 = (240 * 0.94) / WS / 2;
  // distinct side values keep Chrome from shortening inset() (which breaks tween interpolation)
  const ins = (t, r, b, l, rad) => `inset(${t + 0.01}px ${r + 0.02}px ${b + 0.03}px ${l + 0.04}px round ${rad}px)`;
  tl.set("#win", { opacity: 0, scale: WS, transformPerspective: 2200, clipPath: ins(DH / 2 - r0, DW / 2 - r0, DH / 2 - r0, DW / 2 - r0, r0) }, 0);
  tl.set("#win", { opacity: 1 }, 14.55);
  tl.set("#berryDisc", { opacity: 0 }, 14.56);
  tl.to("#win", { clipPath: ins(0, 0, 0, 0, 19), duration: 0.85, ease: "power3.inOut" }, 14.56);
  tl.to("#win", { rotationX: 9, y: 16, duration: 0.45, ease: "power2.in" }, 14.56);
  tl.to("#win", { rotationX: 0, y: 0, duration: 0.9, ease: "power3.out" }, 15.01);
  tl.to("#winBerry", { opacity: 0, duration: 0.8, ease: "power2.inOut" }, 15.15);

  /* ================= C · Product (15.6 – 21.5) ================= */
  const dashParts = "#win .dlogo, #win .dsearch, #win .ds .dn, #win .dsec, #win .dg, #win .dsub, #win .dhl, #win .dsec2, #win .dr, #win .dw";
  tl.set(dashParts, { opacity: 0, y: 8 }, 0);
  tl.to("#win .dlogo, #win .dsearch", { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 }, 15.25);
  const navRows = $$("#win .ds .dn");
  NAV_FOR.forEach((n, k) => tl.to(navRows[n], { opacity: 1, y: 0, duration: 0.4 }, 15.3 + k * 0.035));
  navRows.forEach((r, n) => { if (!NAV_FOR.includes(n)) tl.to(r, { opacity: 1, y: 0, duration: 0.45 }, 15.6 + n * 0.03); });
  tl.to("#win .dsec", { opacity: 1, y: 0, duration: 0.45 }, 15.9);
  tl.to("#win .dg", { opacity: 1, y: 0, duration: 0.7 }, 16.3);
  tl.to("#win .dsub", { opacity: 1, y: 0, duration: 0.7 }, 16.5);
  tl.to("#win .dhl", { opacity: 1, y: 0, duration: 0.7 }, 16.8);
  tl.to("#win .dsec2", { opacity: 1, y: 0, duration: 0.5 }, 17.1);
  tl.to("#win .dr", { opacity: 1, y: 0, duration: 0.6, stagger: 0.13 }, 17.25);
  tl.to("#win .dw", { opacity: 1, y: 0, duration: 0.7, stagger: 0.15 }, 17.5);
  wordsIn("#capDay", 17.2); wordsOut("#capDay", 19.0);

  // camera zooms to the plan, the cursor arrives on an arc and checks off the first task
  const box = $("#win .dr i");
  const bp = pt(box), bs = toScreen(bp.x - WL, bp.y - WT);
  const Z = 1.75, FX = 780, FY = 540;
  tl.to("#cam", { x: FX - CX - (bs.x - CX) * Z, y: FY - CY - (bs.y - CY) * Z, scale: Z, duration: 1.05, ease: "power3.inOut" }, 19.0);
  tl.set("#cursor", { x: 1560, y: 1180, opacity: 1, scale: 1 }, 0);
  tl.to("#cursor", { x: FX - 2, duration: 0.85, ease: "power2.inOut" }, 19.65);
  tl.to("#cursor", { y: FY - 2, duration: 0.85, ease: "power3.out" }, 19.65);
  tl.to("#cursor", { scale: 0.86, duration: 0.1, ease: "power2.out" }, 20.5);
  tl.to("#cursor", { scale: 1, duration: 0.3, ease: "power3.out" }, 20.62);
  tl.to(box, { backgroundColor: "#C41C72", borderColor: "#C41C72", duration: 0.15, ease: "power2.out" }, 20.56);
  tl.set("#clickRip", { x: FX, y: FY }, 0);
  tl.fromTo("#clickRip", { scale: 0.3, opacity: 0.7 }, { scale: 2.6, opacity: 0, duration: 0.7, ease: "power2.out", immediateRender: false }, 20.56);
  tl.set("#win .dr", { color: "#D8D4CC", textDecoration: "none" }, 0);
  tl.set($("#win .dr"), { color: "#6E6A64", textDecoration: "line-through" }, 20.62);
  tl.set("#win .dhl b", { opacity: 1, textDecoration: "none" }, 0);
  tl.set("#win .dhl b", { opacity: 0.6, textDecoration: "line-through" }, 20.62);
  tl.to("#cursor", { x: 1260, y: 940, opacity: 0, duration: 0.55, ease: "power2.in" }, 21.0);

  /* ================= D · Features (21.5 – 34.0) ================= */
  // the camera returns; the window slides right and becomes the feature panel
  tl.to("#cam", { x: 0, y: 0, scale: 1, duration: 1.0, ease: "power3.inOut" }, 21.2);
  const PW = 1920 * (1 - 0.34 - 0.022), PS = PW / DW, PH = DH * PS, PX = 1920 * 0.34 + PW / 2;
  tl.to("#win", { x: PX - CX, scale: PS, duration: 0.9, ease: "power3.inOut" }, 21.25);
  tl.to("#win", { opacity: 0, filter: "blur(10px)", duration: 0.45, ease: "power2.in" }, 21.95);
  const pT = 1080 * 0.03, pL = 1920 * 0.34, pR = 1920 * 0.022;
  tl.set("#rpanel", { opacity: 0, clipPath: ins((1080 - PH) / 2, pR, (1080 - PH) / 2, pL, 19 * PS) }, 0);
  tl.to("#rpanel", { opacity: 1, duration: 0.35, ease: "power2.inOut" }, 21.8);
  tl.to("#rpanel", { clipPath: ins(pT, pR, pT, pL, 38.4), duration: 0.65, ease: "power3.inOut" }, 21.95);

  const FEATS = $$(".fstage");
  const T0 = 22.2, STEP = 1.5;
  FEATS.forEach((st, i) => {
    tl.set(st, { opacity: i === 0 ? 1 : 0 }, 0);
    tl.set(st.querySelector(".tcard"), { opacity: 0, y: 96, filter: "blur(8px)" }, 0);
    tl.set(st.querySelector(".fcard"), { opacity: 0, scale: 0.8, transformOrigin: "80% 20%" }, 0);
    const at = i === 0 ? 22.05 : T0 + i * STEP - 0.1;
    if (i > 0) tl.to(st, { opacity: 1, duration: 0.4, ease: "power2.out" }, at);
    tl.to(st.querySelector(".tcard"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, at + 0.05);
    tl.to(st.querySelector(".fcard"), { opacity: 1, duration: 0.25, ease: "power1.out" }, at + 0.18);
    tl.to(st.querySelector(".fcard"), { scale: 1, duration: HERO.duration, ease: HERO.ease }, at + 0.18);
    if (i < FEATS.length - 1) {
      const out = T0 + (i + 1) * STEP - 0.18;
      tl.to(st.querySelector(".tcard"), { opacity: 0, y: -77, filter: "blur(6px)", duration: 0.35, ease: "power2.in" }, out);
      tl.to(st.querySelector(".fcard"), { opacity: 0, scale: 0.95, duration: 0.25, ease: "power2.in" }, out);
      tl.to(st, { opacity: 0, duration: 0.2 }, out + 0.6);
    }
  });

  // the list: a dial that ticks like a clock
  const SC = [1.45, 1.08, 1.0, 0.95, 0.92], OP = [1, 0.92, 0.62, 0.38, 0];
  const dialX = (a) => (11.5 - 6.2 * a ** 0.85) * 19.2;
  const dialY = (rel) => Math.sign(rel) * (7.6 * Math.abs(rel) - 0.25 * rel * rel) * 19.2;
  const tbl = (t, a) => { const i = Math.min(Math.floor(a), t.length - 2); const k = Math.min(1, a - i); return t[i] + (t[i + 1] - t[i]) * k; };
  const pills = $$("#flist .fpw");
  const state = (j, s) => { const rel = j - 2 - s, a = Math.min(4, Math.abs(rel)); return { x: dialX(a), y: dialY(rel), sc: tbl(SC, a), op: tbl(OP, a) }; };
  pills.forEach((p, j) => {
    const s0 = state(j, 0);
    tl.set(p, { x: -520, y: s0.y, opacity: 0 }, 0);
    tl.set(p.querySelector(".fpin"), { scale: s0.sc, transformOrigin: "0% 50%" }, 0);
    tl.set(p.querySelector(".fpon"), { opacity: j === 2 ? 1 : 0 }, 0);
    tl.to(p, { x: s0.x, opacity: s0.op, duration: 0.85, ease: "power3.out" }, 21.55 + Math.abs(j - 2) * 0.05);
    for (let s = 1; s < 8; s++) {
      const st = state(j, s), at = T0 + s * STEP - 0.12;
      tl.to(p, { x: st.x, y: st.y, opacity: st.op, duration: TICK.duration, ease: TICK.ease }, at);
      tl.to(p.querySelector(".fpin"), { scale: st.sc, duration: TICK.duration, ease: TICK.ease }, at);
      if (j === 2 + s) tl.to(p.querySelector(".fpon"), { opacity: 1, duration: 0.2, ease: "power1.out" }, at + 0.02);
      if (j === 2 + s - 1) tl.to(p.querySelector(".fpon"), { opacity: 0, duration: 0.15, ease: "power1.in" }, at);
    }
  });

  /* ================= E · Automation (34.0 – 41.5) ================= */
  const last = FEATS[FEATS.length - 1];
  tl.to(pills, { x: -620, opacity: 0, duration: 0.5, stagger: 0.02, ease: "power2.in" }, 33.8);
  tl.to(last.querySelector(".tcard"), { opacity: 0, y: -60, filter: "blur(6px)", duration: 0.4, ease: "power2.in" }, 33.8);
  tl.to(last.querySelector(".fcard"), { opacity: 0, scale: 0.95, duration: 0.3, ease: "power2.in" }, 33.8);
  tl.to("#rpanel", { clipPath: ins(0, 0, 0, 0, 0), duration: 0.85, ease: "power3.inOut" }, 33.9);
  tl.set("#berryField", { opacity: 0 }, 0);
  tl.to("#berryField", { opacity: 1, duration: 0.9, ease: "power2.inOut" }, 34.2);
  tl.set("#rpanel", { opacity: 0 }, 35.2);

  wordsIn("#autoHead", 34.65, 0.1);
  wordsIn("#autoSub", 36.6, 0.06);
  tl.set(".a-prompt", { y: 70, opacity: 0, scale: 1.3 }, 0);
  tl.to(".a-prompt", { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 35.0);
  const chars = $$("#prompt .ch");
  tl.set(chars, { opacity: 0 }, 0);
  tl.set("#caret", { opacity: 0 }, 0);
  tl.to(chars, { opacity: 1, duration: 0.04, stagger: 1.5 / chars.length, ease: "none" }, 35.3);
  const cp = pt($("#create"));
  const APX = 960, APY = 560;
  const cbx = APX + (cp.x - APX) * 1.3, cby = APY + (cp.y - APY) * 1.3;
  tl.set("#cursor", { x: 1760, y: 1180, scale: 1 }, 36.0);
  tl.to("#cursor", { opacity: 1, duration: 0.2 }, 36.85);
  tl.to("#cursor", { x: cbx - 4, duration: 0.8, ease: "power2.inOut" }, 36.85);
  tl.to("#cursor", { y: cby - 2, duration: 0.8, ease: "power3.out" }, 36.85);
  tl.to("#cursor", { scale: 0.86, duration: 0.1, ease: "power2.out" }, 37.68);
  tl.to("#cursor", { scale: 1, duration: 0.3, ease: "power3.out" }, 37.8);
  tl.to("#create", { scale: 0.93, duration: 0.1, ease: "power2.out" }, 37.68);
  tl.to("#create", { scale: 1, duration: SETTLE.duration, ease: SETTLE.ease }, 37.8);
  tl.set("#clickRip", { x: cbx, y: cby }, 37.0);
  tl.fromTo("#clickRip", { scale: 0.3, opacity: 0.7 }, { scale: 2.6, opacity: 0, duration: 0.7, ease: "power2.out", immediateRender: false }, 37.72);
  tl.to("#cursor", { x: cbx + 260, y: cby + 320, opacity: 0, duration: 0.55, ease: "power2.in" }, 38.05);
  // the steps card slides out of the prompt; each step checks off in rhythm
  tl.to(".a-prompt", { x: -330, duration: 0.8, ease: "power3.inOut" }, 37.9);
  tl.set(".a-steps", { x: -260, opacity: 0, scale: 1.15 }, 0);
  tl.to(".a-steps", { x: 0, opacity: 1, duration: 0.85, ease: "power3.out" }, 38.0);
  const stps = $$("#stepsWrap .stp");
  tl.set(stps, { backgroundColor: "#FAF8F3" }, 0);
  tl.set("#stepsWrap .stp .ok", { scale: 0, opacity: 0 }, 0);
  stps.forEach((s, i) => {
    const at = 38.4 + i * 0.4;
    tl.to(s.querySelector(".ok"), { scale: 1, opacity: 1, duration: HERO.duration * 0.7, ease: HERO.ease }, at);
    tl.to(s, { backgroundColor: "#F2F8EF", duration: 0.3, ease: "power1.out" }, at);
  });
  tl.set(".a-toast", { y: 50, opacity: 0, scale: 1 }, 0);
  tl.to(".a-toast", { y: 0, opacity: 1, duration: SETTLE.duration, ease: SETTLE.ease }, 39.9);
  tl.to("#autoHead .w, #autoSub .w", { opacity: 0, y: -30, filter: "blur(8px)", duration: 0.45, stagger: 0.02, ease: "power2.in" }, 40.6);
  tl.to(".a-prompt, .a-steps", { opacity: 0, y: -50, filter: "blur(8px)", duration: 0.5, stagger: 0.06, ease: "power2.in" }, 40.7);
  tl.to(".a-toast", { y: 540 - 900, scale: 1.3, duration: 0.85, ease: "power3.inOut" }, 40.8);

  /* ================= F · Everything (41.5 – 48.0) ================= */
  const rows = $$("#wall .wrowW");
  const hero = $("#heroPill");
  const heroOff = pt(hero).x - CX;
  const row2 = rows[2];
  tl.set(".a-toast .toast", { opacity: 1 }, 0);
  tl.to(".a-toast", { opacity: 0, filter: "blur(4px)", duration: 0.35, ease: "power1.inOut" }, 41.55);
  tl.set(hero, { opacity: 0, scale: 0.92 }, 0);
  tl.to(hero, { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }, 41.5);
  $$("#wall .wrowW .wp").forEach((p) => { if (p !== hero) tl.set(p, { opacity: 0 }, 0); });
  rows.forEach((r, i) => {
    const dir = i % 2 ? -1 : 1;
    const base = i === 2 ? -heroOff : (i % 2 ? -140 : 120);
    if (i === 2) {
      tl.set(r, { x: base }, 0);
      const ps = [...r.querySelectorAll(".wp")], hi = ps.indexOf(hero);
      ps.forEach((p, k) => { if (p !== hero) tl.fromTo(p, { opacity: 0, x: (hi - k) * 30 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out", immediateRender: false }, 41.75 + Math.abs(k - hi) * 0.06); });
    } else {
      tl.set(r, { x: base - dir * 1700 }, 0);
      tl.set(r.querySelectorAll(".wp"), { opacity: 1 }, 41.6);
      tl.to(r, { x: base, duration: 1.1, ease: "power3.out" }, 41.7 + Math.abs(i - 2) * 0.1);
    }
    // the wall scrolls in alternating directions and keeps accelerating
    tl.to(r, { x: base + dir * (i === 2 ? 520 : 900), duration: 3.9, ease: "power2.in" }, 42.8);
  });
  wordsIn("#capNeed", 42.3); wordsOut("#capNeed", 46.2);
  // everything gathers into the centre while the field sinks to ink
  tl.set("#wall", { scale: 1, opacity: 1 }, 0);
  tl.to("#wall", { scale: 0.18, opacity: 0, filter: "blur(10px)", duration: 1.0, ease: "power3.in" }, 46.6);
  tl.set("#ink", { opacity: 0 }, 0);
  tl.to("#ink", { opacity: 1, duration: 1.3, ease: "power2.inOut" }, 46.8);
  tl.set("#berryField", { opacity: 0 }, 48.3);

  /* ================= G · Made (48.0 – 54.0) ================= */
  const carSpinProfile = [[47.3, 0], [48.4, -70], [50.0, -46], [52.0, -40], [54.0, -36], [56.0, -28], [58.6, 0]];
  const raw = spinSegs(carSpinProfile);
  const total = raw[raw.length - 1].a1;
  // start offset so the even tiles finish exactly on the mark's four diagonals (45° + k·90°)
  const OFF = ((45 - total) % 90 + 90) % 90;
  const carSpin = spinSegs(carSpinProfile, OFF);
  const bills = $$("#car .cbill2");
  tl.set("#carSpin", { rotationY: OFF }, 0);
  tl.set(bills, { rotationY: -OFF }, 0);
  addSpin(tl, "#carSpin", "rotationY", carSpin);
  // billboard: every tile keeps facing the camera while the ring turns
  addSpin(tl, bills, "rotationY", carSpin, -1);
  tl.set("#car", { opacity: 0, y: 0 }, 0);
  tl.set("#carTilt", { rotationX: -24 }, 0);
  tl.set("#car", { scale: 0.1 }, 0);
  tl.set("#car .cbill3", { rotationX: 24 }, 0);
  tl.to("#car", { opacity: 1, duration: 0.4, ease: "power1.out" }, 47.3);
  tl.to("#car", { scale: 1, duration: 1.3, ease: "power3.out" }, 47.35);
  wordsIn("#capMade", 49.3); wordsOut("#capMade", 52.6);

  /* ================= H · Resolve (54.0 – 70.0) ================= */
  // the ring tips over to face the camera — the same circular motion, now head-on — as ink blooms back to paper
  tl.to("#carTilt", { rotationX: -90, duration: 2.2, ease: "power2.inOut" }, 54.2);
  tl.to("#car .cbill3", { rotationX: 90, duration: 2.2, ease: "power2.inOut" }, 54.2);
  tl.to("#car", { y: 90, scale: 0.72, duration: 2.2, ease: "power2.inOut" }, 54.2);
  tl.to("#ink", { opacity: 0, duration: 1.8, ease: "power2.inOut" }, 54.8);
  wordsIn("#capOne", 54.6);
  tl.to("#capOne .cap", { color: "#191919", duration: 1.4, ease: "power2.inOut" }, 55.0);
  wordsOut("#capOne", 57.4);
  // tiles shed their icons and become circles; pairs merge, eight → four
  tl.set("#car .dotc", { scale: 0.3, opacity: 0 }, 0);
  tl.to("#car .i3", { scale: 0.45, opacity: 0, duration: 0.5, stagger: 0.04, ease: "power2.in" }, 56.3);
  tl.to("#car .dotc", { scale: 1, opacity: 1, duration: 0.55, stagger: 0.04, ease: "power3.out" }, 56.45);
  tl.to("#car .dotc.odd", { scale: 0.2, opacity: 0, duration: 0.5, ease: "power2.in" }, 57.0);
  // the diagonal returns; as it sweeps through, the four circles snap into alignment
  tl.to("#diag3", { attr: { "stroke-dashoffset": 0 }, duration: 0.7, ease: "power3.inOut" }, 57.55);
  tl.to("#diag3", { attr: { "stroke-dashoffset": -1 }, duration: 0.6, ease: "power2.inOut" }, 58.3);
  const KR = 114 / GEO.R_CAR;
  tl.to("#car", { scale: KR, duration: HERO.duration, ease: HERO.ease }, 57.85);
  tl.to("#car .dotc:not(.odd)", { scale: 139 / KR / 140, duration: HERO.duration, ease: HERO.ease }, 57.85);
  // the mark forms from the four circles, finishing the spin with a small overshoot
  tl.set("#mark", { opacity: 0, scale: 0.94, rotation: -10, filter: "blur(4px)" }, 0);
  tl.to("#car .dotc:not(.odd)", { opacity: 0, filter: "blur(3px)", duration: 0.35, ease: "power2.in" }, 58.62);
  tl.to("#mark", { opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power1.out" }, 58.6);
  tl.to("#mark", { scale: 1, rotation: 0, duration: HERO.duration, ease: HERO.ease }, 58.6);
  tl.set("#car", { opacity: 0 }, 59.1);
  // the mark glides left and the wordmark writes itself
  const LW = 900, MS = (LW * 32) / 152;
  tl.to("#mark", { x: CX - LW / 2 + MS / 2 - CX, scale: MS / 300, duration: 0.95, ease: "power3.inOut" }, 59.5);
  const lts = $$("#letters .lt");
  tl.set(lts, { opacity: 0, y: 7 }, 0);
  tl.to(lts, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" }, 59.9);
  wordsIn("#tagline", 61.0, 0.05);
  // the resolve: words step away, night falls, the mark becomes the app icon
  tl.to(lts, { opacity: 0, y: -5, duration: 0.4, stagger: 0.025, ease: "power2.in" }, 65.0);
  wordsOut("#tagline", 64.9);
  tl.set("#night", { opacity: 0 }, 0);
  tl.to("#night", { opacity: 1, duration: 1.0, ease: "power2.inOut" }, 65.2);
  tl.to("#mark", { x: 0, y: -40, scale: 0.5, duration: 0.95, ease: "power3.inOut" }, 65.4);
  tl.to("#markPath", { fill: "#FFFFFF", duration: 0.5, ease: "power1.inOut" }, 65.85);
  tl.set("#appicon", { scale: 0.45, opacity: 0 }, 0);
  tl.to("#appicon", { opacity: 1, duration: 0.3, ease: "power1.out" }, 65.75);
  tl.to("#appicon", { scale: 1, duration: HERO.duration, ease: HERO.ease }, 65.75);
  wordsIn("#avail", 66.6);
  tl.set("#black", { opacity: 0 }, 0);
  tl.to("#black", { opacity: 1, duration: 0.6, ease: "power1.in" }, 69.4);

  window.film = tl;
  window.filmReady = true;
}
document.fonts.ready.then(buildFilm);
