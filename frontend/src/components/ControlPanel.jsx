import { useEffect, useMemo, useRef } from 'react';
import { button, useControls } from 'leva';
import useSignalStore from '../store/useSignalStore';

/**
 * Leva-based control surface used on the dashboard route.
 * Sends parameter updates to the backend and mirrors settings into Zustand.
 */
export default function ControlPanel({ sendParams, submitQuantumJob }) {
  const setParams = useSignalStore((state) => state.setParams);
  const setAIExplanation = useSignalStore((state) => state.setAIExplanation);
  const setQuantumSettings = useSignalStore((state) => state.setQuantumSettings);
  const availableBackends = useSignalStore((state) => state.availableBackends);
  const jobStatus = useSignalStore((state) => state.quantumJobStatus);
  const prevParamsRef = useRef({});

  const backendOptions = useMemo(() => {
    if (!availableBackends.length) {
      return ['local_classical', 'qiskit_simulator'];
    }

    return availableBackends
      .filter((backend) => (typeof backend === 'string' ? true : backend.available !== false))
      .map((backend) => (typeof backend === 'string' ? backend : backend.name));
  }, [availableBackends]);

  const params = useControls('Signal Controls', {
    frequency: { value: 100, min: 1, max: 500, step: 1, label: 'Frequency (Hz)' },
    sampleRate: { value: 300, min: 10, max: 1000, step: 5, label: 'Sample Rate (Hz)' },
    noiseLevel: { value: 0, min: 0, max: 1, step: 0.01, label: 'Noise Level' },
    waveType: {
      value: 'sine',
      options: ['sine', 'square', 'sawtooth', 'triangle'],
      label: 'Waveform',
    },
  });

  const quantumParams = useControls('Quantum Execution', {
    backend: {
      value: 'local_classical',
      options: backendOptions,
      label: 'Backend',
    },
    circuitType: {
      value: 'phase_estimation',
      options: ['phase_estimation', 'quantum_sampling', 'qft'],
      label: 'Workflow',
    },
    shots: { value: 1024, min: 128, max: 8192, step: 128, label: 'Shots' },
    numQubits: { value: 4, min: 2, max: 8, step: 1, label: 'Qubits' },
    noiseModel: {
      value: 'ideal',
      options: ['ideal', 'depolarizing', 'thermal'],
      label: 'Noise Model',
    },
    runQuantumWorkflow: button(
      () => {
        submitQuantumJob?.();
      },
      { label: 'Run Quantum Workflow', disabled: jobStatus === 'running' || jobStatus === 'submitting' }
    ),
  });

  useControls('Analysis Tools', {
    generateAliasingBrief: button(
      () => {
        fetchExplanation();
      },
      { label: 'Generate Operator Brief' }
    ),
  });

  useEffect(() => {
    const nextParams = {
      freq: params.frequency,
      fs: params.sampleRate,
      noise_level: params.noiseLevel,
      wave_type: params.waveType,
    };

    const previous = prevParamsRef.current;
    if (
      previous.freq !== nextParams.freq ||
      previous.fs !== nextParams.fs ||
      previous.noise_level !== nextParams.noise_level ||
      previous.wave_type !== nextParams.wave_type
    ) {
      prevParamsRef.current = nextParams;
      sendParams?.(nextParams);
      setParams({
        freq: params.frequency,
        fs: params.sampleRate,
        noiseLevel: params.noiseLevel,
        waveType: params.waveType,
      });
    }
  }, [params, sendParams, setParams]);

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
      const store = useSignalStore.getState();
      const response = await fetch('/webhook/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freq: store.freq,
          fs: store.fs,
          aliased: store.aliased,
          alias_freq: store.aliasFreq,
        }),
      });

      const data = await response.json();
      const intro = data.is_stub
        ? 'Rule-based operator brief\nThis panel is powered by backend heuristics, not an LLM.\n'
        : 'Operator brief\n';

      setAIExplanation(`${intro}\n${data.explanation || 'No analysis was returned by the backend.'}`);
    } catch {
      setAIExplanation(
        'Rule-based operator brief\nThis panel is powered by backend heuristics, not an LLM.\n\nCould not reach the backend analysis endpoint. Check that the server is running and try again.'
      );
    }
  };

  return null;
}
