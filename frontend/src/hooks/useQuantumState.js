import { useEffect, useRef, useState, useCallback } from 'react';
import useSignalStore from '../store/useSignalStore';

/**
 * Hook that periodically fetches quantum state data from the backend
 * and updates the Zustand store.
 */
export default function useQuantumState() {
  const freq = useSignalStore((s) => s.freq);
  const fs = useSignalStore((s) => s.fs);
  const noiseLevel = useSignalStore((s) => s.noiseLevel);
  const connected = useSignalStore((s) => s.connected);
  const timerRef = useRef(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/quantum-state?freq=${freq}&fs=${fs}&noise_level=${noiseLevel}`
      );
      if (res.ok) {
        const data = await res.json();
        useSignalStore.getState().setQuantumState(data);
      }
    } catch {
      // Silently fail — quantum state is an enhancement, not critical
    }
  }, [freq, fs, noiseLevel]);

  useEffect(() => {
    if (!connected) return;

    // Fetch immediately and then every 2 seconds
    fetchState();
    timerRef.current = setInterval(fetchState, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchState, connected]);
}
