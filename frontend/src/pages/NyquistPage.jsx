import { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import { motion } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import QuantumSlider from '../components/ui/QuantumSlider';
import QuantumSelect from '../components/ui/QuantumSelect';
import './NyquistPage.css';

/**
 * Nyquist Explorer — Interactive educational page about sampling theorem.
 * Generates its own signals client-side for instant feedback.
 */
export default function NyquistPage() {
  const [freq, setFreq] = useState(5);
  const [sampleRate, setSampleRate] = useState(20);
  const [waveType, setWaveType] = useState('sine');

  const nyquist = sampleRate / 2;
  const isAliased = freq > nyquist;
  const aliasFreq = isAliased ? Math.abs(freq - sampleRate * Math.round(freq / sampleRate)) : null;
  const ratio = (sampleRate / (2 * freq)).toFixed(2);

  // Generate continuous signal
  const continuousData = useMemo(() => {
    const points = [];
    const duration = 1;
    const numPoints = 500;
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * duration;
      let y = 0;
      switch (waveType) {
        case 'sine': y = Math.sin(2 * Math.PI * freq * t); break;
        case 'square': y = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
        case 'sawtooth': y = 2 * ((freq * t) % 1) - 1; break;
        case 'triangle': y = 4 * Math.abs((freq * t) % 1 - 0.5) - 1; break;
      }
      points.push({ t: parseFloat(t.toFixed(4)), original: y });
    }
    return points;
  }, [freq, waveType]);

  // Generate sampled points
  const sampledPoints = useMemo(() => {
    const points = [];
    const duration = 1;
    const numSamples = Math.floor(sampleRate * duration);
    for (let i = 0; i <= numSamples; i++) {
      const t = i / sampleRate;
      if (t > duration) break;
      let y = 0;
      switch (waveType) {
        case 'sine': y = Math.sin(2 * Math.PI * freq * t); break;
        case 'square': y = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
        case 'sawtooth': y = 2 * ((freq * t) % 1) - 1; break;
        case 'triangle': y = 4 * Math.abs((freq * t) % 1 - 0.5) - 1; break;
      }
      points.push({ t: parseFloat(t.toFixed(4)), sample: y });
    }
    return points;
  }, [freq, sampleRate, waveType]);

  // Generate alias signal
  const aliasData = useMemo(() => {
    if (!isAliased || !aliasFreq) return [];
    const points = [];
    const duration = 1;
    const numPoints = 500;
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * duration;
      const y = Math.sin(2 * Math.PI * aliasFreq * t);
      points.push({ t: parseFloat(t.toFixed(4)), alias: y });
    }
    return points;
  }, [isAliased, aliasFreq]);

  // Merged data for overlay chart
  const mergedData = useMemo(() => {
    return continuousData.map((point) => {
      const aliasPoint = aliasData.find((a) => Math.abs(a.t - point.t) < 0.002);
      return {
        ...point,
        alias: aliasPoint?.alias ?? null,
      };
    });
  }, [continuousData, aliasData]);

  // Frequency spectrum (simple)
  const spectrumData = useMemo(() => {
    const maxFreq = sampleRate;
    const points = [];
    for (let f = 0; f <= maxFreq; f += 0.5) {
      let magnitude = 0;
      // Primary frequency
      if (Math.abs(f - freq) < 1) magnitude = 1;
      // Alias frequency
      if (aliasFreq && Math.abs(f - aliasFreq) < 1) magnitude = 0.8;
      points.push({ freq: f, magnitude });
    }
    return points;
  }, [freq, sampleRate, aliasFreq]);

  return (
    <div className="nyquist-page">
      {/* Header */}
      <div className="nyquist-page__header">
        <div>
          <h1 className="page-title">Nyquist Explorer</h1>
          <p className="page-subtitle">Interactive Sampling Theorem Visualizer</p>
        </div>
      </div>

      <div className="nyquist-grid">
        {/* Left — Controls + Education */}
        <div className="nyquist-controls-col">
          <GlassCard title="PARAMETERS" icon="⚙">
            <div className="nyquist-controls">
              <QuantumSlider
                label="Signal Frequency"
                value={freq}
                onChange={setFreq}
                min={1} max={50} step={0.5}
                unit="Hz"
                color="var(--neon-cyan)"
              />
              <QuantumSlider
                label="Sample Rate"
                value={sampleRate}
                onChange={setSampleRate}
                min={2} max={100} step={1}
                unit="Hz"
                color="var(--neon-purple)"
              />
              <QuantumSelect
                label="Wave Type"
                value={waveType}
                onChange={setWaveType}
                options={['sine', 'square', 'sawtooth', 'triangle']}
              />
            </div>
          </GlassCard>

          {/* Key Numbers */}
          <GlassCard title="KEY METRICS" icon="◎">
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
                <span className={`nm-value ${parseFloat(ratio) >= 1 ? 'nm-good' : 'nm-bad'}`}>{ratio}×</span>
              </div>
              {isAliased && aliasFreq != null && (
                <div className="nm-item nm-item--alert">
                  <span className="nm-label">Alias Freq</span>
                  <span className="nm-value nm-bad">{aliasFreq.toFixed(1)} Hz</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Education Cards */}
          <GlassCard title="THE NYQUIST-SHANNON THEOREM" icon="📖" variant="purple" className="education-card">
            <div className="education-content">
              <p className="education-quote">
                "A signal can be perfectly reconstructed from its samples if the sampling rate is at least twice the highest frequency in the signal."
              </p>
              <div className="education-formula">
                f<sub>s</sub> ≥ 2 × f<sub>max</sub>
              </div>
              <div className="education-sections">
                <div className="edu-section">
                  <h4>✓ When Satisfied</h4>
                  <p>The original signal can be perfectly reconstructed from discrete samples using sinc interpolation. No information is lost.</p>
                </div>
                <div className="edu-section">
                  <h4>✗ When Violated</h4>
                  <p>High-frequency components "fold" into lower frequencies, creating a phantom signal called an <strong>alias</strong>. This distortion is irreversible.</p>
                </div>
                <div className="edu-section">
                  <h4>🔬 Alias Frequency</h4>
                  <p>f<sub>alias</sub> = |f − n × f<sub>s</sub>| where n rounds f/f<sub>s</sub> to the nearest integer.</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right — Visualizations */}
        <div className="nyquist-viz-col">
          {/* Status Banner */}
          <motion.div
            className={`nyquist-status-banner ${isAliased ? 'aliased' : 'satisfied'}`}
            layout
          >
            {isAliased ? (
              <>
                <span className="nsb-icon">⚠</span>
                <span>ALIASING: Signal {freq} Hz exceeds Nyquist {nyquist} Hz — Alias appears at {aliasFreq?.toFixed(1)} Hz</span>
              </>
            ) : (
              <>
                <span className="nsb-icon">◈</span>
                <span>NYQUIST SATISFIED: Signal {freq} Hz is below Nyquist {nyquist} Hz — Perfect reconstruction possible</span>
              </>
            )}
          </motion.div>

          {/* Signal + Samples Chart */}
          <GlassCard title="SIGNAL & SAMPLES" icon="〰️" className="nyquist-chart-card">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" data={mergedData} tick={{ fontSize: 9 }} label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5, fill: 'rgba(200,210,230,0.4)', fontSize: 10 }} />
                <YAxis domain={[-1.5, 1.5]} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ background: 'rgba(5,5,20,0.92)', border: '1px solid rgba(10,255,255,0.15)', borderRadius: 8, fontSize: 11 }} />

                {/* Original signal */}
                <Line data={mergedData} type="monotone" dataKey="original" stroke="#0affff" strokeWidth={2} dot={false} name="Original" />

                {/* Alias ghost */}
                {isAliased && (
                  <Line data={mergedData} type="monotone" dataKey="alias" stroke="#ff3322" strokeWidth={1.5} dot={false} strokeDasharray="6 3" name="Alias" />
                )}

                {/* Sampled points */}
                <Line
                  data={sampledPoints}
                  type="monotone"
                  dataKey="sample"
                  stroke="transparent"
                  dot={{ fill: '#ffcc00', stroke: '#ffcc00', r: 4 }}
                  name="Samples"
                />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Frequency Spectrum */}
          <GlassCard title="FREQUENCY SPECTRUM" icon="📊" variant={isAliased ? 'danger' : 'default'} className="nyquist-chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={spectrumData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradSpectrum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7b2fff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#7b2fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="freq" tick={{ fontSize: 9 }} label={{ value: 'Frequency (Hz)', position: 'insideBottomRight', offset: -5, fill: 'rgba(200,210,230,0.4)', fontSize: 10 }} />
                <YAxis domain={[0, 1.2]} tick={{ fontSize: 9 }} />
                <ReferenceLine x={nyquist} stroke="#ff3322" strokeDasharray="4 4" label={{ value: `Nyquist (${nyquist} Hz)`, fill: '#ff3322', fontSize: 9, position: 'top' }} />
                {isAliased && (
                  <ReferenceArea x1={nyquist} x2={sampleRate} fill="rgba(255,51,34,0.05)" label={{ value: 'ALIAS ZONE', fill: 'rgba(255,51,34,0.3)', fontSize: 9 }} />
                )}
                <Tooltip contentStyle={{ background: 'rgba(5,5,20,0.92)', border: '1px solid rgba(10,255,255,0.15)', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="magnitude" stroke="#7b2fff" fill="url(#gradSpectrum)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
