import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

/**
 * Glowing energy orbs at sampled data points with pulsing scale,
 * vertical energy beam stems, and point light emission.
 */
export default function SamplingPoints() {
  const groupRef = useRef();
  const sampledData = useSignalStore((s) => s.sampledData);
  const signalData = useSignalStore((s) => s.signalData);

  const points = useMemo(() => {
    if (!sampledData.t.length) return [];

    const maxT = signalData.t[signalData.t.length - 1] || 1;
    return sampledData.t.map((t, i) => ({
      x: (t / maxT) * 10 - 5,
      y: sampledData.y[i] * 2,
    }));
  }, [sampledData, signalData]);

  // Pulse orb sizes
  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const orb = children[i]?.children?.[0];
      if (orb) {
        const scale = 1 + Math.sin(time * 3 + i * 0.5) * 0.25;
        orb.scale.setScalar(scale);
      }
    }
  });

  if (!points.length) return null;

  return (
    <group ref={groupRef}>
      {points.map((p, i) => (
        <group key={i}>
          {/* Energy orb */}
          <mesh position={[p.x, p.y, 0]}>
            <sphereGeometry args={[0.09, 20, 20]} />
            <meshStandardMaterial
              color="#ffcc00"
              emissive="#ffcc00"
              emissiveIntensity={1.5}
              roughness={0.1}
              metalness={0.5}
            />
          </mesh>

          {/* Outer glow shell */}
          <mesh position={[p.x, p.y, 0]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial
              color="#ffaa00"
              transparent
              opacity={0.15}
              emissive="#ffaa00"
              emissiveIntensity={0.8}
            />
          </mesh>

          {/* Vertical energy beam stem */}
          <mesh position={[p.x, p.y / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, Math.abs(p.y), 6]} />
            <meshStandardMaterial
              color="#ffcc00"
              emissive="#ffaa00"
              emissiveIntensity={0.6}
              transparent
              opacity={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
