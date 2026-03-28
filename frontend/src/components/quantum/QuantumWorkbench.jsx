import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiActivity,
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiClipboard,
  FiCloudLightning,
  FiCode,
  FiCopy,
  FiCpu,
  FiDownload,
  FiGrid,
  FiLayers,
  FiMove,
  FiRefreshCw,
  FiSave,
  FiSliders,
  FiTrash2,
  FiUpload,
  FiZap,
} from 'react-icons/fi';
import GlassCard from '../ui/GlassCard';
import QuantumButton from '../ui/QuantumButton';
import QuantumSelect from '../ui/QuantumSelect';
import QuantumSlider from '../ui/QuantumSlider';
import useSignalStore from '../../store/useSignalStore';
import {
  GATE_LIBRARY,
  PRESET_LIBRARY,
  buildPresetWorkspace,
  createDefaultWorkspace,
  duplicateOperationInWorkspace,
  exportOpenQasm,
  formatAngle,
  getGateMeta,
  getOperationQubits,
  isRotationGate,
  isTwoQubitGate,
  moveOperationBy,
  parseWorkspace,
  placeOperationInWorkspace,
  removeOperationFromWorkspace,
  sanitizeWorkspace,
  serializeWorkspace,
  simulateCircuit,
  updateOperationInWorkspace,
} from '../../lib/quantumWorkbench';
import './QuantumWorkbench.css';

const STORAGE_KEY = 'quantum-workbench-v2';
const HISTORY_LIMIT = 40;
const MotionDiv = motion.div;

const REMOTE_WORKFLOW_OPTIONS = [
  { value: 'phase_estimation', label: 'Phase Estimation' },
  { value: 'quantum_sampling', label: 'Quantum Sampling' },
  { value: 'qft', label: 'Quantum Fourier Transform' },
];

const GATE_FAMILY_ORDER = ['Single-Qubit', 'Phase', 'Rotations', 'Entangling', 'Readout'];

function loadWorkspace() {
  if (typeof window === 'undefined') return createDefaultWorkspace();

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultWorkspace();
    return parseWorkspace(saved);
  } catch {
    return createDefaultWorkspace();
  }
}

function workspaceSignature(workspace) {
  return JSON.stringify(sanitizeWorkspace(workspace));
}

function buildBackendOptions(availableBackends) {
  if (Array.isArray(availableBackends) && availableBackends.length) {
    return availableBackends.map((backend) => {
      const value = typeof backend === 'string' ? backend : backend.name;
      return {
        value,
        label: value,
      };
    });
  }

  return [
    { value: 'local_classical', label: 'local_classical' },
    { value: 'qiskit_simulator', label: 'qiskit_simulator' },
    { value: 'qiskit_hardware', label: 'qiskit_hardware' },
  ];
}

function serializeForMode(mode, workspace, qasm) {
  if (mode === 'qasm') return qasm || exportOpenQasm(workspace);
  return serializeWorkspace(workspace);
}

function readDragPayload(event) {
  const raw =
    event.dataTransfer.getData('application/x-quantum-gate') ||
    event.dataTransfer.getData('text/plain');

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeClipboard(text) {
  if (!navigator?.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSigned(value) {
  const rounded = Number(value).toFixed(3);
  return value > 0 ? `+${rounded}` : rounded;
}

function ensureDistinctPair(first, second, maxQubits) {
  if (first !== second) return [first, second];

  const next = second + 1 < maxQubits ? second + 1 : second - 1;
  return [first, Math.max(0, next)];
}

function getOperationDisplayLabel(operation) {
  const meta = getGateMeta(operation.gateId);
  if (!meta) return operation.gateId;
  if (isRotationGate(operation.gateId)) return meta.symbol;
  return meta.symbol;
}

function getCellRole(operation, row) {
  if (!operation) return 'empty';

  if (!isTwoQubitGate(operation.gateId)) {
    return operation.qubits[0] === row ? 'single' : 'empty';
  }

  if (operation.gateId === 'SWAP') {
    const [first, second] = operation.qubits;
    const min = Math.min(first, second);
    const max = Math.max(first, second);

    if (row === first || row === second) return 'swap';
    if (row > min && row < max) return 'bridge';
    return 'empty';
  }

  const min = Math.min(operation.control, operation.target);
  const max = Math.max(operation.control, operation.target);

  if (row === operation.control) return 'control';
  if (row === operation.target) return 'target';
  if (row > min && row < max) return 'bridge';
  return 'empty';
}

export default function QuantumWorkbench({ submitQuantumJob }) {
  const availableBackends = useSignalStore((state) => state.availableBackends);
  const remoteMetrics = useSignalStore((state) => state.quantumMetrics);
  const jobStatus = useSignalStore((state) => state.quantumJobStatus);
  const jobError = useSignalStore((state) => state.quantumJobError);

  const [history, setHistory] = useState(() => {
    const initial = loadWorkspace();
    return { past: [], present: initial, future: [] };
  });
  const workspace = history.present;
  const deferredWorkspace = useDeferredValue(workspace);

  const [simulation, setSimulation] = useState(() => simulateCircuit(workspace));
  const [selectedOperationId, setSelectedOperationId] = useState(() => workspace.operations[0]?.id ?? null);
  const [armedGateId, setArmedGateId] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [ioMode, setIoMode] = useState('json');
  const [ioDraft, setIoDraft] = useState(null);
  const [ioError, setIoError] = useState('');
  const [copyState, setCopyState] = useState('');
  const [remoteBackend, setRemoteBackend] = useState('local_classical');
  const [remoteWorkflow, setRemoteWorkflow] = useState('phase_estimation');

  const backendOptions = useMemo(
    () => buildBackendOptions(availableBackends),
    [availableBackends]
  );

  const groupedGates = useMemo(() => {
    return GATE_FAMILY_ORDER.map((family) => ({
      family,
      gates: GATE_LIBRARY.filter((gate) => gate.family === family),
    }));
  }, []);

  const activeSelectedOperationId = useMemo(() => {
    if (selectedOperationId && workspace.operations.some((operation) => operation.id === selectedOperationId)) {
      return selectedOperationId;
    }

    return workspace.operations[0]?.id ?? null;
  }, [selectedOperationId, workspace.operations]);

  const selectedOperation = useMemo(
    () => workspace.operations.find((operation) => operation.id === activeSelectedOperationId) || null,
    [activeSelectedOperationId, workspace.operations]
  );

  const effectiveRemoteBackend = useMemo(() => {
    if (backendOptions.some((option) => option.value === remoteBackend)) return remoteBackend;
    return backendOptions[0]?.value || 'local_classical';
  }, [backendOptions, remoteBackend]);

  const exportedText = useMemo(
    () => serializeForMode(ioMode, workspace, simulation.qasm),
    [ioMode, simulation.qasm, workspace]
  );

  const ioText = ioDraft ?? exportedText;

  const histogramData = useMemo(() => {
    const idealMap = new Map(
      simulation.idealEntries.map((entry) => [entry.label, entry.probability])
    );

    return simulation.distributionEntries.slice(0, 12).map((entry, index) => ({
      label: entry.label,
      measured: Number((entry.probability * 100).toFixed(2)),
      ideal: Number(((idealMap.get(entry.label) || 0) * 100).toFixed(2)),
      tint: `hsl(${185 + index * 14} 90% 58%)`,
    }));
  }, [simulation.distributionEntries, simulation.idealEntries]);

  const remoteSummary = useMemo(() => {
    const entries = Object.entries(remoteMetrics.counts || {});
    const [topState = '', topCount = 0] = entries.sort((left, right) => right[1] - left[1])[0] || [];
    return { topState, topCount };
  }, [remoteMetrics.counts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, serializeWorkspace(workspace));
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    const nextSimulation = simulateCircuit(deferredWorkspace);

    startTransition(() => {
      if (!cancelled) {
        setSimulation(nextSimulation);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deferredWorkspace]);

  useEffect(() => {
    if (!copyState) return undefined;
    const timeout = window.setTimeout(() => setCopyState(''), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  function commitWorkspace(nextValue) {
    setHistory((current) => {
      const nextPresent = sanitizeWorkspace(
        typeof nextValue === 'function' ? nextValue(current.present) : nextValue
      );

      if (workspaceSignature(current.present) === workspaceSignature(nextPresent)) {
        return current;
      }

      return {
        past: [...current.past.slice(-(HISTORY_LIMIT - 1)), current.present],
        present: nextPresent,
        future: [],
      };
    });
  }

  function undoWorkspace() {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }

  function redoWorkspace() {
    setHistory((current) => {
      if (!current.future.length) return current;
      const [next, ...rest] = current.future;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
      };
    });
  }

  function applyWorkspaceSetting(patch) {
    commitWorkspace((current) => ({
      ...current,
      ...patch,
    }));
  }

  function placeFromPayload(row, column, payload) {
    if (!payload) return;

    commitWorkspace((current) => placeOperationInWorkspace(current, payload, row, column));

    if (payload.kind === 'move') {
      setSelectedOperationId(payload.operationId);
    }
  }

  function handleCellClick(row, column) {
    if (!armedGateId) return;
    placeFromPayload(row, column, { kind: 'palette', gateId: armedGateId });
  }

  async function handleCopyIo() {
    const copied = await writeClipboard(ioText);
    setCopyState(copied ? 'Copied' : 'Clipboard unavailable');
  }

  async function handleCopyQasm() {
    const copied = await writeClipboard(simulation.qasm);
    setCopyState(copied ? 'QASM copied' : 'Clipboard unavailable');
  }

  function handleLoadPreset(presetId) {
    setArmedGateId(null);
    setIoDraft(null);
    setIoError('');
    commitWorkspace(buildPresetWorkspace(presetId, workspace.numQubits));
  }

  function handleImportJson() {
    try {
      const next = parseWorkspace(ioText);
      setIoError('');
      setArmedGateId(null);
      setIoDraft(null);
      commitWorkspace(next);
    } catch {
      setIoError('JSON import failed. Paste a workspace export and try again.');
    }
  }

  function handleRemoteRun() {
    useSignalStore.getState().setQuantumSettings({
      quantumBackend: effectiveRemoteBackend,
      quantumCircuitType: remoteWorkflow,
      quantumShots: workspace.shots,
      quantumNumQubits: workspace.numQubits,
      quantumNoiseModel: workspace.noiseModel,
    });

    submitQuantumJob?.({
      backend: effectiveRemoteBackend,
      circuitType: remoteWorkflow,
      shots: workspace.shots,
      numQubits: workspace.numQubits,
      noiseModel: workspace.noiseModel,
    });
  }

  return (
    <div className="quantum-workbench">
      <section className="quantum-workbench__hero">
        <div className="quantum-workbench__hero-copy">
          <span className="quantum-workbench__eyebrow">Frontend Quantum Workbench</span>
          <h1 className="page-title">Quantum Lab</h1>
          <p className="page-subtitle">
            Build circuits by dragging gates, inspect live amplitudes, export OpenQASM, and
            benchmark template workflows against the backend when you want a second lane.
          </p>
        </div>

        <div className="quantum-workbench__hero-metrics">
          <MetricChip icon={<FiGrid />} label="Depth" value={simulation.metrics.depth} />
          <MetricChip icon={<FiLayers />} label="Gates" value={simulation.metrics.gateCount} />
          <MetricChip icon={<FiZap />} label="Entanglers" value={simulation.metrics.entanglingGateCount} />
          <MetricChip
            icon={<FiActivity />}
            label="Est. Fidelity"
            value={formatPercent(simulation.metrics.estimatedFidelity)}
            tone={simulation.metrics.estimatedFidelity > 0.9 ? 'success' : simulation.metrics.estimatedFidelity > 0.75 ? 'warning' : 'danger'}
          />
          <MetricChip icon={<FiCpu />} label="Top State" value={`|${simulation.metrics.topState}>`} />
          <MetricChip icon={<FiRefreshCw />} label="Solve Time" value={`${simulation.metrics.executionTimeMs} ms`} />
        </div>
      </section>

      <div className="quantum-workbench__layout">
        <aside className="quantum-workbench__sidebar">
          <GlassCard title="Simulation Controls" icon={<FiSliders />} variant="purple" className="quantum-workbench__card">
            <div className="quantum-workbench__stack">
              <QuantumSlider
                label="Qubits"
                value={workspace.numQubits}
                onChange={(value) => applyWorkspaceSetting({ numQubits: value })}
                min={1}
                max={8}
                step={1}
                color="var(--neon-cyan)"
              />
              <QuantumSlider
                label="Timeline Columns"
                value={workspace.columns}
                onChange={(value) => applyWorkspaceSetting({ columns: value })}
                min={6}
                max={24}
                step={1}
                color="var(--neon-purple)"
              />
              <QuantumSlider
                label="Shots"
                value={workspace.shots}
                onChange={(value) => applyWorkspaceSetting({ shots: value })}
                min={128}
                max={8192}
                step={128}
                color="var(--neon-green)"
              />
              <QuantumSelect
                label="Noise Model"
                value={workspace.noiseModel}
                onChange={(value) => applyWorkspaceSetting({ noiseModel: value })}
                options={[
                  { value: 'ideal', label: 'Ideal' },
                  { value: 'depolarizing', label: 'Depolarizing' },
                  { value: 'thermal', label: 'Thermal Relaxation' },
                ]}
                color="var(--neon-cyan)"
              />
            </div>

            <div className="quantum-workbench__button-row">
              <button type="button" className="quantum-workbench__ghost-btn" onClick={undoWorkspace} disabled={!history.past.length}>
                <FiArrowLeft />
                Undo
              </button>
              <button type="button" className="quantum-workbench__ghost-btn" onClick={redoWorkspace} disabled={!history.future.length}>
                <FiArrowRight />
                Redo
              </button>
              <button
                type="button"
                className="quantum-workbench__ghost-btn quantum-workbench__ghost-btn--danger"
                onClick={() => commitWorkspace((current) => ({ ...current, operations: [] }))}
                disabled={!workspace.operations.length}
              >
                <FiTrash2 />
                Clear
              </button>
            </div>

            <div className="quantum-workbench__micro-stats">
              <span>Measured register: {simulation.measuredQubits.map((qubit) => `q${qubit}`).join(', ')}</span>
              <span>Routing pressure: {simulation.metrics.routingPressure}</span>
              <span>Entropy: {simulation.metrics.measurementEntropy.toFixed(2)} bits</span>
            </div>
          </GlassCard>

          <GlassCard title="Gate Palette" icon={<FiMove />} className="quantum-workbench__card">
            <GatePalette
              groupedGates={groupedGates}
              armedGateId={armedGateId}
              onArmGate={setArmedGateId}
            />
          </GlassCard>
 
          <GlassCard title="Presets" icon={<FiLayers />} className="quantum-workbench__card">
            <div className="quantum-workbench__preset-grid">
              {PRESET_LIBRARY.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="quantum-workbench__preset"
                  onClick={() => handleLoadPreset(preset.id)}
                >
                  <span>{preset.label}</span>
                  <small>{preset.summary}</small>
                </button>
              ))}
            </div>
          </GlassCard>

          <IoWorkbench
            ioMode={ioMode}
            ioText={ioText}
            ioError={ioError}
            copyState={copyState}
            onChangeMode={(mode) => {
              setIoMode(mode);
              setIoDraft(null);
              setIoError('');
            }}
            onChangeText={setIoDraft}
            onCopy={handleCopyIo}
            onRefresh={() => {
              setIoDraft(null);
              setIoError('');
            }}
            onImportJson={handleImportJson}
          />
        </aside>

        <section className="quantum-workbench__center">
          <GlassCard title="Circuit Builder" icon={<FiGrid />} variant="purple" className="quantum-workbench__card quantum-workbench__card--canvas">
            <div className="quantum-workbench__canvas-tools">
              <div>
                <h3>Drag gates into a moment grid or arm one to tap-paint.</h3>
                <p>
                  Multi-qubit gates can be edited in the inspector to change control/target
                  placement, long-range span, and schedule column.
                </p>
              </div>
              <div className="quantum-workbench__canvas-actions">
                <button type="button" className="quantum-workbench__ghost-btn" onClick={() => setArmedGateId(null)} disabled={!armedGateId}>
                  <FiMove />
                  Disarm Gate
                </button>
                <button type="button" className="quantum-workbench__ghost-btn" onClick={handleCopyQasm}>
                  <FiCode />
                  Copy QASM
                </button>
              </div>
            </div>

            <CircuitCanvas
              workspace={workspace}
              selectedOperationId={activeSelectedOperationId}
              armedGateId={armedGateId}
              hoverCell={hoverCell}
              onHoverCell={setHoverCell}
              onSelectOperation={setSelectedOperationId}
              onCellClick={handleCellClick}
              onOperationDragStart={(operationId, event) => {
                event.dataTransfer.setData(
                  'application/x-quantum-gate',
                  JSON.stringify({ kind: 'move', operationId })
                );
                event.dataTransfer.setData(
                  'text/plain',
                  JSON.stringify({ kind: 'move', operationId })
                );
                event.dataTransfer.effectAllowed = 'move';
              }}
              onCellDrop={(row, column, event) => {
                event.preventDefault();
                setHoverCell(null);
                placeFromPayload(row, column, readDragPayload(event));
              }}
            />
          </GlassCard>

          <OperationInspector
            workspace={workspace}
            selectedOperation={selectedOperation}
            onSelectOperation={setSelectedOperationId}
            onUpdate={(operationId, updater) => commitWorkspace((current) => updateOperationInWorkspace(current, operationId, updater))}
            onRemove={(operationId) => commitWorkspace((current) => removeOperationFromWorkspace(current, operationId))}
            onDuplicate={(operationId) => commitWorkspace((current) => duplicateOperationInWorkspace(current, operationId))}
            onMove={(operationId, delta) => commitWorkspace((current) => moveOperationBy(current, operationId, delta))}
          />

          <RemoteBenchmarkCard
            backendOptions={backendOptions}
            remoteBackend={effectiveRemoteBackend}
            remoteWorkflow={remoteWorkflow}
            onBackendChange={setRemoteBackend}
            onWorkflowChange={setRemoteWorkflow}
            onRun={handleRemoteRun}
            jobStatus={jobStatus}
            jobError={jobError}
            remoteMetrics={remoteMetrics}
            remoteSummary={remoteSummary}
            workspace={workspace}
            submitQuantumJob={submitQuantumJob}
          />
        </section>

        <section className="quantum-workbench__analysis">
          <GlassCard title="Measurement Distribution" icon={<FiActivity />} className="quantum-workbench__card">
            <div className="quantum-workbench__chart-meta">
              <span>Readout lanes: {simulation.measuredQubits.map((qubit) => `q${qubit}`).join(', ')}</span>
              <span>{workspace.shots} deterministic shots</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={histogramData} margin={{ top: 8, right: 8, bottom: 32, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} height={52} />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name === 'measured' ? 'Noisy Readout' : 'Ideal Readout']}
                  labelFormatter={(label) => `|${label}>`}
                />
                <Bar dataKey="measured" name="measured" radius={[6, 6, 0, 0]} fill="rgba(10,255,255,0.86)" />
                <Bar dataKey="ideal" name="ideal" radius={[6, 6, 0, 0]} fill="rgba(123,47,255,0.55)" />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard title="Statevector Register" icon={<FiCpu />} className="quantum-workbench__card">
            <AmplitudeList entries={simulation.stateEntries.slice(0, 12)} />
          </GlassCard>

          <GlassCard title="Qubit Telemetry" icon={<FiZap />} className="quantum-workbench__card">
            <QubitTelemetry qubitVectors={simulation.qubitVectors} />
          </GlassCard>

          <GlassCard title="Compilation Notes" icon={<FiCloudLightning />} className="quantum-workbench__card">
            <DiagnosticsList diagnostics={simulation.diagnostics} />
          </GlassCard>
        </section>
      </div>
    </div>
  );
}

function MetricChip({ icon, label, value, tone = 'default' }) {
  return (
    <div className={`quantum-workbench__metric quantum-workbench__metric--${tone}`}>
      <span className="quantum-workbench__metric-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function GatePalette({ groupedGates, armedGateId, onArmGate }) {
  return (
    <div className="quantum-workbench__palette">
      {groupedGates.map((group) => (
        <div key={group.family} className="quantum-workbench__palette-group">
          <div className="quantum-workbench__palette-label">{group.family}</div>
          <div className="quantum-workbench__palette-grid">
            {group.gates.map((gate) => (
              <button
                key={gate.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    'application/x-quantum-gate',
                    JSON.stringify({ kind: 'palette', gateId: gate.id })
                  );
                  event.dataTransfer.setData(
                    'text/plain',
                    JSON.stringify({ kind: 'palette', gateId: gate.id })
                  );
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onArmGate((current) => (current === gate.id ? null : gate.id))}
                className={`quantum-workbench__palette-item ${armedGateId === gate.id ? 'is-armed' : ''}`}
                style={{ '--gate-accent': gate.accent }}
                title={gate.description}
              >
                <span className="quantum-workbench__palette-symbol">{gate.symbol}</span>
                <span className="quantum-workbench__palette-name">{gate.id}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CircuitCanvas({
  workspace,
  selectedOperationId,
  armedGateId,
  hoverCell,
  onHoverCell,
  onSelectOperation,
  onCellClick,
  onOperationDragStart,
  onCellDrop,
}) {
  const operationMap = useMemo(() => {
    const map = new Map();
    workspace.operations.forEach((operation) => {
      const qubits = getOperationQubits(operation);
      const min = Math.min(...qubits);
      const max = Math.max(...qubits);
      for (let row = min; row <= max; row += 1) {
        map.set(`${row}:${operation.column}`, operation);
      }
    });
    return map;
  }, [workspace.operations]);

  return (
    <div className="quantum-workbench__canvas-shell">
      <div
        className="quantum-workbench__canvas-grid"
        style={{ '--timeline-columns': workspace.columns }}
      >
        <div className="quantum-workbench__canvas-corner">wire</div>
        {Array.from({ length: workspace.columns }, (_, column) => (
          <div key={`head-${column}`} className="quantum-workbench__canvas-head">
            t{column}
          </div>
        ))}

        {Array.from({ length: workspace.numQubits }, (_, row) => (
          <MotionDiv
            key={`row-${row}`}
            className="quantum-workbench__canvas-row"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: row * 0.02 }}
          >
            <div className="quantum-workbench__wire-label">
              <strong>q{row}</strong>
              <small>{row === 0 ? 'control lane' : 'compute lane'}</small>
            </div>

            {Array.from({ length: workspace.columns }, (_, column) => {
              const key = `${row}:${column}`;
              const operation = operationMap.get(key) || null;
              const role = getCellRole(operation, row);
              const isSelected = operation?.id === selectedOperationId;
              const isHover = hoverCell?.row === row && hoverCell?.column === column;
              const showTopConnector =
                operation &&
                isTwoQubitGate(operation.gateId) &&
                row > Math.min(...getOperationQubits(operation));
              const showBottomConnector =
                operation &&
                isTwoQubitGate(operation.gateId) &&
                row < Math.max(...getOperationQubits(operation));

              return (
                <button
                  key={key}
                  type="button"
                  className={`quantum-workbench__cell role-${role} ${isSelected ? 'is-selected' : ''} ${isHover ? 'is-hover' : ''} ${armedGateId && role === 'empty' ? 'is-armed-target' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    onHoverCell({ row, column });
                  }}
                  onDragLeave={() => onHoverCell(null)}
                  onDrop={(event) => onCellDrop(row, column, event)}
                  onClick={() => {
                    if (operation) {
                      onSelectOperation(operation.id);
                      return;
                    }

                    onCellClick(row, column);
                  }}
                >
                  <span className="quantum-workbench__cell-wire" />
                  {showTopConnector && <span className="quantum-workbench__connector quantum-workbench__connector--top" />}
                  {showBottomConnector && <span className="quantum-workbench__connector quantum-workbench__connector--bottom" />}

                  {operation && role !== 'bridge' && (
                    <span
                      className={`quantum-workbench__gate token-${role}`}
                      draggable
                      onDragStart={(event) => onOperationDragStart(operation.id, event)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectOperation(operation.id);
                      }}
                      title={
                        isRotationGate(operation.gateId)
                          ? `${operation.gateId} ${formatAngle(operation.angle)}`
                          : operation.gateId
                      }
                    >
                      {role === 'control' ? <span className="quantum-workbench__control-dot" /> : getOperationDisplayLabel(operation)}
                    </span>
                  )}

                  {!operation && armedGateId && (
                    <span className="quantum-workbench__cell-hint">{armedGateId}</span>
                  )}
                </button>
              );
            })}
          </MotionDiv>
        ))}
      </div>
    </div>
  );
}

function OperationInspector({
  workspace,
  selectedOperation,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}) {
  const qubitOptions = Array.from({ length: workspace.numQubits }, (_, index) => ({
    value: String(index),
    label: `q${index}`,
  }));

  if (!selectedOperation) {
    return (
      <GlassCard title="Operation Inspector" icon={<FiSliders />} className="quantum-workbench__card">
        <div className="quantum-workbench__empty-panel">
          Select a gate on the timeline to retarget qubits, tune angles, duplicate, or delete it.
        </div>
      </GlassCard>
    );
  }

  const gateMeta = getGateMeta(selectedOperation.gateId);
  const locationLabel = `Moment t${selectedOperation.column} on ${getOperationQubits(selectedOperation)
    .map((qubit) => `q${qubit}`)
    .join(', ')}`;

  return (
    <GlassCard title="Operation Inspector" icon={<FiSliders />} className="quantum-workbench__card">
      <div className="quantum-workbench__inspector-head">
        <div>
          <strong>{gateMeta?.label || selectedOperation.gateId}</strong>
          <p>{locationLabel}</p>
        </div>
        <span className="quantum-workbench__operation-tag">{selectedOperation.gateId}</span>
      </div>

      <div className="quantum-workbench__stack">
        <QuantumSlider
          label="Moment"
          value={selectedOperation.column}
          onChange={(value) => onMove(selectedOperation.id, value - selectedOperation.column)}
          min={0}
          max={workspace.columns - 1}
          step={1}
          color="var(--neon-purple)"
        />

        {!isTwoQubitGate(selectedOperation.gateId) && (
          <QuantumSelect
            label="Target Qubit"
            value={String(selectedOperation.qubits[0])}
            onChange={(value) => onUpdate(selectedOperation.id, (operation) => ({
              ...operation,
              qubits: [Number(value)],
            }))}
            options={qubitOptions}
            color="var(--neon-cyan)"
          />
        )}

        {(selectedOperation.gateId === 'CNOT' || selectedOperation.gateId === 'CZ') && (
          <div className="quantum-workbench__inspector-grid">
            <QuantumSelect
              label="Control"
              value={String(selectedOperation.control)}
              onChange={(value) => onUpdate(selectedOperation.id, (operation) => {
                const [control, target] = ensureDistinctPair(
                  Number(value),
                  operation.target,
                  workspace.numQubits
                );
                return { ...operation, control, target };
              })}
              options={qubitOptions}
              color="var(--neon-cyan)"
            />
            <QuantumSelect
              label="Target"
              value={String(selectedOperation.target)}
              onChange={(value) => onUpdate(selectedOperation.id, (operation) => {
                const [control, target] = ensureDistinctPair(
                  operation.control,
                  Number(value),
                  workspace.numQubits
                );
                return { ...operation, control, target };
              })}
              options={qubitOptions}
              color="var(--neon-magenta)"
            />
          </div>
        )}

        {selectedOperation.gateId === 'SWAP' && (
          <div className="quantum-workbench__inspector-grid">
            <QuantumSelect
              label="Wire A"
              value={String(selectedOperation.qubits[0])}
              onChange={(value) => onUpdate(selectedOperation.id, (operation) => {
                const [first, second] = ensureDistinctPair(
                  Number(value),
                  operation.qubits[1],
                  workspace.numQubits
                );
                return { ...operation, qubits: [first, second] };
              })}
              options={qubitOptions}
              color="var(--neon-amber)"
            />
            <QuantumSelect
              label="Wire B"
              value={String(selectedOperation.qubits[1])}
              onChange={(value) => onUpdate(selectedOperation.id, (operation) => {
                const [first, second] = ensureDistinctPair(
                  operation.qubits[0],
                  Number(value),
                  workspace.numQubits
                );
                return { ...operation, qubits: [first, second] };
              })}
              options={qubitOptions}
              color="var(--neon-amber)"
            />
          </div>
        )}

        {isRotationGate(selectedOperation.gateId) && (
          <QuantumSlider
            label="Rotation Angle"
            value={selectedOperation.angle}
            onChange={(value) => onUpdate(selectedOperation.id, (operation) => ({
              ...operation,
              angle: value,
            }))}
            min={-Math.PI * 2}
            max={Math.PI * 2}
            step={0.05}
            unit="rad"
            color="var(--neon-green)"
          />
        )}
      </div>

      <div className="quantum-workbench__button-row">
        <button type="button" className="quantum-workbench__ghost-btn" onClick={() => onMove(selectedOperation.id, -1)}>
          <FiArrowLeft />
          Step Left
        </button>
        <button type="button" className="quantum-workbench__ghost-btn" onClick={() => onMove(selectedOperation.id, 1)}>
          <FiArrowRight />
          Step Right
        </button>
        <button type="button" className="quantum-workbench__ghost-btn" onClick={() => onDuplicate(selectedOperation.id)}>
          <FiCopy />
          Duplicate
        </button>
        <button type="button" className="quantum-workbench__ghost-btn quantum-workbench__ghost-btn--danger" onClick={() => onRemove(selectedOperation.id)}>
          <FiTrash2 />
          Delete
        </button>
      </div>
    </GlassCard>
  );
}

function IoWorkbench({
  ioMode,
  ioText,
  ioError,
  copyState,
  onChangeMode,
  onChangeText,
  onCopy,
  onRefresh,
  onImportJson,
}) {
  return (
    <GlassCard title="Import / Export" icon={<FiDownload />} className="quantum-workbench__card">
      <div className="quantum-workbench__mode-row">
        <button
          type="button"
          className={`quantum-workbench__mode-chip ${ioMode === 'json' ? 'is-active' : ''}`}
          onClick={() => onChangeMode('json')}
        >
          JSON
        </button>
        <button
          type="button"
          className={`quantum-workbench__mode-chip ${ioMode === 'qasm' ? 'is-active' : ''}`}
          onClick={() => onChangeMode('qasm')}
        >
          OpenQASM
        </button>
      </div>

      <textarea
        className="quantum-workbench__io-area"
        value={ioText}
        onChange={(event) => onChangeText(event.target.value)}
        spellCheck="false"
      />

      {ioError && <div className="quantum-workbench__error">{ioError}</div>}

      <div className="quantum-workbench__button-row">
        <button type="button" className="quantum-workbench__ghost-btn" onClick={onRefresh}>
          <FiRefreshCw />
          Refresh
        </button>
        <button type="button" className="quantum-workbench__ghost-btn" onClick={onCopy}>
          <FiClipboard />
          {copyState || 'Copy'}
        </button>
        <button type="button" className="quantum-workbench__ghost-btn" onClick={onImportJson} disabled={ioMode !== 'json'}>
          <FiUpload />
          Load JSON
        </button>
      </div>
    </GlassCard>
  );
}

function RemoteBenchmarkCard({
  backendOptions,
  remoteBackend,
  remoteWorkflow,
  onBackendChange,
  onWorkflowChange,
  onRun,
  jobStatus,
  jobError,
  remoteMetrics,
  remoteSummary,
  workspace,
  submitQuantumJob,
}) {
  const running = jobStatus === 'running' || jobStatus === 'submitting';

  return (
    <GlassCard title="Backend Benchmark Lane" icon={<FiCloudLightning />} className="quantum-workbench__card">
      <div className="quantum-workbench__remote-copy">
        <p>
          The backend still runs high-level workflows rather than arbitrary custom circuits, so this
          lane is best for sanity checks and throughput comparisons after local iteration.
        </p>
      </div>

      <div className="quantum-workbench__stack">
        <QuantumSelect
          label="Backend"
          value={remoteBackend}
          onChange={onBackendChange}
          options={backendOptions}
          color="var(--neon-cyan)"
        />
        <QuantumSelect
          label="Workflow"
          value={remoteWorkflow}
          onChange={onWorkflowChange}
          options={REMOTE_WORKFLOW_OPTIONS}
          color="var(--neon-purple)"
        />
      </div>

      <div className="quantum-workbench__remote-status">
        <span className={`quantum-workbench__status-pill status-${jobStatus}`}>
          {jobStatus === 'idle' && 'Idle'}
          {jobStatus === 'submitting' && 'Submitting'}
          {jobStatus === 'running' && 'Running'}
          {jobStatus === 'completed' && 'Completed'}
          {jobStatus === 'failed' && 'Failed'}
        </span>
        <small>
          Uses {workspace.numQubits} qubits, {workspace.shots} shots, and the {workspace.noiseModel} noise profile.
        </small>
      </div>

      <QuantumButton
        variant="purple"
        fullWidth
        onClick={onRun}
        loading={running}
        disabled={!submitQuantumJob || running}
        icon={<FiCloudLightning />}
      >
        {running ? 'Running Backend Job...' : 'Run Backend Workflow'}
      </QuantumButton>

      {jobError && <div className="quantum-workbench__error">{jobError}</div>}

      {jobStatus === 'completed' && (
        <div className="quantum-workbench__remote-grid">
          <div className="quantum-workbench__remote-cell">
            <span>Backend</span>
            <strong>{remoteMetrics.backendName || remoteBackend}</strong>
          </div>
          <div className="quantum-workbench__remote-cell">
            <span>Depth</span>
            <strong>{remoteMetrics.circuitDepth || 0}</strong>
          </div>
          <div className="quantum-workbench__remote-cell">
            <span>Top State</span>
            <strong>{remoteSummary.topState ? `|${remoteSummary.topState}>` : 'n/a'}</strong>
          </div>
          <div className="quantum-workbench__remote-cell">
            <span>Top Count</span>
            <strong>{remoteSummary.topCount || 0}</strong>
          </div>
          <div className="quantum-workbench__remote-cell">
            <span>Fidelity</span>
            <strong>{formatPercent(remoteMetrics.fidelityEstimate || 0)}</strong>
          </div>
          <div className="quantum-workbench__remote-cell">
            <span>Exec Time</span>
            <strong>{remoteMetrics.executionTime || 0} ms</strong>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function AmplitudeList({ entries }) {
  return (
    <div className="quantum-workbench__amplitudes">
      {entries.map((entry) => (
        <div key={entry.basis} className="quantum-workbench__amplitude-row">
          <div className="quantum-workbench__amplitude-copy">
            <strong>|{entry.basis}&gt;</strong>
            <span>{formatPercent(entry.probability)}</span>
          </div>
          <div className="quantum-workbench__amplitude-bar">
            <MotionDiv
              className="quantum-workbench__amplitude-fill"
              initial={{ width: 0 }}
              animate={{ width: `${entry.probability * 100}%` }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="quantum-workbench__amplitude-meta">
            <span>
              {formatSigned(entry.real)} {entry.imag < 0 ? '-' : '+'} {Math.abs(entry.imag).toFixed(3)}i
            </span>
            <small>{formatAngle(entry.phase)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function QubitTelemetry({ qubitVectors }) {
  return (
    <div className="quantum-workbench__telemetry">
      {qubitVectors.map((vector) => (
        <div key={vector.qubit} className="quantum-workbench__telemetry-row">
          <div className="quantum-workbench__telemetry-head">
            <strong>{vector.qubit}</strong>
            <div className="quantum-workbench__telemetry-badges">
              <span>purity {vector.purity.toFixed(2)}</span>
              <span>entropy {vector.entropy.toFixed(2)}</span>
            </div>
          </div>
          <AxisBar label="X" value={vector.x} tone="cyan" />
          <AxisBar label="Y" value={vector.y} tone="magenta" />
          <AxisBar label="Z" value={vector.z} tone="green" />
        </div>
      ))}
    </div>
  );
}

function AxisBar({ label, value, tone }) {
  return (
    <div className="quantum-workbench__axis-row">
      <span>{label}</span>
      <div className="quantum-workbench__axis-track">
        <MotionDiv
          className={`quantum-workbench__axis-fill tone-${tone} ${value < 0 ? 'is-negative' : ''}`}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.abs(value) * 50}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>
      <strong>{formatSigned(value)}</strong>
    </div>
  );
}

function DiagnosticsList({ diagnostics }) {
  return (
    <div className="quantum-workbench__diagnostics">
      {diagnostics.map((item, index) => (
        <div key={`${item.level}-${index}`} className={`quantum-workbench__diagnostic level-${item.level}`}>
          <span className="quantum-workbench__diagnostic-icon">
            {item.level === 'success' ? <FiCheckCircle /> : item.level === 'warning' ? <FiZap /> : <FiSave />}
          </span>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  );
}
