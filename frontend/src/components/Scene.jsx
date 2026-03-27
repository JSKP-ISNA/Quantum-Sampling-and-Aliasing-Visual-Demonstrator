import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import SignalRibbon from './SignalRibbon';
import AliasGhost from './AliasGhost';
import ReconstructionWave from './ReconstructionWave';
import SamplingPoints from './SamplingPoints';
import FFTSpectrum from './FFTSpectrum';
import QuantumField from './QuantumField';
import EnergyGrid from './EnergyGrid';
import useSignalStore from '../store/useSignalStore';

/**
 * Main 3D scene with cinematic post-processing, quantum particle field,
 * energy grid floor, and all signal visualization components.
 */
export default function Scene() {
  const aliased = useSignalStore((s) => s.aliased);

  return (
    <Canvas
      camera={{ position: [0, 3, 10], fov: 55 }}
      style={{ background: 'transparent' }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      {/* Dramatic, multi-directional lighting */}
      <ambientLight intensity={0.3} color="#1a1a2e" />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#d0e0ff" />
      <directionalLight position={[-5, 6, -8]} intensity={0.5} color="#c8a0e8" />

      {/* Dynamic point lights */}
      <pointLight
        position={[0, 4, 0]}
        intensity={aliased ? 3.0 : 1.2}
        color={aliased ? '#ff4040' : '#0affff'}
        distance={20}
        decay={2}
      />
      <pointLight
        position={[-4, 2, 3]}
        intensity={0.8}
        color="#7b2fff"
        distance={15}
        decay={2}
      />
      <pointLight
        position={[4, 1, -3]}
        intensity={0.6}
        color="#0affff"
        distance={12}
        decay={2}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#030108', 15, 60]} />

      {/* Quantum Particle Field */}
      <QuantumField />

      {/* Animated Energy Grid Floor */}
      <EnergyGrid />

      {/* Signal Visualizations */}
      <SignalRibbon />
      <AliasGhost />
      <ReconstructionWave />
      <SamplingPoints />
      <FFTSpectrum />

      {/* Post-Processing Effects */}
      <EffectComposer multisampling={4}>
        {/* Bloom ramps up when aliasing is detected for dramatic effect */}
        <Bloom
          intensity={aliased ? 2.8 : 1.5}
          luminanceThreshold={aliased ? 0.1 : 0.15}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={aliased ? 0.95 : 0.85}
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[0.0008, 0.0008]}
          radialModulation={true}
          modulationOffset={0.3}
        />
        <Vignette
          offset={0.3}
          darkness={0.7}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>

      {/* Camera Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={4}
        maxDistance={25}
        autoRotate
        autoRotateSpeed={0.3}
        maxPolarAngle={Math.PI * 0.85}
      />
    </Canvas>
  );
}
