import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine
} from 'recharts';
import { motion } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import QuantumSlider from '../components/ui/QuantumSlider';
import QuantumSelect from '../components/ui/QuantumSelect';
import useSignalStore from '../store/useSignalStore';
import './SignalLabPage.css';

/**
 * Signal Lab — 2D analysis page with Recharts visualizations.
 * Time domain, frequency domain, sampling comparison, and error analysis.
 */
export default function SignalLabPage({ sendParams }) {
  const signalData = useSignalStore((s) => s.signalData);
  const sampledData = useSignalStore((s) => s.sampledData);
  const reconstructedData = useSignalStore((s) => s.reconstructedData);
  const fftData = useSignalStore((s) => s.fftData);
  const error = useSignalStore((s) => s.error);
  const aliased = useSignalStore((s) => s.aliased);
  const aliasFreq = useSignalStore((s) => s.aliasFreq);
  const freq = useSignalStore((s) => s.freq);
  const fs = useSignalStore((s) => s.fs);
  const nyquist = useSignalStore((s) => s.nyquist);

  // Local controls that sync to backend
  const [localFreq, setLocalFreq] = useState(freq || 100);
  const [localFs, setLocalFs] = useState(fs || 300);
  const [localNoise, setLocalNoise] = useState(0);
  const [localWave, setLocalWave] = useState('sine');

  const handleParamChange = (key, value) => {
    const setters = { frequency: setLocalFreq, sampleRate: setLocalFs, noiseLevel: setLocalNoise, waveType: setLocalWave };
    setters[key]?.(value);

    const params = {
      freq: key === 'frequency' ? value : localFreq,
      fs: key === 'sampleRate' ? value : localFs,
      noise_level: key === 'noiseLevel' ? value : localNoise,
      wave_type: key === 'waveType' ? value : localWave,
    };
    if (sendParams) sendParams(params);
  };

  // Prepare chart data
  const timeDomainData = useMemo(() => {
    if (!signalData.t?.length) return [];
    const step = Math.max(1, Math.floor(signalData.t.length / 300));
    return signalData.t
      .filter((_, i) => i % step === 0)
      .map((t, idx) => {
        const i = idx * step;
        return {
          t: parseFloat(t.toFixed(5)),
          original: signalData.y[i],
          reconstructed: reconstructedData.y?.[i] ?? null,
        };
      });
  }, [signalData, reconstructedData]);

  const sampledChartData = useMemo(() => {
    if (!sampledData.t?.length) return [];
    return sampledData.t.map((t, i) => ({
      t: parseFloat(t.toFixed(5)),
      sample: sampledData.y[i],
    }));
  }, [sampledData]);

  const fftChartData = useMemo(() => {
    const mags = fftData?.sampled?.magnitude || [];
    const freqs = fftData?.sampled?.freq || [];
    if (!mags.length) return [];
    const step = Math.max(1, Math.floor(mags.length / 80));
    return mags
      .filter((_, i) => i % step === 0)
      .map((mag, idx) => ({
        freq: parseFloat((freqs[idx * step] || 0).toFixed(1)),
        magnitude: mag,
      }));
  }, [fftData]);

  return (
    <div className="signal-lab-page">
      {/* Page Header */}
      <div className="signal-lab-page__header">
        <div>
          <h1 className="page-title">Signal Lab</h1>
          <p className="page-subtitle">2D Analysis & Signal Processing Testbed</p>
        </div>
        <div className="signal-lab-page__stats">
          <div className={`stat-chip ${aliased ? 'stat-chip--danger' : 'stat-chip--success'}`}>
            {aliased ? `⚠ Aliasing at ${aliasFreq} Hz` : '◈ No Aliasing'}
          </div>
          <div className="stat-chip">SNR: {error.snr?.toFixed(1)} dB</div>
          <div className="stat-chip">MSE: {error.mse?.toFixed(4)}</div>
        </div>
      </div>

      {/* Controls Panel */}
      <GlassCard title="SIGNAL CONTROLS" icon="🎛️" className="signal-lab-controls">
        <div className="signal-lab-controls__grid">
          <QuantumSlider
            label="Frequency"
            value={localFreq}
            onChange={(v) => handleParamChange('frequency', v)}
            min={1} max={500} step={1}
            unit="Hz"
            color="var(--neon-cyan)"
          />
          <QuantumSlider
            label="Sample Rate"
            value={localFs}
            onChange={(v) => handleParamChange('sampleRate', v)}
            min={10} max={1000} step={5}
            unit="Hz"
            color="var(--neon-purple)"
          />
          <QuantumSlider
            label="Noise Level"
            value={localNoise}
            onChange={(v) => handleParamChange('noiseLevel', v)}
            min={0} max={1} step={0.01}
            color="var(--neon-amber)"
          />
          <QuantumSelect
            label="Wave Type"
            value={localWave}
            onChange={(v) => handleParamChange('waveType', v)}
            options={['sine', 'square', 'sawtooth', 'triangle']}
          />
        </div>
        <div className="signal-lab-controls__info">
          <span>Nyquist: <strong>{nyquist} Hz</strong></span>
          <span>Ratio: <strong>{(fs / (2 * (freq || 1))).toFixed(2)}×</strong></span>
        </div>
      </GlassCard>

      {/* Charts Grid */}
      <div className="signal-lab-charts">
        {/* Time Domain */}
        <GlassCard title="TIME DOMAIN" icon="〰️" className="chart-card chart-card--wide">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeDomainData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gradOriginal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0affff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0affff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRecon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} domain={[-1.5, 1.5]} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(5,5,20,0.92)',
                  border: '1px solid rgba(10,255,255,0.15)',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Area type="monotone" dataKey="original" stroke="#0affff" fill="url(#gradOriginal)" strokeWidth={2} dot={false} name="Original" />
              <Area type="monotone" dataKey="reconstructed" stroke="#00ff88" fill="url(#gradRecon)" strokeWidth={1.5} dot={false} name="Reconstructed" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* FFT Spectrum */}
        <GlassCard title="FREQUENCY DOMAIN (FFT)" icon="📊" variant={aliased ? 'danger' : 'default'} className="chart-card">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fftChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="freq" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              {nyquist && <ReferenceLine x={nyquist} stroke="#ff3322" strokeDasharray="4 4" label={{ value: 'Nyquist', fill: '#ff3322', fontSize: 10 }} />}
              <Tooltip
                contentStyle={{
                  background: 'rgba(5,5,20,0.92)',
                  border: '1px solid rgba(10,255,255,0.15)',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="magnitude" fill={aliased ? '#ff3322' : '#7b2fff'} radius={[2, 2, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Samples Scatter */}
        <GlassCard title="SAMPLING POINTS" icon="●" className="chart-card">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={sampledChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} domain={[-1.5, 1.5]} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(5,5,20,0.92)',
                  border: '1px solid rgba(10,255,255,0.15)',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="sample"
                stroke="#ffcc00"
                strokeWidth={0}
                dot={{ fill: '#ffcc00', r: 4, stroke: '#ffcc00', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#ffcc00', stroke: '#fff' }}
                name="Samples"
              />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Error Metrics */}
        <GlassCard title="ERROR METRICS" icon="◎" variant={error.snr < 10 ? 'danger' : 'success'} className="chart-card">
          <div className="error-metrics-grid">
            <div className="error-metric-card">
              <div className="error-metric-label">SNR</div>
              <div className={`error-metric-value ${error.snr >= 20 ? 'good' : error.snr >= 10 ? 'medium' : 'bad'}`}>
                {error.snr?.toFixed(1)}<small> dB</small>
              </div>
              <div className="error-metric-bar">
                <motion.div
                  className="error-metric-bar__fill"
                  animate={{ width: `${Math.min(Math.max((error.snr || 0) / 50, 0), 1) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: error.snr >= 20 ? 'var(--neon-green)' : error.snr >= 10 ? 'var(--neon-amber)' : 'var(--neon-red)' }}
                />
              </div>
            </div>
            <div className="error-metric-card">
              <div className="error-metric-label">MSE</div>
              <div className={`error-metric-value ${error.mse <= 0.01 ? 'good' : error.mse <= 0.1 ? 'medium' : 'bad'}`}>
                {error.mse?.toFixed(4)}
              </div>
              <div className="error-metric-bar">
                <motion.div
                  className="error-metric-bar__fill"
                  animate={{ width: `${Math.min(Math.max(1 - (error.mse || 0) * 10, 0), 1) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: error.mse <= 0.01 ? 'var(--neon-green)' : error.mse <= 0.1 ? 'var(--neon-amber)' : 'var(--neon-red)' }}
                />
              </div>
            </div>
            <div className="error-metric-card">
              <div className="error-metric-label">MAX ERROR</div>
              <div className="error-metric-value">{error.max_error?.toFixed(4)}</div>
            </div>
            <div className="error-metric-card">
              <div className="error-metric-label">STATUS</div>
              <div className={`error-metric-value ${aliased ? 'bad' : 'good'}`}>
                {aliased ? 'ALIASED' : 'CLEAN'}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
