import { useId, useMemo } from 'react';
import './QuantumSelect.css';

function normalizeOption(option) {
  if (typeof option === 'string') {
    return {
      value: option,
      label: option,
      disabled: false,
      description: '',
    };
  }

  return {
    value: option.value,
    label: option.label ?? option.value,
    disabled: Boolean(option.disabled),
    description: option.description || '',
  };
}

export default function QuantumSelect({
  label,
  value,
  onChange,
  options = [],
  color = 'var(--neon-cyan)',
  id: externalId,
  hint,
  disabled = false,
}) {
  const generatedId = useId();
  const selectId = externalId || generatedId;
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === value) || null;
  const helperText = hint || selectedOption?.description || '';

  return (
    <div className="quantum-select">
      {label ? (
        <label htmlFor={selectId} className="quantum-select__label">
          {label}
        </label>
      ) : null}
      <div className="quantum-select__wrapper" style={{ '--select-color': color }}>
        <select
          id={selectId}
          className="quantum-select__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {normalizedOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="quantum-select__chevron">v</span>
      </div>
      {helperText ? <small className="quantum-select__hint">{helperText}</small> : null}
    </div>
  );
}
