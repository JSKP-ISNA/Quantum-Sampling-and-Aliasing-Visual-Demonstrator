import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import GlassCard from '../components/ui/GlassCard';
import QuantumSlider from '../components/ui/QuantumSlider';
import QuantumSelect from '../components/ui/QuantumSelect';
import QuantumButton from '../components/ui/QuantumButton';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import useSignalStore from '../store/useSignalStore';
import './QuantumLabPage.css';

/**
 * Quantum Lab — Dedicated quantum circuit testing and results analysis.
 */
export default function QuantumLabPage({ submitQuantumJob }) {
  const metrics = useSignalStore((s) => s.quantumMetrics);
  const jobStatus = useSignalStore((s) => s.quantumJobStatus);
  const jobError = useSignalStore((s) => s.quantumJobError);

  // Local quantum settings
  const [backend, setBackend] = useState('local_classical');
  const [circuitType, setCircuitType] = useState('phase_estimation');
  const [shots, setShots] = useState(1024);
  const [numQubits, setNumQubits] = useState(4);
  const [noiseModel, setNoiseModel] = useState('ideal');

  const handleSubmit = () => {
    // Update store settings then submit
    useSignalStore.getState().setQuantumSettings({
      quantumBackend: backend,
      quantumCircuitType: circuitType,
      quantumShots: shots,
      quantumNumQubits: numQubits,
      quantumNoiseModel: noiseModel,
    });
    if (submitQuantumJob) submitQuantumJob();
  };

  // Prepare histogram data
  const histogramData = useMemo(() => {
    const entries = Object.entries(metrics.counts || {});
    if (!entries.length) return [];
    return entries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([state, count], i) => ({
        state: `|${state}⟩`,
        count,
        fill: `hsl(${180 + i * 10}, 85%, 55%)`,
      }));
  }, [metrics.counts]);

  const totalShots = useMemo(() =>
    Object.values(metrics.counts || {}).reduce((a, b) => a + b, 0)
  , [metrics.counts]);

  // Fidelity radial gauge
  const fidelityData = useMemo(() => [{
    name: 'Fidelity',
    value: (metrics.fidelityEstimate || 0) * 100,
    fill: metrics.fidelityEstimate > 0.9 ? '#0aff88' : metrics.fidelityEstimate > 0.7 ? '#ffcc00' : '#ff3322',
  }], [metrics.fidelityEstimate]);

  const comparison = metrics.classicalComparison;

  const isRunning = jobStatus === 'submitting' || jobStatus === 'running';

  return (
    <div className="quantum-lab-page">
      {/* Header */}
      <div className="quantum-lab-page__header">
        <div>
          <h1 className="page-title">Quantum Lab</h1>
          <p className="page-subtitle">Circuit Execution & Analysis</p>
        </div>
        <div className="quantum-lab-page__status">
          {jobStatus !== 'idle' && (
            <div className={`quantum-job-badge quantum-job-badge--${jobStatus}`}>
              <span className="quantum-job-badge__dot" />
              {jobStatus === 'submitting' && 'SUBMITTING...'}
              {jobStatus === 'running' && 'EXECUTING CIRCUIT...'}
              {jobStatus === 'completed' && '✓ COMPLETE'}
              {jobStatus === 'failed' && '✗ FAILED'}
            </div>
          )}
        </div>
      </div>

      <div className="quantum-lab-grid">
        {/* Left Column — Configuration */}
        <div className="quantum-lab-config">
          <GlassCard title="CIRCUIT CONFIGURATION" icon="⚛" variant="purple">
            <div className="quantum-config-form">
              <QuantumSelect
                label="Backend"
                value={backend}
                onChange={setBackend}
                options={[
                  { value: 'local_classical', label: 'Local Classical' },
                  { value: 'qiskit_simulator', label: 'Qiskit Simulator' },
                  { value: 'qiskit_hardware', label: 'Qiskit Hardware' },
                ]}
                color="var(--neon-purple)"
              />
              <QuantumSelect
                label="Circuit Type"
                value={circuitType}
                onChange={setCircuitType}
                options={[
                  { value: 'phase_estimation', label: 'Phase Estimation (QPE)' },
                  { value: 'quantum_sampling', label: 'Quantum Sampling' },
                  { value: 'qft', label: 'Quantum Fourier Transform' },
                ]}
                color="var(--neon-purple)"
              />
              <QuantumSlider
                label="Shots"
                value={shots}
                onChange={setShots}
                min={128} max={8192} step={128}
                color="var(--neon-purple)"
              />
              <QuantumSlider
                label="Qubits"
                value={numQubits}
                onChange={setNumQubits}
                min={2} max={8} step={1}
                color="var(--neon-cyan)"
              />
              <QuantumSelect
                label="Noise Model"
                value={noiseModel}
                onChange={setNoiseModel}
                options={[
                  { value: 'ideal', label: 'Ideal (No Noise)' },
                  { value: 'depolarizing', label: 'Depolarizing' },
                  { value: 'thermal', label: 'Thermal' },
                ]}
                color="var(--neon-purple)"
              />
              <QuantumButton
                variant="purple"
                size="lg"
                fullWidth
                onClick={handleSubmit}
                loading={isRunning}
                disabled={isRunning}
                icon="⚡"
              >
                {isRunning ? 'Executing...' : 'Run Quantum Job'}
              </QuantumButton>

              {jobStatus === 'failed' && jobError && (
                <div className="quantum-error-msg">{jobError}</div>
              )}
            </div>
          </GlassCard>

          {/* Circuit Info */}
          {metrics.circuitDepth > 0 && (
            <GlassCard title="CIRCUIT INFO" icon="⬡">
              <div className="quantum-info-grid">
                <div className="qi-item">
                  <span className="qi-label">DEPTH</span>
                  <span className="qi-value">{metrics.circuitDepth}</span>
                </div>
                <div className="qi-item">
                  <span className="qi-label">GATES</span>
                  <span className="qi-value">{metrics.gateCount}</span>
                </div>
                <div className="qi-item">
                  <span className="qi-label">TYPE</span>
                  <span className="qi-value qi-value--small">{formatCircuitType(metrics.circuitType)}</span>
                </div>
                <div className="qi-item">
                  <span className="qi-label">BACKEND</span>
                  <span className="qi-value qi-value--small">{metrics.backendName || '—'}</span>
                </div>
                <div className="qi-item">
                  <span className="qi-label">TIME</span>
                  <span className="qi-value">
                    <AnimatedNumber value={metrics.executionTime} decimals={1} suffix="ms" />
                  </span>
                </div>
                <div className="qi-item">
                  <span className="qi-label">NOISE</span>
                  <span className="qi-value qi-value--small">{metrics.noiseModel}</span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right Column — Results */}
        <div className="quantum-lab-results">
          {/* Shot Histogram */}
          {histogramData.length > 0 && (
            <GlassCard title="MEASUREMENT DISTRIBUTION" icon="⟨ψ|" className="chart-card--histogram">
              <div className="histogram-meta">
                <span>{totalShots} total shots</span>
                <span>{Object.keys(metrics.counts).length} states</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={histogramData} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="state"
                    tick={{ fontSize: 9, fill: 'rgba(10,255,255,0.7)' }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(5,5,20,0.92)',
                      border: '1px solid rgba(123,47,255,0.2)',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(value) => [value, 'Count']}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {histogramData.map((entry, i) => (
                      <motion.rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          )}

          {/* Fidelity + Expectations Row */}
          <div className="quantum-row">
            {/* Fidelity Gauge */}
            {metrics.fidelityEstimate > 0 && (
              <GlassCard title="FIDELITY" icon="◎" className="fidelity-card">
                <div className="fidelity-gauge">
                  <ResponsiveContainer width={160} height={160}>
                    <RadialBarChart
                      innerRadius="70%"
                      outerRadius="100%"
                      data={fidelityData}
                      startAngle={210}
                      endAngle={-30}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar
                        background={{ fill: 'rgba(10,255,255,0.04)' }}
                        dataKey="value"
                        angleAxisId={0}
                        cornerRadius={6}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="fidelity-gauge__value">
                    <AnimatedNumber
                      value={metrics.fidelityEstimate * 100}
                      decimals={1}
                      suffix="%"
                      className="fidelity-number"
                    />
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Expectation Values */}
            {Object.keys(metrics.expectationValues).length > 0 && (
              <GlassCard title="EXPECTATION VALUES" icon="⟨Z⟩" className="expectations-card">
                <div className="ev-list">
                  {Object.entries(metrics.expectationValues).slice(0, 8).map(([key, val]) => (
                    <div key={key} className="ev-row">
                      <span className="ev-key">⟨{key}⟩</span>
                      <div className="ev-bar">
                        <motion.div
                          className="ev-bar__fill"
                          animate={{ width: `${Math.abs(val) * 100}%` }}
                          style={{ background: val > 0 ? 'var(--neon-green)' : 'var(--neon-red)' }}
                        />
                      </div>
                      <span className={`ev-val ${val > 0 ? 'positive' : 'negative'}`}>
                        {Number(val).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Classical Comparison */}
          {comparison && (
            <GlassCard title="QUANTUM vs CLASSICAL" icon="⇌" variant="purple" className="comparison-card">
              <div className="comparison-grid">
                {comparison.quantum_estimated_freq !== undefined && (
                  <>
                    <div className="comp-cell">
                      <span className="comp-cell__label">Q-Freq</span>
                      <span className="comp-cell__value comp-cell__value--quantum">{comparison.quantum_estimated_freq} Hz</span>
                    </div>
                    <div className="comp-cell">
                      <span className="comp-cell__label">C-Freq</span>
                      <span className="comp-cell__value comp-cell__value--classical">{comparison.classical_peak_freq?.toFixed(1)} Hz</span>
                    </div>
                    <div className="comp-cell">
                      <span className="comp-cell__label">Δ Error</span>
                      <span className={`comp-cell__value ${comparison.frequency_error_hz < 5 ? 'comp-cell__value--good' : 'comp-cell__value--bad'}`}>
                        {comparison.frequency_error_hz} Hz
                      </span>
                    </div>
                    <div className="comp-cell">
                      <span className="comp-cell__label">Accurate</span>
                      <span className={`comp-cell__value ${comparison.phase_estimation_accurate ? 'comp-cell__value--good' : 'comp-cell__value--bad'}`}>
                        {comparison.phase_estimation_accurate ? '✓ YES' : '✗ NO'}
                      </span>
                    </div>
                  </>
                )}
                {comparison.kl_divergence !== undefined && (
                  <>
                    <div className="comp-cell">
                      <span className="comp-cell__label">KL Div</span>
                      <span className="comp-cell__value">{comparison.kl_divergence?.toFixed(4)}</span>
                    </div>
                    <div className="comp-cell">
                      <span className="comp-cell__label">Match</span>
                      <span className={`comp-cell__value ${comparison.distribution_match_score > 0.8 ? 'comp-cell__value--good' : 'comp-cell__value--bad'}`}>
                        {(comparison.distribution_match_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </>
                )}
                <div className="comp-cell">
                  <span className="comp-cell__label">C-SNR</span>
                  <span className="comp-cell__value">{comparison.classical_snr?.toFixed(1)} dB</span>
                </div>
                <div className="comp-cell">
                  <span className="comp-cell__label">Aliased</span>
                  <span className={`comp-cell__value ${comparison.classical_is_aliased ? 'comp-cell__value--bad' : 'comp-cell__value--good'}`}>
                    {comparison.classical_is_aliased ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Empty State */}
          {!histogramData.length && jobStatus === 'idle' && (
            <GlassCard variant="purple" className="quantum-empty-state">
              <div className="empty-icon">⚛</div>
              <h3>No Quantum Results Yet</h3>
              <p>Configure your circuit parameters and click "Run Quantum Job" to execute a quantum circuit and see measurement results here.</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
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
