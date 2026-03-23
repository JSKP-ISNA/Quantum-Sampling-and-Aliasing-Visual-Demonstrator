import './QuantumHUD.css';

/**
 * HUD corner frame decorations + scanning line overlay.
 * Gives a futuristic lab-instrument / cockpit feel.
 */
export default function QuantumHUD() {
  return (
    <div className="quantum-hud">
      {/* Corner brackets */}
      <div className="hud-corner hud-top-left" />
      <div className="hud-corner hud-top-right" />
      <div className="hud-corner hud-bottom-left" />
      <div className="hud-corner hud-bottom-right" />

      {/* Scanning line */}
      <div className="hud-scanline" />

      {/* Side tick marks */}
      <div className="hud-ticks hud-ticks-left">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="hud-tick" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className="hud-ticks hud-ticks-right">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="hud-tick" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}
