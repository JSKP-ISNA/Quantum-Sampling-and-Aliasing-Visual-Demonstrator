import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSignalStore from '../store/useSignalStore';

const MAX_INSTANCES = 200; // Upper bound on sampling points

const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempScale = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();

/**
 * Glowing energy orbs at sampled data points using InstancedMesh
 * for efficient rendering. Replaces per-point mesh groups to stay
 * well under Three.js's draw-call soft limit.
 */
export default function SamplingPoints() {
  const orbRef = useRef();
  const stemRef = useRef();
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

  const count = Math.min(points.length, MAX_INSTANCES);

  // Shared geometries and materials (created once)
  const orbGeometry = useMemo(() => new THREE.SphereGeometry(0.09, 16, 16), []);
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 1, 6), []);

  const orbMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffcc00',
        emissive: '#ffcc00',
        emissiveIntensity: 1.5,
        roughness: 0.1,
        metalness: 0.5,
      }),
    []
  );

  const stemMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffcc00',
        emissive: '#ffaa00',
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.4,
      }),
    []
  );

  // Update instance matrices when points change
  useEffect(() => {
    if (!orbRef.current || !stemRef.current) return;

    for (let i = 0; i < MAX_INSTANCES; i++) {
      if (i < count) {
        const p = points[i];

        // Orb
        _tempMatrix.compose(
          _tempPosition.set(p.x, p.y, 0),
          _tempQuaternion.identity(),
          _tempScale.set(1, 1, 1)
        );
        orbRef.current.setMatrixAt(i, _tempMatrix);

        // Stem — scaled to reach from y=0 to y=p.y
        const stemHeight = Math.max(Math.abs(p.y), 0.01);
        _tempMatrix.compose(
          _tempPosition.set(p.x, p.y / 2, 0),
          _tempQuaternion.identity(),
          _tempScale.set(1, stemHeight, 1)
        );
        stemRef.current.setMatrixAt(i, _tempMatrix);
      } else {
        // Hide unused instances by scaling to zero
        _tempMatrix.compose(
          _tempPosition.set(0, -999, 0),
          _tempQuaternion.identity(),
          _tempScale.set(0, 0, 0)
        );
        orbRef.current.setMatrixAt(i, _tempMatrix);
        stemRef.current.setMatrixAt(i, _tempMatrix);
      }
    }

    orbRef.current.instanceMatrix.needsUpdate = true;
    stemRef.current.instanceMatrix.needsUpdate = true;
  }, [points, count]);

  // Pulse orb sizes
  useFrame((state) => {
    if (!orbRef.current) return;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const p = points[i];
      if (!p) continue;

      const scale = 1 + Math.sin(time * 3 + i * 0.5) * 0.25;
      _tempMatrix.compose(
        _tempPosition.set(p.x, p.y, 0),
        _tempQuaternion.identity(),
        _tempScale.set(scale, scale, scale)
      );
      orbRef.current.setMatrixAt(i, _tempMatrix);
    }
    orbRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!count) return null;

  return (
    <group>
      <instancedMesh
        ref={orbRef}
        args={[orbGeometry, orbMaterial, MAX_INSTANCES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={stemRef}
        args={[stemGeometry, stemMaterial, MAX_INSTANCES]}
        frustumCulled={false}
      />
    </group>
  );
}
