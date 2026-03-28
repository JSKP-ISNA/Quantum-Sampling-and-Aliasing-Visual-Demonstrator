"""
Tests for the Quantum Engine module.

Tests cover:
  • Domain model creation and serialization
  • LocalClassicalEngine execution
  • Circuit spec builders
  • JobManager lifecycle
  • Workflow end-to-end execution
"""

import asyncio
import sys
import os
import pytest

# Ensure backend is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quantum_engine.models import (
    CircuitSpec,
    CircuitType,
    ExecutionResult,
    JobStatus,
    NoiseConfig,
    NoiseModelType,
    ObservableSpec,
    QuantumJob,
)
from quantum_engine.backends import LocalClassicalEngine, get_backend
from quantum_engine.circuits import (
    build_phase_estimation_spec,
    build_sampling_spec,
    build_qft_spec,
)
from quantum_engine.workflows import run_quantum_sampling_comparison
from quantum_engine.job_manager import JobManager
from quantum_engine.persistence import ExperimentStore


# ─── Domain Model Tests ──────────────────────────────────────────────


class TestDomainModels:
    def test_circuit_spec_creation(self):
        spec = CircuitSpec(
            circuit_type=CircuitType.PHASE_ESTIMATION,
            num_qubits=5,
            parameters={"signal_freq": 100, "sample_rate": 300},
            depth=12,
            gate_count=40,
        )
        assert spec.num_qubits == 5
        assert spec.circuit_type == CircuitType.PHASE_ESTIMATION

    def test_circuit_spec_to_dict(self):
        spec = CircuitSpec(
            circuit_type=CircuitType.QFT,
            num_qubits=4,
        )
        d = spec.to_dict()
        assert d["circuit_type"] == "qft"
        assert d["num_qubits"] == 4

    def test_quantum_job_creation(self):
        job = QuantumJob(shots=2048, backend_name="local_classical")
        assert job.status == JobStatus.QUEUED
        assert job.shots == 2048
        assert job.id is not None
        assert len(job.id) > 0

    def test_quantum_job_to_dict(self):
        job = QuantumJob()
        d = job.to_dict()
        assert d["status"] == "queued"
        assert "id" in d
        assert "created_at" in d

    def test_noise_config_defaults(self):
        nc = NoiseConfig()
        assert nc.model_type == NoiseModelType.IDEAL
        assert nc.single_gate_error == 0.001

    def test_execution_result(self):
        result = ExecutionResult(
            job_id="test-123",
            counts={"00": 500, "01": 250, "10": 150, "11": 100},
            probabilities={"00": 0.5, "01": 0.25, "10": 0.15, "11": 0.1},
        )
        assert sum(result.counts.values()) == 1000
        d = result.to_dict()
        assert d["job_id"] == "test-123"

    def test_observable_spec(self):
        obs = ObservableSpec()
        d = obs.to_dict()
        assert d["observable_type"] == "computational_basis"


# ─── Backend Tests ───────────────────────────────────────────────────


class TestLocalClassicalEngine:
    def test_run_phase_estimation(self):
        engine = LocalClassicalEngine()
        spec = build_phase_estimation_spec(100, 300, num_qubits=3)
        result = engine.run(spec, shots=512)

        assert len(result.counts) > 0
        assert sum(result.counts.values()) == 512
        assert result.metadata["backend"] == "local_classical"
        assert result.metadata["shots"] == 512

    def test_run_sampling(self):
        engine = LocalClassicalEngine()
        spec = build_sampling_spec([0.1, 0.5, 0.8, 0.3, 0.2, 0.6, 0.4, 0.9], num_qubits=3)
        result = engine.run(spec, shots=1024)

        assert sum(result.counts.values()) == 1024
        assert len(result.probabilities) > 0

    def test_run_qft(self):
        engine = LocalClassicalEngine()
        spec = build_qft_spec(num_qubits=3)
        result = engine.run(spec, shots=1024)

        assert sum(result.counts.values()) == 1024
        # QFT on |0⟩ should give roughly uniform distribution
        assert len(result.counts) > 1

    def test_run_with_noise(self):
        engine = LocalClassicalEngine()
        spec = build_phase_estimation_spec(100, 300, num_qubits=3)
        noise = NoiseConfig(
            model_type=NoiseModelType.DEPOLARIZING,
            single_gate_error=0.01,
        )
        result = engine.run(spec, shots=1024, noise_config=noise)

        assert result.metadata["noise_model"] == "depolarizing"
        assert result.metadata["fidelity_estimate"] < 1.0

    def test_run_thermal_noise(self):
        engine = LocalClassicalEngine()
        spec = build_phase_estimation_spec(100, 300, num_qubits=3)
        noise = NoiseConfig(model_type=NoiseModelType.THERMAL)
        result = engine.run(spec, shots=512, noise_config=noise)

        assert result.metadata["noise_model"] == "thermal"

    def test_expectation_values(self):
        engine = LocalClassicalEngine()
        spec = build_phase_estimation_spec(100, 300, num_qubits=3)
        result = engine.run(spec, shots=2048)

        assert len(result.expectation_values) > 0
        for key, val in result.expectation_values.items():
            assert -1.0 <= val <= 1.0, f"EV {key}={val} out of range"

    def test_metadata_completeness(self):
        engine = LocalClassicalEngine()
        spec = build_phase_estimation_spec(100, 300, num_qubits=3)
        result = engine.run(spec, shots=512)

        required_keys = [
            "backend", "shots", "num_qubits", "circuit_depth",
            "gate_count", "noise_model", "execution_time_ms", "fidelity_estimate",
        ]
        for key in required_keys:
            assert key in result.metadata, f"Missing metadata key: {key}"


class TestGetBackend:
    def test_get_local_classical(self):
        b = get_backend("local_classical")
        assert b.name == "local_classical"

    def test_get_qiskit_simulator(self):
        b = get_backend("qiskit_simulator")
        assert b.name == "qiskit_simulator"

    def test_get_unknown_raises(self):
        with pytest.raises(ValueError):
            get_backend("nonexistent_backend")


# ─── Circuit Builder Tests ───────────────────────────────────────────


class TestCircuitBuilders:
    def test_phase_estimation_spec(self):
        spec = build_phase_estimation_spec(100, 300, num_qubits=4)
        assert spec.circuit_type == CircuitType.PHASE_ESTIMATION
        assert spec.num_qubits == 5  # 4 counting + 1 target
        assert spec.parameters["signal_freq"] == 100
        assert spec.parameters["sample_rate"] == 300
        assert 0 <= spec.parameters["phase"] <= 1

    def test_sampling_spec(self):
        samples = [0.1, 0.5, 0.8, 0.3]
        spec = build_sampling_spec(samples, num_qubits=2)
        assert spec.circuit_type == CircuitType.QUANTUM_SAMPLING
        assert spec.num_qubits == 2
        assert spec.parameters["signal_samples"] == samples

    def test_qft_spec(self):
        spec = build_qft_spec(num_qubits=4)
        assert spec.circuit_type == CircuitType.QFT
        assert spec.num_qubits == 4
        assert spec.parameters["transform_size"] == 16


# ─── Workflow Tests ──────────────────────────────────────────────────


class TestWorkflows:
    def test_quantum_sampling_comparison_qpe(self):
        result = run_quantum_sampling_comparison(
            freq=100, fs=300, noise_level=0,
            wave_type="sine", backend_name="local_classical",
            shots=512, num_qubits=3, circuit_type="phase_estimation",
        )
        assert isinstance(result, ExecutionResult)
        assert len(result.counts) > 0
        assert result.classical_comparison is not None
        assert "classical_peak_freq" in result.classical_comparison

    def test_quantum_sampling_comparison_sampling(self):
        result = run_quantum_sampling_comparison(
            freq=100, fs=300, noise_level=0,
            wave_type="sine", backend_name="local_classical",
            shots=512, num_qubits=3, circuit_type="quantum_sampling",
        )
        assert isinstance(result, ExecutionResult)
        assert len(result.counts) > 0

    def test_workflow_metadata(self):
        result = run_quantum_sampling_comparison(
            freq=200, fs=500, shots=256,
            num_qubits=3, circuit_type="phase_estimation",
        )
        assert "total_workflow_time_ms" in result.metadata
        assert "signal_params" in result.metadata
        assert result.metadata["signal_params"]["freq"] == 200


# ─── Job Manager Tests ───────────────────────────────────────────────


class TestJobManager:
    @pytest.fixture
    def manager(self):
        return JobManager(default_backend="local_classical", job_timeout=30)

    def test_list_backends(self, manager):
        backends = manager.list_backends()
        assert len(backends) == 3
        names = [b["name"] for b in backends]
        assert "local_classical" in names
        assert "qiskit_simulator" in names
        assert "qiskit_hardware" in names

    @pytest.mark.asyncio
    async def test_submit_and_complete(self, manager):
        job_id = await manager.submit_job(
            freq=100, fs=300, shots=256, num_qubits=3,
        )
        assert job_id is not None

        # Wait for completion
        for _ in range(30):
            status = manager.get_job_status(job_id)
            if status and status["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.2)

        job = manager.get_job(job_id)
        assert job.status == JobStatus.COMPLETED

        result = manager.get_job_result(job_id)
        assert result is not None
        assert len(result.counts) > 0

    @pytest.mark.asyncio
    async def test_job_not_found(self, manager):
        status = manager.get_job_status("nonexistent-id")
        assert status is None

    def test_list_jobs(self, manager):
        jobs = manager.list_jobs()
        assert isinstance(jobs, list)


# ─── Persistence Tests ──────────────────────────────────────────────


class TestPersistence:
    @pytest.fixture
    def store(self, tmp_path):
        return ExperimentStore(db_path=str(tmp_path / "test_experiments.db"))

    def test_save_and_retrieve(self, store):
        job = QuantumJob(shots=512, backend_name="local_classical")
        job.completed_at = job.created_at

        result = ExecutionResult(
            job_id=job.id,
            counts={"00": 300, "01": 212},
            metadata={
                "backend": "local_classical",
                "circuit_type": "phase_estimation",
                "num_qubits": 3,
                "circuit_depth": 10,
                "gate_count": 30,
                "execution_time_ms": 5.2,
                "fidelity_estimate": 0.98,
                "noise_model": "ideal",
                "signal_params": {"freq": 100, "fs": 300},
            },
        )

        exp_id = store.save_experiment(job, result)
        assert exp_id is not None

        exp = store.get_experiment(exp_id)
        assert exp is not None
        assert exp["backend_name"] == "local_classical"
        assert exp["counts"]["00"] == 300

    def test_list_experiments(self, store):
        experiments = store.list_experiments()
        assert isinstance(experiments, list)

    def test_experiment_not_found(self, store):
        exp = store.get_experiment("nonexistent")
        assert exp is None
