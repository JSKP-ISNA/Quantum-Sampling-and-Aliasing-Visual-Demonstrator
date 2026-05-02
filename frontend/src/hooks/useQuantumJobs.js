import { useCallback, useEffect, useRef } from 'react';
import useSignalStore from '../store/useSignalStore';
import { apiUrl } from '../lib/network';

const POLL_INTERVAL_MS = 1000;

function backendNameFor(entry) {
  return typeof entry === 'string' ? entry : entry?.name;
}

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
      useSignalStore.getState().pushToast({
        tone: 'success',
        title: 'Quantum run complete',
        message: `Latest execution finished on ${result.metadata?.backend || 'the selected backend'}.`,
      });
    } catch (error) {
      useSignalStore.getState().setQuantumJobStatus('failed', jobId, error.message);
      useSignalStore.getState().pushToast({
        tone: 'danger',
        title: 'Result retrieval failed',
        message: error.message || 'The job completed, but the result payload could not be read.',
      });
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
          const message = status.error_message || 'Job failed';
          useSignalStore
            .getState()
            .setQuantumJobStatus('failed', jobId, message);
          useSignalStore.getState().pushToast({
            tone: 'danger',
            title: 'Quantum run failed',
            message,
          });
        }
      } catch {
        // Keep polling on intermittent failures.
      }
    }, POLL_INTERVAL_MS);
  }, [fetchResult]);

  const submitJob = useCallback(async (overrides = {}) => {
    const store = useSignalStore.getState();
    const requestedBackend = overrides.backend || store.quantumBackend;
    const selectedBackend = (store.availableBackends || []).find(
      (backend) => backendNameFor(backend) === requestedBackend
    );

    if (selectedBackend && selectedBackend.available === false) {
      const message =
        requestedBackend === 'qiskit_hardware'
          ? 'IBM hardware is locked until an API token and qiskit-ibm-runtime are configured.'
          : `${selectedBackend.display_name || requestedBackend} is currently unavailable.`;

      store.setQuantumJobStatus('failed', null, message);
      store.pushToast({
        tone: 'warning',
        title: 'Backend unavailable',
        message,
      });
      return null;
    }

    const params = new URLSearchParams({
      freq: String(store.freq),
      fs: String(store.fs),
      noise_level: String(store.noiseLevel),
      wave_type: store.waveType,
      backend: requestedBackend,
      shots: String(overrides.shots || store.quantumShots),
      noise_model: overrides.noiseModel || store.quantumNoiseModel,
      num_qubits: String(overrides.numQubits || store.quantumNumQubits),
      circuit_type: overrides.circuitType || store.quantumCircuitType,
      window_type: overrides.windowType || store.quantumWindowType || 'uniform',
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
      store.pushToast({
        tone: 'danger',
        title: 'Quantum submission failed',
        message: error.message || 'The backend rejected the workflow submission.',
      });
      return null;
    }
  }, [startPolling]);

  return { submitJob, fetchBackends };
}
