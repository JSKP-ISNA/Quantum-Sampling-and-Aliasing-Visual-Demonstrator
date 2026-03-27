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

  // ─── Quantum State ───────────────────────────────────────────
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
}));

export default useSignalStore;
