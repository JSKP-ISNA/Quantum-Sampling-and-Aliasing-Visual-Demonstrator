import { useCallback, useEffect, useRef } from 'react';
import useSignalStore from '../store/useSignalStore';
import { apiUrl } from '../lib/network';

const POLL_INTERVAL_MS = 1000;

export default function useQuantumJobs() {
  const pollingRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const fetchBackends = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/quantum/backends'));
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      useSignalStore.getState().setAvailableBackends(data.backends || []);
    } catch {
      // Non-critical. The workspace can still operate without backend metadata.
    }
  }, []);

  useEffect(() => {
    fetchBackends();
  }, [fetchBackends]);

  const fetchResult = useCallback(async (jobId) => {
    try {
      const response = await fetch(apiUrl(`/api/quantum/result/${jobId}`));
      if (!response.ok) {
        throw new Error(`Result fetch failed: ${response.status}`);
      }

      const result = await response.json();
      useSignalStore.getState().setQuantumResult(result);
    } catch (error) {
      useSignalStore.getState().setQuantumJobStatus('failed', jobId, error.message);
    }
  }, []);

  const startPolling = useCallback((jobId) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        return;
      }

      try {
        const response = await fetch(apiUrl(`/api/quantum/status/${jobId}`));
        if (!response.ok) {
          return;
        }

        const status = await response.json();

        if (status.status === 'completed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          await fetchResult(jobId);
          return;
        }

        if (status.status === 'failed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          useSignalStore
            .getState()
            .setQuantumJobStatus('failed', jobId, status.error_message || 'Job failed');
        }
      } catch {
        // Keep polling on intermittent failures.
      }
    }, POLL_INTERVAL_MS);
  }, [fetchResult]);

  const submitJob = useCallback(async (overrides = {}) => {
    const store = useSignalStore.getState();

    const params = new URLSearchParams({
      freq: String(store.freq),
      fs: String(store.fs),
      noise_level: String(store.noiseLevel),
      wave_type: store.waveType,
      backend: overrides.backend || store.quantumBackend,
      shots: String(overrides.shots || store.quantumShots),
      noise_model: overrides.noiseModel || store.quantumNoiseModel,
      num_qubits: String(overrides.numQubits || store.quantumNumQubits),
      circuit_type: overrides.circuitType || store.quantumCircuitType,
    });

    store.setQuantumJobStatus('submitting');

    try {
      const response = await fetch(`${apiUrl('/api/quantum/submit')}?${params}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Submit failed: ${response.status}`);
      }

      const data = await response.json();
      const jobId = data.job_id;

      store.setQuantumJobStatus('running', jobId);
      startPolling(jobId);

      return jobId;
    } catch (error) {
      store.setQuantumJobStatus('failed', null, error.message);
      return null;
    }
  }, [startPolling]);

  return { submitJob, fetchBackends };
}
