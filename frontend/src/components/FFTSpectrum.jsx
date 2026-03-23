import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

/**
 * 3D neon bar graph of FFT magnitudes with bloom-optimized glow,
 * animated height transitions, and frequency-based color gradient.
 */
export default function FFTSpectrum() {
  const groupRef = useRef();
  const barsRef = useRef([]);
  const fftData = useSignalStore((s) => s.fftData);
  const aliased = useSignalStore((s) => s.aliased);

  const bars = useMemo(() => {
    const mags = fftData.sampled?.magnitude || [];
    if (!mags.length) return [];

    const maxMag = Math.max(...mags, 0.001);
    const barWidth = 8 / Math.max(mags.length, 1);

    return mags.map((mag, i) => {
      const normalizedHeight = (mag / maxMag) * 3.5;
      const x = (i / Math.max(mags.length - 1, 1)) * 8 - 4;
      const t = i / Math.max(mags.length - 1, 1);

      // Gradient: cyan → purple → magenta
      let color;
      if (aliased) {
        color = new THREE.Color().setHSL(0.0 + t * 0.08, 0.9, 0.55);
      } else {
        color = new THREE.Color().setHSL(0.5 + t * 0.2, 0.85, 0.55);
      }

      return {
        x,
        targetHeight: Math.max(normalizedHeight, 0.02),
        width: barWidth * 0.75,
        color,
        emissive: aliased
          ? new THREE.Color('#5a1010')
          : new THREE.Color('#0a2a3a'),
        intensity: mag / maxMag,
      };
    });
  }, [fftData, aliased]);

  // Animate bar heights smoothly
  useFrame(() => {
    if (!groupRef.current) return;
    const children = groupRef.current.children;
    for (let i = 0; i < bars.length && i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      const target = bars[i].targetHeight;
      const current = child.scale.y;
      child.scale.y = THREE.MathUtils.lerp(current, target, 0.12);
      child.position.y = child.scale.y / 2;
    }
  });

  if (!bars.length) return null;

  return (
    <group position={[0, -3.5, 0]} ref={groupRef}>
      {/* Reflection plane */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 3]} />
        <meshStandardMaterial
          color="#050510"
          transparent
          opacity={0.4}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Bars */}
      {bars.map((bar, i) => (
        <mesh key={i} position={[bar.x, bar.targetHeight / 2, 0]} scale={[1, 1, 1]}>
          <boxGeometry args={[bar.width, 1, 0.5]} />
          <meshStandardMaterial
            color={bar.color}
            emissive={bar.color}
            emissiveIntensity={0.6 + bar.intensity * 0.5}
            roughness={0.2}
            metalness={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
