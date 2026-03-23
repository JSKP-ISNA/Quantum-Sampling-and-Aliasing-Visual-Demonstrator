import { create } from 'zustand';

const useSignalStore = create((set) => ({
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

  setSignalData: (data) =>
    set({
      signalData: data.signal,
      sampledData: data.sampled,
      reconstructedData: data.reconstructed,
      aliasGhostData: data.alias_ghost,
      fftData: data.fft,
      aliased: data.aliased,
      aliasFreq: data.alias_freq,
      error: data.error,
      nyquist: data.params?.nyquist ?? 150,
    }),

  setConnected: (connected) => set({ connected }),
  setAIExplanation: (explanation) => set({ aiExplanation: explanation }),
  setQuantumState: (quantumState) => set({ quantumState }),
  setBooted: (booted) => set({ booted }),
}));

export default useSignalStore;
