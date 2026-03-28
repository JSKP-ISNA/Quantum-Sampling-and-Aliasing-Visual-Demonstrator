import './StatusDot.css';

/**
 * Animated status indicator dot.
 * status: 'online' | 'offline' | 'warning' | 'loading'
 */
export default function StatusDot({ status = 'offline', size = 8, label }) {
  return (
    <span className={`status-dot status-dot--${status}`}>
      <span
        className="status-dot__circle"
        style={{ width: size, height: size }}
      />
      {label && <span className="status-dot__label">{label}</span>}
    </span>
  );
}
