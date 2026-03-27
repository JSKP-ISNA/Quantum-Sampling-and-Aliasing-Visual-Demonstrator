"""
AliasingViz 3D – FastAPI Backend
WebSocket-driven real-time signal processing server with quantum state computations.
"""

import asyncio
import json
import logging
import math
import os

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from signal_engine import process_signal

# ─── App Setup ────────────────────────────────────────────────────────

app = FastAPI(
    title="AliasingViz 3D Backend",
    version="1.0.0",
    description="Real-time signal processing engine for 3D aliasing visualization",
)

# CORS — restrict to known dev/prod origins, fall back to permissive
# only when CORS_ALLOW_ALL is explicitly set (e.g. hackathon mode).
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",") if os.environ.get("CORS_ORIGINS") else [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aliasingviz")

# ─── Default Parameters ──────────────────────────────────────────────

DEFAULT_PARAMS = {
    "freq": 100.0,
    "fs": 300.0,
    "noise_level": 0.0,
    "wave_type": "sine",
}

# ─── Health Check ─────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "AliasingViz 3D Backend"}


# ─── REST endpoint for one-shot processing ────────────────────────────

@app.get("/api/process")
async def process_once(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
    wave_type: str = "sine",
):
    """One-shot signal processing (for testing / fallback)."""
    result = process_signal(freq=freq, fs=fs, noise_level=noise_level, wave_type=wave_type)
    return JSONResponse(content=result)


# ─── WebSocket Stream ────────────────────────────────────────────────

def _validate_params(update: dict, params: dict) -> dict:
    """Validate and merge incoming parameter update into current params."""
    new_params = params.copy()
    if "freq" in update:
        new_params["freq"] = max(1.0, min(2000.0, float(update["freq"])))
    if "fs" in update:
        new_params["fs"] = max(2.0, min(5000.0, float(update["fs"])))
    if "noise_level" in update:
        new_params["noise_level"] = max(0.0, min(1.0, float(update["noise_level"])))
    if "wave_type" in update:
        if update["wave_type"] in ("sine", "square", "sawtooth", "triangle"):
            new_params["wave_type"] = update["wave_type"]
    return new_params


@app.websocket("/stream")
async def stream_signal(ws: WebSocket):
    """
    Real-time bidirectional stream using asyncio.gather for separate
    receive and send loops. This avoids the race condition where
    wait_for timeouts silently drop incoming parameter changes under load.

    Client sends parameter updates as JSON:
        {"freq": 150, "fs": 400, "noise_level": 0.1, "wave_type": "sine"}

    Server continuously sends processed signal data back at ~30 FPS.
    """
    await ws.accept()
    logger.info("WebSocket client connected")

    params = DEFAULT_PARAMS.copy()
    running = True

    async def receive_loop():
        nonlocal params, running
        try:
            while running:
                raw = await ws.receive_text()
                try:
                    update = json.loads(raw)
                    params = _validate_params(update, params)
                except (json.JSONDecodeError, ValueError) as e:
                    logger.warning(f"Invalid parameter update: {e}")
        except WebSocketDisconnect:
            running = False
        except Exception:
            running = False

    async def send_loop():
        nonlocal running
        try:
            while running:
                result = process_signal(**params)
                await ws.send_text(json.dumps(result))
                await asyncio.sleep(1 / 30)
        except WebSocketDisconnect:
            running = False
        except Exception:
            running = False

    try:
        await asyncio.gather(receive_loop(), send_loop())
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        logger.info("WebSocket client disconnected")
        try:
            await ws.close()
        except Exception:
            pass


# ─── Quantum State Computation ───────────────────────────────────────

@app.get("/api/quantum-state")
async def quantum_state(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
):
    """
    Compute quantum-physics-inspired state data from signal parameters.
    Maps signal parameters onto a qubit Bloch-sphere representation.

    NOTE: This is a creative/educational analogy mapping signal processing
    concepts to quantum state visualization. The math follows correct qubit
    density matrix formalism but the *mapping* from signal params to quantum
    angles is a pedagogical metaphor, not a physical model.
    """
    nyquist = fs / 2.0
    ratio = min(freq / max(nyquist, 1.0), 2.0)

    # Bloch sphere coordinates (theta, phi) derived from signal params
    theta = ratio * math.pi  # polar angle 0..pi
    phi = (freq % 360) * math.pi / 180.0  # azimuthal angle

    bloch_x = math.sin(theta) * math.cos(phi)
    bloch_y = math.sin(theta) * math.sin(phi)
    bloch_z = math.cos(theta)

    # Superposition amplitudes |alpha|^2 + |beta|^2 = 1
    alpha_sq = (math.cos(theta / 2)) ** 2
    beta_sq = (math.sin(theta / 2)) ** 2

    # Quantum coherence: Off-diagonal density matrix element magnitude
    # |rho_01| = |alpha * beta| for pure state, decayed by noise
    alpha = math.cos(theta / 2)
    beta = math.sin(theta / 2)
    coherence = abs(alpha * beta) * math.exp(-noise_level * 2.0)

    # Von Neumann entropy: S = -sum(p * log(p))
    eigenvalues = np.array([alpha_sq, beta_sq])
    eigenvalues = np.clip(eigenvalues, 1e-10, 1.0)
    entropy = float(-np.sum(eigenvalues * np.log2(eigenvalues)))

    # Fidelity (how close to a pure state)
    fidelity = max(alpha_sq, beta_sq)

    # Purity: Tr(rho^2) for a qubit density matrix
    # rho = [[alpha_sq, alpha*beta*e^{-i*phi} * decay],
    #         [alpha*beta*e^{i*phi} * decay, beta_sq]]
    # Tr(rho^2) = alpha_sq^2 + beta_sq^2 + 2*|rho_01|^2
    purity = alpha_sq ** 2 + beta_sq ** 2 + 2 * coherence ** 2

    return {
        "bloch": {"x": round(bloch_x, 4), "y": round(bloch_y, 4), "z": round(bloch_z, 4)},
        "theta": round(theta, 4),
        "phi": round(phi, 4),
        "superposition": {"alpha_sq": round(alpha_sq, 4), "beta_sq": round(beta_sq, 4)},
        "coherence": round(coherence, 4),
        "entropy": round(entropy, 4),
        "fidelity": round(fidelity, 4),
        "purity": round(min(purity, 1.0), 4),
        "is_aliased": freq > nyquist,
    }


# ─── n8n Webhook Stub ────────────────────────────────────────────────

@app.post("/webhook/alias")
async def alias_webhook(data: dict):
    """
    Stub endpoint for n8n automation.

    ⚠️  This returns a template-based explanation, NOT an LLM-generated one.
    In production, connect this to n8n → LLM workflow for real AI analysis.
    The frontend labels this as "AI Analysis" but it is rule-based string
    formatting until an actual LLM backend is configured.
    """
    logger.info(f"Alias webhook triggered: {data}")

    is_stub = True  # Flag so the frontend can show a disclaimer

    if data.get("aliased", False):
        freq = data.get("freq", 0)
        fs = data.get("fs", 0)
        alias_freq = data.get("alias_freq", 0)
        explanation = (
            f"⚠️ Aliasing Detected!\n\n"
            f"Signal frequency ({freq} Hz) exceeds the Nyquist limit ({fs/2} Hz).\n"
            f"The signal appears as {alias_freq} Hz instead of {freq} Hz.\n\n"
            f"💡 Increase sampling rate to at least {2 * freq} Hz to avoid aliasing."
        )
    else:
        explanation = "✅ No aliasing detected. The sampling rate satisfies the Nyquist criterion."

    return {"explanation": explanation, "status": "processed", "is_stub": is_stub}


# ─── Entry Point ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
