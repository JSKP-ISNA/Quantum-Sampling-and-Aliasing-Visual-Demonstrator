import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

/**
 * 3D neon ribbon representing the original signal.
 * Features animated UV energy flow and high-bloom glow.
 */
export default function SignalRibbon() {
  const meshRef = useRef();
  const signalData = useSignalStore((s) => s.signalData);

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color('#0affff') },
          uGlow: { value: new THREE.Color('#064a5e') },
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
          // Animated energy flow along UV
          float flow = sin(vUv.x * 30.0 - uTime * 4.0) * 0.5 + 0.5;
          float pulse = sin(uTime * 2.0) * 0.15 + 0.85;

          // Fresnel rim glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);

          vec3 color = mix(uGlow, uColor, flow * pulse);
          color += fresnel * uColor * 0.5;

          float alpha = 0.85 + fresnel * 0.15;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      }),
    []
  );

  const geometry = useMemo(() => {
    if (!signalData.t.length || !signalData.y.length) return null;

    const points = signalData.t.map((t, i) => {
      const x = (t / (signalData.t[signalData.t.length - 1] || 1)) * 10 - 5;
      const y = signalData.y[i] * 2;
      return new THREE.Vector3(x, y, 0);
    });

    if (points.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, points.length * 2, 0.04, 12, false);
  }, [signalData]);

  useFrame((state) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!geometry) return null;

  return <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />;
}
