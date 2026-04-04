import { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiActivity, FiCheckCircle, FiDownload, FiLayers, FiTarget, FiTrendingUp, FiZap } from 'react-icons/fi';
import GlassCard from '../components/ui/GlassCard';
import QuantumSelect from '../components/ui/QuantumSelect';
import QuantumSlider from '../components/ui/QuantumSlider';
import QuantumButton from '../components/ui/QuantumButton';
import useSignalStore from '../store/useSignalStore';
import signalLabVideo from '../assets/signal-lab-background.mp4';
import './SignalLabPage.css';

const QUICK_SCENARIOS = [
  {
    id: 'clean-capture',
    label: 'Clean Capture',
    summary: 'Comfortable headroom with minimal distortion risk.',
    params: { freq: 80, fs: 360, noise_level: 0.02, wave_type: 'sine' },
  },
  {
    id: 'edge-window',
    label: 'Edge Window',
    summary: 'Operates close to Nyquist so you can study margin behavior.',
    params: { freq: 140, fs: 300, noise_level: 0.05, wave_type: 'triangle' },
  },
  {
    id: 'alias-stress',
    label: 'Alias Stress',
    summary: 'Intentionally folds the carrier below Nyquist to expose alias posture.',
    params: { freq: 240, fs: 300, noise_level: 0.08, wave_type: 'sawtooth' },
  },
  {
    id: 'noisy-recovery',
    label: 'Noisy Recovery',
    summary: 'Tests reconstruction quality under elevated noise.',
    params: { freq: 110, fs: 420, noise_level: 0.22, wave_type: 'square' },
  },
];

const TOOLTIP_STYLE = {
  background: 'rgba(13, 19, 27, 0.96)',
  border: '1px solid rgba(143, 169, 191, 0.16)',
  borderRadius: 12,
  fontSize: 11,
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

function samplingTone(ratio, aliased) {
  if (aliased || ratio < 1) return 'critical';
  if (ratio < 1.35) return 'warning';
  return 'good';
}

function recommendationList({ aliased, oversamplingRatio, snr, mse, noiseLevel }) {
  const notes = [];

  if (aliased || oversamplingRatio < 1) {
    notes.push('Raise the sampling rate above 2x the carrier before trusting downstream measurements.');
  } else if (oversamplingRatio < 1.35) {
    notes.push('You are near the Nyquist boundary. Increase headroom if this configuration will be reused in production.');
  } else {
    notes.push('Sampling margin is healthy. This operating point is suitable for stable comparative analysis.');
  }

  if ((snr || 0) < 15 || noiseLevel > 0.18) {
    notes.push('Noise is materially affecting reconstruction quality. Reduce noise or widen the margin before benchmarking.');
  }

  if ((mse || 0) > 0.05) {
    notes.push('Mean square error is elevated. Inspect the sample lattice and FFT card together to isolate the cause.');
  }

  if (!notes.length) {
    notes.push('No corrective action recommended. The current signal posture is within a credible operating envelope.');
  }

  return notes.slice(0, 3);
}

function HealthRail({ label, value, detail, tone }) {
  return (
    <div className="signal-health-rail">
      <div className="signal-health-rail__head">
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <div className="signal-health-rail__track">
        <div className={`signal-health-rail__fill tone-${tone}`} style={{ width: `${value}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}

function SummaryCard({ label, value, note, tone = 'default' }) {
  return (
    <div className={`signal-summary-card signal-summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function SignalLabPage({ sendParams }) {
  const signalData = useSignalStore((state) => state.signalData);
  const sampledData = useSignalStore((state) => state.sampledData);
  const reconstructedData = useSignalStore((state) => state.reconstructedData);
  const fftData = useSignalStore((state) => state.fftData);
  const error = useSignalStore((state) => state.error);
  const aliased = useSignalStore((state) => state.aliased);
  const aliasFreq = useSignalStore((state) => state.aliasFreq);
  const freq = useSignalStore((state) => state.freq);
  const fs = useSignalStore((state) => state.fs);
  const nyquist = useSignalStore((state) => state.nyquist);
  const noiseLevel = useSignalStore((state) => state.noiseLevel);
  const waveType = useSignalStore((state) => state.waveType);
  const connected = useSignalStore((state) => state.connected);
  const setParams = useSignalStore((state) => state.setParams);

  const handleParamChange = (key, value) => {
    const next = {
      freq: key === 'freq' ? value : freq,
      fs: key === 'fs' ? value : fs,
      noise_level: key === 'noise_level' ? value : noiseLevel,
      wave_type: key === 'wave_type' ? value : waveType,
    };

    setParams({
      freq: next.freq,
      fs: next.fs,
      noiseLevel: next.noise_level,
      waveType: next.wave_type,
    });

    sendParams?.(next);
  };

  const applyScenario = (scenario) => {
    setParams({
      freq: scenario.params.freq,
      fs: scenario.params.fs,
      noiseLevel: scenario.params.noise_level,
      waveType: scenario.params.wave_type,
    });
    sendParams?.(scenario.params);
  };

  const exportRows = useMemo(() => {
    const rowCount = Math.max(signalData.t?.length || 0, sampledData.t?.length || 0);
    return Array.from({ length: rowCount }, (_, index) => ({
      signal_t: signalData.t?.[index] ?? '',
      signal_y: signalData.y?.[index] ?? '',
      reconstructed_y: reconstructedData.y?.[index] ?? '',
      sampled_t: sampledData.t?.[index] ?? '',
      sampled_y: sampledData.y?.[index] ?? '',
    }));
  }, [reconstructedData.y, sampledData.t, sampledData.y, signalData.t, signalData.y]);

  const exportCsv = () => {
    const header = ['signal_t', 'signal_y', 'reconstructed_y', 'sampled_t', 'sampled_y'];
    const csv = [
      header.join(','),
      ...exportRows.map((row) =>
        header.map((key) => row[key]).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `signal-lab-${waveType}-${freq}hz-${fs}fs.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const timeDomainData = useMemo(() => {
    if (!signalData.t?.length) return [];

    const step = Math.max(1, Math.floor(signalData.t.length / 320));
    const rows = [];

    for (let index = 0; index < signalData.t.length; index += step) {
      rows.push({
        t: Number(signalData.t[index].toFixed(5)),
        original: signalData.y[index],
        reconstructed: reconstructedData.y?.[index] ?? null,
      });
    }

    return rows;
  }, [reconstructedData.y, signalData.t, signalData.y]);

  const sampledChartData = useMemo(() => {
    if (!sampledData.t?.length) return [];

    return sampledData.t.map((value, index) => ({
      t: Number(value.toFixed(5)),
      sample: sampledData.y[index],
    }));
  }, [sampledData.t, sampledData.y]);

  const fftChartData = useMemo(() => {
    const magnitudes = fftData?.sampled?.magnitude || [];
    const frequencies = fftData?.sampled?.freq || [];

    if (!magnitudes.length) return [];

    const step = Math.max(1, Math.floor(magnitudes.length / 80));
    const rows = [];

    for (let index = 0; index < magnitudes.length; index += step) {
      rows.push({
        freq: Number((frequencies[index] || 0).toFixed(1)),
        magnitude: magnitudes[index],
      });
    }

    return rows;
  }, [fftData]);

  const summary = useMemo(() => {
    const oversamplingRatio = fs / Math.max(freq * 2, 1);
    const marginHz = fs - freq * 2;
    const samplingScore = clamp(oversamplingRatio * 48, 0, 100);
    const reconstructionScore = clamp(
      ((error.snr || 0) / 40) * 60 + (1 - Math.min(error.mse || 0, 0.25) / 0.25) * 40,
      0,
      100
    );
    const transportScore = connected ? 100 : 18;
    const tone = samplingTone(oversamplingRatio, aliased);
    const posture = aliased
      ? `Aliasing is active. The folded component is appearing near ${formatNumber(aliasFreq, 1)} Hz.`
      : `The carrier is running at ${formatNumber(oversamplingRatio, 2)}x its Nyquist requirement with ${formatNumber(Math.max(marginHz, 0), 1)} Hz of margin.`;

    return {
      oversamplingRatio,
      marginHz,
      samplingScore,
      reconstructionScore,
      transportScore,
      tone,
      posture,
      recommendations: recommendationList({
        aliased,
        oversamplingRatio,
        snr: error.snr,
        mse: error.mse,
        noiseLevel,
      }),
    };
  }, [aliasFreq, aliased, connected, error.mse, error.snr, freq, fs, noiseLevel]);

  return (
    <div className="signal-lab-page">
      <div className="signal-lab-page__video-wrap" aria-hidden="true">
        <video className="signal-lab-page__video" autoPlay loop muted playsInline preload="metadata">
          <source src={signalLabVideo} type="video/mp4" />
        </video>
        <div className="signal-lab-page__scrim" />
        <div className="signal-lab-page__vignette" />
        <div className="signal-lab-page__grid" />
      </div>

      <div className="signal-lab-page__content">
      <section className="signal-lab-page__header">
        <div>
          <div className="signal-lab-page__eyebrow">Signal acquisition surface</div>
          <h1 className="page-title">Signal Lab</h1>
          <p className="page-subtitle">
            A more disciplined analysis workspace for tuning the operating point, stress-testing Nyquist margin,
            and reading reconstruction quality without jumping between views.
          </p>
        </div>

        <div className="signal-lab-page__stats">
          <QuantumButton variant="cyan" size="sm" icon={<FiDownload />} onClick={exportCsv}>
            Export CSV
          </QuantumButton>
          <div className={`signal-stat-chip signal-stat-chip--${summary.tone}`}>
            <FiTarget />
            {aliased ? `Alias at ${formatNumber(aliasFreq, 1)} Hz` : `${formatNumber(summary.oversamplingRatio, 2)}x Nyquist`}
          </div>
          <div className="signal-stat-chip">
            <FiTrendingUp />
            SNR {formatNumber(error.snr || 0, 1)} dB
          </div>
          <div className="signal-stat-chip">
            <FiLayers />
            MSE {formatNumber(error.mse || 0, 4)}
          </div>
          <div className={`signal-stat-chip signal-stat-chip--${connected ? 'good' : 'critical'}`}>
            <FiZap />
            {connected ? 'Realtime link active' : 'Offline posture'}
          </div>
        </div>
      </section>

      <section className="signal-lab-brief-grid">
        <GlassCard title="Operational Brief" icon={<FiActivity />} className="signal-lab-card">
          <div className="signal-brief">
            <p>{summary.posture}</p>

            <div className="signal-summary-grid">
              <SummaryCard
                label="Carrier"
                value={`${formatNumber(freq, 1)} Hz`}
                note={`${waveType} waveform`}
              />
              <SummaryCard
                label="Sample Rate"
                value={`${formatNumber(fs, 1)} Hz`}
                note={`${formatNumber(summary.marginHz, 1)} Hz margin`}
                tone={summary.tone}
              />
              <SummaryCard
                label="Noise Profile"
                value={formatPercent(noiseLevel)}
                note={`${sampledData.t?.length || 0} sample points`}
              />
              <SummaryCard
                label="Reconstruction"
                value={`${formatNumber(error.snr || 0, 1)} dB`}
                note={`max error ${formatNumber(error.max_error || 0, 4)}`}
                tone={(error.snr || 0) >= 15 ? 'good' : 'warning'}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Quick Scenarios" icon={<FiCheckCircle />} variant="purple" className="signal-lab-card">
          <div className="signal-scenarios">
            {QUICK_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className="signal-scenario"
                onClick={() => applyScenario(scenario)}
              >
                <strong>{scenario.label}</strong>
                <span>{scenario.summary}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      </section>

      <GlassCard title="Signal Controls" icon={<FiLayers />} className="signal-lab-controls">
        <div className="signal-lab-controls__grid">
          <QuantumSlider
            label="Frequency"
            value={freq}
            onChange={(value) => handleParamChange('freq', value)}
            min={1}
            max={500}
            step={1}
            unit="Hz"
            color="var(--neon-cyan)"
          />
          <QuantumSlider
            label="Sample Rate"
            value={fs}
            onChange={(value) => handleParamChange('fs', value)}
            min={10}
            max={1000}
            step={5}
            unit="Hz"
            color="var(--neon-blue)"
          />
          <QuantumSlider
            label="Noise Level"
            value={noiseLevel}
            onChange={(value) => handleParamChange('noise_level', value)}
            min={0}
            max={1}
            step={0.01}
            color="var(--neon-amber)"
          />
          <QuantumSelect
            label="Wave Type"
            value={waveType}
            onChange={(value) => handleParamChange('wave_type', value)}
            options={['sine', 'square', 'sawtooth', 'triangle']}
            color="var(--neon-purple)"
          />
        </div>
      </GlassCard>

      <section className="signal-lab-insight-grid">
        <GlassCard title="Acquisition Posture" icon={<FiTarget />} className="signal-lab-card">
          <div className="signal-health-rails">
            <HealthRail
              label="Sampling margin"
              value={summary.samplingScore}
              detail={`${formatNumber(summary.oversamplingRatio, 2)}x against Nyquist`}
              tone={summary.tone}
            />
            <HealthRail
              label="Reconstruction confidence"
              value={summary.reconstructionScore}
              detail={`${formatNumber(error.snr || 0, 1)} dB SNR and MSE ${formatNumber(error.mse || 0, 4)}`}
              tone={(error.snr || 0) >= 18 ? 'good' : (error.snr || 0) >= 10 ? 'warning' : 'critical'}
            />
            <HealthRail
              label="Transport health"
              value={summary.transportScore}
              detail={connected ? 'WebSocket telemetry is active' : 'Awaiting backend connectivity'}
              tone={connected ? 'good' : 'critical'}
            />
          </div>
        </GlassCard>

        <GlassCard title="Operator Recommendations" icon={<FiZap />} variant="purple" className="signal-lab-card">
          <div className="signal-recommendations">
            {summary.recommendations.map((item, index) => (
              <Motion.div
                key={`${item}-${index}`}
                className="signal-recommendation"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                <span>{index + 1}</span>
                <p>{item}</p>
              </Motion.div>
            ))}
          </div>
        </GlassCard>
      </section>

      <div className="signal-lab-charts">
        <GlassCard title="Time-Domain Reconstruction" icon={<FiActivity />} className="chart-card chart-card--wide">
          <div className="chart-card__intro">
            <p>Overlaying source and reconstructed traces so amplitude loss and phase drift are visible immediately.</p>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={timeDomainData} margin={{ top: 8, right: 12, bottom: 6, left: -10 }}>
              <defs>
                <linearGradient id="signalOriginalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d6bf9e" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#d6bf9e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="signalReconGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8fa9bf" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#8fa9bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={(value) => `${formatNumber(value * 1000, 1)} ms`} minTickGap={28} />
              <YAxis tickFormatter={(value) => formatNumber(value, 1)} domain={[-1.5, 1.5]} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(value) => `${formatNumber(value * 1000, 2)} ms`}
              />
              <Legend />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
              <Area
                type="monotone"
                dataKey="original"
                stroke="#d6bf9e"
                fill="url(#signalOriginalGradient)"
                strokeWidth={2}
                dot={false}
                name="Source"
              />
              <Area
                type="monotone"
                dataKey="reconstructed"
                stroke="#8fa9bf"
                fill="url(#signalReconGradient)"
                strokeWidth={1.8}
                dot={false}
                name="Reconstruction"
                strokeDasharray="5 3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard
          title="Frequency-Domain Occupancy"
          icon={<FiTrendingUp />}
          variant={aliased ? 'danger' : 'default'}
          className="chart-card"
        >
          <div className="chart-card__intro">
            <p>Dominant sampled bands with the Nyquist line kept visible as the critical boundary.</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={fftChartData} margin={{ top: 8, right: 10, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="freq" tickFormatter={(value) => `${formatNumber(value, 0)} Hz`} minTickGap={18} />
              <YAxis tickFormatter={(value) => formatNumber(value, 2)} />
              {nyquist ? (
                <ReferenceLine
                  x={nyquist}
                  stroke="#c8796c"
                  strokeDasharray="4 4"
                  label={{ value: 'Nyquist', fill: '#c8796c', fontSize: 10 }}
                />
              ) : null}
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(value) => `${value} Hz`} />
              <Bar
                dataKey="magnitude"
                fill={aliased ? '#c8796c' : '#8b808a'}
                radius={[6, 6, 0, 0]}
                opacity={0.88}
              />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard title="Sample Lattice" icon={<FiLayers />} className="chart-card">
          <div className="chart-card__intro">
            <p>Discrete capture points reveal whether the reconstruction is being supported by enough temporal coverage.</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={sampledChartData} margin={{ top: 8, right: 10, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={(value) => `${formatNumber(value * 1000, 1)} ms`} minTickGap={28} />
              <YAxis tickFormatter={(value) => formatNumber(value, 1)} domain={[-1.5, 1.5]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(value) => `${formatNumber(value * 1000, 2)} ms`} />
              <Line
                type="monotone"
                dataKey="sample"
                stroke="#79a595"
                strokeWidth={0}
                dot={{ fill: '#79a595', r: 4, stroke: '#79a595', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#79a595', stroke: '#fff' }}
                name="Samples"
              />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard
          title="Quality Readout"
          icon={<FiCheckCircle />}
          variant={(error.snr || 0) >= 15 ? 'success' : 'danger'}
          className="chart-card"
        >
          <div className="signal-quality-grid">
            <div className="signal-quality-card">
              <span>SNR</span>
              <strong>{formatNumber(error.snr || 0, 1)} dB</strong>
              <small>{(error.snr || 0) >= 20 ? 'Strong reconstruction clarity' : 'Monitor noise and headroom'}</small>
            </div>
            <div className="signal-quality-card">
              <span>MSE</span>
              <strong>{formatNumber(error.mse || 0, 4)}</strong>
              <small>{(error.mse || 0) <= 0.01 ? 'Low deviation from source' : 'Deviation is becoming visible'}</small>
            </div>
            <div className="signal-quality-card">
              <span>Nyquist</span>
              <strong>{formatNumber(nyquist || fs / 2, 1)} Hz</strong>
              <small>{formatNumber(summary.marginHz, 1)} Hz margin remaining</small>
            </div>
            <div className="signal-quality-card">
              <span>Status</span>
              <strong>{aliased ? 'Aliased' : 'Stable'}</strong>
              <small>{aliased ? 'Foldback is now influencing observed output' : 'No alias foldback detected'}</small>
            </div>
          </div>
        </GlassCard>
      </div>
      </div>
    </div>
  );
}
