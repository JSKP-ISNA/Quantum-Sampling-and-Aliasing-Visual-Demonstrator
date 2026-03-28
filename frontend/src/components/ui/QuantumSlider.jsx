import { useId } from 'react';
import './QuantumSlider.css';

/**
 * Custom quantum-themed range slider.
 */
export default function QuantumSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  color = 'var(--neon-cyan)',
  id: externalId,
}) {
  const generatedId = useId();
  const inputId = externalId || generatedId;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="quantum-slider">
      <div className="quantum-slider__header">
        <label htmlFor={inputId} className="quantum-slider__label">{label}</label>
        <span className="quantum-slider__value" style={{ color }}>
          {typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}
          {unit && <small className="quantum-slider__unit">{unit}</small>}
        </span>
      </div>
      <div className="quantum-slider__track-wrapper">
        <input
          id={inputId}
          className="quantum-slider__input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            '--slider-pct': `${pct}%`,
            '--slider-color': color,
          }}
        />
      </div>
    </div>
  );
}
