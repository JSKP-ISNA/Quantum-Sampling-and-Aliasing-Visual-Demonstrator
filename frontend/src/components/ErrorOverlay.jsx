import { motion } from 'framer-motion';
import useSignalStore from '../store/useSignalStore';
import './ErrorOverlay.css';

/**
 * HUD-style monitoring dashboard with animated metrics,
 * quantum state data, circular gauges, and scanning line effects.
 */
export default function ErrorOverlay() {
  const error = useSignalStore((s) => s.error);
  const aliased = useSignalStore((s) => s.aliased);
  const aliasFreq = useSignalStore((s) => s.aliasFreq);
  const freq = useSignalStore((s) => s.freq);
  const fs = useSignalStore((s) => s.fs);
  const nyquist = useSignalStore((s) => s.nyquist);
  const connected = useSignalStore((s) => s.connected);
  const quantumState = useSignalStore((s) => s.quantumState);

  const snrNorm = Math.min(Math.max((error.snr || 0) / 50, 0), 1);
  const mseNorm = Math.min(Math.max(1 - (error.mse || 0) * 10, 0), 1);

  return (
    <motion.div
      className="error-overlay"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
    >
      {/* Connection Status */}
      <div className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
        <span className="dot" />
        {connected ? 'QUANTUM LINK' : 'OFFLINE'}
      </div>

      {/* Metrics Panel */}
      <div className="metrics-panel">
        <div className="panel-header">
          <span className="panel-icon">◈</span>
          <h3>SIGNAL METRICS</h3>
        </div>
        <div className="panel-scan-line" />

        <div className="gauge-row">
          {/* SNR Circular Gauge */}
          <div className="circular-gauge">
            <svg viewBox="0 0 80 80" className="gauge-svg">
              <circle cx="40" cy="40" r="32" className="gauge-track" />
              <circle
                cx="40" cy="40" r="32"
                className={`gauge-fill ${error.snr < 10 ? 'warning' : 'good'}`}
                strokeDasharray={`${snrNorm * 201} 201`}
                strokeDashoffset="0"
              />
            </svg>
            <div className="gauge-label">
              <span className="gauge-value">{error.snr?.toFixed(1)}</span>
              <span className="gauge-unit">dB SNR</span>
            </div>
          </div>

          {/* MSE Gauge */}
          <div className="circular-gauge">
            <svg viewBox="0 0 80 80" className="gauge-svg">
              <circle cx="40" cy="40" r="32" className="gauge-track" />
              <circle
                cx="40" cy="40" r="32"
                className={`gauge-fill ${error.mse > 0.1 ? 'warning' : 'good'}`}
                strokeDasharray={`${mseNorm * 201} 201`}
                strokeDashoffset="0"
              />
            </svg>
            <div className="gauge-label">
              <span className="gauge-value">{error.mse?.toFixed(4)}</span>
              <span className="gauge-unit">MSE</span>
            </div>
          </div>
        </div>

        <div className="metric-row">
          <span className="metric-label">MAX ERROR</span>
          <span className="metric-value mono">{error.max_error?.toFixed(4)}</span>
        </div>
      </div>

      {/* Signal Info */}
      <div className="signal-info">
        <div className="panel-header">
          <span className="panel-icon">⟡</span>
          <h3>SIGNAL PARAMS</h3>
        </div>
        <div className="metric-row">
          <span className="metric-label">FREQ</span>
          <span className="metric-value mono">{freq} <small>Hz</small></span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Fs</span>
          <span className="metric-value mono">{fs} <small>Hz</small></span>
        </div>
        <div className="metric-row">
          <span className="metric-label">NYQUIST</span>
          <span className="metric-value mono">{nyquist} <small>Hz</small></span>
        </div>
      </div>

      {/* Quantum State Panel */}
      <div className="quantum-panel">
        <div className="panel-header">
          <span className="panel-icon">⬡</span>
          <h3>QUANTUM STATE</h3>
        </div>
        <div className="quantum-metrics">
          <div className="quantum-metric">
            <span className="q-label">COHERENCE</span>
            <div className="q-bar-container">
              <div
                className="q-bar-fill coherence"
                style={{ width: `${(quantumState.coherence || 0) * 100}%` }}
              />
            </div>
            <span className="q-value">{quantumState.coherence?.toFixed(3)}</span>
          </div>
          <div className="quantum-metric">
            <span className="q-label">ENTROPY</span>
            <div className="q-bar-container">
              <div
                className="q-bar-fill entropy"
                style={{ width: `${(quantumState.entropy || 0) * 100}%` }}
              />
            </div>
            <span className="q-value">{quantumState.entropy?.toFixed(3)}</span>
          </div>
          <div className="quantum-metric">
            <span className="q-label">PURITY</span>
            <div className="q-bar-container">
              <div
                className="q-bar-fill purity"
                style={{ width: `${(quantumState.purity || 0) * 100}%` }}
              />
            </div>
            <span className="q-value">{quantumState.purity?.toFixed(3)}</span>
          </div>
          <div className="quantum-metric">
            <span className="q-label">|α|²</span>
            <span className="q-value mono">{quantumState.superposition?.alpha_sq?.toFixed(3)}</span>
          </div>
          <div className="quantum-metric">
            <span className="q-label">|β|²</span>
            <span className="q-value mono">{quantumState.superposition?.beta_sq?.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Alias Alert */}
      {aliased && (
        <motion.div
          className="alias-alert"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="alias-alert-header">
            <span className="alert-pulse" />
            ⚠ ALIASING DETECTED
          </div>
          <div className="alias-alert-body">
            <p>Signal <strong>{freq} Hz</strong> exceeds Nyquist <strong>{nyquist} Hz</strong></p>
            <p>Alias frequency: <strong>{aliasFreq} Hz</strong></p>
          </div>
        </motion.div>
      )}

      {!aliased && (
        <div className="no-alias-badge">
          <span className="check-icon">◈</span> Nyquist Satisfied
        </div>
      )}
    </motion.div>
  );
}
