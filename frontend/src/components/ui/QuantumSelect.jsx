import { useId } from 'react';
import './QuantumSelect.css';

/**
 * Custom quantum-themed dropdown select.
 */
export default function QuantumSelect({
  label,
  value,
  onChange,
  options = [],
  color = 'var(--neon-cyan)',
  id: externalId,
}) {
  const generatedId = useId();
  const selectId = externalId || generatedId;

  return (
    <div className="quantum-select">
      {label && (
        <label htmlFor={selectId} className="quantum-select__label">{label}</label>
      )}
      <div className="quantum-select__wrapper" style={{ '--select-color': color }}>
        <select
          id={selectId}
          className="quantum-select__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            return <option key={val} value={val}>{label}</option>;
          })}
        </select>
        <span className="quantum-select__chevron">▾</span>
      </div>
    </div>
  );
}
