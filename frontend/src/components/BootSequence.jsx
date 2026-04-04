import { useEffect, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import './BootSequence.css';

const INIT_MESSAGES = [
  { text: '> Initializing Quantum Signal Studio', delay: 0 },
  { text: '> Preparing signal reconstruction engine', delay: 260 },
  { text: '> Checking backend health and route guards', delay: 520 },
  { text: '> Syncing Nyquist and quantum workspaces', delay: 780 },
  { text: '> Hydrating desktop webview runtime', delay: 1040 },
  { text: '> Mission shell online', delay: 1300 },
];

const TOTAL_DURATION = 2200;

export default function BootSequence({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const lineTimers = INIT_MESSAGES.map((message) =>
      window.setTimeout(() => {
        setVisibleLines((prev) => [...prev, message.text]);
      }, message.delay)
    );

    const progressInterval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(progressInterval);
          return 100;
        }
        return Math.min(100, current + 4);
      });
    }, TOTAL_DURATION / 25);

    const fadeTimer = window.setTimeout(() => setFading(true), TOTAL_DURATION - 320);
    const completeTimer = window.setTimeout(() => onComplete?.(), TOTAL_DURATION);

    return () => {
      lineTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(progressInterval);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!fading && (
        <Motion.div
          className="boot-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <div className="boot-container">
            <div className="boot-logo">
              <div className="boot-logo-icon">QS</div>
              <h1 className="boot-title">Quantum Signal Studio</h1>
              <p className="boot-subtitle">Hybrid signal intelligence platform</p>
            </div>

            <div className="boot-terminal">
              {visibleLines.map((line) => (
                <Motion.div
                  key={line}
                  className="boot-line"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {line}
                </Motion.div>
              ))}
              <span className="boot-cursor">|</span>
            </div>

            <div className="boot-progress-container">
              <div className="boot-progress-bar">
                <Motion.div className="boot-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="boot-progress-text">{progress}%</span>
            </div>
          </div>

          <div className="boot-scanline" />
        </Motion.div>
      )}
    </AnimatePresence>
  );
}
