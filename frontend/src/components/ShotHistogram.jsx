import { motion } from 'framer-motion';
import useSignalStore from '../store/useSignalStore';
import './ShotHistogram.css';

/**
 * Animated bar chart showing quantum measurement shot counts.
 * Displays the probability distribution across computational basis states.
 */
export default function ShotHistogram() {
  const counts = useSignalStore((s) => s.quantumMetrics.counts);
  const jobStatus = useSignalStore((s) => s.quantumJobStatus);
  const shots = useSignalStore((s) => s.quantumShots);

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  // Sort by count descending, take top 16
  const sorted = entries
    .sort(([, a], [, b]) => b - a)
    .slice(0, 16);

  const maxCount = Math.max(...sorted.map(([, c]) => c));
  const totalShots = sorted.reduce((acc, [, c]) => acc + c, 0);

  return (
    <div className="shot-histogram">
      <div className="histogram-header">
        <span className="histogram-icon">⟨ψ|</span>
        <h3>MEASUREMENT DISTRIBUTION</h3>
        <span className="histogram-shots">{totalShots} shots</span>
      </div>

      <div className="histogram-bars">
        {sorted.map(([state, count], i) => {
          const pct = (count / maxCount) * 100;
          const prob = (count / totalShots * 100).toFixed(1);

          return (
            <motion.div
              key={state}
              className="histogram-bar-row"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <span className="bar-label">|{state}⟩</span>
              <div className="bar-track">
                <motion.div
                  className="bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.04 + 0.1, duration: 0.5, ease: 'easeOut' }}
                  style={{
                    background: `linear-gradient(90deg, 
                      hsl(${180 + i * 12}, 85%, 55%) 0%, 
                      hsl(${200 + i * 12}, 90%, 65%) 100%)`
                  }}
                />
              </div>
              <span className="bar-count">{count}</span>
              <span className="bar-prob">{prob}%</span>
            </motion.div>
          );
        })}
      </div>

      {entries.length > 16 && (
        <div className="histogram-overflow">
          +{entries.length - 16} more states
        </div>
      )}
    </div>
  );
}
