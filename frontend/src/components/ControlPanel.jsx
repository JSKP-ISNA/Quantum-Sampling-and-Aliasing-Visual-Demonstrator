import { useEffect, useRef } from 'react';
import { useControls, button } from 'leva';
import useSignalStore from '../store/useSignalStore';

/**
 * Leva-based interactive control panel.
 * Sends parameter updates to backend via WebSocket.
 */
export default function ControlPanel({ sendParams }) {
  const setParams = useSignalStore((s) => s.setParams);
  const setAIExplanation = useSignalStore((s) => s.setAIExplanation);
  const prevParamsRef = useRef({});

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

  useControls('🤖 AI Assistant', {
    'Explain Aliasing': button(() => {
      fetchExplanation();
    }),
  });

  // Send params to backend whenever they change
  useEffect(() => {
    const newParams = {
      freq: params.frequency,
      fs: params.sampleRate,
      noise_level: params.noiseLevel,
      wave_type: params.waveType,
    };

    // Only send if actually changed
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

  const fetchExplanation = async () => {
    try {
      const store = useSignalStore.getState();
      const res = await fetch('http://localhost:8000/webhook/alias', {
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
      setAIExplanation(data.explanation || '');
    } catch (err) {
      setAIExplanation('⚠️ Could not reach AI backend. Is the server running?');
    }
  };

  return null; // Leva renders its own UI panel
}
