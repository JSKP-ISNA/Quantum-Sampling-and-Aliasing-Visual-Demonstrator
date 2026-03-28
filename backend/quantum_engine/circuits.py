"""
Quantum Engine – Circuit Construction

Builds parameterized quantum circuits from high-level specifications.
Provides both abstract CircuitSpec objects and concrete Qiskit QuantumCircuit
objects when the Qiskit SDK is available.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from quantum_engine.models import CircuitSpec, CircuitType


# ─── CircuitSpec Builders ────────────────────────────────────────────


def build_phase_estimation_spec(
    signal_freq: float,
    sample_rate: float,
    num_qubits: int = 4,
) -> CircuitSpec:
    """
    Create a CircuitSpec for Quantum Phase Estimation.

    The phase φ = freq/fs (mod 1) is the eigenvalue phase.
    QPE uses num_qubits counting qubits + 1 target qubit.
    """
    phase = (signal_freq / sample_rate) % 1.0
    total_qubits = num_qubits + 1  # counting + target

    depth = num_qubits * 3 + 2  # Hadamards + controlled rotations + inverse QFT
    gate_count = num_qubits * 2 + num_qubits * (num_qubits - 1) // 2 + num_qubits

    return CircuitSpec(
        circuit_type=CircuitType.PHASE_ESTIMATION,
        num_qubits=total_qubits,
        parameters={
            "signal_freq": signal_freq,
            "sample_rate": sample_rate,
            "phase": round(phase, 6),
            "counting_qubits": num_qubits,
        },
        depth=depth,
        gate_count=gate_count,
        description=(
            f"QPE circuit: φ={phase:.4f} (freq={signal_freq}Hz, fs={sample_rate}Hz), "
            f"{num_qubits} counting qubits"
        ),
    )


def build_sampling_spec(
    signal_samples: list[float] | np.ndarray,
    num_qubits: int = 3,
) -> CircuitSpec:
    """
    Create a CircuitSpec for quantum sampling.

    Encodes discretized signal amplitudes into a quantum state
    whose measurement probabilities match the normalized signal distribution.
    """
    if isinstance(signal_samples, np.ndarray):
        signal_samples = signal_samples.tolist()

    # Truncate to 2^n states
    num_states = 2**num_qubits
    samples = signal_samples[:num_states]

    depth = num_qubits * 4  # Amplitude encoding + entanglement
    gate_count = num_qubits * 6

    return CircuitSpec(
        circuit_type=CircuitType.QUANTUM_SAMPLING,
        num_qubits=num_qubits,
        parameters={
            "signal_samples": samples,
            "num_bins": num_states,
        },
        depth=depth,
        gate_count=gate_count,
        description=f"Quantum sampling circuit: {num_qubits} qubits, {len(samples)} input samples",
    )


def build_qft_spec(num_qubits: int = 4) -> CircuitSpec:
    """Create a CircuitSpec for Quantum Fourier Transform."""
    depth = num_qubits * (num_qubits + 1) // 2
    gate_count = num_qubits + num_qubits * (num_qubits - 1) // 2

    return CircuitSpec(
        circuit_type=CircuitType.QFT,
        num_qubits=num_qubits,
        parameters={"transform_size": 2**num_qubits},
        depth=depth,
        gate_count=gate_count,
        description=f"QFT circuit: {num_qubits} qubits ({2**num_qubits}-point transform)",
    )


# ─── Qiskit Circuit Builders ────────────────────────────────────────


def build_qiskit_circuit(spec: CircuitSpec):
    """
    Build a concrete Qiskit QuantumCircuit from a CircuitSpec.
    Raises ImportError if Qiskit is not installed.
    """
    try:
        from qiskit import QuantumCircuit
    except ImportError:
        raise ImportError(
            "Qiskit is required for building quantum circuits. "
            "Install with: pip install qiskit qiskit-aer"
        )

    if spec.circuit_type == CircuitType.PHASE_ESTIMATION:
        return _build_qiskit_qpe(spec)
    elif spec.circuit_type == CircuitType.QUANTUM_SAMPLING:
        return _build_qiskit_sampling(spec)
    elif spec.circuit_type == CircuitType.QFT:
        return _build_qiskit_qft(spec)
    else:
        # Generic: create empty circuit with measurements
        qc = QuantumCircuit(spec.num_qubits, spec.num_qubits)
        qc.h(range(spec.num_qubits))
        qc.measure(range(spec.num_qubits), range(spec.num_qubits))
        return qc


def _build_qiskit_qpe(spec: CircuitSpec):
    """Build a QPE circuit in Qiskit."""
    from qiskit import QuantumCircuit

    counting = spec.parameters.get("counting_qubits", spec.num_qubits - 1)
    total = counting + 1
    phase = spec.parameters.get("phase", 0.25)

    qc = QuantumCircuit(total, counting)

    # Prepare target qubit in eigenstate |1⟩
    qc.x(total - 1)

    # Hadamard on counting qubits
    for i in range(counting):
        qc.h(i)

    # Controlled phase rotations
    for i in range(counting):
        angle = 2 * math.pi * phase * (2**i)
        qc.cp(angle, i, total - 1)

    # Inverse QFT on counting qubits
    _apply_inverse_qft(qc, counting)

    # Measure counting qubits
    qc.measure(range(counting), range(counting))

    return qc


def _build_qiskit_sampling(spec: CircuitSpec):
    """Build a quantum sampling circuit (amplitude encoding)."""
    from qiskit import QuantumCircuit

    n = spec.num_qubits
    num_states = 2**n
    qc = QuantumCircuit(n, n)

    signal_samples = spec.parameters.get("signal_samples", [])

    if signal_samples:
        # Normalize samples to create valid state vector amplitudes
        amplitudes = np.array(signal_samples[:num_states], dtype=float)
        amplitudes = amplitudes - amplitudes.min() + 1e-8
        amplitudes = np.sqrt(amplitudes / amplitudes.sum())

        # Pad to num_states
        if len(amplitudes) < num_states:
            padded = np.zeros(num_states)
            padded[: len(amplitudes)] = amplitudes
            remaining = 1.0 - np.sum(amplitudes**2)
            if remaining > 0 and num_states > len(amplitudes):
                fill = math.sqrt(remaining / (num_states - len(amplitudes)))
                padded[len(amplitudes) :] = fill
            amplitudes = padded

        # Re-normalize to ensure unit norm
        norm = np.linalg.norm(amplitudes)
        if norm > 0:
            amplitudes /= norm

        qc.initialize(amplitudes.tolist(), range(n))
    else:
        # Default: uniform superposition
        qc.h(range(n))

    qc.measure(range(n), range(n))
    return qc


def _build_qiskit_qft(spec: CircuitSpec):
    """Build a QFT circuit."""
    from qiskit import QuantumCircuit

    n = spec.num_qubits
    qc = QuantumCircuit(n, n)

    # Apply H and controlled rotations
    for i in range(n):
        qc.h(i)
        for j in range(i + 1, n):
            qc.cp(math.pi / (2 ** (j - i)), j, i)

    # Swap qubits for correct ordering
    for i in range(n // 2):
        qc.swap(i, n - i - 1)

    qc.measure(range(n), range(n))
    return qc


def _apply_inverse_qft(qc, n: int):
    """Apply inverse QFT to the first n qubits of a circuit."""
    # Swap
    for i in range(n // 2):
        qc.swap(i, n - i - 1)

    # Inverse rotations
    for i in range(n - 1, -1, -1):
        for j in range(n - 1, i, -1):
            qc.cp(-math.pi / (2 ** (j - i)), j, i)
        qc.h(i)
