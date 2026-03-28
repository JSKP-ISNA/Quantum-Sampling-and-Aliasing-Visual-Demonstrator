import { create } from 'zustand';

/**
 * Deep-compare two data objects { t: [...], y: [...] }.
 * Returns true if arrays differ, meaning we should update.
 */
function dataChanged(prev, next) {
  if (!prev || !next) return true;
  if (prev.t?.length !== next.t?.length) return true;
  if (prev.y?.length !== next.y?.length) return true;
  // Check a few sentinel values instead of full deep compare
  const len = prev.y?.length || 0;
  if (len === 0) return false;
  const indices = [0, Math.floor(len / 4), Math.floor(len / 2), Math.floor(3 * len / 4), len - 1];
  for (const i of indices) {
    if (prev.y[i] !== next.y[i]) return true;
    if (prev.t[i] !== next.t[i]) return true;
  }
  return false;
}

const useSignalStore = create((set, get) => ({
  // ─── Control Parameters ──────────────────────────────────────
  freq: 100,
  fs: 300,
  noiseLevel: 0,
  waveType: 'sine',

  // ─── Signal Data from Backend ────────────────────────────────
  signalData: { t: [], y: [] },
  sampledData: { t: [], y: [] },
  reconstructedData: { t: [], y: [] },
  aliasGhostData: { t: [], y: [] },
  fftData: {
    original: { freq: [], magnitude: [] },
    sampled: { freq: [], magnitude: [] },
  },

  // ─── Status ──────────────────────────────────────────────────
  aliased: false,
  aliasFreq: 0,
  error: { mse: 0, snr: 0, max_error: 0 },
  nyquist: 150,
  connected: false,
  aiExplanation: '',

  // ─── Legacy Quantum State (backward compat) ──────────────────
  quantumState: {
    bloch: { x: 0, y: 0, z: 1 },
    theta: 0,
    phi: 0,
    superposition: { alpha_sq: 1, beta_sq: 0 },
    coherence: 0,
    entropy: 0,
    fidelity: 1,
    purity: 1,
  },

  // ─── Quantum Engine State ────────────────────────────────────
  quantumJobs: {},           // Map of job_id → { status, result }
  activeJobId: null,         // Currently tracked job
  availableBackends: [],     // From /api/quantum/backends

  // Quantum execution settings
  quantumBackend: 'local_classical',
  quantumShots: 1024,
  quantumNoiseModel: 'ideal',
  quantumNumQubits: 4,
  quantumCircuitType: 'phase_estimation',

  // Latest quantum result metrics
  quantumMetrics: {
    counts: {},
    probabilities: {},
    expectationValues: {},
    circuitDepth: 0,
    gateCount: 0,
    backendName: '',
    executionTime: 0,
    noiseModel: '',
    fidelityEstimate: 0,
    circuitType: '',
    totalWorkflowTime: 0,
    classicalComparison: null,
  },

  // Job UI state
  quantumJobStatus: 'idle',  // idle | submitting | running | completed | failed
  quantumJobError: null,

  // ─── UI State ────────────────────────────────────────────────
  booted: false,

  // ─── Actions ─────────────────────────────────────────────────
  setParams: (params) => set(params),

  setSignalData: (data) => {
    const state = get();

    // Only create new object references for data that actually changed.
    // This prevents unnecessary Three.js geometry rebuilds.
    const update = {
      aliased: data.aliased,
      aliasFreq: data.alias_freq,
      error: data.error,
      nyquist: data.params?.nyquist ?? 150,
    };

    // Also sync control-plane params from backend so the store stays
    // consistent even if the UI hasn't caught up yet.
    if (data.params) {
      update.freq = data.params.freq;
      update.fs = data.params.fs;
      update.noiseLevel = data.params.noise_level ?? state.noiseLevel;
      update.waveType = data.params.wave_type ?? state.waveType;
    }

    // Deep-compare data arrays to avoid unnecessary re-renders
    if (dataChanged(state.signalData, data.signal)) {
      update.signalData = data.signal;
    }
    if (dataChanged(state.sampledData, data.sampled)) {
      update.sampledData = data.sampled;
    }
    if (dataChanged(state.reconstructedData, data.reconstructed)) {
      update.reconstructedData = data.reconstructed;
    }
    if (dataChanged(state.aliasGhostData, data.alias_ghost)) {
      update.aliasGhostData = data.alias_ghost;
    }

    // FFT data — always update (lightweight and always changes)
    update.fftData = data.fft;

    set(update);
  },

  setConnected: (connected) => set({ connected }),
  setAIExplanation: (explanation) => set({ aiExplanation: explanation }),
  setQuantumState: (quantumState) => set({ quantumState }),
  setBooted: (booted) => set({ booted }),

  // ─── Quantum Engine Actions ──────────────────────────────────

  setAvailableBackends: (backends) => set({ availableBackends: backends }),

  setQuantumSettings: (settings) => set(settings),

  setQuantumJobStatus: (status, jobId = null, error = null) =>
    set({
      quantumJobStatus: status,
      activeJobId: jobId ?? undefined,
      quantumJobError: error,
    }),

  setQuantumResult: (result) => {
    const metadata = result.metadata || {};
    set({
      quantumJobStatus: 'completed',
      quantumMetrics: {
        counts: result.counts || {},
        probabilities: result.probabilities || {},
        expectationValues: result.expectation_values || {},
        circuitDepth: metadata.circuit_depth || 0,
        gateCount: metadata.gate_count || 0,
        backendName: metadata.backend || '',
        executionTime: metadata.execution_time_ms || 0,
        noiseModel: metadata.noise_model || 'ideal',
        fidelityEstimate: metadata.fidelity_estimate || 0,
        circuitType: metadata.circuit_type || '',
        totalWorkflowTime: metadata.total_workflow_time_ms || 0,
        classicalComparison: result.classical_comparison || null,
      },
    });
  },

  updateJobStatus: (jobId, status) =>
    set((state) => ({
      quantumJobs: {
        ...state.quantumJobs,
        [jobId]: { ...state.quantumJobs[jobId], ...status },
      },
    })),
}));

export default useSignalStore;
