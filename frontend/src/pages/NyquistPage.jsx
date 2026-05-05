import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion as Motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import QuantumSlider from '../components/ui/QuantumSlider';
import QuantumSelect from '../components/ui/QuantumSelect';
import BlochSphere from '../components/BlochSphere';
import './NyquistPage.css';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function waveformValue(waveType, freq, t) {
  const phase = 2 * Math.PI * freq * t;
  switch (waveType) {
    case 'square':
      return Math.sign(Math.sin(phase)) || 1;
    case 'sawtooth':
      return 2 * ((freq * t) % 1) - 1;
    case 'triangle':
      return 4 * Math.abs((freq * t) % 1 - 0.5) - 1;
    default:
      return Math.sin(phase);
  }
}

function sinc(value) {
  if (Math.abs(value) < 1e-8) return 1;
  return Math.sin(Math.PI * value) / (Math.PI * value);
}

export default function NyquistPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const freq = parseNumber(searchParams.get('freq'), 5, 1, 50);
  const sampleRate = parseNumber(searchParams.get('sampleRate'), 20, 2, 100);
  const waveType = ['sine', 'square', 'sawtooth', 'triangle'].includes(searchParams.get('waveType'))
    ? searchParams.get('waveType')
    : 'sine';

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(patch).forEach(([key, value]) => {
      next.set(key, String(value));
    });

    setSearchParams(next, { replace: true });
  };

  const nyquist = sampleRate / 2;
  const isAliased = freq > nyquist;
  const aliasFreq = isAliased ? Math.abs(freq - sampleRate * Math.round(freq / sampleRate)) : null;
  const ratio = (sampleRate / (2 * freq)).toFixed(2);

  const continuousData = useMemo(() => {
    const points = [];
    const duration = 1;
    const numPoints = 480;

    for (let i = 0; i <= numPoints; i += 1) {
      const t = (i / numPoints) * duration;
      points.push({
        t: Number(t.toFixed(4)),
        original: waveformValue(waveType, freq, t),
      });
    }

    return points;
  }, [freq, waveType]);

  const sampledPoints = useMemo(() => {
    const points = [];
    const duration = 1;
    const numSamples = Math.floor(sampleRate * duration);

    for (let i = 0; i <= numSamples; i += 1) {
      const t = i / sampleRate;
      if (t > duration) break;
      points.push({
        t: Number(t.toFixed(4)),
        sample: waveformValue(waveType, freq, t),
      });
    }

    return points;
  }, [freq, sampleRate, waveType]);

  const reconstructedData = useMemo(() => {
    const duration = 1;
    const numPoints = 480;

    return Array.from({ length: numPoints + 1 }, (_, index) => {
      const t = (index / numPoints) * duration;
      const reconstructed = sampledPoints.reduce(
        (sum, point) => sum + point.sample * sinc(sampleRate * (t - point.t)),
        0
      );

      return {
        t: Number(t.toFixed(4)),
        reconstructed,
      };
    });
  }, [sampleRate, sampledPoints]);

  const aliasData = useMemo(() => {
    if (!isAliased || !aliasFreq) return [];

    const duration = 1;
    const numPoints = 480;
    return Array.from({ length: numPoints + 1 }, (_, index) => {
      const t = (index / numPoints) * duration;
      return {
        t: Number(t.toFixed(4)),
        alias: Math.sin(2 * Math.PI * aliasFreq * t),
      };
    });
  }, [aliasFreq, isAliased]);

  const mergedData = useMemo(() => {
    return continuousData.map((point, index) => ({
      ...point,
      reconstructed: reconstructedData[index]?.reconstructed ?? null,
      alias: aliasData[index]?.alias ?? null,
    }));
  }, [aliasData, continuousData, reconstructedData]);

  const spectrumData = useMemo(() => {
    const N = sampledPoints.length;
    if (!N) return [];

    const bins = [];
    const maxBin = Math.floor(N / 2);

    for (let k = 0; k <= maxBin; k += 1) {
      let real = 0;
      let imag = 0;

      sampledPoints.forEach((point, n) => {
        const angle = (2 * Math.PI * k * n) / N;
        real += point.sample * Math.cos(angle);
        imag -= point.sample * Math.sin(angle);
      });

      bins.push({
        freq: Number(((k * sampleRate) / N).toFixed(2)),
        magnitude: Number((Math.sqrt(real ** 2 + imag ** 2) / N).toFixed(4)),
      });
    }

    return bins;
  }, [sampleRate, sampledPoints]);

  return (
    <div className="nyquist-page">
      <div className="nyquist-page__header">
        <div>
          <h1 className="page-title">Nyquist Explorer</h1>
          <p className="page-subtitle">
            Interactive sampling theorem visualizer with shareable URL state and client-side sinc reconstruction.
          </p>
        </div>
      </div>

      <div className="nyquist-grid">
        <div className="nyquist-controls-col">
          <GlassCard title="Parameters" icon="T">
            <div className="nyquist-controls">
              <QuantumSlider
                label="Signal Frequency"
                value={freq}
                onChange={(value) => updateParams({ freq: value })}
                min={1}
                max={50}
                step={0.5}
                unit="Hz"
                color="var(--neon-cyan)"
              />
              <QuantumSlider
                label="Sample Rate"
                value={sampleRate}
                onChange={(value) => updateParams({ sampleRate: value })}
                min={2}
                max={100}
                step={1}
                unit="Hz"
                color="var(--neon-purple)"
              />
              <QuantumSelect
                label="Wave Type"
                value={waveType}
                onChange={(value) => updateParams({ waveType: value })}
                options={['sine', 'square', 'sawtooth', 'triangle']}
                hint="This route persists its state in the URL so scenarios can be shared."
              />
            </div>
          </GlassCard>

          <GlassCard title="Key Metrics" icon="O">
            <div className="nyquist-metrics">
              <div className="nm-item">
                <span className="nm-label">Signal Freq</span>
                <span className="nm-value">{freq} Hz</span>
              </div>
              <div className="nm-item">
                <span className="nm-label">Sample Rate</span>
                <span className="nm-value" style={{ color: 'var(--neon-purple)' }}>{sampleRate} Hz</span>
              </div>
              <div className="nm-item">
                <span className="nm-label">Nyquist Freq</span>
                <span className="nm-value" style={{ color: isAliased ? 'var(--neon-red)' : 'var(--neon-green)' }}>{nyquist} Hz</span>
              </div>
              <div className="nm-item">
                <span className="nm-label">Ratio (Fs/2f)</span>
                <span className={`nm-value ${parseFloat(ratio) >= 1 ? 'nm-good' : 'nm-bad'}`}>{ratio}x</span>
              </div>
              {isAliased && aliasFreq != null ? (
                <div className="nm-item nm-item--alert">
                  <span className="nm-label">Alias Freq</span>
                  <span className="nm-value nm-bad">{aliasFreq.toFixed(1)} Hz</span>
                </div>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard title="The Nyquist-Shannon Theorem" icon="i" variant="purple" className="education-card">
            <div className="education-content">
              <p className="education-quote">
                A signal can be reconstructed from its samples if the sampling rate is at least twice the highest
                frequency present in the signal.
              </p>
              <div className="education-formula">
                f<sub>s</sub> &gt;= 2 x f<sub>max</sub>
              </div>
              <div className="education-sections">
                <div className="edu-section">
                  <h4>When Satisfied</h4>
                  <p>The reconstructed line tracks the source because the sample lattice still preserves enough information.</p>
                </div>
                <div className="edu-section">
                  <h4>When Violated</h4>
                  <p>High-frequency content folds into a lower phantom tone called an alias, and the reconstruction becomes misleading.</p>
                </div>
                <div className="edu-section">
                  <h4>Alias Frequency</h4>
                  <p>f_alias = |f - n x f_s| where n is the nearest integer multiple of the sampling rate.</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="nyquist-viz-col">
          <Motion.div className={`nyquist-status-banner ${isAliased ? 'aliased' : 'satisfied'}`} layout>
            {isAliased ? (
              <>
                <span className="nsb-icon">!</span>
                <span>
                  ALIASING: Signal {freq} Hz exceeds Nyquist {nyquist} Hz, so the sampler now presents a {aliasFreq?.toFixed(1)} Hz ghost.
                </span>
              </>
            ) : (
              <>
                <span className="nsb-icon">o</span>
                <span>
                  NYQUIST SATISFIED: Signal {freq} Hz remains below Nyquist {nyquist} Hz, so sinc reconstruction can track the source.
                </span>
              </>
            )}
          </Motion.div>

          <GlassCard title="Signal, Reconstruction, and Samples" icon="~" className="nyquist-chart-card">
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={mergedData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tick={{ fontSize: 9 }}
                  tickFormatter={(value) => `${value}s`}
                  label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5, fill: 'rgba(200,210,230,0.4)', fontSize: 10 }}
                />
                <YAxis domain={[-1.5, 1.5]} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ background: 'rgba(13, 19, 27, 0.96)', border: '1px solid rgba(143, 169, 191, 0.16)', borderRadius: 12, fontSize: 11 }} />
                <Line dataKey="original" stroke="#d6bf9e" strokeWidth={2} dot={false} name="Original" />
                <Line dataKey="reconstructed" stroke="#8fa9bf" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Reconstruction" />
                {isAliased ? (
                  <Line dataKey="alias" stroke="#c8796c" strokeWidth={1.6} dot={false} strokeDasharray="3 3" name="Alias" />
                ) : null}
                <Line
                  data={sampledPoints}
                  type="monotone"
                  dataKey="sample"
                  stroke="transparent"
                  dot={{ fill: '#79a595', stroke: '#79a595', r: 4 }}
                  name="Samples"
                />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard title="Frequency Spectrum" icon="f" variant={isAliased ? 'danger' : 'default'} className="nyquist-chart-card">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={spectrumData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradSpectrum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8fa9bf" stopOpacity={0.36} />
                    <stop offset="100%" stopColor="#8fa9bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="freq"
                  tick={{ fontSize: 9 }}
                  label={{ value: 'Frequency (Hz)', position: 'insideBottomRight', offset: -5, fill: 'rgba(200,210,230,0.4)', fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 9 }} />
                <ReferenceLine x={nyquist} stroke="#c8796c" strokeDasharray="4 4" label={{ value: `Nyquist (${nyquist} Hz)`, fill: '#c8796c', fontSize: 9, position: 'top' }} />
                {isAliased ? (
                  <ReferenceArea x1={nyquist} x2={sampleRate} fill="rgba(200,121,108,0.08)" label={{ value: 'Alias zone', fill: 'rgba(200,121,108,0.44)', fontSize: 9 }} />
                ) : null}
                <Tooltip contentStyle={{ background: 'rgba(13, 19, 27, 0.96)', border: '1px solid rgba(143, 169, 191, 0.16)', borderRadius: 12, fontSize: 11 }} />
                <Area type="monotone" dataKey="magnitude" stroke="#8fa9bf" fill="url(#gradSpectrum)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard title="Bloch Sphere Simulator" icon="Q" variant="purple" className="nyquist-chart-card">
            <BlochSphere />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
