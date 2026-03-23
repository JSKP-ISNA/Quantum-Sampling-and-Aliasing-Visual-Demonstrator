import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './BootSequence.css';

const INIT_MESSAGES = [
  { text: '> INITIALIZING QUANTUM SYSTEM...', delay: 0 },
  { text: '> Loading signal processing engine', delay: 300 },
  { text: '> Calibrating Nyquist subsystem', delay: 600 },
  { text: '> Establishing WebSocket link', delay: 900 },
  { text: '> Computing Bloch sphere coordinates', delay: 1200 },
  { text: '> Quantum coherence check: PASSED', delay: 1500 },
  { text: '> Entanglement entropy: NOMINAL', delay: 1800 },
  { text: '> Signal reconstruction pipeline: READY', delay: 2100 },
  { text: '> FFT spectrum analyzer: ONLINE', delay: 2400 },
  { text: '> All systems nominal', delay: 2700 },
  { text: '> LAUNCHING ALIASINGVIZ 3D', delay: 3000 },
];

const TOTAL_DURATION = 3800;

/**
 * Cinematic boot-up sequence with system initialization messages.
 */
export default function BootSequence({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Show lines one by one
    INIT_MESSAGES.forEach((msg) => {
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, msg.text]);
      }, msg.delay);
    });

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, TOTAL_DURATION / 50);

    // Start fade out
    setTimeout(() => setFading(true), TOTAL_DURATION - 500);

    // Complete
    setTimeout(() => {
      if (onComplete) onComplete();
    }, TOTAL_DURATION);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!fading && (
        <motion.div
          className="boot-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          <div className="boot-container">
            <div className="boot-logo">
              <div className="boot-logo-icon">◈</div>
              <h1 className="boot-title">
                AliasingViz<span className="boot-accent">3D</span>
              </h1>
              <p className="boot-subtitle">QUANTUM SIGNAL PROCESSING LAB</p>
            </div>

            <div className="boot-terminal">
              {visibleLines.map((line, i) => (
                <motion.div
                  key={i}
                  className="boot-line"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {line}
                </motion.div>
              ))}
              <span className="boot-cursor">█</span>
            </div>

            <div className="boot-progress-container">
              <div className="boot-progress-bar">
                <motion.div
                  className="boot-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="boot-progress-text">{progress}%</span>
            </div>
          </div>

          <div className="boot-scanline" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
