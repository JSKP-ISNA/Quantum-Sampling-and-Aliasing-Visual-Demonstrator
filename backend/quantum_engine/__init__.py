"""
Quantum Engine – Provider-agnostic quantum execution module.

Provides circuit abstraction, multiple backend targets (classical simulator,
Qiskit Aer, hardware placeholder), async job management, and hybrid
classical-quantum workflows for the AliasingViz 3D application.
"""

from quantum_engine.models import (
    CircuitSpec,
    ObservableSpec,
    QuantumJob,
    ExecutionResult,
    NoiseConfig,
    JobStatus,
)
from quantum_engine.backends import (
    QuantumBackend,
    LocalClassicalEngine,
    QuantumSimulatorEngine,
    QuantumHardwareEngine,
    get_backend,
)
from quantum_engine.job_manager import JobManager
from quantum_engine.workflows import run_quantum_sampling_comparison

__all__ = [
    "CircuitSpec",
    "ObservableSpec",
    "QuantumJob",
    "ExecutionResult",
    "NoiseConfig",
    "JobStatus",
    "QuantumBackend",
    "LocalClassicalEngine",
    "QuantumSimulatorEngine",
    "QuantumHardwareEngine",
    "get_backend",
    "JobManager",
    "run_quantum_sampling_comparison",
]
