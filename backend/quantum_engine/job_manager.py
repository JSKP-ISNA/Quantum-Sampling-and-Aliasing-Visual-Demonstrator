"""
Quantum Engine – Async Job Manager

Manages the lifecycle of quantum jobs:
  • Submit → Queue → Run → Complete/Fail
  • Background execution via asyncio tasks
  • Retry logic, timeouts, result caching
  • Job cleanup after TTL expiry
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from quantum_engine.backends import QuantumBackend, get_backend
from quantum_engine.models import (
    CircuitSpec,
    ExecutionResult,
    JobStatus,
    NoiseConfig,
    ObservableSpec,
    QuantumJob,
)
from quantum_engine.workflows import run_quantum_sampling_comparison

logger = logging.getLogger("quantum_engine.job_manager")


class JobManager:
    """
    Manages async quantum job execution with retry, timeout, and caching.

    Jobs are stored in-memory. Completed jobs are cached for `result_ttl_seconds`.
    """

    def __init__(
        self,
        default_backend: str = "local_classical",
        job_timeout: int = 60,
        result_ttl_seconds: int = 3600,
        api_token: str | None = None,
    ):
        self._jobs: dict[str, QuantumJob] = {}
        self._results: dict[str, ExecutionResult] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._default_backend = default_backend
        self._job_timeout = job_timeout
        self._result_ttl = result_ttl_seconds
        self._api_token = api_token
        self._backends: dict[str, QuantumBackend] = {}

    # ─── Backend Management ──────────────────────────────────────

    def get_or_create_backend(self, provider: str) -> QuantumBackend:
        """Get a cached backend instance or create a new one."""
        if provider not in self._backends:
            self._backends[provider] = get_backend(
                provider=provider,
                api_token=self._api_token,
            )
        return self._backends[provider]

    def list_backends(self) -> list[dict[str, Any]]:
        """List all available backends with capabilities."""
        backends = [
            {
                "name": "local_classical",
                "display_name": "Local Classical Simulator",
                "type": "classical_simulator",
                "max_qubits": 20,
                "noise_support": True,
                "available": True,
            },
            {
                "name": "qiskit_simulator",
                "display_name": "Qiskit Aer Simulator",
                "type": "quantum_simulator",
                "max_qubits": 30,
                "noise_support": True,
                "available": self._check_qiskit_available(),
            },
            {
                "name": "qiskit_hardware",
                "display_name": "IBM Quantum Hardware",
                "type": "quantum_hardware",
                "max_qubits": 127,
                "noise_support": True,
                "available": bool(self._api_token),
            },
        ]
        return backends

    def _check_qiskit_available(self) -> bool:
        try:
            import qiskit  # noqa: F401
            return True
        except ImportError:
            return False

    # ─── Job Submission ──────────────────────────────────────────

    async def submit_job(
        self,
        freq: float = 100.0,
        fs: float = 300.0,
        noise_level: float = 0.0,
        wave_type: str = "sine",
        backend_name: str | None = None,
        shots: int = 1024,
        noise_config: NoiseConfig | None = None,
        num_qubits: int = 4,
        circuit_type: str = "phase_estimation",
        window_type: str = "uniform",
    ) -> str:
        """
        Submit a quantum job for async execution.

        Returns the job ID for status polling.
        """
        backend_name = backend_name or self._default_backend
        noise_config = noise_config or NoiseConfig()

        job = QuantumJob(
            backend_name=backend_name,
            shots=shots,
            noise_config=noise_config,
        )

        self._jobs[job.id] = job
        logger.info(f"Job {job.id} submitted (backend={backend_name}, shots={shots})")

        # Start background execution
        task = asyncio.create_task(
            self._execute_job(
                job_id=job.id,
                freq=freq,
                fs=fs,
                noise_level=noise_level,
                wave_type=wave_type,
                backend_name=backend_name,
                shots=shots,
                noise_config=noise_config,
                num_qubits=num_qubits,
                circuit_type=circuit_type,
                window_type=window_type,
            )
        )
        self._tasks[job.id] = task

        return job.id

    # ─── Job Execution ───────────────────────────────────────────

    async def _execute_job(
        self,
        job_id: str,
        freq: float,
        fs: float,
        noise_level: float,
        wave_type: str,
        backend_name: str,
        shots: int,
        noise_config: NoiseConfig,
        num_qubits: int,
        circuit_type: str,
        window_type: str = "uniform",
    ):
        """Background task that runs the quantum workflow with retry logic."""
        job = self._jobs.get(job_id)
        if not job:
            return

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc).isoformat()

        while job.retries <= job.max_retries:
            try:
                # Run with timeout
                backend = self.get_or_create_backend(backend_name)

                result = await asyncio.wait_for(
                    asyncio.to_thread(
                        run_quantum_sampling_comparison,
                        freq=freq,
                        fs=fs,
                        noise_level=noise_level,
                        wave_type=wave_type,
                        backend=backend,
                        shots=shots,
                        noise_config=noise_config,
                        num_qubits=num_qubits,
                        circuit_type=circuit_type,
                        window_type=window_type,
                    ),
                    timeout=self._job_timeout,
                )

                # Success
                result.job_id = job_id
                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.now(timezone.utc).isoformat()
                job.result = result
                self._results[job_id] = result
                logger.info(f"Job {job_id} completed successfully")
                return

            except asyncio.TimeoutError:
                job.retries += 1
                logger.warning(
                    f"Job {job_id} timed out (attempt {job.retries}/{job.max_retries})"
                )
                if job.retries > job.max_retries:
                    job.status = JobStatus.FAILED
                    job.error_message = (
                        f"Job timed out after {self._job_timeout}s "
                        f"({job.max_retries} retries exhausted)"
                    )
                    job.completed_at = datetime.now(timezone.utc).isoformat()

            except Exception as e:
                job.retries += 1
                logger.error(
                    f"Job {job_id} failed (attempt {job.retries}/{job.max_retries}): {e}"
                )
                if job.retries > job.max_retries:
                    job.status = JobStatus.FAILED
                    job.error_message = str(e)
                    job.completed_at = datetime.now(timezone.utc).isoformat()
                else:
                    # Brief backoff before retry
                    await asyncio.sleep(1.0 * job.retries)

    # ─── Job Status & Results ────────────────────────────────────

    def get_job(self, job_id: str) -> QuantumJob | None:
        """Get a job by ID."""
        return self._jobs.get(job_id)

    def get_job_status(self, job_id: str) -> dict | None:
        """Get job status summary."""
        job = self._jobs.get(job_id)
        if not job:
            return None
        return job.to_dict()

    def get_job_result(self, job_id: str) -> ExecutionResult | None:
        """Get the result of a completed job."""
        return self._results.get(job_id)

    def list_jobs(self, limit: int = 50) -> list[dict]:
        """List recent jobs."""
        jobs = sorted(
            self._jobs.values(),
            key=lambda j: j.created_at,
            reverse=True,
        )[:limit]
        return [j.to_dict() for j in jobs]

    # ─── Cleanup ─────────────────────────────────────────────────

    async def cleanup_expired(self):
        """Remove jobs and results older than TTL."""
        now = datetime.now(timezone.utc)
        expired = []
        for job_id, job in self._jobs.items():
            if job.completed_at:
                completed = datetime.fromisoformat(job.completed_at)
                age = (now - completed).total_seconds()
                if age > self._result_ttl:
                    expired.append(job_id)

        for job_id in expired:
            self._jobs.pop(job_id, None)
            self._results.pop(job_id, None)
            task = self._tasks.pop(job_id, None)
            if task and not task.done():
                task.cancel()
            logger.info(f"Cleaned up expired job {job_id}")
