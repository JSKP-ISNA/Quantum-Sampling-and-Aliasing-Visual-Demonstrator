import { useState, useRef } from 'react';
import './QuantumButton.css';

/**
 * Glowing button with ripple animation.
 * Variants: 'cyan' | 'purple' | 'green' | 'danger'
 */
export default function QuantumButton({
  children,
  onClick,
  variant = 'cyan',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  id,
  type = 'button',
}) {
  const [ripple, setRipple] = useState(null);
  const btnRef = useRef(null);

  const handleClick = (e) => {
    if (disabled || loading) return;

    // Create ripple
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipple({ x, y, key: Date.now() });
    setTimeout(() => setRipple(null), 600);

    onClick?.(e);
  };

  return (
    <button
      ref={btnRef}
      id={id}
      type={type}
      className={`quantum-btn quantum-btn--${variant} quantum-btn--${size} ${fullWidth ? 'quantum-btn--full' : ''} ${loading ? 'quantum-btn--loading' : ''}`}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {ripple && (
        <span
          className="quantum-btn__ripple"
          style={{ left: ripple.x, top: ripple.y }}
          key={ripple.key}
        />
      )}
      {loading && <span className="quantum-btn__spinner" />}
      {icon && !loading && <span className="quantum-btn__icon">{icon}</span>}
      <span className="quantum-btn__text">{children}</span>
    </button>
  );
}
