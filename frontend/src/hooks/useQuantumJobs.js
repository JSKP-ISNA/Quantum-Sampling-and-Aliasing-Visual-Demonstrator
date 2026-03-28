import { useCallback, useRef, useEffect } from 'react';
import useSignalStore from '../store/useSignalStore';

const API_BASE = 'http://localhost:8000';
const POLL_INTERVAL_MS = 1000;

/**
 * Hook for quantum job lifecycle management.
 * Handles: submit → poll status → fetch result → update store.
 */
export default function useQuantumJobs() {
  const pollingRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Fetch available backends on mount
  useEffect(() => {
    fetchBackends();
  }, []);

  const fetchBackends = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/quantum/backends`);
      if (res.ok) {
        const data = await res.json();
        useSignalStore.getState().setAvailableBackends(data.backends || []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const submitJob = useCallback(async (overrides = {}) => {
    const state = useSignalStore.getState();
    const store = useSignalStore.getState();

    const params = new URLSearchParams({
      freq: String(state.freq),
      fs: String(state.fs),
      noise_level: String(state.noiseLevel),
      wave_type: state.waveType,
      backend: overrides.backend || store.quantumBackend,
      shots: String(overrides.shots || store.quantumShots),
      noise_model: overrides.noiseModel || store.quantumNoiseModel,
      num_qubits: String(overrides.numQubits || store.quantumNumQubits),
      circuit_type: overrides.circuitType || store.quantumCircuitType,
    });

    store.setQuantumJobStatus('submitting');

    try {
      const res = await fetch(`${API_BASE}/api/quantum/submit?${params}`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);

      const data = await res.json();
      const jobId = data.job_id;

      store.setQuantumJobStatus('running', jobId);

      // Start polling
      startPolling(jobId);
      return jobId;
    } catch (err) {
      store.setQuantumJobStatus('failed', null, err.message);
      return null;
    }
  }, []);

  const startPolling = useCallback((jobId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        clearInterval(pollingRef.current);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/quantum/status/${jobId}`);
        if (!res.ok) return;

        const status = await res.json();

        if (status.status === 'completed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          // Fetch full result
          await fetchResult(jobId);
        } else if (status.status === 'failed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          useSignalStore.getState().setQuantumJobStatus(
            'failed', jobId, status.error_message || 'Job failed'
          );
        }
      } catch {
        // Continue polling on network errors
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const fetchResult = useCallback(async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/api/quantum/result/${jobId}`);
      if (!res.ok) throw new Error(`Result fetch failed: ${res.status}`);

      const result = await res.json();
      useSignalStore.getState().setQuantumResult(result);
    } catch (err) {
      useSignalStore.getState().setQuantumJobStatus(
        'failed', jobId, err.message
      );
    }
  }, []);

  return { submitJob, fetchBackends };
}
