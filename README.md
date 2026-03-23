# AliasingViz 3D 🌊

> **Quantum Project** – Interactive real-time signal processing simulation with 3D visualization, audio feedback, and AI-driven explanations.

## 🏗️ Architecture

```
User Input (Sliders/UI)
        ↓
Frontend (React + Three.js)
        ↓
WebSocket (Real-time stream)
        ↓
Backend (FastAPI)
        ↓
Signal Engine (NumPy + SciPy)
        ↓
Processing Pipeline:
   Generate → Sample → Noise → Alias → Reconstruct → FFT → Error
        ↓
JSON → Frontend → 3D Visualization + Audio
        ↓
n8n Automation (AI Explanations / Alerts)
```

## 🚀 Quick Start

### Development (no Docker)

**1. Start Backend:**
```bash
cd backend
pip install fastapi uvicorn numpy scipy websockets
python main.py
```
Backend runs at `http://localhost:8000`

**2. Start Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`

### Docker Compose
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- n8n: `http://localhost:5678`

## 🎛️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React + Vite |
| 3D Rendering | React Three Fiber + drei |
| Controls | Leva |
| Audio | Tone.js |
| State | Zustand |
| Backend | FastAPI + Uvicorn |
| Signal Processing | NumPy + SciPy |
| Communication | WebSocket |
| Automation | n8n |
| Infrastructure | Docker Compose |

## 📊 Features

- **3D Signal Ribbon** – Continuous waveform visualization
- **Alias Ghost** – Red transparent wave when aliasing detected
- **Sampling Points** – Yellow spheres at sample locations
- **Signal Reconstruction** – Green sinc-interpolated wave
- **FFT Spectrum** – 3D frequency domain bar chart
- **Error Metrics** – MSE, SNR, Max Error in real-time
- **Audio Feedback** – Alias frequency played via Tone.js
- **AI Explanations** – Click to get plain-English alias analysis
- **Multiple Waveforms** – Sine, Square, Sawtooth, Triangle

## 📁 Project Structure

```
Quantum/
├── backend/
│   ├── signal_engine.py    # Core signal processing (7 functions)
│   ├── main.py             # FastAPI server + WebSocket
│   ├── test_signal_engine.py
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React + Three.js components
│   │   ├── hooks/          # WebSocket + Audio hooks
│   │   ├── store/          # Zustand state management
│   │   ├── App.jsx
│   │   └── App.css
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## 📜 License

Educational project – Quantum Hackathon
