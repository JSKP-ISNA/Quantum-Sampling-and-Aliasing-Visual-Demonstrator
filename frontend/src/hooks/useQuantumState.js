import { useEffect, useRef, useCallback } from 'react';
import useSignalStore from '../store/useSignalStore';

/**
 * Hook that fetches quantum state data from the backend
 * only when signal parameters actually change.
 * Uses dependency-based fetching instead of blind 2-second polling.
 */
export default function useQuantumState() {
  const freq = useSignalStore((s) => s.freq);
  const fs = useSignalStore((s) => s.fs);
  const noiseLevel = useSignalStore((s) => s.noiseLevel);
  const connected = useSignalStore((s) => s.connected);
  const abortRef = useRef(null);

  const fetchState = useCallback(async () => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/quantum-state?freq=${freq}&fs=${fs}&noise_level=${noiseLevel}`,
        { signal: controller.signal }
      );
      if (res.ok) {
        const data = await res.json();
        useSignalStore.getState().setQuantumState(data);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Silently fail — quantum state is an enhancement, not critical
      }
    }
  }, [freq, fs, noiseLevel]);

  useEffect(() => {
    if (!connected) return;

    // Fetch when params change (debounced to avoid rapid-fire requests)
    const timer = setTimeout(fetchState, 150);

    return () => {
      clearTimeout(timer);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchState, connected]);
}
