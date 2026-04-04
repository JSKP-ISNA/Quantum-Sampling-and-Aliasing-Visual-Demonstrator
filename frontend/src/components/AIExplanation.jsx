import { motion as Motion } from 'framer-motion';
import useSignalStore from '../store/useSignalStore';
import './AIExplanation.css';

export default function AIExplanation() {
  const explanation = useSignalStore((state) => state.aiExplanation);
  const setAIExplanation = useSignalStore((state) => state.setAIExplanation);

  if (!explanation) return null;

  return (
    <Motion.div
      className="ai-explanation-overlay"
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ai-explanation-panel">
        <div className="ai-header">
          <div className="ai-header-left">
            <span className="ai-icon">RB</span>
            <div className="ai-header-copy">
              <span className="ai-title">Rule-Based Analysis</span>
              <small className="ai-subtitle">Backend heuristics, not a language model</small>
            </div>
          </div>
          <button
            className="ai-close"
            onClick={() => setAIExplanation('')}
            aria-label="Close analysis panel"
            type="button"
          >
            x
          </button>
        </div>

        <div className="ai-disclaimer">
          This summary is generated from deterministic aliasing rules so the operator always knows what is inferred.
        </div>

        <div className="ai-body">
          {explanation.split('\n').map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      </div>
    </Motion.div>
  );
}
