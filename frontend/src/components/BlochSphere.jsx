import { useCallback, useEffect, useRef, useState } from 'react';
import './BlochSphere.css';

const GATE_TRANSFORMS = {
  X: ([x, y, z]) => [x, -y, -z],
  Y: ([x, y, z]) => [-x, y, -z],
  Z: ([x, y, z]) => [-x, -y, z],
  H: ([x, y, z]) => [z, y, x],
  S: ([x, y, z]) => {
    const a = Math.PI / 2;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  },
  T: ([x, y, z]) => {
    const a = Math.PI / 4;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
  },
};

function project(x, y, z, cx, cy, r, angH, angV) {
  const cH = Math.cos(angH), sH = Math.sin(angH);
  const cV = Math.cos(angV), sV = Math.sin(angV);
  const x2 = x * cH + z * sH;
  const z2 = -x * sH + z * cH;
  const y2 = y * cV - z2 * sV;
  const z3 = y * sV + z2 * cV;
  return { px: cx + r * x2, py: cy - r * y2, depth: z3 };
}

export default function BlochSphere() {
  const canvasRef = useRef(null);
  const [thetaDeg, setThetaDeg] = useState(45);
  const [phiDeg, setPhiDeg] = useState(60);

  const applyGate = useCallback((gate) => {
    const t = thetaDeg * Math.PI / 180;
    const p = phiDeg * Math.PI / 180;
    const bloch = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];

    const transform = GATE_TRANSFORMS[gate];
    if (!transform) return;

    const [nx, ny, nz] = transform(bloch);
    const newT = Math.acos(Math.max(-1, Math.min(1, nz)));
    const newP = (Math.atan2(ny, nx) + 2 * Math.PI) % (2 * Math.PI);
    setThetaDeg(Math.round(newT * 180 / Math.PI));
    setPhiDeg(Math.round(newP * 180 / Math.PI));
  }, [thetaDeg, phiDeg]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, r = 130;
    const angH = 0.4, angV = 0.35;
    ctx.clearRect(0, 0, W, H);

    // Meridians
    for (let ph = 0; ph < 360; ph += 30) {
      ctx.beginPath();
      for (let i = 0; i <= 180; i += 3) {
        const t2 = i * Math.PI / 180, p2 = ph * Math.PI / 180;
        const p = project(Math.sin(t2) * Math.cos(p2), Math.cos(t2), Math.sin(t2) * Math.sin(p2), cx, cy, r, angH, angV);
        i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Equator
    ctx.beginPath();
    for (let i = 0; i <= 360; i += 2) {
      const rad = i * Math.PI / 180;
      const p = project(Math.cos(rad), 0, Math.sin(rad), cx, cy, r, angH, angV);
      i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py);
    }
    ctx.strokeStyle = 'rgba(74,158,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Latitude rings
    for (const lat of [30, 60, 120, 150]) {
      const t2 = lat * Math.PI / 180;
      ctx.beginPath();
      for (let i = 0; i <= 360; i += 3) {
        const rad = i * Math.PI / 180;
        const p = project(Math.sin(t2) * Math.cos(rad), Math.cos(t2), Math.sin(t2) * Math.sin(rad), cx, cy, r, angH, angV);
        i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Axes
    const axes = [
      { v: [1, 0, 0], lbl: 'X' },
      { v: [0, 1, 0], lbl: 'Z' },
      { v: [0, 0, 1], lbl: 'Y' },
    ];
    axes.forEach((a) => {
      const start = project(-a.v[0], -a.v[1], -a.v[2], cx, cy, r, angH, angV);
      const end = project(a.v[0], a.v[1], a.v[2], cx, cy, r, angH, angV);
      const label = project(a.v[0], a.v[1], a.v[2], cx, cy, r * 1.2, angH, angV);
      ctx.beginPath();
      ctx.moveTo(start.px, start.py);
      ctx.lineTo(end.px, end.py);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(a.lbl, label.px, label.py - 4);
    });

    // Poles
    const pN = project(0, 1, 0, cx, cy, r, angH, angV);
    const pS = project(0, -1, 0, cx, cy, r, angH, angV);
    ctx.fillStyle = '#4a9eff';
    ctx.font = 'bold 12px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('|0⟩', pN.px, pN.py - 10);
    ctx.fillStyle = '#ff6b35';
    ctx.fillText('|1⟩', pS.px, pS.py + 16);

    // State vector
    const t = thetaDeg * Math.PI / 180, phi = phiDeg * Math.PI / 180;
    const vx = Math.sin(t) * Math.cos(phi), vy = Math.cos(t), vz = Math.sin(t) * Math.sin(phi);
    const tip = project(vx, vy, vz, cx, cy, r, angH, angV);
    const orig = project(0, 0, 0, cx, cy, r, angH, angV);

    // Shadow projections
    const sh = project(vx, 0, vz, cx, cy, r, angH, angV);
    ctx.beginPath();
    ctx.moveTo(orig.px, orig.py);
    ctx.lineTo(sh.px, sh.py);
    ctx.strokeStyle = 'rgba(255,107,53,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(tip.px, tip.py);
    ctx.lineTo(sh.px, sh.py);
    ctx.strokeStyle = 'rgba(255,107,53,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glow
    const grad = ctx.createRadialGradient(tip.px, tip.py, 0, tip.px, tip.py, 36);
    grad.addColorStop(0, 'rgba(74,158,255,0.18)');
    grad.addColorStop(1, 'rgba(74,158,255,0)');
    ctx.beginPath();
    ctx.arc(tip.px, tip.py, 36, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();

    // Vector line
    ctx.beginPath();
    ctx.moveTo(orig.px, orig.py);
    ctx.lineTo(tip.px, tip.py);
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Arrowhead
    const dx = tip.px - orig.px, dy = tip.py - orig.py;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const ux = dx / len, uy = dy / len;
      ctx.beginPath();
      ctx.moveTo(tip.px, tip.py);
      ctx.lineTo(tip.px - ux * 12 + uy * 5, tip.py - uy * 12 - ux * 5);
      ctx.lineTo(tip.px - ux * 12 - uy * 5, tip.py - uy * 12 + ux * 5);
      ctx.closePath();
      ctx.fillStyle = '#4a9eff';
      ctx.fill();
    }

    // Tip dot
    ctx.beginPath();
    ctx.arc(tip.px, tip.py, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
  }, [thetaDeg, phiDeg]);

  useEffect(() => { draw(); }, [draw]);

  const alpha = Math.cos((thetaDeg * Math.PI / 180) / 2);
  const betaR = Math.sin((thetaDeg * Math.PI / 180) / 2) * Math.cos(phiDeg * Math.PI / 180);
  const betaI = Math.sin((thetaDeg * Math.PI / 180) / 2) * Math.sin(phiDeg * Math.PI / 180);
  const fmt = (n) => (n >= 0 ? '+' : '') + n.toFixed(2);
  const betaStr = Math.abs(betaI) < 0.01 ? betaR.toFixed(2) : `(${betaR.toFixed(2)}${fmt(betaI)}i)`;
  const stateText = `${alpha.toFixed(2)}|0⟩ + ${betaStr}|1⟩`;
  const p0 = (alpha * alpha * 100).toFixed(1);
  const p1 = ((1 - alpha * alpha) * 100).toFixed(1);

  return (
    <div className="bloch-sphere">
      <div className="bloch-sphere__header">
        <h3 className="bloch-sphere__title">Quantum Bloch Sphere</h3>
        <span className="bloch-sphere__subtitle">Single-qubit state visualizer · adjust θ φ · apply gates</span>
      </div>

      <div className="bloch-sphere__layout">
        <div className="bloch-sphere__canvas-wrap">
          <canvas ref={canvasRef} className="bloch-sphere__canvas" width={340} height={340} />
        </div>

        <div className="bloch-sphere__controls">
          <div className="bloch-sphere__slider-group">
            <label className="bloch-sphere__label">θ (theta) — polar angle</label>
            <div className="bloch-sphere__slider-row">
              <input
                type="range"
                className="bloch-sphere__range"
                min={0}
                max={180}
                value={thetaDeg}
                onChange={(e) => setThetaDeg(+e.target.value)}
              />
              <span className="bloch-sphere__val">{thetaDeg}°</span>
            </div>
          </div>

          <div className="bloch-sphere__slider-group">
            <label className="bloch-sphere__label">φ (phi) — azimuthal angle</label>
            <div className="bloch-sphere__slider-row">
              <input
                type="range"
                className="bloch-sphere__range"
                min={0}
                max={360}
                value={phiDeg}
                onChange={(e) => setPhiDeg(+e.target.value)}
              />
              <span className="bloch-sphere__val">{phiDeg}°</span>
            </div>
          </div>

          <div className="bloch-sphere__gates">
            <span className="bloch-sphere__label">Apply quantum gate</span>
            <div className="bloch-sphere__gate-grid">
              {Object.keys(GATE_TRANSFORMS).map((g) => (
                <button key={g} type="button" className="bloch-sphere__gate-btn" onClick={() => applyGate(g)}>{g}</button>
              ))}
            </div>
          </div>

          <div className="bloch-sphere__state-card">
            <span className="bloch-sphere__label">Quantum state |ψ⟩</span>
            <div className="bloch-sphere__state-expr">{stateText}</div>
            <div className="bloch-sphere__prob-row">
              P(|0⟩) = <span>{p0}%</span> &nbsp;&nbsp; P(|1⟩) = <span>{p1}%</span>
            </div>
          </div>

          <div className="bloch-sphere__guide">
            <strong>X</strong> — bit flip |0⟩↔|1⟩ &nbsp;·&nbsp; <strong>Y</strong> — flip + phase<br />
            <strong>Z</strong> — phase flip &nbsp;·&nbsp; <strong>H</strong> — superposition<br />
            <strong>S</strong> — π/2 phase &nbsp;·&nbsp; <strong>T</strong> — π/4 phase<br /><br />
            North pole = |0⟩ · South pole = |1⟩<br />
            Equator = equal superposition
          </div>
        </div>
      </div>
    </div>
  );
}
