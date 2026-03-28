# Quantum Engine Architecture Overhaul

Transform the current pseudo-quantum signal visualization app into a **genuinely quantum-capable** application with provider-agnostic execution, hybrid classical-quantum workflows, async job handling, and measurement-based outputs.

**Chosen quantum use case**: **Quantum Sampling & Phase Estimation** — classical signal parameters encode into parameterized quantum circuits; measured distributions are compared against classical reconstruction.

## User Review Required

> [!IMPORTANT]
> **Qiskit dependency**: The plan uses **Qiskit Aer** as the default local simulator because it's the most mature open-source quantum SDK. It will be wrapped behind an abstraction layer so PennyLane/Cirq can be swapped in later. Confirm this is acceptable.

> [!IMPORTANT]
> **SQLite for experiment persistence**: Lightweight, zero-config, suitable for a demo. If you need PostgreSQL or another DB, let me know.

> [!WARNING]
> **Breaking change**: The current `/api/quantum-state` endpoint will be replaced with real quantum job results. The frontend [useQuantumState](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/hooks/useQuantumState.js#4-41) hook will be rewritten to poll jobs instead of fetching fake Bloch sphere data.

---

## Proposed Changes

### Backend Quantum Engine Module

New `backend/quantum_engine/` package with clean separation of concerns.

#### [NEW] [\_\_init\_\_.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/__init__.py)
Package init, exports public API.

#### [NEW] [models.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/models.py)
Provider-agnostic domain objects using Pydantic/dataclasses:
- `CircuitSpec` — circuit type, num_qubits, parameters, depth
- `ObservableSpec` — measurement basis, observable type
- `QuantumJob` — id, status (queued/running/completed/failed), circuit_spec, observable_spec, shots, backend_name, created_at, completed_at, error message
- `ExecutionResult` — job_id, counts (shot histogram), expectation_values, metadata (gate_count, circuit_depth, backend, execution_time, noise_model)
- `NoiseConfig` — noise model type (ideal/depolarizing/thermal), error rates

#### [NEW] [backends.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/backends.py)
Backend interface (ABC) + three implementations:
- `QuantumBackend` (ABC) — `run(circuit_spec, observable_spec, shots, noise_config) → ExecutionResult`
- `LocalClassicalEngine` — simulates circuit behavior using NumPy (no Qiskit needed), returns synthetic measurement distributions
- `QuantumSimulatorEngine` — wraps Qiskit Aer `AerSimulator`, builds real circuits, runs with noise models
- `QuantumHardwareEngine` — placeholder that validates config and raises `NotImplementedError` with clear instructions for API credentials

#### [NEW] [circuits.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/circuits.py)
Circuit construction abstraction:
- `build_phase_estimation_circuit(signal_freq, sample_rate, num_qubits)` — QPE circuit for frequency/phase
- `build_sampling_circuit(probabilities, num_qubits)` — encodes signal sample distribution
- `build_qft_circuit(num_qubits)` — Quantum Fourier Transform sub-circuit
- All return `CircuitSpec` + Qiskit `QuantumCircuit` (when using simulator engine)

#### [NEW] [workflows.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/workflows.py)
Hybrid classical-quantum workflow orchestrator:
- `run_quantum_sampling_comparison(freq, fs, noise_level, wave_type, backend, shots, noise_config)`:
  1. Classical preprocessing via existing `signal_engine.process_signal()`
  2. Encode signal parameters into parameterized circuit
  3. Execute on chosen backend
  4. Classical postprocessing — compare measured distribution vs classical FFT
  5. Return combined `ExecutionResult` + comparison metrics

#### [NEW] [job_manager.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/job_manager.py)
Async job lifecycle:
- In-memory job store (dict) with `QuantumJob` objects
- `submit_job(circuit_spec, backend, shots, noise_config) → job_id`
- `get_job_status(job_id) → QuantumJob`
- `get_job_result(job_id) → ExecutionResult`
- Background execution via `asyncio.create_task`
- Retry logic (up to 3 retries on failure)
- Job timeout (configurable, default 60s)
- Result caching (completed jobs kept for 1 hour)

---

### Configuration & Persistence

#### [NEW] [config.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/config.py)
Environment-driven settings using Pydantic `BaseSettings`:
- `QUANTUM_PROVIDER` (local_classical | qiskit_simulator | qiskit_hardware)
- `QUANTUM_BACKEND` (aer_simulator | ibm_brisbane | etc.)
- `QUANTUM_SHOTS` (default: 1024)
- `QUANTUM_OPTIMIZATION_LEVEL` (0-3)
- `QUANTUM_NOISE_MODEL` (ideal | depolarizing | thermal)
- `QUANTUM_API_TOKEN` (for hardware access)
- `JOB_TIMEOUT_SECONDS` (default: 60)
- `DB_PATH` (default: experiments.db)

#### [NEW] [.env.example](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/.env.example)
Template env file with documented defaults.

#### [NEW] [persistence.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/quantum_engine/persistence.py)
SQLite experiment store:
- `experiments` table: id, job_id, inputs (JSON), backend_used, circuit_version, result_summary (JSON), timestamps, reproducibility_info
- `save_experiment(job, result)`, `get_experiment(id)`, `list_experiments(limit, offset)`

---

### API Overhaul

#### [MODIFY] [main.py](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/main.py)
- **Keep** existing `/health`, `/api/process`, `/stream`, `/webhook/alias` endpoints (backward compatible)
- **Replace** `/api/quantum-state` with:
  - `POST /api/quantum/submit` — submit a quantum job (params: freq, fs, noise_level, wave_type, backend, shots, noise_model)
  - `GET /api/quantum/status/{job_id}` — poll job status
  - `GET /api/quantum/result/{job_id}` — get completed job result (counts, expectation values, metrics)
  - `GET /api/quantum/experiments` — list saved experiments
  - `GET /api/quantum/backends` — list available backends with capabilities
- Add startup event to initialize `JobManager` and load config

#### [MODIFY] [pyproject.toml](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/pyproject.toml)
Add dependencies:
- `qiskit>=1.0.0` (core)
- `qiskit-aer>=0.14.0` (simulator)
- `pydantic-settings>=2.0.0` (config)
- `python-dotenv>=1.0.0` (env loading)

---

### Frontend Quantum Dashboard

#### [MODIFY] [useSignalStore.js](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/store/useSignalStore.js)
Add quantum job state:
- `quantumJobs: {}` (map of job_id → status/result)
- `activeJobId: null`
- `availableBackends: []`
- `quantumMetrics: { counts: {}, expectationValues: [], circuitDepth: 0, gateCount: 0, backendName: '', executionTime: 0, noiseModel: '', fidelity: 0 }`
- Actions: `submitQuantumJob`, `setJobStatus`, `setQuantumResult`, `setAvailableBackends`

#### [NEW] [useQuantumJobs.js](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/hooks/useQuantumJobs.js)
Hook for quantum job lifecycle:
- `submitJob(params)` — POST to `/api/quantum/submit`, start polling
- Polling loop (every 1s) on `/api/quantum/status/{id}` until completed/failed
- On completion, fetch `/api/quantum/result/{id}` and update store
- Cleanup on unmount

#### [MODIFY] [useQuantumState.js](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/hooks/useQuantumState.js)
Replace periodic polling of fake quantum state with fetching available backends on mount.

#### [NEW] [ShotHistogram.jsx](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/components/ShotHistogram.jsx)
Bar chart visualization of measurement counts (e.g., `|00⟩: 512, |01⟩: 256, |10⟩: 128, |11⟩: 128`). CSS-only animated bars with quantum-themed styling.

#### [NEW] [ShotHistogram.css](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/components/ShotHistogram.css)
Styling for histogram bars, labels, animation.

#### [NEW] [QuantumMetrics.jsx](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/components/QuantumMetrics.jsx)
Panel showing: expectation values, circuit depth, gate count, backend name, execution time, noise model, fidelity/noise estimates.

#### [NEW] [QuantumMetrics.css](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/components/QuantumMetrics.css)
Styling for metrics panel.

#### [MODIFY] [ErrorOverlay.jsx](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/components/ErrorOverlay.jsx)
- Replace the static quantum state bars (coherence/entropy/purity/|α|²/|β|²) with live quantum job results
- Add `ShotHistogram` and `QuantumMetrics` components
- Show job status indicator (queued/running/completed/failed)

#### [MODIFY] [ControlPanel.jsx](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/components/ControlPanel.jsx)
Add quantum controls section:
- Backend selector dropdown (populated from `/api/quantum/backends`)
- Shots count slider (128–8192)
- Noise model selector (ideal/depolarizing/thermal)
- "Run Quantum Job" button that triggers `submitJob`

#### [MODIFY] [App.jsx](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/frontend/src/App.jsx)
Import and wire `useQuantumJobs` hook.

---

### Docker & Infrastructure

#### [MODIFY] [docker-compose.yml](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/docker-compose.yml)
Add env vars for quantum config to backend service.

#### [MODIFY] [Dockerfile](file:///c:/Users/gsgmk/OneDrive/Desktop/Project/Quantum/backend/Dockerfile)
Ensure Qiskit installs correctly in container.

---

## Verification Plan

### Automated Tests

**Existing tests** — run to confirm backward compatibility:
```bash
cd backend && python -m pytest test_signal_engine.py -v
```

**New tests** — `backend/tests/test_quantum_engine.py`:
- Test domain model creation (`CircuitSpec`, `QuantumJob`, `ExecutionResult`)
- Test `LocalClassicalEngine.run()` returns valid counts and expectation values
- Test `QuantumSimulatorEngine.run()` with ideal + noisy models (requires qiskit)
- Test `JobManager` submit/status/result lifecycle
- Test circuit construction functions
- Test workflow end-to-end (classical → quantum → comparison)
- Test config loading from env vars
- Test persistence save/load

Run: `cd backend && python -m pytest tests/ -v`

**API integration tests** — `backend/tests/test_api.py`:
- Test `POST /api/quantum/submit` returns job_id
- Test `GET /api/quantum/status/{id}` returns valid status
- Test `GET /api/quantum/result/{id}` returns counts after completion
- Test `GET /api/quantum/backends` returns list
- Test existing endpoints still work (`/health`, `/api/process`)

Run: `cd backend && python -m pytest tests/test_api.py -v`

### Manual Verification
- Start the app via `docker-compose up --build`
- Open browser to `http://localhost:3000`
- Verify classical signal visualization still works
- Select a quantum backend from the control panel
- Click "Run Quantum Job" and observe: job status updates, shot histogram appears, quantum metrics populate
- Compare classical vs quantum results visually
