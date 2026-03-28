# Quantum Signal Studio

Hybrid signal intelligence workspace for realtime DSP analysis, Nyquist exploration, and backend-aware quantum workflows.

## Quick Start

### Backend

```bash
cd backend
pip install fastapi uvicorn numpy scipy websockets
python main.py
```

The backend runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Default frontend development now launches inside the desktop webview shell.

If you want the raw browser dev server instead:

```bash
cd frontend
npm run dev:web
```

## Frontend Run Modes

- `npm run dev`: Vite + desktop webview shell
- `npm run dev:web`: Vite in the browser
- `npm run preview`: production preview in the desktop webview shell
- `npm run preview:web`: production preview in the browser

## Current Frontend Highlights

- Product-style landing page before entering the workspace
- Dedicated dashboard, signal lab, quantum lab, Nyquist explorer, and status center
- Same-origin API and WebSocket routing for cleaner deployment behavior
- Desktop webview shell via Electron for app-style local usage
- Upgraded Signal Lab with presets, posture scoring, and operator recommendations
- Upgraded Status Center with runtime mode, endpoint inventory, backend snapshot, and execution telemetry

## Core Stack

- React + Vite
- Framer Motion
- Recharts
- React Three Fiber / Drei / Three.js
- Zustand
- FastAPI + WebSocket
- NumPy + SciPy
- Electron
- Docker Compose
