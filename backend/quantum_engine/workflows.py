"""
Quantum Engine – Hybrid Classical-Quantum Workflows

Orchestrates the full pipeline:
  1. Classical preprocessing (signal generation via signal_engine)
  2. Parameterized quantum circuit construction
  3. Quantum execution on chosen backend
  4. Classical postprocessing + comparison metrics
"""

from __future__ import annotations

import logging
import time

import numpy as np

from quantum_engine.backends import QuantumBackend, get_backend
from quantum_engine.circuits import (
    build_phase_estimation_spec,
    build_sampling_spec,
)
from quantum_engine.models import (
    ExecutionResult,
    NoiseConfig,
    ObservableSpec,
)

# Import the existing classical signal engine
from signal_engine import process_signal, compute_fft, generate_signal, sample_signal

logger = logging.getLogger("quantum_engine.workflows")


def run_quantum_sampling_comparison(
    freq: float = 100.0,
    fs: float = 300.0,
    noise_level: float = 0.0,
    wave_type: str = "sine",
    backend: QuantumBackend | None = None,
    backend_name: str = "local_classical",
    shots: int = 1024,
    noise_config: NoiseConfig | None = None,
    num_qubits: int = 4,
    circuit_type: str = "phase_estimation",
) -> ExecutionResult:
    """
    Full hybrid classical-quantum workflow.

    1. Classical preprocessing: generate signal, compute FFT
    2. Encode signal parameters into a quantum circuit
    3. Execute circuit on the chosen backend
    4. Compare quantum measurement results with classical analysis

    Returns an ExecutionResult with both quantum data and comparison metrics.
    """
    start_total = time.time()
    noise_config = noise_config or NoiseConfig()

    # ── Step 1: Classical preprocessing ──
    logger.info(
        f"Classical preprocessing: freq={freq}, fs={fs}, "
        f"noise={noise_level}, wave={wave_type}"
    )

    classical_result = process_signal(
        freq=freq, fs=fs, noise_level=noise_level, wave_type=wave_type
    )

    # Get FFT peak info
    fft_freqs_orig = np.array(classical_result["fft"]["original"]["freq"])
    fft_mags_orig = np.array(classical_result["fft"]["original"]["magnitude"])
    if len(fft_freqs_orig) > 0 and len(fft_mags_orig) > 0:
        peak_idx = int(np.argmax(fft_mags_orig))
        classical_peak_freq = float(fft_freqs_orig[peak_idx])
        classical_peak_mag = float(fft_mags_orig[peak_idx])
    else:
        classical_peak_freq = freq
        classical_peak_mag = 1.0

    # ── Step 2: Build quantum circuit ──
    if circuit_type == "phase_estimation":
        circuit_spec = build_phase_estimation_spec(
            signal_freq=freq,
            sample_rate=fs,
            num_qubits=num_qubits,
        )
    elif circuit_type == "quantum_sampling":
        # Use sampled signal values as input to quantum sampling
        signal_samples = classical_result["sampled"]["y"]
        circuit_spec = build_sampling_spec(
            signal_samples=signal_samples,
            num_qubits=min(num_qubits, 5),  # Cap at 5 qubits for sampling
        )
    else:
        circuit_spec = build_phase_estimation_spec(
            signal_freq=freq, sample_rate=fs, num_qubits=num_qubits
        )

    observable_spec = ObservableSpec()

    # ── Step 3: Execute on backend ──
    if backend is None:
        backend = get_backend(backend_name)

    logger.info(
        f"Executing on backend={backend.name}, shots={shots}, "
        f"noise={noise_config.model_type.value}"
    )

    result = backend.run(
        circuit_spec=circuit_spec,
        observable_spec=observable_spec,
        shots=shots,
        noise_config=noise_config,
    )

    # ── Step 4: Classical postprocessing & comparison ──
    comparison = _compute_comparison(
        result=result,
        classical_result=classical_result,
        circuit_spec=circuit_spec,
        freq=freq,
        fs=fs,
        classical_peak_freq=classical_peak_freq,
        classical_peak_mag=classical_peak_mag,
    )

    result.classical_comparison = comparison
    result.metadata["total_workflow_time_ms"] = round(
        (time.time() - start_total) * 1000, 2
    )
    result.metadata["circuit_type"] = circuit_type
    result.metadata["signal_params"] = {
        "freq": freq,
        "fs": fs,
        "noise_level": noise_level,
        "wave_type": wave_type,
    }

    return result


def _compute_comparison(
    result: ExecutionResult,
    classical_result: dict,
    circuit_spec,
    freq: float,
    fs: float,
    classical_peak_freq: float,
    classical_peak_mag: float,
) -> dict:
    """
    Compare quantum measurement distribution against classical analysis.

    For QPE: compare estimated frequency vs classical FFT peak.
    For sampling: compare measurement distribution vs signal amplitude distribution.
    """
    comparison = {
        "classical_peak_freq": classical_peak_freq,
        "classical_peak_magnitude": classical_peak_mag,
        "classical_is_aliased": classical_result["aliased"],
        "classical_alias_freq": classical_result["alias_freq"],
        "classical_snr": classical_result["error"]["snr"],
        "classical_mse": classical_result["error"]["mse"],
    }

    if circuit_spec.circuit_type.value == "phase_estimation":
        # Extract quantum-estimated frequency from measurement counts
        counts = result.counts
        if counts:
            n_counting = circuit_spec.parameters.get(
                "counting_qubits", circuit_spec.num_qubits - 1
            )
            # Most probable measurement gives the phase estimate
            top_state = max(counts, key=counts.get)
            # Convert binary to decimal, then to frequency
            measured_int = int(top_state, 2)
            estimated_phase = measured_int / (2**n_counting)
            estimated_freq = estimated_phase * fs

            comparison["quantum_estimated_phase"] = round(estimated_phase, 6)
            comparison["quantum_estimated_freq"] = round(estimated_freq, 2)
            comparison["frequency_error_hz"] = round(
                abs(estimated_freq - freq), 2
            )
            # Success metric: did QPE find the right frequency?
            comparison["phase_estimation_accurate"] = (
                abs(estimated_freq - freq) < fs / (2**n_counting)
            )

    elif circuit_spec.circuit_type.value == "quantum_sampling":
        # Compare measurement distribution vs signal distribution
        probs = result.probabilities
        if probs:
            # KL divergence between quantum and classical distributions
            signal_samples = classical_result["sampled"]["y"]
            n = circuit_spec.num_qubits
            num_states = 2**n
            classical_probs = _signal_to_probs(signal_samples, num_states)
            quantum_probs = np.zeros(num_states)
            for state, p in probs.items():
                idx = int(state, 2)
                if idx < num_states:
                    quantum_probs[idx] = p

            kl_div = _kl_divergence(classical_probs, quantum_probs)
            comparison["kl_divergence"] = round(kl_div, 6)
            comparison["distribution_match_score"] = round(
                max(0, 1 - kl_div), 4
            )

    return comparison


def _signal_to_probs(samples: list[float], num_bins: int) -> np.ndarray:
    """Convert signal samples to a probability distribution."""
    arr = np.array(samples[:num_bins], dtype=float)
    arr = arr - arr.min() + 1e-8
    probs = arr / arr.sum()
    if len(probs) < num_bins:
        padded = np.zeros(num_bins)
        padded[: len(probs)] = probs
        padded[len(probs) :] = (1 - probs.sum()) / max((num_bins - len(probs)), 1)
        probs = padded
    return probs


def _kl_divergence(p: np.ndarray, q: np.ndarray) -> float:
    """Compute KL divergence D(p||q) with smoothing."""
    eps = 1e-10
    p = np.clip(p, eps, None)
    q = np.clip(q, eps, None)
    p = p / p.sum()
    q = q / q.sum()
    return float(np.sum(p * np.log(p / q)))
