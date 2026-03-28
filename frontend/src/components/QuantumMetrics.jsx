import { motion } from 'framer-motion';
import useSignalStore from '../store/useSignalStore';
import './QuantumMetrics.css';

/**
 * Quantum execution metrics panel.
 * Shows circuit depth, gate count, backend, execution time,
 * noise model, fidelity, expectation values, and comparison metrics.
 */
export default function QuantumMetrics() {
  const metrics = useSignalStore((s) => s.quantumMetrics);
  const jobStatus = useSignalStore((s) => s.quantumJobStatus);

  const hasData = metrics.backendName || metrics.circuitDepth > 0;
  if (!hasData && jobStatus === 'idle') return null;

  const comparison = metrics.classicalComparison;

  return (
    <motion.div
      className="quantum-metrics"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Circuit Info */}
      <div className="qm-section">
        <div className="qm-section-header">
          <span className="qm-icon">⬡</span>
          <h3>CIRCUIT INFO</h3>
        </div>
        <div className="qm-grid">
          <div className="qm-item">
            <span className="qm-label">DEPTH</span>
            <span className="qm-value">{metrics.circuitDepth}</span>
          </div>
          <div className="qm-item">
            <span className="qm-label">GATES</span>
            <span className="qm-value">{metrics.gateCount}</span>
          </div>
          <div className="qm-item">
            <span className="qm-label">TYPE</span>
            <span className="qm-value small">{formatCircuitType(metrics.circuitType)}</span>
          </div>
        </div>
      </div>

      {/* Backend Info */}
      <div className="qm-section">
        <div className="qm-section-header">
          <span className="qm-icon">◈</span>
          <h3>EXECUTION</h3>
        </div>
        <div className="qm-grid">
          <div className="qm-item wide">
            <span className="qm-label">BACKEND</span>
            <span className="qm-value small">{metrics.backendName || '—'}</span>
          </div>
          <div className="qm-item">
            <span className="qm-label">TIME</span>
            <span className="qm-value">{metrics.executionTime.toFixed(1)}<small>ms</small></span>
          </div>
          <div className="qm-item">
            <span className="qm-label">NOISE</span>
            <span className="qm-value small">{metrics.noiseModel}</span>
          </div>
        </div>
      </div>

      {/* Fidelity Gauge */}
      <div className="qm-section">
        <div className="qm-section-header">
          <span className="qm-icon">◎</span>
          <h3>FIDELITY</h3>
        </div>
        <div className="fidelity-bar-container">
          <motion.div
            className={`fidelity-bar-fill ${metrics.fidelityEstimate > 0.9 ? 'good' : metrics.fidelityEstimate > 0.7 ? 'medium' : 'poor'}`}
            initial={{ width: 0 }}
            animate={{ width: `${(metrics.fidelityEstimate || 0) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="fidelity-value">
          {(metrics.fidelityEstimate * 100).toFixed(1)}%
        </div>
      </div>

      {/* Expectation Values */}
      {Object.keys(metrics.expectationValues).length > 0 && (
        <div className="qm-section">
          <div className="qm-section-header">
            <span className="qm-icon">⟨Z⟩</span>
            <h3>EXPECTATION VALUES</h3>
          </div>
          <div className="ev-list">
            {Object.entries(metrics.expectationValues).slice(0, 6).map(([key, val]) => (
              <div key={key} className="ev-item">
                <span className="ev-label">⟨{key}⟩</span>
                <span className={`ev-value ${val > 0 ? 'positive' : 'negative'}`}>
                  {Number(val).toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classical Comparison */}
      {comparison && (
        <div className="qm-section comparison">
          <div className="qm-section-header">
            <span className="qm-icon">⇌</span>
            <h3>QUANTUM vs CLASSICAL</h3>
          </div>

          {comparison.quantum_estimated_freq !== undefined && (
            <div className="comparison-grid">
              <div className="comp-item">
                <span className="comp-label">Q-Freq</span>
                <span className="comp-value quantum">{comparison.quantum_estimated_freq} Hz</span>
              </div>
              <div className="comp-item">
                <span className="comp-label">C-Freq</span>
                <span className="comp-value classical">{comparison.classical_peak_freq?.toFixed(1)} Hz</span>
              </div>
              <div className="comp-item wide">
                <span className="comp-label">Δ ERROR</span>
                <span className={`comp-value ${comparison.frequency_error_hz < 5 ? 'good' : 'warning'}`}>
                  {comparison.frequency_error_hz} Hz
                </span>
              </div>
              <div className="comp-item wide">
                <span className="comp-label">ACCURATE</span>
                <span className={`comp-value ${comparison.phase_estimation_accurate ? 'good' : 'warning'}`}>
                  {comparison.phase_estimation_accurate ? '✓ YES' : '✗ NO'}
                </span>
              </div>
            </div>
          )}

          {comparison.kl_divergence !== undefined && (
            <div className="comparison-grid">
              <div className="comp-item">
                <span className="comp-label">KL Div</span>
                <span className="comp-value">{comparison.kl_divergence?.toFixed(4)}</span>
              </div>
              <div className="comp-item">
                <span className="comp-label">Match</span>
                <span className={`comp-value ${comparison.distribution_match_score > 0.8 ? 'good' : 'warning'}`}>
                  {(comparison.distribution_match_score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          <div className="comparison-grid">
            <div className="comp-item">
              <span className="comp-label">C-SNR</span>
              <span className="comp-value">{comparison.classical_snr?.toFixed(1)} dB</span>
            </div>
            <div className="comp-item">
              <span className="comp-label">ALIASED</span>
              <span className={`comp-value ${comparison.classical_is_aliased ? 'warning' : 'good'}`}>
                {comparison.classical_is_aliased ? 'YES' : 'NO'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Time */}
      {metrics.totalWorkflowTime > 0 && (
        <div className="qm-footer">
          Total workflow: {metrics.totalWorkflowTime.toFixed(1)}ms
        </div>
      )}
    </motion.div>
  );
}

function formatCircuitType(type) {
  const map = {
    phase_estimation: 'QPE',
    quantum_sampling: 'QSamp',
    qft: 'QFT',
  };
  return map[type] || type || '—';
}
