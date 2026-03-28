import { useCallback } from 'react';
import { Leva } from 'leva';
import Scene from '../components/Scene';
import ControlPanel from '../components/ControlPanel';
import QuantumHUD from '../components/QuantumHUD';
import ErrorOverlay from '../components/ErrorOverlay';
import AIExplanation from '../components/AIExplanation';
import useSignalStore from '../store/useSignalStore';
import './DashboardPage.css';

/**
 * Dashboard Page — Main 3D visualization view with real-time metrics.
 * This is the refined version of the original single-page app.
 */
export default function DashboardPage({ sendParams, submitQuantumJob }) {
  const aliased = useSignalStore((s) => s.aliased);

  return (
    <div className="dashboard-page">
      {/* 3D Scene — full background */}
      <div className="dashboard-scene">
        <Scene />
      </div>

      {/* Branding Header */}
      <header className="dashboard-header">
        <div className="dashboard-header__left">
          <h1 className="dashboard-title">
            AliasingViz<span className="gradient-text">3D</span>
          </h1>
          <p className="dashboard-subtitle">Quantum Signal Processing Lab</p>
        </div>
        <div className="dashboard-header__right">
          <div className={`dashboard-status-badge ${aliased ? 'aliased' : 'nominal'}`}>
            <span className="dashboard-status-dot" />
            {aliased ? '⚠ ALIASING DETECTED' : '◈ NYQUIST SATISFIED'}
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="dashboard-legend">
        <div className="dashboard-legend__title">SIGNAL LAYERS</div>
        {[
          { color: '#0affff', label: 'Original Signal' },
          { color: '#00ff88', label: 'Reconstructed' },
          { color: '#ff3322', label: 'Alias Ghost' },
          { color: '#ffcc00', label: 'Sample Points' },
        ].map((item) => (
          <div className="dashboard-legend__item" key={item.label}>
            <span
              className="dashboard-legend__dot"
              style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }}
            />
            {item.label}
          </div>
        ))}
      </div>

      {/* HUD Overlay */}
      <QuantumHUD />

      {/* Leva panel */}
      <Leva
        collapsed={false}
        oneLineLabels={false}
        flat={false}
        theme={{
          sizes: { rootWidth: '280px', controlWidth: '150px' },
          colors: {
            elevation1: 'rgba(5, 5, 20, 0.88)',
            elevation2: 'rgba(10, 10, 30, 0.88)',
            elevation3: 'rgba(15, 15, 40, 0.9)',
            accent1: '#0affff',
            accent2: '#7b2fff',
            accent3: '#ff2fff',
            highlight1: 'rgba(255, 255, 255, 0.9)',
            highlight2: 'rgba(200, 210, 230, 0.6)',
            highlight3: 'rgba(150, 160, 180, 0.4)',
          },
          fontSizes: { root: '11px' },
          fonts: { mono: "'JetBrains Mono', 'Fira Code', monospace" },
        }}
      />

      {/* Controls logic */}
      <ControlPanel sendParams={sendParams} submitQuantumJob={submitQuantumJob} />

      {/* Overlays */}
      <ErrorOverlay />
      <AIExplanation />
    </div>
  );
}
