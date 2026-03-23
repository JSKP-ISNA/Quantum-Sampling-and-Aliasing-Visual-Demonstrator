import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

/**
 * Animated energy grid floor with flowing glow lines and pulsing intersections.
 * Uses a custom shader for the scrolling/pulsing effect.
 */
export default function EnergyGrid() {
  const meshRef = useRef();
  const aliased = useSignalStore((s) => s.aliased);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#0affff') },
        uColor2: { value: new THREE.Color('#7b2fff') },
        uAliased: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uAliased;
        varying vec2 vUv;

        void main() {
          vec2 grid = abs(fract(vUv * 20.0 - 0.5) - 0.5);
          float line = min(grid.x, grid.y);
          float gridLine = 1.0 - smoothstep(0.0, 0.04, line);

          // Scrolling energy effect
          float energy = sin(vUv.y * 40.0 - uTime * 2.0) * 0.5 + 0.5;
          energy *= sin(vUv.x * 40.0 - uTime * 1.5) * 0.5 + 0.5;

          // Pulsing intersections
          float intersection = (1.0 - smoothstep(0.0, 0.08, grid.x)) * (1.0 - smoothstep(0.0, 0.08, grid.y));
          float pulse = intersection * (sin(uTime * 3.0) * 0.3 + 0.7);

          // Distance fade from center
          float dist = length(vUv - 0.5) * 2.0;
          float fade = 1.0 - smoothstep(0.2, 1.0, dist);

          vec3 alertColor = vec3(1.0, 0.2, 0.1);
          vec3 baseColor = mix(uColor1, uColor2, vUv.x + sin(uTime * 0.5) * 0.3);
          vec3 finalColor = mix(baseColor, alertColor, uAliased * 0.7);

          float alpha = (gridLine * 0.35 + energy * 0.05 + pulse * 0.6) * fade;
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    shaderMaterial.uniforms.uAliased.value = THREE.MathUtils.lerp(
      shaderMaterial.uniforms.uAliased.value,
      aliased ? 1.0 : 0.0,
      0.05
    );
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3, 0]}
      material={shaderMaterial}
    >
      <planeGeometry args={[60, 60]} />
    </mesh>
  );
}
