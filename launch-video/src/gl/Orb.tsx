import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { energy } from "../brand/tokens";

/**
 * The orb (DIRECTION_V3.md §5 "Implosion to orb"): a sphere with a fresnel
 * shader in the energy gradient (pink at the rim, rose, apricot at the core)
 * and selective bloom. `scale`, `glow` and `breathe` come from the frame.
 */
const vert = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const frag = /* glsl */ `
uniform vec3 cRim, cMid, cCore; uniform float glow;
varying vec3 vN; varying vec3 vV;
void main(){
  // Fresnel: the rim is the brightest, most saturated part; the core is a soft warm light.
  float f = 1. - max(dot(vN, vV), 0.);
  vec3 core = mix(vec3(1., .96, .92), cCore, .35);
  vec3 c = mix(core, cMid, smoothstep(.05, .6, f));
  c = mix(c, cRim, smoothstep(.55, .98, f));
  // Screen-blended over the scene: brightness is the light the orb emits.
  float e = mix(.8, 1.05, smoothstep(.2, .95, f)) * (.9 + glow * .4);
  gl_FragColor = vec4(c * e, 1.);
}`;

const OrbMesh: React.FC<{ scale: number; glow: number }> = ({ scale, glow }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          cRim: { value: new THREE.Color(energy.pink) },
          cMid: { value: new THREE.Color(energy.rose) },
          cCore: { value: new THREE.Color(energy.apricot) },
          glow: { value: glow },
        },
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending, // it is light: it adds to what's behind it

      }),
    [],
  );
  mat.uniforms.glow.value = glow;
  return (
    <mesh scale={scale} material={mat}>
      <sphereGeometry args={[1, 96, 96]} />
    </mesh>
  );
};

/**
 * Bloom is composited in CSS around the canvas rather than with
 * @react-three/postprocessing: its EffectComposer renders from R3F's own frame
 * loop, which Remotion's frame-by-frame renderer doesn't drive (the pass comes
 * out empty). A radial glow sized from the orb is deterministic and cheap.
 */
export const Orb: React.FC<{ width: number; height: number; scale: number; glow: number }> = ({ width, height, scale, glow }) => (
  <div style={{ position: "absolute", inset: 0 }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 286 * scale * 4.4,
        height: 286 * scale * 4.4,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(closest-side, rgba(255, 214, 190, ${0.55 * glow + 0.25}), rgba(232, 168, 197, ${0.35 * glow + 0.15}) 38%, rgba(196, 28, 114, ${0.25 * glow}) 60%, transparent)`,
      }}
    />
  <ThreeCanvas width={width} height={height} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} camera={{ position: [0, 0, 6], fov: 35 }} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
    <OrbMesh scale={scale} glow={glow} />
  </ThreeCanvas>
  </div>
);
