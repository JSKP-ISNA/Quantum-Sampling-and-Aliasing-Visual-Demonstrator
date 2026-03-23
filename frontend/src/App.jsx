import { useState, useCallback } from 'react';
import { Leva } from 'leva';
import { AnimatePresence, motion } from 'framer-motion';
import Scene from './components/Scene';
import ControlPanel from './components/ControlPanel';
import ErrorOverlay from './components/ErrorOverlay';
import AIExplanation from './components/AIExplanation';
import BootSequence from './components/BootSequence';
import QuantumHUD from './components/QuantumHUD';
import useAudio from './hooks/useAudio';
import useWebSocket from './hooks/useWebSocket';
import useQuantumState from './hooks/useQuantumState';
import './App.css';

/**
 * AliasingViz 3D – Root Application
 * Industry-level quantum signal processing showcase.
 */
export default function App() {
  const { sendParams } = useWebSocket();
  useAudio();
  useQuantumState();
  const [booted, setBooted] = useState(false);

  const handleBootComplete = useCallback(() => {
    setBooted(true);
  }, []);

  return (
    <div className="app-container">
      {/* Boot Sequence */}
      <AnimatePresence>
        {!booted && <BootSequence onComplete={handleBootComplete} />}
      </AnimatePresence>

      {/* Main Application */}
      {booted && (
        <motion.div
          className="app-main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          {/* Branding Header */}
          <header className="app-header">
            <div className="logo-group">
              <div className="logo-icon">◈</div>
              <div className="logo-text">
                <h1>AliasingViz<span className="accent">3D</span></h1>
                <p className="subtitle">Quantum Signal Processing Lab</p>
              </div>
            </div>
            <div className="header-right">
              <div className="header-badge">
                <span className="badge-dot" />
                QUANTUM PROJECT
              </div>
            </div>
          </header>

          {/* Legend */}
          <div className="legend">
            <div className="legend-title">SIGNAL LAYERS</div>
            {[
              { color: '#0affff', label: 'Original Signal' },
              { color: '#00ff88', label: 'Reconstructed' },
              { color: '#ff3322', label: 'Alias Ghost' },
              { color: '#ffcc00', label: 'Sample Points' },
            ].map((item) => (
              <div className="legend-item" key={item.label}>
                <span className="legend-dot" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }} />
                {item.label}
              </div>
            ))}
          </div>

          {/* 3D Scene */}
          <Scene />

          {/* HUD Overlay */}
          <QuantumHUD />

          {/* Leva control panel */}
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
          <ControlPanel sendParams={sendParams} />

          {/* Overlays */}
          <ErrorOverlay />
          <AIExplanation />
        </motion.div>
      )}
    </div>
  );
}
