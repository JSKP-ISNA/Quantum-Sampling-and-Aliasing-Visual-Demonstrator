import { useEffect, useRef, useCallback } from 'react';
import { useControls, button, folder } from 'leva';
import useSignalStore from '../store/useSignalStore';

/**
 * Leva-based interactive control panel.
 * Sends parameter updates to backend via WebSocket.
 * Includes quantum execution controls.
 */
export default function ControlPanel({ sendParams, submitQuantumJob }) {
  const setParams = useSignalStore((s) => s.setParams);
  const setAIExplanation = useSignalStore((s) => s.setAIExplanation);
  const setQuantumSettings = useSignalStore((s) => s.setQuantumSettings);
  const availableBackends = useSignalStore((s) => s.availableBackends);
  const jobStatus = useSignalStore((s) => s.quantumJobStatus);
  const prevParamsRef = useRef({});

  // ── Signal Controls ──
  const params = useControls('🎛️ Signal Controls', {
    frequency: { value: 100, min: 1, max: 500, step: 1, label: '📡 Frequency (Hz)' },
    sampleRate: { value: 300, min: 10, max: 1000, step: 5, label: '🔬 Sample Rate (Hz)' },
    noiseLevel: { value: 0, min: 0, max: 1, step: 0.01, label: '📻 Noise Level' },
    waveType: {
      value: 'sine',
      options: ['sine', 'square', 'sawtooth', 'triangle'],
      label: '〰️ Wave Type',
    },
  });

  // ── Quantum Controls ──
  const quantumParams = useControls('⚛️ Quantum Engine', {
    backend: {
      value: 'local_classical',
      options: ['local_classical', 'qiskit_simulator', 'qiskit_hardware'],
      label: '🔧 Backend',
    },
    circuitType: {
      value: 'phase_estimation',
      options: ['phase_estimation', 'quantum_sampling', 'qft'],
      label: '🔬 Circuit Type',
    },
    shots: { value: 1024, min: 128, max: 8192, step: 128, label: '🎯 Shots' },
    numQubits: { value: 4, min: 2, max: 8, step: 1, label: '⟨ψ⟩ Qubits' },
    noiseModel: {
      value: 'ideal',
      options: ['ideal', 'depolarizing', 'thermal'],
      label: '📊 Noise Model',
    },
    'Run Quantum Job ⚡': button(
      () => {
        if (submitQuantumJob) submitQuantumJob();
      },
      { disabled: jobStatus === 'running' || jobStatus === 'submitting' }
    ),
  });

  // ── AI Assistant ──
  useControls('🤖 AI Assistant', {
    'Explain Aliasing': button(() => {
      fetchExplanation();
    }),
  });

  // Send signal params to backend whenever they change
  useEffect(() => {
    const newParams = {
      freq: params.frequency,
      fs: params.sampleRate,
      noise_level: params.noiseLevel,
      wave_type: params.waveType,
    };

    // Only send if actually changed (including wave_type)
    const prev = prevParamsRef.current;
    if (
      prev.freq !== newParams.freq ||
      prev.fs !== newParams.fs ||
      prev.noise_level !== newParams.noise_level ||
      prev.wave_type !== newParams.wave_type
    ) {
      prevParamsRef.current = newParams;
      if (sendParams) sendParams(newParams);
      setParams({
        freq: params.frequency,
        fs: params.sampleRate,
        noiseLevel: params.noiseLevel,
        waveType: params.waveType,
      });
    }
  }, [params, sendParams, setParams]);

  // Sync quantum settings to store
  useEffect(() => {
    setQuantumSettings({
      quantumBackend: quantumParams.backend,
      quantumCircuitType: quantumParams.circuitType,
      quantumShots: quantumParams.shots,
      quantumNumQubits: quantumParams.numQubits,
      quantumNoiseModel: quantumParams.noiseModel,
    });
  }, [quantumParams, setQuantumSettings]);

  const fetchExplanation = async () => {
    try {
      // Read fresh state at call time to avoid stale closures
      const store = useSignalStore.getState();
      const res = await fetch('/webhook/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freq: store.freq,
          fs: store.fs,
          aliased: store.aliased,
          alias_freq: store.aliasFreq,
        }),
      });
      const data = await res.json();
      const disclaimer = data.is_stub
        ? '\n\n📝 Note: This is a rule-based explanation, not AI-generated.'
        : '';
      setAIExplanation((data.explanation || '') + disclaimer);
    } catch (err) {
      setAIExplanation('⚠️ Could not reach backend. Is the server running?');
    }
  };

  return null; // Leva renders its own UI panel
}
