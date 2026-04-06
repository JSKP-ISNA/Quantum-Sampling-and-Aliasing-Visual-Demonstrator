import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Leva, useCreateStore } from 'leva';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiCpu,
  FiLayers,
  FiRadio,
  FiShield,
  FiWifi,
  FiZap,
} from 'react-icons/fi';
import useSignalStore from '../store/useSignalStore';
import './DashboardPage.css';

const Scene = lazy(() => import('../components/Scene'));
const ControlPanel = lazy(() => import('../components/ControlPanel'));
const AIExplanation = lazy(() => import('../components/AIExplanation'));

const MAX_TIME_POINTS = 96;
const MAX_SPECTRUM_BANDS = 18;
const MotionSection = motion.section;

const WAVE_TYPE_LABELS = {
  sine: 'Sine',
  square: 'Square',
  sawtooth: 'Sawtooth',
  triangle: 'Triangle',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '0';
}

function formatPercent(value) {
  return `${formatNumber(value * 100, 1)}%`;
}

function waveformValue(waveType, phase) {
  if (waveType === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (waveType === 'sawtooth') return 2 * ((phase / (2 * Math.PI)) - Math.floor(0.5 + phase / (2 * Math.PI)));
  if (waveType === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

function buildSyntheticTimeSeries(freq, noiseLevel, waveType) {
  const cycles = 2.5;
  const duration = cycles / Math.max(freq, 1);
  const data = [];

  for (let index = 0; index < MAX_TIME_POINTS; index += 1) {
    const t = (index / (MAX_TIME_POINTS - 1)) * duration;
    const phase = 2 * Math.PI * freq * t;
    const source = waveformValue(waveType, phase);
    const noise = noiseLevel * 0.22 * Math.sin(phase * 4 + index * 0.19);
    const reconstruction = source * (1 - noiseLevel * 0.08) + noise;

    data.push({
      time: Number((t * 1000).toFixed(2)),
      source: Number(source.toFixed(4)),
      reconstruction: Number(reconstruction.toFixed(4)),
    });
  }

  return data;
}

function buildTimeSeries(signalData, reconstructedData, freq, noiseLevel, waveType) {
  const signalCount = signalData?.t?.length || 0;

  if (!signalCount || !signalData?.y?.length) {
    return {
      points: buildSyntheticTimeSeries(freq, noiseLevel, waveType),
      sourceLabel: 'Projected frontend model',
    };
  }

  const step = Math.max(1, Math.floor(signalCount / MAX_TIME_POINTS));
  const points = [];

  for (let index = 0; index < signalCount; index += step) {
    points.push({
      time: Number(((signalData.t[index] || 0) * 1000).toFixed(2)),
      source: Number((signalData.y[index] || 0).toFixed(4)),
      reconstruction: Number((reconstructedData?.y?.[index] ?? signalData.y[index] ?? 0).toFixed(4)),
    });
  }

  return {
    points,
    sourceLabel: 'Live backend trace',
  };
}

function buildSyntheticSpectrum(freq, fs, waveType) {
  const harmonics = [];
  const baseLimit = Math.max(1, Math.floor((fs / 2) / Math.max(freq, 1)));

  for (let harmonic = 1; harmonic <= Math.min(baseLimit, MAX_SPECTRUM_BANDS); harmonic += 1) {
    const bandFreq = freq * harmonic;
    if (bandFreq > fs / 2) break;

    let source = 0;
    if (waveType === 'sine') source = harmonic === 1 ? 1 : 0.02 / harmonic;
    else if (waveType === 'square') source = harmonic % 2 ? 1 / harmonic : 0;
    else if (waveType === 'triangle') source = harmonic % 2 ? 1 / (harmonic * harmonic) : 0;
    else source = 1 / harmonic;

    harmonics.push({
      band: `${Math.round(bandFreq)}`,
      freq: Number(bandFreq.toFixed(1)),
      source: Number(source.toFixed(3)),
      sampled: Number((source * 0.92).toFixed(3)),
    });
  }

  return harmonics;
}

function buildSpectrumSeries(fftData, freq, fs, waveType) {
  const originalFreq = fftData?.original?.freq || [];
  const originalMagnitude = fftData?.original?.magnitude || [];

  if (!originalFreq.length || !originalMagnitude.length) {
    return {
      points: buildSyntheticSpectrum(freq, fs, waveType),
      sourceLabel: 'Projected harmonic bands',
    };
  }

  const sampledMagnitude = fftData?.sampled?.magnitude || [];
  const points = originalFreq
    .map((frequency, index) => ({
      band: `${Math.round(frequency)}`,
      freq: frequency,
      source: originalMagnitude[index] || 0,
      sampled: sampledMagnitude[index] || 0,
    }))
    .filter((point) => point.freq >= 0 && point.freq <= fs / 2)
    .sort((left, right) => right.source - left.source)
    .slice(0, MAX_SPECTRUM_BANDS)
    .sort((left, right) => left.freq - right.freq)
    .map((point) => ({
      ...point,
      freq: Number(point.freq.toFixed(1)),
      source: Number(point.source.toFixed(3)),
      sampled: Number(point.sampled.toFixed(3)),
    }));

  return {
    points,
    sourceLabel: 'Observed FFT peaks',
  };
}

function toneForScore(score) {
  if (score < 35) return 'critical';
  if (score < 65) return 'warning';
  return 'good';
}

function statusTone(status) {
  if (status === 'failed') return 'critical';
  if (status === 'running' || status === 'submitting') return 'warning';
  if (status === 'completed') return 'good';
  return 'neutral';
}

function topMeasuredState(counts) {
  const entries = Object.entries(counts || {}).sort((left, right) => right[1] - left[1]);
  return entries[0] || ['', 0];
}

function DashboardPanel({ eyebrow, title, description, aside, className = '', delay = 0, children }) {
  return (
    <MotionSection
      className={`dashboard-panel ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="dashboard-panel__header">
        <div>
          <div className="dashboard-panel__eyebrow">{eyebrow}</div>
          <h2 className="dashboard-panel__title">{title}</h2>
          {description && <p className="dashboard-panel__description">{description}</p>}
        </div>
        {aside && <div className="dashboard-panel__aside">{aside}</div>}
      </div>
      <div className="dashboard-panel__body">{children}</div>
    </MotionSection>
  );
}

function StatusChip({ icon, label, value, tone = 'neutral' }) {
  return (
    <div className={`dashboard-chip dashboard-chip--${tone}`}>
      <span className="dashboard-chip__icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DetailItem({ label, value, note }) {
  return (
    <div className="dashboard-detail">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function ProgressRail({ label, value, detail }) {
  const tone = toneForScore(value);

  return (
    <div className="dashboard-rail">
      <div className="dashboard-rail__copy">
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <div className="dashboard-rail__track">
        <div className={`dashboard-rail__fill tone-${tone}`} style={{ width: `${value}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}

export default function DashboardPage({ sendParams, submitQuantumJob }) {
  const controlStore = useCreateStore();
  const [stageReady, setStageReady] = useState(false);
  const [controlsReady, setControlsReady] = useState(false);
  const freq = useSignalStore((state) => state.freq);
  const fs = useSignalStore((state) => state.fs);
  const noiseLevel = useSignalStore((state) => state.noiseLevel);
  const waveType = useSignalStore((state) => state.waveType);
  const signalData = useSignalStore((state) => state.signalData);
  const sampledData = useSignalStore((state) => state.sampledData);
  const reconstructedData = useSignalStore((state) => state.reconstructedData);
  const fftData = useSignalStore((state) => state.fftData);
  const aliased = useSignalStore((state) => state.aliased);
  const aliasFreq = useSignalStore((state) => state.aliasFreq);
  const error = useSignalStore((state) => state.error);
  const nyquist = useSignalStore((state) => state.nyquist);
  const connected = useSignalStore((state) => state.connected);
  const quantumState = useSignalStore((state) => state.quantumState);
  const quantumMetrics = useSignalStore((state) => state.quantumMetrics);
  const quantumJobStatus = useSignalStore((state) => state.quantumJobStatus);

  const timeSeries = useMemo(
    () => buildTimeSeries(signalData, reconstructedData, freq, noiseLevel, waveType),
    [freq, noiseLevel, reconstructedData, signalData, waveType]
  );

  const spectrumSeries = useMemo(
    () => buildSpectrumSeries(fftData, freq, fs, waveType),
    [fftData, freq, fs, waveType]
  );

  const summary = useMemo(() => {
    const oversamplingRatio = fs / Math.max(freq * 2, 1);
    const nyquistHeadroom = fs - freq * 2;
    const samplingHealth = aliased ? 18 : clamp(oversamplingRatio * 44, 0, 100);
    const reconstructionHealth = clamp(
      ((error.snr || 0) / 40) * 60 + (1 - Math.min(error.mse || 0, 0.25) / 0.25) * 40,
      0,
      100
    );
    const reportedFidelity = quantumMetrics.fidelityEstimate || quantumState.fidelity || 0;
    const quantumStability = clamp(
      (reportedFidelity * 0.42 + (quantumState.purity || 0) * 0.33 + (quantumState.coherence || 0) * 0.25) * 100,
      0,
      100
    );
    const linkHealth = connected ? 100 : 18;
    const [topState, topCount] = topMeasuredState(quantumMetrics.counts);

    const posture = aliased
      ? 'Aliasing event'
      : oversamplingRatio < 1.15
        ? 'Near boundary'
        : oversamplingRatio < 1.75
          ? 'Managed margin'
          : 'Healthy margin';

    const postureNarrative = aliased
      ? `The carrier at ${formatNumber(freq, 1)} Hz has crossed the Nyquist boundary. Foldback energy is currently tracking near ${formatNumber(aliasFreq, 1)} Hz.`
      : `The signal is running at ${formatNumber(oversamplingRatio, 2)}x its Nyquist requirement, leaving ${formatNumber(Math.max(nyquistHeadroom, 0), 1)} Hz of headroom for stable reconstruction.`;

    const quantumNarrative = connected
      ? `Control link is live. Current state estimates report ${formatPercent(reportedFidelity)} fidelity, ${formatPercent(quantumState.purity || 0)} purity, and ${formatPercent(quantumState.coherence || 0)} coherence.`
      : 'The backend link is offline, so the dashboard is operating in local analysis mode and holding the last known quantum telemetry.';

    return {
      oversamplingRatio,
      nyquistHeadroom,
      samplingHealth,
      reconstructionHealth,
      quantumStability,
      linkHealth,
      posture,
      postureNarrative,
      quantumNarrative,
      reportedFidelity,
      topState,
      topCount,
    };
  }, [aliasFreq, aliased, connected, error.mse, error.snr, freq, fs, quantumMetrics.counts, quantumMetrics.fidelityEstimate, quantumState.coherence, quantumState.fidelity, quantumState.purity]);

  const waveLabel = WAVE_TYPE_LABELS[waveType] || waveType;
  const executionTone = statusTone(quantumJobStatus);

  useEffect(() => {
    let disposed = false;
    let idleHandle = null;
    let controlsTimer = null;

    const revealStage = () => {
      if (!disposed) {
        setStageReady(true);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(revealStage, { timeout: 250 });
    } else {
      idleHandle = window.setTimeout(revealStage, 80);
    }

    controlsTimer = window.setTimeout(() => {
      if (!disposed) {
        setControlsReady(true);
      }
    }, 120);

    return () => {
      disposed = true;
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle);
      } else if (idleHandle) {
        window.clearTimeout(idleHandle);
      }
      window.clearTimeout(controlsTimer);
    };
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div className="dashboard-header__copy">
            <div className="dashboard-header__eyebrow">Operations Console</div>
            <h1 className="dashboard-header__title">Quantum Signal Mission Control</h1>
            <p className="dashboard-header__subtitle">
              A restrained control surface for time-domain behavior, spectral occupancy, and quantum execution posture.
            </p>
          </div>

          <div className="dashboard-header__chips">
            <StatusChip
              icon={connected ? <FiWifi /> : <FiAlertTriangle />}
              label="Link"
              value={connected ? 'Connected' : 'Offline'}
              tone={connected ? 'good' : 'critical'}
            />
            <StatusChip
              icon={aliased ? <FiAlertTriangle /> : <FiCheckCircle />}
              label="Sampling"
              value={summary.posture}
              tone={aliased ? 'critical' : toneForScore(summary.samplingHealth)}
            />
            <StatusChip
              icon={<FiCpu />}
              label="Quantum Lane"
              value={quantumJobStatus === 'idle' ? 'Ready' : quantumJobStatus}
              tone={executionTone}
            />
          </div>
        </header>

        <div className="dashboard-grid">
          <DashboardPanel
            eyebrow="Operational Brief"
            title="Signal mission summary"
            description={summary.postureNarrative}
            className="dashboard-panel--brief"
            delay={0.05}
          >
            <div className="dashboard-stat-grid">
              <div className="dashboard-stat-card">
                <span>Carrier</span>
                <strong>{formatNumber(freq, 1)} Hz</strong>
                <small>{waveLabel} waveform</small>
              </div>
              <div className="dashboard-stat-card">
                <span>Sample Rate</span>
                <strong>{formatNumber(fs, 1)} Hz</strong>
                <small>{formatNumber(summary.oversamplingRatio, 2)}x of Nyquist</small>
              </div>
              <div className="dashboard-stat-card">
                <span>Noise Floor</span>
                <strong>{formatPercent(noiseLevel)}</strong>
                <small>{sampledData?.t?.length || 0} sample points</small>
              </div>
              <div className="dashboard-stat-card">
                <span>Alias Foldback</span>
                <strong>{aliased ? `${formatNumber(aliasFreq, 1)} Hz` : 'None'}</strong>
                <small>{aliased ? 'Critical event tracked' : 'No foldback observed'}</small>
              </div>
            </div>

            <div className="dashboard-detail-grid">
              <DetailItem label="Nyquist boundary" value={`${formatNumber(nyquist, 1)} Hz`} note={`${formatNumber(summary.nyquistHeadroom, 1)} Hz headroom`} />
              <DetailItem label="Reconstruction SNR" value={`${formatNumber(error.snr || 0, 1)} dB`} note={`MSE ${formatNumber(error.mse || 0, 4)}`} />
              <DetailItem label="Execution state" value={quantumJobStatus} note={connected ? 'Backend path available' : 'Local-only posture'} />
            </div>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="Simulation Chamber"
            title="Live 3D signal stage"
            description="The viewport has been reframed as a contained lab instrument instead of a full-screen ambient backdrop."
            aside={<span className="dashboard-panel__badge">Interactive orbit view</span>}
            className="dashboard-panel--stage"
            delay={0.1}
          >
            <div className="dashboard-stage">
              <div className="dashboard-stage__toolbar">
                <div className="dashboard-stage__meta">
                  <span>{waveLabel}</span>
                  <span>{formatNumber(freq, 1)} Hz carrier</span>
                  <span>{formatNumber(fs, 1)} Hz sampling</span>
                  <span>{formatPercent(noiseLevel)} noise</span>
                </div>
                <div className={`dashboard-stage__state dashboard-stage__state--${aliased ? 'critical' : 'stable'}`}>
                  {aliased ? 'Aliasing tracked' : 'Reconstruction stable'}
                </div>
              </div>

              <div className="dashboard-stage__viewport">
                <div className="dashboard-scene">
                  {stageReady ? (
                    <Suspense fallback={<div className="dashboard-stage__loading">Loading 3D stage...</div>}>
                      <Scene />
                    </Suspense>
                  ) : (
                    <div className="dashboard-stage__loading">Preparing 3D stage...</div>
                  )}
                </div>

                <div className="dashboard-stage__overlay dashboard-stage__overlay--top">
                  <div>
                    <span className="dashboard-stage__label">Primary view</span>
                    <strong>Signal field and sampling geometry</strong>
                  </div>
                  <div className="dashboard-stage__chips">
                    <span>Nyquist {formatNumber(nyquist, 1)} Hz</span>
                    <span>{connected ? 'Backend synced' : 'Local projection'}</span>
                  </div>
                </div>

                <div className="dashboard-stage__overlay dashboard-stage__overlay--bottom">
                  <div className="dashboard-stage__legend">
                    <span><i className="tone-source" /> Source</span>
                    <span><i className="tone-reconstruction" /> Reconstruction</span>
                    <span><i className="tone-alias" /> Alias trace</span>
                    <span><i className="tone-sample" /> Sample lattice</span>
                  </div>
                  <div className="dashboard-stage__caption">
                    Camera orbit remains available. The stage is intentionally darkened so the simulation, not the glow, does the talking.
                  </div>
                </div>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="System Posture"
            title="Health and readiness"
            description="A quick read on sampling headroom, reconstruction confidence, quantum stability, and link reliability."
            className="dashboard-panel--posture"
            delay={0.15}
          >
            <div className="dashboard-rails">
              <ProgressRail label="Sampling headroom" value={summary.samplingHealth} detail={`${formatNumber(summary.oversamplingRatio, 2)}x ratio against Nyquist`} />
              <ProgressRail label="Reconstruction confidence" value={summary.reconstructionHealth} detail={`${formatNumber(error.snr || 0, 1)} dB SNR and ${formatNumber(error.max_error || 0, 4)} max error`} />
              <ProgressRail label="Quantum stability" value={summary.quantumStability} detail={`${formatPercent(summary.reportedFidelity)} fidelity / ${formatPercent(quantumState.purity || 0)} purity`} />
              <ProgressRail label="Link reliability" value={summary.linkHealth} detail={connected ? 'WebSocket control link is active' : 'Awaiting backend reconnection'} />
            </div>

            <div className="dashboard-inline-note">
              {summary.quantumNarrative}
            </div>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="Time Domain"
            title="Source vs reconstruction"
            description={`Showing ${timeSeries.sourceLabel.toLowerCase()} for the current operating point.`}
            className="dashboard-panel--time"
            delay={0.2}
          >
            <div className="dashboard-chart">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeSeries.points}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickFormatter={(value) => `${formatNumber(value, 0)} ms`} minTickGap={28} />
                  <YAxis domain={[-1.4, 1.4]} tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatNumber(value, 4),
                      name === 'source' ? 'Source' : 'Reconstruction',
                    ]}
                    labelFormatter={(value) => `${formatNumber(value, 2)} ms`}
                    contentStyle={{
                      background: 'rgba(12, 18, 30, 0.96)',
                      border: '1px solid rgba(120, 170, 255, 0.18)',
                      borderRadius: 12,
                    }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
                  <Line type="monotone" dataKey="source" stroke="#8fd1ff" strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="reconstruction" stroke="#7df3cd" strokeWidth={2.6} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="dashboard-chart__footer">
              <span>{timeSeries.sourceLabel}</span>
              <span>{signalData?.t?.length || MAX_TIME_POINTS} rendered points</span>
            </div>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="Frequency Domain"
            title="Spectral occupancy"
            description={`Dominant spectral bands within the current ${formatNumber(fs / 2, 1)} Hz observable half-band.`}
            className="dashboard-panel--spectrum"
            delay={0.25}
          >
            <div className="dashboard-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={spectrumSeries.points} margin={{ top: 8, right: 8, bottom: 18, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="band" tickFormatter={(value) => `${value} Hz`} minTickGap={18} />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatNumber(value, 3),
                      name === 'source' ? 'Source FFT' : 'Sampled FFT',
                    ]}
                    labelFormatter={(value) => `${value} Hz`}
                    contentStyle={{
                      background: 'rgba(12, 18, 30, 0.96)',
                      border: '1px solid rgba(120, 170, 255, 0.18)',
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="source" fill="#7aa8ff" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sampled" fill="#5dd0ae" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="dashboard-chart__footer">
              <span>{spectrumSeries.sourceLabel}</span>
              <span>Nyquist boundary at {formatNumber(nyquist, 1)} Hz</span>
            </div>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="Quantum Lane"
            title="Execution and state telemetry"
            description="A concise readout of the current quantum lane without dropping into the dedicated Quantum Lab."
            className="dashboard-panel--quantum"
            delay={0.3}
          >
            <div className="dashboard-quantum-grid">
              <div className="dashboard-quantum-card">
                <span>Job status</span>
                <strong className={`tone-${executionTone}`}>{quantumJobStatus}</strong>
                <small>{connected ? 'Remote execution path available' : 'Holding in local mode'}</small>
              </div>
              <div className="dashboard-quantum-card">
                <span>Dominant state</span>
                <strong>{summary.topState ? `|${summary.topState}>` : '|0>'}</strong>
                <small>{summary.topCount ? `${summary.topCount} counts recorded` : 'No completed run yet'}</small>
              </div>
              <div className="dashboard-quantum-card">
                <span>Circuit depth</span>
                <strong>{quantumMetrics.circuitDepth || 0}</strong>
                <small>{quantumMetrics.gateCount || 0} gates in last execution</small>
              </div>
              <div className="dashboard-quantum-card">
                <span>Backend</span>
                <strong>{quantumMetrics.backendName || 'local preview'}</strong>
                <small>{quantumMetrics.executionTime || 0} ms last execution time</small>
              </div>
            </div>

            <div className="dashboard-bloch-grid">
              <div className="dashboard-bloch-axis">
                <span>X projection</span>
                <strong>{formatNumber(quantumState.bloch?.x || 0, 3)}</strong>
              </div>
              <div className="dashboard-bloch-axis">
                <span>Y projection</span>
                <strong>{formatNumber(quantumState.bloch?.y || 0, 3)}</strong>
              </div>
              <div className="dashboard-bloch-axis">
                <span>Z projection</span>
                <strong>{formatNumber(quantumState.bloch?.z || 1, 3)}</strong>
              </div>
            </div>
          </DashboardPanel>
        </div>

        {controlsReady ? (
          <>
            <Leva
              store={controlStore}
              collapsed={false}
              oneLineLabels={false}
              flat={false}
              theme={{
                sizes: { rootWidth: '320px', controlWidth: '150px' },
                colors: {
                  elevation1: 'rgba(12, 16, 24, 0.96)',
                  elevation2: 'rgba(16, 22, 32, 0.98)',
                  elevation3: 'rgba(20, 27, 40, 0.98)',
                  accent1: '#89c6ff',
                  accent2: '#63d1b6',
                  accent3: '#9ab0d0',
                  highlight1: '#f4f7fb',
                  highlight2: 'rgba(220, 228, 238, 0.72)',
                  highlight3: 'rgba(158, 171, 190, 0.5)',
                },
                fontSizes: { root: '11px' },
                fonts: {
                  mono: "'JetBrains Mono', 'Fira Code', monospace",
                  body: "'Outfit', sans-serif",
                },
              }}
            />

            <Suspense fallback={null}>
              <ControlPanel store={controlStore} sendParams={sendParams} submitQuantumJob={submitQuantumJob} />
              <AIExplanation />
            </Suspense>
          </>
        ) : null}
      </div>
    </div>
  );
}
