import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import useSignalStore from '../store/useSignalStore';
import './AIExplanation.css';

/**
 * Holographic AI explanation panel with typewriter text reveal,
 * animated gradient border, and glitch effect on open.
 */
export default function AIExplanation() {
  const explanation = useSignalStore((s) => s.aiExplanation);
  const setAIExplanation = useSignalStore((s) => s.setAIExplanation);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef(null);

  // Typewriter effect
  useEffect(() => {
    if (!explanation) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    let index = 0;

    intervalRef.current = setInterval(() => {
      if (index < explanation.length) {
        setDisplayedText(explanation.slice(0, index + 1));
        index++;
      } else {
        clearInterval(intervalRef.current);
        setIsTyping(false);
      }
    }, 18);

    return () => clearInterval(intervalRef.current);
  }, [explanation]);

  if (!explanation) return null;

  return (
    <motion.div
      className="ai-explanation-overlay"
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ai-explanation-panel">
        <div className="ai-border-glow" />
        <div className="ai-header">
          <div className="ai-header-left">
            <span className="ai-icon">⬡</span>
            <span className="ai-title">QUANTUM AI ANALYSIS</span>
          </div>
          <button
            className="ai-close"
            onClick={() => setAIExplanation('')}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="ai-body">
          {displayedText.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {isTyping && <span className="ai-cursor">▌</span>}
        </div>
      </div>
    </motion.div>
  );
}
