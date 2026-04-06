import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

/**
 * Reconstructed signal wave with neon green energy flow shader.
 * Features animated UV scrolling glow and metallic-glass appearance.
 */
export default function ReconstructionWave() {
  const meshRef = useRef();
  const reconstructedData = useSignalStore((s) => s.reconstructedData);

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color('#7df3cd') },
          uGlow: { value: new THREE.Color('#1f7f67') },
        },
        vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uGlow;
        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
          // Animated energy flow
          float flow = sin(vUv.x * 25.0 - uTime * 3.0) * 0.5 + 0.5;
          float pulse = sin(uTime * 1.5 + 1.0) * 0.1 + 0.9;

          // Fresnel rim glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);

          vec3 color = mix(uGlow, uColor, flow * pulse);
          color += fresnel * uColor * 0.65;

          float alpha = 0.86 + fresnel * 0.14;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      }),
    []
  );

  const geometry = useMemo(() => {
    if (!reconstructedData.t.length || !reconstructedData.y.length) return null;

    const points = reconstructedData.t.map((t, i) => {
      const x = (t / (reconstructedData.t[reconstructedData.t.length - 1] || 1)) * 10 - 5;
      const y = reconstructedData.y[i] * 2;
      return new THREE.Vector3(x, y, -0.2);
    });

    if (points.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, points.length * 2, 0.045, 14, false);
  }, [reconstructedData]);

  useFrame((state) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!geometry) return null;

  return <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />;
}
