"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function ShockwaveEffect({
  color,
  position,
}: {
  color: string;
  position: [number, number, number];
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const elapsed = useRef(0);

  const shader = {
    uniforms: {
      u_time: { value: 0 },
      u_color: { value: new THREE.Color(color) },
      u_thickness: { value: 0.05 },
      u_intensity: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float u_time;
      uniform vec3  u_color;
      uniform float u_thickness;
      uniform float u_intensity;
      varying vec2 vUv;
      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center);
        float waveFront = u_time * 0.8;
        float wave = smoothstep(waveFront - u_thickness, waveFront, dist)
                   * (1.0 - smoothstep(waveFront, waveFront + u_thickness * 0.5, dist));
        float opacity = wave * u_intensity * (1.0 - u_time);
        gl_FragColor = vec4(u_color, opacity);
      }
    `,
  };

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (matRef.current) {
      matRef.current.uniforms.u_time.value = Math.min(
        elapsed.current * 0.8,
        1.0,
      );
    }
  });

  return (
    <mesh position={position}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        ref={matRef}
        args={[shader]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
