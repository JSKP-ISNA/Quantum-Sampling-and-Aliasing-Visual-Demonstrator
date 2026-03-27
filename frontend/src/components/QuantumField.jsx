import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

const PARTICLE_COUNT = 2000;

/**
 * Animated quantum particle field using a GPU shader for orbital motion.
 * The vertex shader handles all particle animation on the GPU, eliminating
 * the 180k CPU writes/sec that the previous CPU-based approach required.
 */
export default function QuantumField() {
  const meshRef = useRef();
  const aliased = useSignalStore((s) => s.aliased);

  const { positions, baseColors, aliasColors, sizes, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const baseCol = new Float32Array(PARTICLE_COUNT * 3);
    const aliasCol = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    const vel = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 8 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Cyan/purple/magenta palette (base)
      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        baseCol[i * 3] = 0.1; baseCol[i * 3 + 1] = 0.8; baseCol[i * 3 + 2] = 1.0;
      } else if (colorChoice < 0.66) {
        baseCol[i * 3] = 0.6; baseCol[i * 3 + 1] = 0.3; baseCol[i * 3 + 2] = 1.0;
      } else {
        baseCol[i * 3] = 1.0; baseCol[i * 3 + 1] = 0.2; baseCol[i * 3 + 2] = 0.8;
      }

      // Red palette for aliased state
      aliasCol[i * 3] = 1.0;
      aliasCol[i * 3 + 1] = 0.15;
      aliasCol[i * 3 + 2] = 0.1;

      sz[i] = 0.3 + Math.random() * 1.5;
      vel[i] = (Math.random() - 0.5) * 0.02;
    }

    return { positions: pos, baseColors: baseCol, aliasColors: aliasCol, sizes: sz, velocities: vel };
  }, []);

  // Custom shader material that moves particles on the GPU
  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 1.0 },
          uAliased: { value: 0.0 },
        },
        vertexShader: `
          attribute vec3 baseColor;
          attribute vec3 aliasColor;
          attribute float aSize;
          attribute float aVelocity;
          
          uniform float uTime;
          uniform float uSpeed;
          uniform float uAliased;
          
          varying vec3 vColor;
          
          void main() {
            // Mix colors based on aliased state
            vColor = mix(baseColor, aliasColor, uAliased);
            // Add subtle time-based color variation when aliased
            if (uAliased > 0.5) {
              vColor.g += 0.15 * sin(uTime * 3.0 + float(gl_VertexID));
            }
            
            // Orbital motion on the GPU
            float angle = uTime * uSpeed * (0.05 + aVelocity * 0.5);
            float cosA = cos(angle);
            float sinA = sin(angle);
            
            vec3 pos = position;
            float newX = pos.x * cosA - pos.z * sinA;
            float newY = pos.y + sin(uTime * 0.5 + float(gl_VertexID) * 0.01) * 0.3;
            float newZ = pos.x * sinA + pos.z * cosA;
            
            // Pulsing size
            float pulsedSize = aSize * (0.6 + 0.4 * sin(uTime * 2.0 + float(gl_VertexID) * 0.1));
            
            vec4 mvPosition = modelViewMatrix * vec4(newX, newY, newZ, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = pulsedSize * (300.0 / -mvPosition.z);
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          
          void main() {
            // Soft circle shape
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = 0.7 * (1.0 - smoothstep(0.3, 0.5, dist));
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
      }),
    []
  );

  // Update only uniforms each frame (no buffer writes)
  useFrame((state) => {
    if (!shaderMaterial) return;
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    shaderMaterial.uniforms.uSpeed.value = aliased ? 2.5 : 1.0;
    shaderMaterial.uniforms.uAliased.value = aliased ? 1.0 : 0.0;
  });

  return (
    <points ref={meshRef} material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-baseColor"
          count={PARTICLE_COUNT}
          array={baseColors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aliasColor"
          count={PARTICLE_COUNT}
          array={aliasColors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={PARTICLE_COUNT}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aVelocity"
          count={PARTICLE_COUNT}
          array={velocities}
          itemSize={1}
        />
      </bufferGeometry>
    </points>
  );
}
