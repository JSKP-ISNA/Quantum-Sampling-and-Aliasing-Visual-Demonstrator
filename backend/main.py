"""
AliasingViz 3D – FastAPI Backend
WebSocket-driven real-time signal processing server with quantum engine integration.
"""

import asyncio
import json
import logging
import math
import os
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from signal_engine import process_signal
from config import QuantumConfig
from quantum_engine.models import NoiseConfig, NoiseModelType, JobStatus
from quantum_engine.job_manager import JobManager
from quantum_engine.persistence import ExperimentStore


# ─── Configuration ────────────────────────────────────────────────────

config = QuantumConfig.from_env()

# ─── Singletons ──────────────────────────────────────────────────────

job_manager: JobManager | None = None
experiment_store: ExperimentStore | None = None


# ─── App Lifespan ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize quantum engine components on startup."""
    global job_manager, experiment_store

    logging.info("Initializing quantum engine...")
    job_manager = JobManager(
        default_backend=config.provider,
        job_timeout=config.job_timeout_seconds,
        result_ttl_seconds=config.result_ttl_seconds,
        api_token=config.api_token,
    )
    experiment_store = ExperimentStore(db_path=config.db_path)
    logging.info(
        f"Quantum engine ready: provider={config.provider}, "
        f"shots={config.shots}, noise={config.noise_model}"
    )

    yield

    logging.info("Shutting down quantum engine...")


# ─── App Setup ────────────────────────────────────────────────────────

app = FastAPI(
    title="AliasingViz 3D Backend",
    version="2.0.0",
    description="Real-time signal processing + quantum execution engine",
    lifespan=lifespan,
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


# ═══════════════════════════════════════════════════════════════════════
#  CLASSICAL SIGNAL ENDPOINTS (backward compatible)
# ═══════════════════════════════════════════════════════════════════════


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "AliasingViz 3D Backend",
        "version": "2.0.0",
        "quantum_engine": {
            "provider": config.provider,
            "noise_model": config.noise_model,
            "shots": config.shots,
        },
    }


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
    Real-time bidirectional stream for classical signal data using asyncio.gather for separate
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


# ═══════════════════════════════════════════════════════════════════════
#  QUANTUM ENGINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════


@app.get("/api/quantum/backends")
async def list_backends():
    """List available quantum backends with their capabilities."""
    return {"backends": job_manager.list_backends()}


@app.post("/api/quantum/submit")
async def submit_quantum_job(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
    wave_type: str = "sine",
    backend: Optional[str] = None,
    shots: Optional[int] = None,
    noise_model: Optional[str] = None,
    num_qubits: Optional[int] = None,
    circuit_type: Optional[str] = None,
):
    """
    Submit a quantum job for asynchronous execution.

    Returns a job ID that can be polled for status and results.
    """
    # Build noise config from request or defaults
    noise_model_type = NoiseModelType(noise_model or config.noise_model)
    noise_cfg = NoiseConfig(
        model_type=noise_model_type,
        single_gate_error=config.single_gate_error,
        two_gate_error=config.two_gate_error,
        measurement_error=config.measurement_error,
        thermal_population=config.thermal_population,
    )

    job_id = await job_manager.submit_job(
        freq=freq,
        fs=fs,
        noise_level=noise_level,
        wave_type=wave_type,
        backend_name=backend or config.provider,
        shots=shots or config.shots,
        noise_config=noise_cfg,
        num_qubits=num_qubits or config.default_num_qubits,
        circuit_type=circuit_type or config.default_circuit_type,
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Job submitted successfully. Poll /api/quantum/status/{job_id} for updates.",
    }


@app.get("/api/quantum/status/{job_id}")
async def get_job_status(job_id: str):
    """Get the current status of a quantum job."""
    status = job_manager.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return status


@app.get("/api/quantum/result/{job_id}")
async def get_job_result(job_id: str):
    """
    Get the result of a completed quantum job.

    Returns counts, probabilities, expectation values, and comparison metrics.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status == JobStatus.QUEUED or job.status == JobStatus.RUNNING:
        return {
            "job_id": job_id,
            "status": job.status.value,
            "message": "Job is still processing. Poll again shortly.",
        }

    if job.status == JobStatus.FAILED:
        return {
            "job_id": job_id,
            "status": "failed",
            "error": job.error_message,
        }

    result = job_manager.get_job_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Auto-save experiment
    try:
        exp_id = experiment_store.save_experiment(job, result)
        result_dict = result.to_dict()
        result_dict["experiment_id"] = exp_id
    except Exception as e:
        logger.warning(f"Failed to save experiment: {e}")
        result_dict = result.to_dict()

    return result_dict


@app.get("/api/quantum/experiments")
async def list_experiments(limit: int = 50, offset: int = 0):
    """List saved quantum experiments."""
    experiments = experiment_store.list_experiments(limit=limit, offset=offset)
    return {"experiments": experiments, "total": len(experiments)}


@app.get("/api/quantum/experiments/{exp_id}")
async def get_experiment(exp_id: str):
    """Get a specific experiment by ID."""
    experiment = experiment_store.get_experiment(exp_id)
    if not experiment:
        raise HTTPException(status_code=404, detail=f"Experiment {exp_id} not found")
    return experiment


# ═══════════════════════════════════════════════════════════════════════
#  LEGACY QUANTUM STATE (kept for backward compat, now uses real engine)
# ═══════════════════════════════════════════════════════════════════════


@app.get("/api/quantum-state")
async def quantum_state(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
):
    """
    Compute quantum state data from signal parameters.

    This endpoint now uses the quantum engine for real execution
    while maintaining backward-compatible response format.
    """
    # Run a quick quantum job synchronously for immediate response
    from quantum_engine.backends import LocalClassicalEngine
    from quantum_engine.circuits import build_phase_estimation_spec
    from quantum_engine.models import ObservableSpec

    backend = LocalClassicalEngine()
    noise_cfg = NoiseConfig(
        model_type=NoiseModelType(config.noise_model),
        single_gate_error=config.single_gate_error,
    )

    spec = build_phase_estimation_spec(freq, fs, num_qubits=4)
    result = backend.run(spec, ObservableSpec(), shots=512, noise_config=noise_cfg)

    # Extract quantum metrics for backward-compatible response
    nyquist = fs / 2.0
    ratio = min(freq / max(nyquist, 1.0), 2.0)
    theta = ratio * math.pi
    phi = (freq % 360) * math.pi / 180.0

    bloch_x = math.sin(theta) * math.cos(phi)
    bloch_y = math.sin(theta) * math.sin(phi)
    bloch_z = math.cos(theta)

    alpha_sq = (math.cos(theta / 2)) ** 2
    beta_sq = (math.sin(theta / 2)) ** 2
    # Quantum coherence: Off-diagonal density matrix element magnitude
    # |rho_01| = |alpha * beta| for pure state, decayed by noise
    alpha = math.cos(theta / 2)
    beta = math.sin(theta / 2)
    coherence = abs(alpha * beta) * math.exp(-noise_level * 2.0)

    eigenvalues = np.array([alpha_sq, beta_sq])
    eigenvalues = np.clip(eigenvalues, 1e-10, 1.0)
    entropy = float(-np.sum(eigenvalues * np.log2(eigenvalues)))
    fidelity = max(alpha_sq, beta_sq)
    # Purity: Tr(rho^2) for a qubit density matrix
    # rho = [[alpha_sq, alpha*beta*e^{-i*phi} * decay],
    #         [alpha*beta*e^{i*phi} * decay, beta_sq]]
    # Tr(rho^2) = alpha_sq^2 + beta_sq^2 + 2*|rho_01|^2
    purity = alpha_sq ** 2 + beta_sq ** 2 + 2 * coherence ** 2

    return {
        # Legacy fields
        "bloch": {"x": round(bloch_x, 4), "y": round(bloch_y, 4), "z": round(bloch_z, 4)},
        "theta": round(theta, 4),
        "phi": round(phi, 4),
        "superposition": {"alpha_sq": round(alpha_sq, 4), "beta_sq": round(beta_sq, 4)},
        "coherence": round(coherence, 4),
        "entropy": round(entropy, 4),
        "fidelity": round(fidelity, 4),
        "purity": round(min(purity, 1.0), 4),
        "is_aliased": freq > nyquist,
        # New quantum engine fields
        "quantum_counts": result.counts,
        "quantum_probabilities": result.probabilities,
        "quantum_expectation_values": result.expectation_values,
        "quantum_metadata": result.metadata,
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
