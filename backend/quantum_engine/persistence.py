"""
Quantum Engine – Experiment Persistence

SQLite-based storage for experiment metadata.
Tracks inputs, backends, circuit versions, results, and timestamps
for reproducibility and research credibility.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from quantum_engine.models import ExecutionResult, QuantumJob

logger = logging.getLogger("quantum_engine.persistence")


class ExperimentStore:
    """
    Persists quantum experiment metadata to SQLite.

    Schema:
        experiments(
            id TEXT PRIMARY KEY,
            job_id TEXT,
            circuit_type TEXT,
            num_qubits INTEGER,
            shots INTEGER,
            backend_name TEXT,
            noise_model TEXT,
            inputs TEXT (JSON),
            result_summary TEXT (JSON),
            counts TEXT (JSON),
            expectation_values TEXT (JSON),
            comparison TEXT (JSON),
            circuit_depth INTEGER,
            gate_count INTEGER,
            execution_time_ms REAL,
            fidelity REAL,
            created_at TEXT,
            completed_at TEXT
        )
    """

    def __init__(self, db_path: str = "experiments.db"):
        self._db_path = db_path
        self._init_db()

    def _init_db(self):
        """Create the experiments table if it doesn't exist."""
        conn = sqlite3.connect(self._db_path)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS experiments (
                    id TEXT PRIMARY KEY,
                    job_id TEXT,
                    circuit_type TEXT,
                    num_qubits INTEGER,
                    shots INTEGER,
                    backend_name TEXT,
                    noise_model TEXT,
                    inputs TEXT,
                    result_summary TEXT,
                    counts TEXT,
                    expectation_values TEXT,
                    comparison TEXT,
                    circuit_depth INTEGER,
                    gate_count INTEGER,
                    execution_time_ms REAL,
                    fidelity REAL,
                    created_at TEXT,
                    completed_at TEXT
                )
            """)
            conn.commit()
        finally:
            conn.close()

    def save_experiment(
        self,
        job: QuantumJob,
        result: ExecutionResult,
    ) -> str:
        """Save a completed experiment. Returns the experiment ID."""
        exp_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        metadata = result.metadata
        inputs = metadata.get("signal_params", {})
        inputs["num_qubits"] = metadata.get("num_qubits", 0)
        inputs["circuit_type"] = metadata.get("circuit_type", "unknown")

        conn = sqlite3.connect(self._db_path)
        try:
            conn.execute(
                """
                INSERT INTO experiments (
                    id, job_id, circuit_type, num_qubits, shots,
                    backend_name, noise_model, inputs, result_summary,
                    counts, expectation_values, comparison,
                    circuit_depth, gate_count, execution_time_ms,
                    fidelity, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    exp_id,
                    job.id,
                    metadata.get("circuit_type", "unknown"),
                    metadata.get("num_qubits", 0),
                    job.shots,
                    metadata.get("backend", job.backend_name),
                    metadata.get("noise_model", "ideal"),
                    json.dumps(inputs),
                    json.dumps({
                        "top_state": max(result.counts, key=result.counts.get) if result.counts else None,
                        "num_unique_states": len(result.counts),
                    }),
                    json.dumps(result.counts),
                    json.dumps(result.expectation_values),
                    json.dumps(result.classical_comparison),
                    metadata.get("circuit_depth", 0),
                    metadata.get("gate_count", 0),
                    metadata.get("execution_time_ms", 0),
                    metadata.get("fidelity_estimate", 1.0),
                    job.created_at,
                    job.completed_at or now,
                ),
            )
            conn.commit()
            logger.info(f"Saved experiment {exp_id} for job {job.id}")
        finally:
            conn.close()

        return exp_id

    def get_experiment(self, exp_id: str) -> dict | None:
        """Retrieve a single experiment by ID."""
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        try:
            row = conn.execute(
                "SELECT * FROM experiments WHERE id = ?", (exp_id,)
            ).fetchone()
            if row:
                return self._row_to_dict(row)
            return None
        finally:
            conn.close()

    def list_experiments(
        self, limit: int = 50, offset: int = 0
    ) -> list[dict]:
        """List experiments, most recent first."""
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(
                "SELECT * FROM experiments ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [self._row_to_dict(row) for row in rows]
        finally:
            conn.close()

    def count_experiments(self) -> int:
        """Return the total number of persisted experiments."""
        conn = sqlite3.connect(self._db_path)
        try:
            row = conn.execute("SELECT COUNT(*) FROM experiments").fetchone()
            return int(row[0] if row else 0)
        finally:
            conn.close()

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        """Convert a database row to a dictionary with parsed JSON fields."""
        d = dict(row)
        for json_field in [
            "inputs", "result_summary", "counts",
            "expectation_values", "comparison",
        ]:
            if d.get(json_field):
                try:
                    d[json_field] = json.loads(d[json_field])
                except (json.JSONDecodeError, TypeError):
                    pass
        return d
