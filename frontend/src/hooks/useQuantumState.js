import { useEffect } from 'react';
import useSignalStore from '../store/useSignalStore';
import { apiUrl } from '../lib/network';

/**
 * Hook that fetches available quantum backends on mount
 * and optionally polls for legacy quantum state data.
 */
export default function useQuantumState() {
  const connected = useSignalStore((s) => s.connected);

  // Fetch available backends when connected
  useEffect(() => {
    if (!connected) return;

    const fetchBackends = async () => {
      try {
        const res = await fetch(apiUrl('/api/quantum/backends'));
        if (res.ok) {
          const data = await res.json();
          useSignalStore.getState().setAvailableBackends(data.backends || []);
        }
      } catch {
        // Non-critical
      }
    };

    fetchBackends();
  }, [connected]);
}
