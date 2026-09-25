import React, { useLayoutEffect, useRef } from "react";
import { Look } from "../brand/look";
import { aurora, colour, voidColour } from "../brand/tokens";
import { GLSL_NOISE, VERT_QUAD, compile, quad, rgb } from "./gl";

/**
 * The living background, on the GPU: one domain-warped flow-noise field that
 * reads as warm daylight with an aurora at the edges, sinks into the plum
 * void, and floods with the full Zenboard gradient in stepped columns.
 * Drawn at half resolution: it is all soft light, and the grain is added on top.
 */
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float t, dark, brand, aurora, rising, seed;
uniform vec2 res;
uniform vec3 cPaper, cVoid, cViolet, cPeri, cPink, cCoral, cPeach;
${GLSL_NOISE}
vec3 grad(float k){
  k = clamp(k, 0., 1.);
  if (k < .33) return mix(cPeri, cViolet, k / .33);
  if (k < .66) return mix(cViolet, cPink, (k - .33) / .33);
  return mix(cPink, cCoral, (k - .66) / .34);
}
void main(){
  vec2 uv = vUv; vec2 a = vec2(res.x / res.y, 1.);
  vec2 p = uv * a;
  // Domain warp: the field folds slowly over itself like light through silk.
  vec2 q = vec2(fbm(p * 1.3 + t * .035), fbm(p * 1.3 - t * .03 + 5.2));
  float n = fbm(p * 1.1 + q * 1.6 + t * .02);

  // Daylight: aurora pooled at the edges and bottom, clean in the middle where the story sits.
  vec2 c = (uv - vec2(.5, .58)) * vec2(1.25, 1.);
  float edge = smoothstep(.28, .95, length(c) + (1. - uv.y) * .16 + (n - .5) * .3);
  vec3 lightCol = mix(cPaper, grad(n * 1.3 - .15 + uv.x * .35), edge * aurora * (.65 + .5 * n));
  lightCol = mix(lightCol, cPeach, smoothstep(.55, 1., q.x) * edge * .18 * aurora);

  // The void: deep plum with slow indigo and magenta glows, heavier at the edges.
  float g1 = smoothstep(.45, .95, fbm(p * .9 + q + t * .015));
  vec3 voidCol = cVoid + vec3(.16, .09, .42) * g1 * .55 + vec3(.38, .05, .22) * smoothstep(.5, 1., q.y) * .35;
  voidCol *= 1. - .45 * smoothstep(.45, 1.1, length((uv - .5) * a * .9));

  // The flood: the brand gradient, alive, with a soft bright core.
  float k = (uv.x * .75 + (1. - uv.y) * .35) + (n - .5) * .45;
  vec3 brandCol = grad(k * .95);
  brandCol += vec3(.10, .06, .10) * smoothstep(.55, .95, fbm(p * 2. + q * 2. + t * .05));
  brandCol = mix(brandCol, vec3(1.), .12 * smoothstep(.6, 0., length((uv - vec2(.5, .55)) * a)));

  vec3 col = mix(lightCol, voidCol, dark);
  // Stepped columns rising from the bottom (centre first), or a plain cross-fade when leaving.
  float mask = brand;
  if (rising > .5) {
    float colI = floor(uv.x * 12.);
    float d = abs(colI + .5 - 6.) / 6.;
    float h = clamp(brand * 1.9 - d * .9, 0., 1.);
    mask = step(uv.y, h) * step(.001, brand);
  }
  col = mix(col, brandCol, mask);

  // Fine film grain, warm, deterministic per frame.
  float gr = hash(gl_FragCoord.xy + seed * 17.13) - .5;
  col += gr * mix(.018, .035, dark);
  o = vec4(col, 1.);
}`;

type GLState = { gl: WebGL2RenderingContext; pr: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

export const AuroraShader: React.FC<{ g: number; look: Look; rising: boolean }> = ({ g, look, rising }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<GLState | null>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    if (!st.current) {
      const gl = c.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false })!;
      const pr = compile(gl, VERT_QUAD, FRAG);
      gl.useProgram(pr);
      quad(gl, pr);
      const names = ["t", "dark", "brand", "aurora", "rising", "seed", "res", "cPaper", "cVoid", "cViolet", "cPeri", "cPink", "cCoral", "cPeach"];
      const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(pr, n)]));
      gl.uniform3fv(u.cPaper, rgb(colour.paper));
      gl.uniform3fv(u.cVoid, rgb(voidColour));
      gl.uniform3fv(u.cViolet, rgb(aurora.violet));
      gl.uniform3fv(u.cPeri, rgb(aurora.periwinkle));
      gl.uniform3fv(u.cPink, rgb(aurora.pink));
      gl.uniform3fv(u.cCoral, rgb(aurora.coral));
      gl.uniform3fv(u.cPeach, rgb(aurora.peach));
      st.current = { gl, pr, u };
    }
    const { gl, u } = st.current;
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(u.res, c.width, c.height);
    gl.uniform1f(u.t, g / 60);
    gl.uniform1f(u.seed, g % 97);
    gl.uniform1f(u.dark, look.dark);
    gl.uniform1f(u.brand, look.brand);
    gl.uniform1f(u.aurora, look.aurora);
    gl.uniform1f(u.rising, rising ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [g, look.dark, look.brand, look.aurora, rising]);
  return <canvas ref={ref} width={960} height={540} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};
