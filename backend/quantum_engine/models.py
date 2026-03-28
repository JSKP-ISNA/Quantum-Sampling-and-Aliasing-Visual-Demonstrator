"""
Quantum Engine – Domain Models

Provider-agnostic data structures for quantum circuits, jobs, and results.
These models decouple UI/API code from any specific SDK (Qiskit, PennyLane, etc.).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


# ─── Enums ────────────────────────────────────────────────────────────


class JobStatus(str, Enum):
    """Lifecycle states for a quantum job."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CircuitType(str, Enum):
    """Supported circuit templates."""
    PHASE_ESTIMATION = "phase_estimation"
    QUANTUM_SAMPLING = "quantum_sampling"
    QFT = "qft"
    CUSTOM = "custom"


class NoiseModelType(str, Enum):
    """Noise model fidelity levels."""
    IDEAL = "ideal"
    DEPOLARIZING = "depolarizing"
    THERMAL = "thermal"


class ObservableType(str, Enum):
    """Types of quantum observables."""
    COMPUTATIONAL_BASIS = "computational_basis"
    PAULI_Z = "pauli_z"
    PAULI_X = "pauli_x"
    PAULI_Y = "pauli_y"


# ─── Domain Objects ──────────────────────────────────────────────────


@dataclass
class NoiseConfig:
    """Configuration for noise simulation."""
    model_type: NoiseModelType = NoiseModelType.IDEAL
    single_gate_error: float = 0.001
    two_gate_error: float = 0.01
    measurement_error: float = 0.01
    thermal_population: float = 0.01

    def to_dict(self) -> dict:
        return {
            "model_type": self.model_type.value,
            "single_gate_error": self.single_gate_error,
            "two_gate_error": self.two_gate_error,
            "measurement_error": self.measurement_error,
            "thermal_population": self.thermal_population,
        }


@dataclass
class CircuitSpec:
    """
    Provider-agnostic circuit specification.
    Describes *what* circuit to build without tying to any SDK.
    """
    circuit_type: CircuitType
    num_qubits: int
    parameters: dict[str, Any] = field(default_factory=dict)
    depth: int | None = None
    gate_count: int | None = None
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "circuit_type": self.circuit_type.value,
            "num_qubits": self.num_qubits,
            "parameters": self.parameters,
            "depth": self.depth,
            "gate_count": self.gate_count,
            "description": self.description,
        }


@dataclass
class ObservableSpec:
    """What to measure on the circuit output."""
    observable_type: ObservableType = ObservableType.COMPUTATIONAL_BASIS
    qubit_indices: list[int] | None = None

    def to_dict(self) -> dict:
        return {
            "observable_type": self.observable_type.value,
            "qubit_indices": self.qubit_indices,
        }


@dataclass
class ExecutionResult:
    """
    Provider-agnostic result of a quantum execution.
    Contains counts, expectation values, and execution metadata.
    """
    job_id: str
    counts: dict[str, int] = field(default_factory=dict)
    probabilities: dict[str, float] = field(default_factory=dict)
    expectation_values: dict[str, float] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    # Comparison metrics (classical vs quantum)
    classical_comparison: dict[str, Any] | None = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "counts": self.counts,
            "probabilities": self.probabilities,
            "expectation_values": self.expectation_values,
            "metadata": self.metadata,
            "classical_comparison": self.classical_comparison,
        }


@dataclass
class QuantumJob:
    """
    Full lifecycle record for a quantum execution job.
    Tracks submission → queued → running → completed/failed.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: JobStatus = JobStatus.QUEUED
    circuit_spec: CircuitSpec | None = None
    observable_spec: ObservableSpec | None = None
    shots: int = 1024
    backend_name: str = "local_classical"
    noise_config: NoiseConfig = field(default_factory=NoiseConfig)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    started_at: str | None = None
    completed_at: str | None = None
    error_message: str | None = None
    result: ExecutionResult | None = None
    retries: int = 0
    max_retries: int = 3

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "status": self.status.value,
            "circuit_spec": self.circuit_spec.to_dict() if self.circuit_spec else None,
            "observable_spec": (
                self.observable_spec.to_dict() if self.observable_spec else None
            ),
            "shots": self.shots,
            "backend_name": self.backend_name,
            "noise_config": self.noise_config.to_dict(),
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error_message": self.error_message,
            "retries": self.retries,
        }
