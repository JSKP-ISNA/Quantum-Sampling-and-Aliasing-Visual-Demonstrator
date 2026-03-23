"""
AliasingViz 3D – FastAPI Backend
WebSocket-driven real-time signal processing server with quantum state computations.
"""

import asyncio
import json
import logging
import math

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.websocket("/stream")
async def stream_signal(ws: WebSocket):
    """
    Real-time bidirectional stream.
    
    Client sends parameter updates as JSON:
        {"freq": 150, "fs": 400, "noise_level": 0.1, "wave_type": "sine"}
    
    Server continuously sends processed signal data back.
    """
    await ws.accept()
    logger.info("WebSocket client connected")

    params = DEFAULT_PARAMS.copy()
    frame_interval = 1 / 30  # 30 FPS to balance performance

    try:
        while True:
            # Check for incoming parameter updates (non-blocking)
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=frame_interval)
                update = json.loads(raw)

                # Validate and update parameters
                if "freq" in update:
                    params["freq"] = max(1.0, min(2000.0, float(update["freq"])))
                if "fs" in update:
                    params["fs"] = max(2.0, min(5000.0, float(update["fs"])))
                if "noise_level" in update:
                    params["noise_level"] = max(0.0, min(1.0, float(update["noise_level"])))
                if "wave_type" in update:
                    if update["wave_type"] in ("sine", "square", "sawtooth", "triangle"):
                        params["wave_type"] = update["wave_type"]

            except asyncio.TimeoutError:
                pass  # No update received, continue with current params

            # Process signal with current parameters
            result = process_signal(**params)

            # Send data to client
            await ws.send_text(json.dumps(result))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await ws.close()
        except Exception:
            pass


# ─── Quantum State Computation ───────────────────────────────────────

import numpy as np

@app.get("/api/quantum-state")
async def quantum_state(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
):
    """
    Compute quantum-physics-inspired state data from signal parameters.
    Uses NumPy for Bloch sphere coordinates, von Neumann entropy,
    coherence metrics, and superposition probability amplitudes.
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
    coherence = abs(math.sin(theta)) * math.exp(-noise_level * 2.0)

    # Von Neumann entropy: S = -sum(p * log(p))
    eigenvalues = np.array([alpha_sq, beta_sq])
    eigenvalues = np.clip(eigenvalues, 1e-10, 1.0)
    entropy = float(-np.sum(eigenvalues * np.log2(eigenvalues)))

    # Fidelity (how close to a pure state)
    fidelity = max(alpha_sq, beta_sq)

    # Purity: Tr(rho^2) for a qubit
    purity = alpha_sq ** 2 + beta_sq ** 2 + 2 * (coherence / 2) ** 2

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
    In production, n8n would call this or be called by this endpoint.
    """
    logger.info(f"Alias webhook triggered: {data}")

    # Placeholder response - in production, n8n would process this
    explanation = ""
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

    return {"explanation": explanation, "status": "processed"}


# ─── Entry Point ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
