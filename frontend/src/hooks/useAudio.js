import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import useSignalStore from '../store/useSignalStore';

/**
 * Plays a tone at the alias frequency when aliasing is detected.
 */
export default function useAudio() {
  const synthRef = useRef(null);
  const startedRef = useRef(false);
  const aliased = useSignalStore((s) => s.aliased);
  const aliasFreq = useSignalStore((s) => s.aliasFreq);

  useEffect(() => {
    // Create synth lazily
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.3,
          release: 0.5,
        },
        volume: -20,
      }).toDestination();
    }

    return () => {
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, []);

  useEffect(() => {
    const play = async () => {
      if (aliased && aliasFreq > 20 && aliasFreq < 2000) {
        if (!startedRef.current) {
          await Tone.start();
          startedRef.current = true;
        }
        synthRef.current?.triggerAttackRelease(aliasFreq, '8n');
      }
    };

    // Throttle audio to avoid overwhelming the user
    const timer = setTimeout(play, 300);
    return () => clearTimeout(timer);
  }, [aliased, aliasFreq]);
}
