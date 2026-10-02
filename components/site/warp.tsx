'use client';
// ── ENTERING FOCUS ──────────────────────────────────────────────────────────
//
// The user, 2026-09-26, with pictures of a jump into hyperspace: "in brand colours, they are entering
// focus mode", and then, of the first version: "I want a magic transition, like you are entering, a
// transformation". So the moment a focus session starts, the page falls away down a tunnel of light in
// the brand's own colours (berry, petal, periwinkle, a little apricot): streaks rushing past, window
// frames flying by the way the product's own screens would, a haze of berry and a white-hot core that
// swells into a flash, and out of the flash, the quiet dark ground the session runs on.
//
// It is drawn on the GPU (one fragment shader, no library: three.js would add most of a megabyte to a
// website for two seconds of light), with the flat drawing it replaced kept as the fallback where
// WebGL is not available. It plays once, when someone chooses to start a session, never on anything
// done a hundred times a day; it is a picture (hidden from assistive technology); and less motion
// skips it for the plain fade the session arrives on anyway.

import * as React from 'react';

/** The brand's colours, read from the page so both themes and a chosen accent follow. */
const INKS = ['--accent', '--color-field-petal', '--color-field-periwinkle', '--color-field-apricot', '--color-illustration-light'];

/** A duration token (`1.7s`, `900ms`) in milliseconds. */
function ms(value: string, fallback: number): number {
  const v = value.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n : n * 1000;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Stage = { speed: number; flash: number; fade: number };

/** How the jump goes, at progress `p`: speed rises into it and falls away at the end; the flash is
    the core swelling to fill the view just before it opens onto the session. */
function stage(p: number): Stage {
  const speed = smooth(0.02, 0.6, p) * (1 - smooth(0.9, 1, p));
  const flash = smooth(0.7, 0.9, p) * (1 - smooth(0.9, 1, p));
  const fade = smooth(0, 0.08, p) * (1 - smooth(0.93, 1, p));
  return { speed, flash, fade };
}

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTravel, uSpeed, uFlash, uFade;
uniform vec3 uBerry, uPetal, uPeri, uApricot, uLight, uGround;
const float TAU = 6.2831853;

float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  vec3 col = vec3(0.0);

  // Streaks: every angular slot carries one, rushing outward from far (the middle) to near (the edge),
  // longer and brighter the faster the jump and the nearer the streak. Three layers, finer each time.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float slots = 70.0 + 55.0 * fi;
    float s = (a / TAU + 0.5) * slots;
    float cell = floor(s);
    float across = fract(s) - 0.5;
    float h1 = hash(vec2(cell, 13.1 + fi * 7.3));
    float h2 = hash(vec2(cell, 3.7 + fi * 11.9));
    float z = fract(h1 * 3.1 + uTravel * (0.35 + 0.65 * h2) * (0.85 + 0.3 * fi));
    float head = 0.015 + z * z * 1.9;
    float len = (0.012 + 0.75 * uSpeed) * (0.15 + z);
    float along = smoothstep(head - len, head, r) * (1.0 - smoothstep(head, head + 0.004 + 0.012 * z, r));
    float width = (0.06 + 0.3 * z) * (0.5 + 0.5 * h2);
    float line = 1.0 - smoothstep(0.0, width, abs(across));
    float lit = along * line * (0.15 + 0.85 * z) * step(0.3, h2);
    vec3 tint = h1 < 0.4 ? uBerry : h1 < 0.72 ? uPeri : h1 < 0.9 ? uPetal : h1 < 0.95 ? uApricot : uLight;
    col += tint * lit * (0.6 + 2.0 * uSpeed);
  }

  // Frames: the product's own screens flying past, rounded windows coming at the viewer.
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float z = fract(fk * 0.25 + uTravel * 0.2);
    float size = 0.04 + z * z * 2.4;
    vec2 q = abs(uv) - vec2(0.8, 0.5) * size;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.05 * size;
    float edge = 1.0 - smoothstep(0.0, 0.0015 + 0.008 * z, abs(d));
    float glass = (1.0 - smoothstep(-0.02 * size, 0.0, d)) * 0.03;
    col += mix(uPeri, uPetal, fk / 3.0) * (edge + glass) * z * (1.0 - z) * 2.2 * uSpeed;
  }

  // The haze around the way through: berry close in, periwinkle further out, both kept low so the
  // tunnel stays dark and the light reads as light.
  col += uBerry * exp(-r * 3.4) * (0.1 + 0.4 * uSpeed + 0.5 * uFlash);
  col += uPeri * exp(-r * 1.9) * 0.08 * uSpeed;
  // The white-hot core, which swells into the flash but stays a core, coloured at its rim.
  vec3 hot = mix(uPetal, vec3(1.0), 0.75);
  col += hot * exp(-r * r * mix(80.0, 7.0, uFlash)) * (0.35 + 1.4 * uSpeed + 2.4 * uFlash);
  col += uBerry * exp(-r * r * mix(20.0, 2.2, uFlash)) * 0.9 * uFlash;

  // A deep ground, darker toward the edges, under light that adds up the way light does and rolls off
  // instead of clipping: a soft bloom.
  vec3 deep = uGround * 0.72 + uBerry * 0.04 + uPeri * 0.03;
  col = deep * (1.0 - 0.45 * smoothstep(0.35, 1.25, r)) + col;
  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(mix(uGround, col, uFade), 1.0);
}`;

type Painter = { frame: (travel: number, s: Stage) => void; release: () => void };

/** Any CSS colour the page resolves, as 0..1 sRGB channels (read back from a pixel, so `oklch()`,
    `color-mix()` and hex all arrive the same way). */
function channels(colors: string[]): [number, number, number][] {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  return colors.map((color) => {
    if (!ctx) return [0.77, 0.11, 0.45];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
  });
}

/** Draws the jump with WebGL, or returns null where WebGL is not to be had. */
function glWarp(canvas: HTMLCanvasElement, inks: [number, number, number][], ground: [number, number, number]): Painter | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // One triangle that covers the screen.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const [berry, petal, peri, apricot, light] = inks;
  gl.uniform3fv(u('uBerry'), berry);
  gl.uniform3fv(u('uPetal'), petal);
  gl.uniform3fv(u('uPeri'), peri);
  gl.uniform3fv(u('uApricot'), apricot);
  gl.uniform3fv(u('uLight'), light);
  gl.uniform3fv(u('uGround'), ground);
  gl.uniform2f(u('uRes'), canvas.width, canvas.height);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const travel = u('uTravel');
  const speed = u('uSpeed');
  const flash = u('uFlash');
  const fade = u('uFade');

  return {
    frame(t, s) {
      gl.uniform1f(travel, t);
      gl.uniform1f(speed, s.speed);
      gl.uniform1f(flash, s.flash);
      gl.uniform1f(fade, s.fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    release() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** The flat drawing, where there is no WebGL: streaks as lines, the core as a glow. */
function flatWarp(canvas: HTMLCanvasElement, inks: string[], dpr: number): Painter | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cx = w / 2;
  const cy = h / 2;
  const reach = Math.hypot(cx, cy);
  const focal = reach * 0.07;
  const stars = Array.from({ length: 380 }, (_, i) => ({ a: Math.random() * Math.PI * 2, z: 0.05 + Math.random() * 0.95, ink: inks[i % 4], width: 0.5 + Math.random() * 1.5 }));
  let last = 0;
  return {
    frame(travel, s) {
      const dz = travel - last;
      last = travel;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * (0.12 + s.speed * 0.3 + s.flash * 0.6));
      glow.addColorStop(0, inks[0]);
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = (0.28 * s.speed + 0.5 * s.flash) * s.fade;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      for (const star of stars) {
        star.z -= dz * 0.9;
        if (star.z <= 0.02) star.z += 1;
        const r1 = focal / star.z;
        const r0 = focal / (star.z + 0.004 + s.speed * 0.3);
        if (r0 > reach * 1.2) continue;
        ctx.globalAlpha = s.fade * Math.min(1, (1 - star.z) * 1.4);
        ctx.strokeStyle = star.ink;
        ctx.lineWidth = star.width * (1 + (1 - star.z) * 1.8);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(star.a) * r0, cy + Math.sin(star.a) * r0);
        ctx.lineTo(cx + Math.cos(star.a) * r1, cy + Math.sin(star.a) * r1);
        ctx.stroke();
      }
    },
    release() {},
  };
}

export function Warp({ onDone }: { onDone: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const done = React.useRef(onDone);
  React.useEffect(() => { done.current = onDone; });

  React.useEffect(() => {
    const host = ref.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current();
      return;
    }
    // A canvas of its own every time this runs. Leaving lets the GPU context go, and a canvas whose
    // context was let go hands the same dead context back to the next run (React runs this twice
    // while developing): it showed as a white screen with the browser's broken-context face.
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);

    const probe = document.createElement('span');
    host.appendChild(probe);
    const read = (v: string) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    const css = INKS.map(read);
    const groundCss = read('--color-site-ink');
    probe.remove();
    const [ground] = channels([groundCss]);
    const painter = glWarp(canvas, channels(css), ground) ?? flatWarp(canvas, css, dpr);
    const total = ms(getComputedStyle(document.documentElement).getPropertyValue('--site-warp'), 1700);

    // The session starts when the warp ends, so the warp must END even when frames do not come: a tab
    // put in the background the moment it starts gets no frames at all. The clock is the backstop.
    let raf = 0;
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(backstop);
      done.current();
    };
    const backstop = window.setTimeout(finish, total + 250);
    let travel = 0;
    let last = performance.now();
    const start = last;
    const frame = (t: number) => {
      // A frame's timestamp is when the frame began, which can be a hair BEFORE the moment this
      // started: held at 0, or the first frame's numbers go negative (and a fractional power of a
      // negative number is NaN, which ends the drawing).
      const p = Math.min(1, Math.max(0, (t - start) / total));
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      const s = stage(p);
      travel += (0.12 + 2.6 * s.speed) * dt;
      painter?.frame(travel, s);
      if (p < 1) raf = requestAnimationFrame(frame);
      else finish();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      over = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(backstop);
      painter?.release();
      canvas.remove();
    };
  }, []);

  // The tunnel fades in behind the card diving into it, so the page dissolves into it rather than
  // cutting to dark.
  return <div ref={ref} data-warp aria-hidden className="zb-enter pointer-events-none absolute inset-0 animate-fadein" />;
}
