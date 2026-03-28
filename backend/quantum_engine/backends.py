"""
Quantum Engine – Backend Implementations

Three execution backends behind a common interface:
  • LocalClassicalEngine  – NumPy-based, zero dependencies beyond NumPy
  • QuantumSimulatorEngine – Qiskit Aer, supports noise models
  • QuantumHardwareEngine  – placeholder for IBM Quantum / other providers
"""

from __future__ import annotations

import logging
import math
import time
from abc import ABC, abstractmethod
from typing import Any

import numpy as np

from quantum_engine.models import (
    CircuitSpec,
    CircuitType,
    ExecutionResult,
    NoiseConfig,
    NoiseModelType,
    ObservableSpec,
)

logger = logging.getLogger("quantum_engine.backends")


# ─── Abstract Backend Interface ──────────────────────────────────────


class QuantumBackend(ABC):
    """Provider-agnostic interface for quantum execution."""

    name: str = "abstract"
    capabilities: dict[str, Any] = {}

    @abstractmethod
    def run(
        self,
        circuit_spec: CircuitSpec,
        observable_spec: ObservableSpec | None = None,
        shots: int = 1024,
        noise_config: NoiseConfig | None = None,
    ) -> ExecutionResult:
        """Execute a circuit and return measurement results."""
        ...

    def info(self) -> dict[str, Any]:
        """Return backend metadata."""
        return {
            "name": self.name,
            "capabilities": self.capabilities,
        }


# ─── LocalClassicalEngine ───────────────────────────────────────────


class LocalClassicalEngine(QuantumBackend):
    """
    Pure-NumPy classical simulation of quantum circuit behaviour.
    No external quantum SDK required. Good for fast local testing
    and as the baseline for classical-vs-quantum comparisons.
    """

    name = "local_classical"
    capabilities = {
        "max_qubits": 20,
        "noise_support": True,
        "type": "classical_simulator",
    }

    def run(
        self,
        circuit_spec: CircuitSpec,
        observable_spec: ObservableSpec | None = None,
        shots: int = 1024,
        noise_config: NoiseConfig | None = None,
    ) -> ExecutionResult:
        start = time.time()
        noise_config = noise_config or NoiseConfig()
        n = circuit_spec.num_qubits

        # Build probability distribution from circuit parameters
        probs = self._build_probabilities(circuit_spec, noise_config)

        # Sample from distribution
        num_states = 2**n
        labels = [format(i, f"0{n}b") for i in range(num_states)]
        samples = np.random.choice(num_states, size=shots, p=probs)
        counts = {}
        for s in samples:
            label = labels[s]
            counts[label] = counts.get(label, 0) + 1

        # Probabilities from counts
        probabilities = {k: v / shots for k, v in counts.items()}

        # Expectation values (Z-basis for each qubit)
        expectation_values = {}
        for q in range(n):
            ev = 0.0
            for state_idx, label in enumerate(labels):
                # Z eigenvalue: +1 for |0⟩, -1 for |1⟩
                z_val = 1.0 if label[q] == "0" else -1.0
                ev += z_val * probs[state_idx]
            expectation_values[f"Z_{q}"] = round(ev, 6)

        elapsed = time.time() - start

        return ExecutionResult(
            job_id="",
            counts=counts,
            probabilities=probabilities,
            expectation_values=expectation_values,
            metadata={
                "backend": self.name,
                "shots": shots,
                "num_qubits": n,
                "circuit_depth": circuit_spec.depth or self._estimate_depth(circuit_spec),
                "gate_count": circuit_spec.gate_count or self._estimate_gates(circuit_spec),
                "noise_model": noise_config.model_type.value,
                "execution_time_ms": round(elapsed * 1000, 2),
                "fidelity_estimate": self._estimate_fidelity(noise_config, circuit_spec),
            },
        )

    def _build_probabilities(
        self, spec: CircuitSpec, noise: NoiseConfig
    ) -> np.ndarray:
        """Build a probability distribution based on circuit type and params."""
        n = spec.num_qubits
        num_states = 2**n

        if spec.circuit_type == CircuitType.PHASE_ESTIMATION:
            probs = self._phase_estimation_probs(spec, n)
        elif spec.circuit_type == CircuitType.QUANTUM_SAMPLING:
            probs = self._sampling_probs(spec, n)
        elif spec.circuit_type == CircuitType.QFT:
            # QFT on |0...0⟩ produces uniform distribution
            probs = np.ones(num_states) / num_states
        else:
            probs = np.ones(num_states) / num_states

        # Apply noise
        if noise.model_type != NoiseModelType.IDEAL:
            probs = self._apply_noise(probs, noise, spec)

        # Normalize
        probs = np.clip(probs, 0, None)
        total = probs.sum()
        if total > 0:
            probs /= total
        else:
            probs = np.ones(num_states) / num_states

        return probs

    def _phase_estimation_probs(self, spec: CircuitSpec, n: int) -> np.ndarray:
        """
        Simulate QPE output distribution.
        The phase φ = freq/fs is encoded; the QPE output peaks at
        the integer closest to φ × 2^n.
        """
        num_states = 2**n
        freq = spec.parameters.get("signal_freq", 100.0)
        fs = spec.parameters.get("sample_rate", 300.0)
        phase = (freq / fs) % 1.0  # Normalize to [0, 1)

        probs = np.zeros(num_states)
        for k in range(num_states):
            # QPE probability formula: |1/N * sin(Nπ(φ - k/N)) / sin(π(φ - k/N))|²
            delta = phase - k / num_states
            if abs(delta) < 1e-10:
                probs[k] = 1.0
            elif abs(math.sin(math.pi * delta)) < 1e-10:
                probs[k] = 1.0
            else:
                numerator = math.sin(num_states * math.pi * delta)
                denominator = num_states * math.sin(math.pi * delta)
                probs[k] = (numerator / denominator) ** 2

        return probs

    def _sampling_probs(self, spec: CircuitSpec, n: int) -> np.ndarray:
        """
        Build a prob distribution that encodes discretized signal amplitudes.
        Maps signal sample values into qubit state probabilities.
        """
        num_states = 2**n
        signal_samples = spec.parameters.get("signal_samples", None)

        if signal_samples is not None and len(signal_samples) > 0:
            samples = np.array(signal_samples[:num_states])
            # Shift to positive, then normalize
            samples = samples - samples.min() + 1e-6
            probs = samples / samples.sum()
            # Pad or truncate to num_states
            if len(probs) < num_states:
                padded = np.zeros(num_states)
                padded[: len(probs)] = probs
                padded[len(probs) :] = (1 - probs.sum()) / max(
                    (num_states - len(probs)), 1
                )
                probs = padded
        else:
            # Default: slight bias toward |0⟩ states
            probs = np.zeros(num_states)
            probs[0] = 0.5
            probs[1:] = 0.5 / (num_states - 1)

        return probs

    def _apply_noise(
        self, probs: np.ndarray, noise: NoiseConfig, spec: CircuitSpec
    ) -> np.ndarray:
        """Mix probabilities toward uniform to simulate decoherence."""
        n = len(probs)
        uniform = np.ones(n) / n

        if noise.model_type == NoiseModelType.DEPOLARIZING:
            depth = spec.depth or 5
            # Error accumulates with depth
            error_rate = 1 - (1 - noise.single_gate_error) ** depth
            error_rate = min(error_rate, 0.5)
            probs = (1 - error_rate) * probs + error_rate * uniform
        elif noise.model_type == NoiseModelType.THERMAL:
            # Thermal noise biases toward lower-energy (|0...0⟩) states
            thermal = np.exp(-np.arange(n) * noise.thermal_population * 10)
            thermal /= thermal.sum()
            error_rate = noise.single_gate_error * (spec.depth or 5) * 0.5
            error_rate = min(error_rate, 0.4)
            probs = (1 - error_rate) * probs + error_rate * thermal

        # Measurement error: small uniform mixing
        m_err = noise.measurement_error * 0.5
        probs = (1 - m_err) * probs + m_err * uniform

        return probs

    def _estimate_fidelity(self, noise: NoiseConfig, spec: CircuitSpec) -> float:
        if noise.model_type == NoiseModelType.IDEAL:
            return 1.0
        depth = spec.depth or 5
        n = spec.num_qubits
        gate_fidelity = (1 - noise.single_gate_error) ** (depth * n)
        meas_fidelity = (1 - noise.measurement_error) ** n
        return round(gate_fidelity * meas_fidelity, 4)

    def _estimate_depth(self, spec: CircuitSpec) -> int:
        if spec.circuit_type == CircuitType.PHASE_ESTIMATION:
            return spec.num_qubits * 3 + 2
        elif spec.circuit_type == CircuitType.QFT:
            return spec.num_qubits * (spec.num_qubits + 1) // 2
        return spec.num_qubits * 2

    def _estimate_gates(self, spec: CircuitSpec) -> int:
        depth = self._estimate_depth(spec)
        return depth * spec.num_qubits


# ─── QuantumSimulatorEngine ─────────────────────────────────────────


class QuantumSimulatorEngine(QuantumBackend):
    """
    Qiskit Aer-based quantum simulator.
    Supports ideal and noisy simulation with realistic gate-level execution.
    Falls back to LocalClassicalEngine if Qiskit is not installed.
    """

    name = "qiskit_simulator"
    capabilities = {
        "max_qubits": 30,
        "noise_support": True,
        "type": "quantum_simulator",
    }

    def __init__(self):
        self._qiskit_available = False
        try:
            import qiskit  # noqa: F401
            from qiskit_aer import AerSimulator  # noqa: F401
            self._qiskit_available = True
        except ImportError:
            logger.warning(
                "Qiskit/Qiskit-Aer not installed. "
                "QuantumSimulatorEngine will fall back to LocalClassicalEngine."
            )
            self._fallback = LocalClassicalEngine()

    def run(
        self,
        circuit_spec: CircuitSpec,
        observable_spec: ObservableSpec | None = None,
        shots: int = 1024,
        noise_config: NoiseConfig | None = None,
    ) -> ExecutionResult:
        if not self._qiskit_available:
            logger.info("Falling back to LocalClassicalEngine")
            result = self._fallback.run(circuit_spec, observable_spec, shots, noise_config)
            result.metadata["backend"] = f"{self.name} (fallback: local_classical)"
            return result

        return self._run_qiskit(circuit_spec, observable_spec, shots, noise_config)

    def _run_qiskit(
        self,
        circuit_spec: CircuitSpec,
        observable_spec: ObservableSpec | None,
        shots: int,
        noise_config: NoiseConfig | None,
    ) -> ExecutionResult:
        from quantum_engine.circuits import build_qiskit_circuit
        from qiskit_aer import AerSimulator
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

        start = time.time()
        noise_config = noise_config or NoiseConfig()

        # Build the Qiskit circuit
        qc = build_qiskit_circuit(circuit_spec)

        # Configure simulator
        sim_options = {}
        noise_model = None

        if noise_config.model_type != NoiseModelType.IDEAL:
            noise_model = self._build_noise_model(noise_config)
            sim_options["noise_model"] = noise_model

        backend = AerSimulator(**sim_options)

        # Transpile
        pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
        transpiled = pm.run(qc)

        # Run
        job = backend.run(transpiled, shots=shots)
        result = job.result()
        raw_counts = result.get_counts()

        # Convert counts keys to standard form
        counts = {k.replace(" ", ""): v for k, v in raw_counts.items()}

        # Compute probabilities
        probabilities = {k: v / shots for k, v in counts.items()}

        # Expectation values
        n = circuit_spec.num_qubits
        expectation_values = {}
        for q in range(n):
            ev = 0.0
            for state, prob in probabilities.items():
                bit = state[-(q + 1)] if q < len(state) else "0"
                z_val = 1.0 if bit == "0" else -1.0
                ev += z_val * prob
            expectation_values[f"Z_{q}"] = round(ev, 6)

        elapsed = time.time() - start

        return ExecutionResult(
            job_id="",
            counts=counts,
            probabilities=probabilities,
            expectation_values=expectation_values,
            metadata={
                "backend": self.name,
                "shots": shots,
                "num_qubits": n,
                "circuit_depth": transpiled.depth(),
                "gate_count": transpiled.size(),
                "noise_model": noise_config.model_type.value,
                "execution_time_ms": round(elapsed * 1000, 2),
                "fidelity_estimate": self._estimate_fidelity(noise_config, transpiled),
            },
        )

    def _build_noise_model(self, noise_config: NoiseConfig):
        """Build a Qiskit noise model from our config."""
        from qiskit_aer.noise import NoiseModel, depolarizing_error, thermal_relaxation_error

        noise_model = NoiseModel()

        if noise_config.model_type == NoiseModelType.DEPOLARIZING:
            error_1q = depolarizing_error(noise_config.single_gate_error)
            error_2q = depolarizing_error(noise_config.two_gate_error)
            noise_model.add_all_qubit_quantum_error(error_1q, ["u1", "u2", "u3", "rx", "ry", "rz"])
            noise_model.add_all_qubit_quantum_error(error_2q, ["cx", "cz"])

        elif noise_config.model_type == NoiseModelType.THERMAL:
            # T1, T2 relaxation
            t1 = 50e3  # 50 µs in ns
            t2 = 70e3  # 70 µs
            gate_time = 50  # 50 ns gate time
            error_thermal = thermal_relaxation_error(t1, t2, gate_time)
            noise_model.add_all_qubit_quantum_error(error_thermal, ["u1", "u2", "u3", "rx", "ry", "rz"])

        return noise_model

    def _estimate_fidelity(self, noise_config, transpiled_circuit) -> float:
        if noise_config.model_type == NoiseModelType.IDEAL:
            return 1.0
        depth = transpiled_circuit.depth()
        n = transpiled_circuit.num_qubits
        gate_fidelity = (1 - noise_config.single_gate_error) ** (depth * n)
        meas_fidelity = (1 - noise_config.measurement_error) ** n
        return round(gate_fidelity * meas_fidelity, 4)


# ─── QuantumHardwareEngine ──────────────────────────────────────────


class QuantumHardwareEngine(QuantumBackend):
    """
    Placeholder for real quantum hardware access (IBM Quantum, etc.).
    Validates configuration and provides clear guidance on setup.
    """

    name = "quantum_hardware"
    capabilities = {
        "max_qubits": 127,
        "noise_support": True,
        "type": "quantum_hardware",
    }

    def __init__(self, api_token: str | None = None, backend_name: str = "ibm_brisbane"):
        self._api_token = api_token
        self._hw_backend_name = backend_name

    def run(
        self,
        circuit_spec: CircuitSpec,
        observable_spec: ObservableSpec | None = None,
        shots: int = 1024,
        noise_config: NoiseConfig | None = None,
    ) -> ExecutionResult:
        if not self._api_token:
            raise NotImplementedError(
                "Quantum hardware access requires an API token. "
                "Set QUANTUM_API_TOKEN in your .env file. "
                "Get a token at https://quantum.ibm.com/"
            )

        raise NotImplementedError(
            f"Hardware backend '{self._hw_backend_name}' execution is not yet implemented. "
            "This placeholder validates configuration. "
            "To connect to IBM Quantum, install qiskit-ibm-runtime and "
            "implement the IBM Runtime Sampler workflow."
        )


# ─── Factory ─────────────────────────────────────────────────────────


def get_backend(
    provider: str = "local_classical",
    api_token: str | None = None,
    backend_name: str | None = None,
) -> QuantumBackend:
    """Factory function to get a backend by provider name."""
    if provider == "local_classical":
        return LocalClassicalEngine()
    elif provider == "qiskit_simulator":
        return QuantumSimulatorEngine()
    elif provider == "qiskit_hardware":
        return QuantumHardwareEngine(
            api_token=api_token,
            backend_name=backend_name or "ibm_brisbane",
        )
    else:
        raise ValueError(
            f"Unknown provider '{provider}'. "
            f"Available: local_classical, qiskit_simulator, qiskit_hardware"
        )
