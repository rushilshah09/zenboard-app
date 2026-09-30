import React, { useLayoutEffect, useRef } from "react";
import { energy, stage } from "../brand/tokens";
import { GLSL_NOISE, VERT_QUAD, compile, quad, rgb } from "./gl";

/**
 * A soft mesh gradient on the Ink stage (outro reference: a slow, flowing
 * magenta / red / violet mesh). Broad ribbons of berry and pink light fold
 * through deep plum and violet over the ink base; the domain is warped twice
 * with low-octave noise so every edge is a long, smooth blend. Only a
 * whisper of dithered grain, enough to stop banding. `t` drives the drift;
 * `intensity` scales the light.
 */
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float t, intensity, seed;
uniform vec2 res;
uniform vec3 cInk, cEdge, cPlum, cViolet, cBerry, cPink, cRose, cApri;
${GLSL_NOISE}
// Low-octave fbm: big, soft shapes only.
float soft(vec2 p){ float v = 0., a = .55; for (int i = 0; i < 3; i++){ v += a * noise(p); p = p * 1.9 + 11.3; a *= .45; } return v / .9; }
void main(){
  vec2 a = vec2(res.x / res.y, 1.);
  vec2 p = vUv * a;
  float s = t * .05;
  // Two passes of domain warp: the mesh "flows".
  vec2 q = vec2(soft(p * .8 + vec2(0., s)), soft(p * .8 + vec2(5.2, -s * .8)));
  vec2 r = vec2(soft(p * .9 + q * 1.7 + vec2(1.7, 9.2) + s * .6), soft(p * .9 + q * 1.7 + vec2(8.3, 2.8) - s * .5));
  // A long diagonal ribbon, bent by the warp (the reference's sweeping bands).
  float rib = .5 + .5 * sin((p.x * .9 - p.y * 1.25) * 2.4 + (r.x - .5) * 6. + s * 3.);
  float v = soft(p * .7 + r * 1.5);

  // Base: ink, sinking to the edge colour toward the corners.
  vec3 col = mix(cInk, cEdge, smoothstep(.3, 1.1, length((vUv - .5) * a * .9)));
  // Violet shadows and plum depth.
  col = mix(col, cPlum,   smoothstep(.4, .8, r.y) * .7);
  col = mix(col, cViolet, smoothstep(.5, .8, q.x) * smoothstep(.25, .75, 1. - rib) * .6);
  // Berry body and pink light along the ribbon; dark valleys between.
  float body = smoothstep(.45, .85, v * .5 + rib * .5);
  col = mix(col, cBerry, body * .85 * intensity);
  float hot = smoothstep(.66, .98, v * .4 + rib * .6);
  col = mix(col, cPink, hot * .75 * intensity);
  col = mix(col, cRose, pow(hot, 3.) * .25 * intensity);
  // A breath of apricot where the light is strongest, low in frame.
  col = mix(col, cApri, pow(hot, 4.) * smoothstep(.3, 1., vUv.y) * .12 * intensity);
  // Corners fall back into the ink.
  col *= mix(1., .55, smoothstep(.45, 1.15, length((vUv - .5) * a * .9)));
  // Keep it quiet: overall level so the drawing and type read on top.
  col *= .78 + .22 * intensity;
  // Dither-level grain only (triangular, ±0.6%).
  float g = hash(gl_FragCoord.xy + seed * 13.1) + hash(gl_FragCoord.yx + seed * 7.7) - 1.;
  col += g * .006;
  o = vec4(col, 1.);
}`;

type St = { gl: WebGL2RenderingContext; u: Record<string, WebGLUniformLocation | null> };

const COLOURS: Record<string, string> = {
  cInk: stage.ink,
  cEdge: stage.inkEdge,
  cPlum: "#3A0A32",
  cViolet: "#4A2F78",
  cBerry: "#8A0F51",
  cPink: energy.pink,
  cRose: energy.rose,
  cApri: energy.apricot,
};

export const MeshGradient: React.FC<{ t: number; intensity?: number; frame: number }> = ({ t, intensity = 1, frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<St | null>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    if (!st.current) {
      const gl = c.getContext("webgl2", { preserveDrawingBuffer: true })!;
      const pr = compile(gl, VERT_QUAD, FRAG);
      gl.useProgram(pr);
      quad(gl, pr);
      const names = ["t", "intensity", "seed", "res", ...Object.keys(COLOURS)];
      const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(pr, n)]));
      for (const [k, hex] of Object.entries(COLOURS)) gl.uniform3fv(u[k], rgb(hex));
      st.current = { gl, u };
    }
    const { gl, u } = st.current;
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(u.res, c.width, c.height);
    gl.uniform1f(u.t, t);
    gl.uniform1f(u.intensity, intensity);
    gl.uniform1f(u.seed, frame % 97);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [t, intensity, frame]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};
