import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

/**
 * Pulsating holographic ghost wave visible only when aliasing occurs.
 * Features flickering distortion and red-orange glow shader.
 */
export default function AliasGhost() {
  const meshRef = useRef();
  const aliased = useSignalStore((s) => s.aliased);
  const aliasGhostData = useSignalStore((s) => s.aliasGhostData);

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color('#ff3322') },
        },
        vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vPosition;

        // Simple noise-like function
        float hash(float n) { return fract(sin(n) * 43758.5453123); }

        void main() {
          // Pulsating opacity
          float pulse = sin(uTime * 3.0) * 0.2 + 0.5;

          // Holographic scan lines
          float scanLine = sin(vPosition.y * 60.0 + uTime * 5.0) * 0.1 + 0.9;

          // Flickering
          float flicker = hash(floor(uTime * 12.0)) * 0.3 + 0.7;

          // Distortion glow
          vec3 color = uColor * (1.0 + sin(vUv.x * 20.0 - uTime * 6.0) * 0.3);
          color += vec3(1.0, 0.5, 0.1) * pow(sin(vUv.x * 10.0 + uTime * 3.0) * 0.5 + 0.5, 3.0) * 0.4;

          float alpha = pulse * scanLine * flicker * 0.6;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      }),
    []
  );

  const geometry = useMemo(() => {
    if (!aliased || !aliasGhostData.t.length) return null;

    const points = aliasGhostData.t.map((t, i) => {
      const x = (t / (aliasGhostData.t[aliasGhostData.t.length - 1] || 1)) * 10 - 5;
      const y = aliasGhostData.y[i] * 2;
      return new THREE.Vector3(x, y, 0.2);
    });

    if (points.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, points.length * 2, 0.05, 12, false);
  }, [aliased, aliasGhostData]);

  useFrame((state) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!geometry || !aliased) return null;

  return <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />;
}
