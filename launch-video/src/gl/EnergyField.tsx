import React, { useLayoutEffect, useRef } from "react";
import { energy, stage } from "../brand/tokens";
import { GLSL_NOISE, VERT_QUAD, compile, quad, rgb } from "./gl";

/**
 * The energy light on the Ink stage, on the GPU (DIRECTION_V3.md §2: the
 * gradient is light, never a flat backdrop). Soft pools of pink, magenta,
 * apricot and lavender light fold through deep burgundy on a domain-warped
 * field, so every edge blends; nothing banded, nothing hard. `t` drives a slow
 * drift; `intensity` scales the light.
 */
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float t, intensity, seed;
uniform vec2 res;
uniform vec3 cInk, cEdge, cPink, cMag, cApri, cLav;
${GLSL_NOISE}
// A soft light pool: gaussian falloff, gently warped.
float pool(vec2 p, vec2 c, float r){ vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
void main(){
  vec2 a = vec2(res.x / res.y, 1.);
  vec2 p = vUv * a;
  vec2 q = vec2(fbm(p * 1.2 + t * .02), fbm(p * 1.2 + 4.1 - t * .018));
  vec2 w = p + (q - .5) * .35;
  vec3 col = mix(cInk, cEdge, smoothstep(.35, 1.05, length((vUv - .5) * a * .95)));
  // Light pools, each drifting on its own slow path.
  col += cPink * pool(w, vec2(.2 + .03 * sin(t * .21), .45 + .04 * cos(t * .17)) * a, .40) * .55 * intensity;
  col += cMag  * pool(w, vec2(.9 + .03 * cos(t * .19), .62 + .03 * sin(t * .23)) * a, .36) * .5 * intensity;
  col += cApri * pool(w, vec2(.6 + .04 * sin(t * .15), -.08) * a, .40) * .38 * intensity;
  col += cLav  * pool(w, vec2(.45 + .03 * cos(t * .13), 1.02) * a, .30) * .22 * intensity;
  // Screen-style soft compression so overlapping pools blend instead of clipping.
  col = 1. - exp(-col * 1.35);
  col += (hash(gl_FragCoord.xy + seed * 13.1) - .5) * .028; // grain
  o = vec4(col, 1.);
}`;

type St = { gl: WebGL2RenderingContext; u: Record<string, WebGLUniformLocation | null> };

export const EnergyField: React.FC<{ t: number; intensity?: number; frame: number }> = ({ t, intensity = 1, frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<St | null>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    if (!st.current) {
      const gl = c.getContext("webgl2", { preserveDrawingBuffer: true })!;
      const pr = compile(gl, VERT_QUAD, FRAG);
      gl.useProgram(pr);
      quad(gl, pr);
      const names = ["t", "intensity", "seed", "res", "cInk", "cEdge", "cPink", "cMag", "cApri", "cLav"];
      const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(pr, n)]));
      // Colours are linear-ish light amounts; the ink base is the stage colour.
      gl.uniform3fv(u.cInk, rgb(stage.ink));
      gl.uniform3fv(u.cEdge, rgb(stage.inkEdge));
      gl.uniform3fv(u.cPink, rgb(energy.pink));
      gl.uniform3fv(u.cMag, rgb("#9B1C6E"));
      gl.uniform3fv(u.cApri, rgb(energy.apricot));
      gl.uniform3fv(u.cLav, rgb(energy.lavender));
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
