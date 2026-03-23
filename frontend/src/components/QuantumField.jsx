import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

const PARTICLE_COUNT = 2000;

/**
 * Animated quantum particle field — thousands of glowing dots orbiting in 3D space.
 * Responds to aliasing state with color shifts and acceleration.
 */
export default function QuantumField() {
  const meshRef = useRef();
  const aliased = useSignalStore((s) => s.aliased);

  const { positions, colors, sizes, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    const vel = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 8 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Cyan/purple/magenta palette
      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        col[i * 3] = 0.1; col[i * 3 + 1] = 0.8; col[i * 3 + 2] = 1.0; // Cyan
      } else if (colorChoice < 0.66) {
        col[i * 3] = 0.6; col[i * 3 + 1] = 0.3; col[i * 3 + 2] = 1.0; // Purple
      } else {
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.2; col[i * 3 + 2] = 0.8; // Magenta
      }

      sz[i] = 0.3 + Math.random() * 1.5;

      vel[i * 3] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    return { positions: pos, colors: col, sizes: sz, velocities: vel };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const geo = meshRef.current.geometry;
    const posAttr = geo.attributes.position;
    const colAttr = geo.attributes.color;
    const sizeAttr = geo.attributes.size;
    const speed = aliased ? 2.5 : 1.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Orbital motion
      const x = positions[i3];
      const y = positions[i3 + 1];
      const z = positions[i3 + 2];

      const angle = time * speed * (0.05 + velocities[i3] * 0.5);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      posAttr.array[i3] = x * cosA - z * sinA;
      posAttr.array[i3 + 1] = y + Math.sin(time * 0.5 + i * 0.01) * 0.3;
      posAttr.array[i3 + 2] = x * sinA + z * cosA;

      // Pulsing size
      sizeAttr.array[i] = sizes[i] * (0.6 + 0.4 * Math.sin(time * 2 + i * 0.1));

      // Color shift when aliased
      if (aliased) {
        colAttr.array[i3] = 1.0;
        colAttr.array[i3 + 1] = 0.15 + 0.15 * Math.sin(time * 3 + i);
        colAttr.array[i3 + 2] = 0.1;
      } else {
        colAttr.array[i3] = colors[i3];
        colAttr.array[i3 + 1] = colors[i3 + 1];
        colAttr.array[i3 + 2] = colors[i3 + 2];
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={new Float32Array(positions)}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={PARTICLE_COUNT}
          array={new Float32Array(colors)}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={PARTICLE_COUNT}
          array={new Float32Array(sizes)}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
