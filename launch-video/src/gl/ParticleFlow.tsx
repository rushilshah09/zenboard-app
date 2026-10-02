import React, { useLayoutEffect, useRef } from "react";
import { compile } from "./gl";

/**
 * GPU particle layer: soft round sprites, additively blended, positioned per
 * frame by the caller (deterministic). Used for information flowing along the
 * threads in the hero (S16).
 */
export type Particle = { x: number; y: number; size: number; alpha: number; c: [number, number, number] };

const VERT = `#version 300 es
in vec2 pos; in float size; in float alpha; in vec3 col;
uniform vec2 res; out float vA; out vec3 vC;
void main(){ vec2 c = pos / res * 2. - 1.; gl_Position = vec4(c.x, -c.y, 0., 1.); gl_PointSize = size; vA = alpha; vC = col; }`;
const FRAG = `#version 300 es
precision highp float; in float vA; in vec3 vC; out vec4 o;
void main(){ vec2 d = gl_PointCoord - .5; float r = length(d);
  float core = smoothstep(.22, .0, r); float glow = exp(-r * r * 14.) * .55;
  float a = clamp(core + glow, 0., 1.) * vA;
  vec3 c = mix(vC, vec3(1.), core * .55);
  o = vec4(c * a, a); }`;

type St = { gl: WebGL2RenderingContext; buf: WebGLBuffer; res: WebGLUniformLocation | null };

export const ParticleFlow: React.FC<{ particles: Particle[]; frame: number }> = ({ particles, frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<St | null>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    if (!st.current) {
      const gl = c.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: true, alpha: true })!;
      const pr = compile(gl, VERT, FRAG);
      gl.useProgram(pr);
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const stride = 7 * 4;
      const attr = (name: string, n: number, off: number) => {
        const l = gl.getAttribLocation(pr, name);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, n, gl.FLOAT, false, stride, off * 4);
      };
      attr("pos", 2, 0);
      attr("size", 1, 2);
      attr("alpha", 1, 3);
      attr("col", 3, 4);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied: glowing beads that read on light and dark
      st.current = { gl, buf, res: gl.getUniformLocation(pr, "res") };
    }
    const { gl, buf, res } = st.current;
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(res, c.width, c.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const data = new Float32Array(particles.length * 7);
    particles.forEach((p, i) => data.set([p.x, p.y, p.size, p.alpha, ...p.c], i * 7));
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, particles.length);
  }, [particles, frame]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
};
