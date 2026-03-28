"""
AliasingViz 3D – Application Configuration

Environment-driven settings for quantum backend, execution parameters,
persistence, and provider credentials.

Load from .env file or environment variables.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Try to load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


@dataclass
class QuantumConfig:
    """Quantum engine configuration loaded from environment."""

    # Provider selection
    provider: str = "local_classical"  # local_classical | qiskit_simulator | qiskit_hardware
    backend: str = "aer_simulator"      # Backend name within the provider
    shots: int = 1024                    # Default shot count
    optimization_level: int = 1          # Transpiler optimization (0-3)
    default_num_qubits: int = 4          # Default qubit count for circuits
    default_circuit_type: str = "phase_estimation"  # phase_estimation | quantum_sampling | qft

    # Noise model
    noise_model: str = "ideal"           # ideal | depolarizing | thermal
    single_gate_error: float = 0.001
    two_gate_error: float = 0.01
    measurement_error: float = 0.01
    thermal_population: float = 0.01

    # Hardware credentials
    api_token: str | None = None

    # Job management
    job_timeout_seconds: int = 60
    result_ttl_seconds: int = 3600       # 1 hour cache
    max_retries: int = 3

    # Persistence
    db_path: str = "experiments.db"

    @classmethod
    def from_env(cls) -> QuantumConfig:
        """Load configuration from environment variables."""
        return cls(
            provider=os.getenv("QUANTUM_PROVIDER", "local_classical"),
            backend=os.getenv("QUANTUM_BACKEND", "aer_simulator"),
            shots=int(os.getenv("QUANTUM_SHOTS", "1024")),
            optimization_level=int(os.getenv("QUANTUM_OPTIMIZATION_LEVEL", "1")),
            default_num_qubits=int(os.getenv("QUANTUM_NUM_QUBITS", "4")),
            default_circuit_type=os.getenv("QUANTUM_CIRCUIT_TYPE", "phase_estimation"),
            noise_model=os.getenv("QUANTUM_NOISE_MODEL", "ideal"),
            single_gate_error=float(os.getenv("QUANTUM_SINGLE_GATE_ERROR", "0.001")),
            two_gate_error=float(os.getenv("QUANTUM_TWO_GATE_ERROR", "0.01")),
            measurement_error=float(os.getenv("QUANTUM_MEASUREMENT_ERROR", "0.01")),
            thermal_population=float(os.getenv("QUANTUM_THERMAL_POPULATION", "0.01")),
            api_token=os.getenv("QUANTUM_API_TOKEN"),
            job_timeout_seconds=int(os.getenv("JOB_TIMEOUT_SECONDS", "60")),
            result_ttl_seconds=int(os.getenv("RESULT_TTL_SECONDS", "3600")),
            max_retries=int(os.getenv("MAX_RETRIES", "3")),
            db_path=os.getenv("DB_PATH", "experiments.db"),
        )
