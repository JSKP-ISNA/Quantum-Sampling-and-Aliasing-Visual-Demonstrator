const MIN_QUBITS = 1;
const MAX_QUBITS = 8;
const MIN_COLUMNS = 6;
const MAX_COLUMNS = 24;
const MIN_SHOTS = 128;
const MAX_SHOTS = 8192;
const SHOT_STEP = 128;
const DEFAULT_ROTATION = Math.PI / 2;

const VALID_NOISE_MODELS = new Set(['ideal', 'depolarizing', 'thermal']);
const TWO_QUBIT_GATES = new Set(['CNOT', 'CZ', 'SWAP']);
const ROTATION_GATES = new Set(['RX', 'RY', 'RZ']);

export const GATE_LIBRARY = [
  {
    id: 'H',
    label: 'Hadamard',
    symbol: 'H',
    family: 'Single-Qubit',
    accent: 'var(--neon-cyan)',
    description: 'Create superposition from a computational basis state.',
  },
  {
    id: 'X',
    label: 'Pauli-X',
    symbol: 'X',
    family: 'Single-Qubit',
    accent: 'var(--neon-blue)',
    description: 'Flip the qubit between |0> and |1>.',
  },
  {
    id: 'Y',
    label: 'Pauli-Y',
    symbol: 'Y',
    family: 'Single-Qubit',
    accent: 'var(--neon-magenta)',
    description: 'Rotate around the Y axis with an imaginary phase.',
  },
  {
    id: 'Z',
    label: 'Pauli-Z',
    symbol: 'Z',
    family: 'Single-Qubit',
    accent: 'var(--neon-purple)',
    description: 'Flip the phase of the |1> component.',
  },
  {
    id: 'S',
    label: 'Phase-S',
    symbol: 'S',
    family: 'Phase',
    accent: 'var(--neon-green)',
    description: 'Apply a quarter-turn phase.',
  },
  {
    id: 'T',
    label: 'Phase-T',
    symbol: 'T',
    family: 'Phase',
    accent: 'var(--neon-amber)',
    description: 'Apply an eighth-turn phase.',
  },
  {
    id: 'RX',
    label: 'Rotate X',
    symbol: 'RX',
    family: 'Rotations',
    accent: 'var(--neon-blue)',
    description: 'Parameterized rotation around the X axis.',
    hasAngle: true,
  },
  {
    id: 'RY',
    label: 'Rotate Y',
    symbol: 'RY',
    family: 'Rotations',
    accent: 'var(--neon-green)',
    description: 'Parameterized rotation around the Y axis.',
    hasAngle: true,
  },
  {
    id: 'RZ',
    label: 'Rotate Z',
    symbol: 'RZ',
    family: 'Rotations',
    accent: 'var(--neon-purple)',
    description: 'Parameterized rotation around the Z axis.',
    hasAngle: true,
  },
  {
    id: 'CNOT',
    label: 'Controlled-X',
    symbol: 'CX',
    family: 'Entangling',
    accent: 'var(--neon-cyan)',
    description: 'Entangle a control qubit with a target X flip.',
  },
  {
    id: 'CZ',
    label: 'Controlled-Z',
    symbol: 'CZ',
    family: 'Entangling',
    accent: 'var(--neon-magenta)',
    description: 'Entangle qubits with a controlled phase flip.',
  },
  {
    id: 'SWAP',
    label: 'Swap',
    symbol: 'SWP',
    family: 'Entangling',
    accent: 'var(--neon-amber)',
    description: 'Exchange the state of two qubits.',
  },
  {
    id: 'MEASURE',
    label: 'Measure',
    symbol: 'M',
    family: 'Readout',
    accent: 'var(--text-primary)',
    description: 'Mark a qubit for computational-basis readout.',
  },
];

export const PRESET_LIBRARY = [
  {
    id: 'bell',
    label: 'Bell Pair',
    summary: 'Two-qubit entanglement starter.',
  },
  {
    id: 'ghz',
    label: 'GHZ Chain',
    summary: 'Fan out one superposition across several qubits.',
  },
  {
    id: 'hardware-ansatz',
    label: 'Hardware Ansatz',
    summary: 'Rotation-entangler layer for VQE-style experiments.',
  },
  {
    id: 'phase-kickback',
    label: 'Phase Kickback',
    summary: 'Controlled phase behavior with an ancilla lane.',
  },
  {
    id: 'qft-lite',
    label: 'QFT Lite',
    summary: 'A compact Fourier-style ladder with long-range couplings.',
  },
];

const GATE_MAP = new Map(GATE_LIBRARY.map((gate) => [gate.id, gate]));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function sortOperations(operations) {
  return [...operations].sort((left, right) => {
    if (left.column !== right.column) return left.column - right.column;
    const leftMin = Math.min(...getOperationQubits(left));
    const rightMin = Math.min(...getOperationQubits(right));
    if (leftMin !== rightMin) return leftMin - rightMin;
    return left.id.localeCompare(right.id);
  });
}

function createOperationId() {
  return `op_${Math.random().toString(36).slice(2, 10)}`;
}

export function getGateMeta(gateId) {
  return GATE_MAP.get(gateId) || null;
}

export function isRotationGate(gateId) {
  return ROTATION_GATES.has(gateId);
}

export function isTwoQubitGate(gateId) {
  return TWO_QUBIT_GATES.has(gateId);
}

export function getOperationQubits(operation) {
  if (operation.gateId === 'CNOT' || operation.gateId === 'CZ') {
    return [operation.control, operation.target];
  }
  if (operation.gateId === 'SWAP') {
    return [...operation.qubits];
  }
  return [...operation.qubits];
}

export function getOperationAnchor(operation) {
  return Math.min(...getOperationQubits(operation));
}

export function formatAngle(angle) {
  const rounded = Number(angle).toFixed(2);
  return `${rounded} rad`;
}

function basisMask(numQubits, qubit) {
  return 1 << (numQubits - qubit - 1);
}

function basisLabel(index, width) {
  return index.toString(2).padStart(width, '0');
}

function normalizeOperation(operation, numQubits, columns) {
  const gateMeta = getGateMeta(operation.gateId);
  if (!gateMeta) return null;

  const column = clamp(Number(operation.column) || 0, 0, Math.max(columns - 1, 0));

  if (!isTwoQubitGate(operation.gateId)) {
    const target = clamp(Number(operation.qubits?.[0]) || 0, 0, numQubits - 1);
    return {
      id: operation.id || createOperationId(),
      gateId: operation.gateId,
      column,
      qubits: [target],
      angle: gateMeta.hasAngle ? Number(operation.angle ?? DEFAULT_ROTATION) : undefined,
    };
  }

  if (operation.gateId === 'SWAP') {
    const first = clamp(Number(operation.qubits?.[0]) || 0, 0, numQubits - 1);
    let second = clamp(Number(operation.qubits?.[1]) || first + 1, 0, numQubits - 1);
    if (second === first) {
      second = clamp(first + 1, 0, numQubits - 1);
      if (second === first) second = clamp(first - 1, 0, numQubits - 1);
    }
    if (second === first) return null;
    return {
      id: operation.id || createOperationId(),
      gateId: operation.gateId,
      column,
      qubits: [first, second],
    };
  }

  let control = clamp(Number(operation.control) || 0, 0, numQubits - 1);
  let target = clamp(Number(operation.target) || control + 1, 0, numQubits - 1);

  if (target === control) {
    target = clamp(control + 1, 0, numQubits - 1);
    if (target === control) target = clamp(control - 1, 0, numQubits - 1);
  }

  if (target === control) return null;

  return {
    id: operation.id || createOperationId(),
    gateId: operation.gateId,
    column,
    control,
    target,
  };
}

function overlapsByQubit(left, right) {
  const leftSet = new Set(getOperationQubits(left));
  return getOperationQubits(right).some((qubit) => leftSet.has(qubit));
}

function reanchorOperation(operation, row, numQubits, column = operation.column) {
  const boundedColumn = Math.max(0, Number(column) || 0);

  if (!isTwoQubitGate(operation.gateId)) {
    return {
      ...operation,
      column: boundedColumn,
      qubits: [clamp(row, 0, numQubits - 1)],
    };
  }

  if (operation.gateId === 'SWAP') {
    const [first, second] = getOperationQubits(operation).sort((a, b) => a - b);
    const span = Math.max(1, second - first);
    const top = clamp(row, 0, Math.max(numQubits - span - 1, 0));
    return {
      ...operation,
      column: boundedColumn,
      qubits: [top, top + span],
    };
  }

  const span = Math.max(1, Math.abs(operation.target - operation.control));
  const top = clamp(row, 0, Math.max(numQubits - span - 1, 0));
  const descending = operation.control > operation.target;

  return {
    ...operation,
    column: boundedColumn,
    control: descending ? top + span : top,
    target: descending ? top : top + span,
  };
}

export function buildOperationFromGate(gateId, column, row, numQubits) {
  if (!getGateMeta(gateId)) return null;

  if (!isTwoQubitGate(gateId)) {
    return normalizeOperation(
      {
        id: createOperationId(),
        gateId,
        column,
        qubits: [row],
        angle: isRotationGate(gateId) ? DEFAULT_ROTATION : undefined,
      },
      numQubits,
      MAX_COLUMNS
    );
  }

  const top = clamp(row, 0, Math.max(numQubits - 2, 0));

  if (gateId === 'SWAP') {
    return normalizeOperation(
      {
        id: createOperationId(),
        gateId,
        column,
        qubits: [top, top + 1],
      },
      numQubits,
      MAX_COLUMNS
    );
  }

  return normalizeOperation(
    {
      id: createOperationId(),
      gateId,
      column,
      control: top,
      target: top + 1,
    },
    numQubits,
    MAX_COLUMNS
  );
}

export function sanitizeWorkspace(workspace) {
  const numQubits = clamp(Number(workspace?.numQubits) || 4, MIN_QUBITS, MAX_QUBITS);
  const columns = clamp(Number(workspace?.columns) || 12, MIN_COLUMNS, MAX_COLUMNS);
  const shots = clamp(
    roundToStep(Number(workspace?.shots) || 1024, SHOT_STEP),
    MIN_SHOTS,
    MAX_SHOTS
  );
  const noiseModel = VALID_NOISE_MODELS.has(workspace?.noiseModel)
    ? workspace.noiseModel
    : 'ideal';

  const operations = sortOperations(
    (workspace?.operations || [])
      .map((operation) => normalizeOperation(operation, numQubits, columns))
      .filter(Boolean)
      .filter((operation) => operation.column < columns)
  );

  return {
    numQubits,
    columns,
    shots,
    noiseModel,
    operations,
  };
}

export function createDefaultWorkspace() {
  return buildPresetWorkspace('hardware-ansatz', 4);
}

export function buildPresetWorkspace(presetId, requestedQubits = 4) {
  const numQubits = clamp(requestedQubits, MIN_QUBITS, MAX_QUBITS);

  if (presetId === 'bell') {
    return sanitizeWorkspace({
      numQubits: Math.max(2, numQubits),
      columns: 8,
      shots: 1024,
      noiseModel: 'ideal',
      operations: [
        { id: createOperationId(), gateId: 'H', column: 0, qubits: [0] },
        { id: createOperationId(), gateId: 'CNOT', column: 1, control: 0, target: 1 },
        { id: createOperationId(), gateId: 'MEASURE', column: 3, qubits: [0] },
        { id: createOperationId(), gateId: 'MEASURE', column: 3, qubits: [1] },
      ],
    });
  }

  if (presetId === 'ghz') {
    const width = Math.max(3, numQubits);
    const operations = [{ id: createOperationId(), gateId: 'H', column: 0, qubits: [0] }];
    for (let qubit = 0; qubit < width - 1; qubit += 1) {
      operations.push({
        id: createOperationId(),
        gateId: 'CNOT',
        column: qubit + 1,
        control: qubit,
        target: qubit + 1,
      });
    }
    for (let qubit = 0; qubit < width; qubit += 1) {
      operations.push({
        id: createOperationId(),
        gateId: 'MEASURE',
        column: width + 2,
        qubits: [qubit],
      });
    }
    return sanitizeWorkspace({
      numQubits: width,
      columns: Math.min(width + 6, MAX_COLUMNS),
      shots: 1024,
      noiseModel: 'depolarizing',
      operations,
    });
  }

  if (presetId === 'phase-kickback') {
    const width = Math.max(3, numQubits);
    return sanitizeWorkspace({
      numQubits: width,
      columns: 10,
      shots: 2048,
      noiseModel: 'ideal',
      operations: [
        { id: createOperationId(), gateId: 'X', column: 0, qubits: [width - 1] },
        { id: createOperationId(), gateId: 'H', column: 1, qubits: [0] },
        { id: createOperationId(), gateId: 'H', column: 1, qubits: [width - 1] },
        { id: createOperationId(), gateId: 'CZ', column: 2, control: 0, target: width - 1 },
        { id: createOperationId(), gateId: 'RZ', column: 3, qubits: [width - 1], angle: Math.PI / 3 },
        { id: createOperationId(), gateId: 'H', column: 4, qubits: [0] },
        { id: createOperationId(), gateId: 'MEASURE', column: 6, qubits: [0] },
        { id: createOperationId(), gateId: 'MEASURE', column: 6, qubits: [width - 1] },
      ],
    });
  }

  if (presetId === 'qft-lite') {
    const width = Math.max(3, Math.min(5, numQubits));
    const operations = [];
    for (let qubit = 0; qubit < width; qubit += 1) {
      operations.push({ id: createOperationId(), gateId: 'H', column: qubit * 2, qubits: [qubit] });
      if (qubit + 1 < width) {
        operations.push({
          id: createOperationId(),
          gateId: 'CZ',
          column: qubit * 2 + 1,
          control: qubit,
          target: width - 1,
        });
      }
    }
    operations.push({ id: createOperationId(), gateId: 'SWAP', column: width * 2, qubits: [0, width - 1] });
    for (let qubit = 0; qubit < width; qubit += 1) {
      operations.push({
        id: createOperationId(),
        gateId: 'MEASURE',
        column: width * 2 + 2,
        qubits: [qubit],
      });
    }
    return sanitizeWorkspace({
      numQubits: width,
      columns: Math.min(width * 2 + 5, MAX_COLUMNS),
      shots: 2048,
      noiseModel: 'thermal',
      operations,
    });
  }

  const operations = [];
  for (let qubit = 0; qubit < numQubits; qubit += 1) {
    operations.push({
      id: createOperationId(),
      gateId: 'RY',
      column: 0,
      qubits: [qubit],
      angle: Math.PI / (3 + qubit),
    });
    operations.push({
      id: createOperationId(),
      gateId: 'RZ',
      column: 1,
      qubits: [qubit],
      angle: Math.PI / (2 + qubit),
    });
  }
  for (let qubit = 0; qubit < numQubits - 1; qubit += 1) {
    operations.push({
      id: createOperationId(),
      gateId: 'CNOT',
      column: 2 + qubit,
      control: qubit,
      target: qubit + 1,
    });
  }
  for (let qubit = 0; qubit < numQubits; qubit += 1) {
    operations.push({
      id: createOperationId(),
      gateId: 'RY',
      column: numQubits + 2,
      qubits: [qubit],
      angle: Math.PI / 4,
    });
  }

  return sanitizeWorkspace({
    numQubits,
    columns: Math.min(numQubits + 7, MAX_COLUMNS),
    shots: 2048,
    noiseModel: 'depolarizing',
    operations,
  });
}

function replaceOperation(workspace, operation, ignoreId = null) {
  const nextOperation = normalizeOperation(operation, workspace.numQubits, workspace.columns);
  if (!nextOperation) return workspace;

  const operations = workspace.operations.filter((candidate) => {
    if (candidate.id === ignoreId) return false;
    if (candidate.column !== nextOperation.column) return true;
    return !overlapsByQubit(candidate, nextOperation);
  });

  return sanitizeWorkspace({
    ...workspace,
    operations: [...operations, nextOperation],
  });
}

export function placeOperationInWorkspace(workspace, source, row, column) {
  const normalized = sanitizeWorkspace(workspace);
  const boundedColumn = clamp(column, 0, normalized.columns - 1);

  if (source.kind === 'palette') {
    const created = buildOperationFromGate(source.gateId, boundedColumn, row, normalized.numQubits);
    if (!created) return normalized;
    return replaceOperation(normalized, created);
  }

  if (source.kind === 'move') {
    const current = normalized.operations.find((operation) => operation.id === source.operationId);
    if (!current) return normalized;
    const moved = reanchorOperation(current, row, normalized.numQubits, boundedColumn);
    return replaceOperation(normalized, moved, current.id);
  }

  return normalized;
}

export function updateOperationInWorkspace(workspace, operationId, updater) {
  const normalized = sanitizeWorkspace(workspace);
  const current = normalized.operations.find((operation) => operation.id === operationId);
  if (!current) return normalized;
  const nextValue = updater(current);
  if (!nextValue) return normalized;
  return replaceOperation(normalized, nextValue, current.id);
}

export function moveOperationBy(workspace, operationId, delta) {
  return updateOperationInWorkspace(workspace, operationId, (operation) => ({
    ...operation,
    column: clamp(operation.column + delta, 0, workspace.columns - 1),
  }));
}

export function duplicateOperationInWorkspace(workspace, operationId) {
  const normalized = sanitizeWorkspace(workspace);
  const current = normalized.operations.find((operation) => operation.id === operationId);
  if (!current) return normalized;

  const duplicate = {
    ...current,
    id: createOperationId(),
    column: clamp(current.column + 1, 0, normalized.columns - 1),
  };

  return replaceOperation(normalized, duplicate);
}

export function removeOperationFromWorkspace(workspace, operationId) {
  return sanitizeWorkspace({
    ...workspace,
    operations: workspace.operations.filter((operation) => operation.id !== operationId),
  });
}

function matrixForGate(gateId, angle = DEFAULT_ROTATION) {
  const cos = Math.cos(angle / 2);
  const sin = Math.sin(angle / 2);

  if (gateId === 'H') {
    return [
      [Math.SQRT1_2, 0],
      [Math.SQRT1_2, 0],
      [Math.SQRT1_2, 0],
      [-Math.SQRT1_2, 0],
    ];
  }

  if (gateId === 'X') {
    return [
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 0],
    ];
  }

  if (gateId === 'Y') {
    return [
      [0, 0],
      [0, -1],
      [0, 1],
      [0, 0],
    ];
  }

  if (gateId === 'Z') {
    return [
      [1, 0],
      [0, 0],
      [0, 0],
      [-1, 0],
    ];
  }

  if (gateId === 'S') {
    return [
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 1],
    ];
  }

  if (gateId === 'T') {
    return [
      [1, 0],
      [0, 0],
      [0, 0],
      [Math.SQRT1_2, Math.SQRT1_2],
    ];
  }

  if (gateId === 'RX') {
    return [
      [cos, 0],
      [0, -sin],
      [0, -sin],
      [cos, 0],
    ];
  }

  if (gateId === 'RY') {
    return [
      [cos, 0],
      [-sin, 0],
      [sin, 0],
      [cos, 0],
    ];
  }

  if (gateId === 'RZ') {
    return [
      [Math.cos(-angle / 2), Math.sin(-angle / 2)],
      [0, 0],
      [0, 0],
      [Math.cos(angle / 2), Math.sin(angle / 2)],
    ];
  }

  return null;
}

function applySingleGate(state, numQubits, qubit, matrix) {
  const [m00, m01, m10, m11] = matrix;
  const mask = basisMask(numQubits, qubit);
  const { real, imag } = state;

  for (let index = 0; index < real.length; index += 1) {
    if (index & mask) continue;

    const pair = index | mask;
    const aRe = real[index];
    const aIm = imag[index];
    const bRe = real[pair];
    const bIm = imag[pair];

    real[index] =
      m00[0] * aRe - m00[1] * aIm +
      m01[0] * bRe - m01[1] * bIm;
    imag[index] =
      m00[0] * aIm + m00[1] * aRe +
      m01[0] * bIm + m01[1] * bRe;

    real[pair] =
      m10[0] * aRe - m10[1] * aIm +
      m11[0] * bRe - m11[1] * bIm;
    imag[pair] =
      m10[0] * aIm + m10[1] * aRe +
      m11[0] * bIm + m11[1] * bRe;
  }
}

function applyCnot(state, numQubits, control, target) {
  const controlMask = basisMask(numQubits, control);
  const targetMask = basisMask(numQubits, target);
  const { real, imag } = state;

  for (let index = 0; index < real.length; index += 1) {
    if ((index & controlMask) === 0 || index & targetMask) continue;
    const pair = index | targetMask;

    [real[index], real[pair]] = [real[pair], real[index]];
    [imag[index], imag[pair]] = [imag[pair], imag[index]];
  }
}

function applyCz(state, numQubits, control, target) {
  const controlMask = basisMask(numQubits, control);
  const targetMask = basisMask(numQubits, target);
  const { real, imag } = state;

  for (let index = 0; index < real.length; index += 1) {
    if ((index & controlMask) === 0 || (index & targetMask) === 0) continue;
    real[index] *= -1;
    imag[index] *= -1;
  }
}

function applySwap(state, numQubits, first, second) {
  const firstMask = basisMask(numQubits, first);
  const secondMask = basisMask(numQubits, second);
  const { real, imag } = state;

  for (let index = 0; index < real.length; index += 1) {
    const firstBit = (index & firstMask) !== 0;
    const secondBit = (index & secondMask) !== 0;
    if (firstBit === secondBit || firstBit) continue;

    const swapped = index ^ firstMask ^ secondMask;

    [real[index], real[swapped]] = [real[swapped], real[index]];
    [imag[index], imag[swapped]] = [imag[swapped], imag[index]];
  }
}

function buildStatevector(workspace) {
  const stateSize = 2 ** workspace.numQubits;
  const state = {
    real: new Float64Array(stateSize),
    imag: new Float64Array(stateSize),
  };

  state.real[0] = 1;

  for (const operation of workspace.operations) {
    if (operation.gateId === 'MEASURE') continue;

    if (operation.gateId === 'CNOT') {
      applyCnot(state, workspace.numQubits, operation.control, operation.target);
      continue;
    }

    if (operation.gateId === 'CZ') {
      applyCz(state, workspace.numQubits, operation.control, operation.target);
      continue;
    }

    if (operation.gateId === 'SWAP') {
      applySwap(state, workspace.numQubits, operation.qubits[0], operation.qubits[1]);
      continue;
    }

    const matrix = matrixForGate(operation.gateId, operation.angle);
    if (!matrix) continue;
    applySingleGate(state, workspace.numQubits, operation.qubits[0], matrix);
  }

  return state;
}

function probabilitiesFromState(state) {
  return Array.from(state.real, (real, index) => real ** 2 + state.imag[index] ** 2);
}

function normalizeDistribution(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return values.map(() => 0);
  return values.map((value) => value / total);
}

function deterministicCounts(probabilities, shots) {
  const entries = Object.entries(probabilities);
  const base = entries.map(([label, probability]) => ({
    label,
    probability,
    count: Math.floor(probability * shots),
    fraction: probability * shots - Math.floor(probability * shots),
  }));

  const remaining = shots - base.reduce((sum, entry) => sum + entry.count, 0);

  base
    .slice()
    .sort((left, right) => right.fraction - left.fraction)
    .slice(0, remaining)
    .forEach((entry) => {
      const target = base.find((candidate) => candidate.label === entry.label);
      if (target) target.count += 1;
    });

  const counts = {};
  base.forEach((entry) => {
    if (entry.count > 0) counts[entry.label] = entry.count;
  });
  return counts;
}

function sortUnique(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function readoutDistribution(workspace, stateProbabilities) {
  const measuredQubits = sortUnique(
    workspace.operations
      .filter((operation) => operation.gateId === 'MEASURE')
      .map((operation) => operation.qubits[0])
  );

  const readoutQubits = measuredQubits.length
    ? measuredQubits
    : Array.from({ length: workspace.numQubits }, (_, index) => index);

  const distribution = {};

  stateProbabilities.forEach((probability, index) => {
    if (probability <= 1e-12) return;
    const label = readoutQubits
      .map((qubit) => (((index & basisMask(workspace.numQubits, qubit)) !== 0) ? '1' : '0'))
      .join('');
    distribution[label] = (distribution[label] || 0) + probability;
  });

  return {
    measuredQubits: readoutQubits,
    distribution,
  };
}

function applyNoise(distribution, noiseModel, metrics) {
  const labels = Object.keys(distribution).sort();
  const probabilities = labels.map((label) => distribution[label]);

  if (!labels.length || noiseModel === 'ideal') {
    return {
      probabilities: distribution,
      mixRate: 0,
    };
  }

  const mixBase =
    metrics.depth * 0.012 +
    metrics.entanglingGateCount * 0.035 +
    metrics.longRangeGateCount * 0.03;

  const mixRate = noiseModel === 'depolarizing'
    ? clamp(mixBase, 0, 0.42)
    : clamp(metrics.depth * 0.008 + metrics.measurementCount * 0.02, 0, 0.35);

  const uniform = 1 / labels.length;
  let target = labels.map(() => uniform);

  if (noiseModel === 'thermal') {
    target = normalizeDistribution(
      labels.map((label) => Math.exp(-label.split('').filter((bit) => bit === '1').length * 1.3))
    );
  }

  const noisy = {};
  labels.forEach((label, index) => {
    noisy[label] = (1 - mixRate) * probabilities[index] + mixRate * target[index];
  });

  return {
    probabilities: noisy,
    mixRate,
  };
}

function singleQubitObservables(state, numQubits, qubit) {
  const mask = basisMask(numQubits, qubit);
  let rho00 = 0;
  let rho11 = 0;
  let offDiagRe = 0;
  let offDiagIm = 0;

  for (let index = 0; index < state.real.length; index += 1) {
    if (index & mask) continue;

    const pair = index | mask;
    const aRe = state.real[index];
    const aIm = state.imag[index];
    const bRe = state.real[pair];
    const bIm = state.imag[pair];

    rho00 += aRe * aRe + aIm * aIm;
    rho11 += bRe * bRe + bIm * bIm;

    offDiagRe += aRe * bRe + aIm * bIm;
    offDiagIm += aIm * bRe - aRe * bIm;
  }

  const x = 2 * offDiagRe;
  const y = -2 * offDiagIm;
  const z = rho00 - rho11;
  const purity = clamp(
    rho00 * rho00 + rho11 * rho11 + 2 * (offDiagRe ** 2 + offDiagIm ** 2),
    0,
    1
  );
  const blochLength = clamp(Math.sqrt(x ** 2 + y ** 2 + z ** 2), 0, 1);
  const eigenHigh = (1 + blochLength) / 2;
  const eigenLow = 1 - eigenHigh;
  const entropy = [eigenHigh, eigenLow]
    .filter((value) => value > 1e-9)
    .reduce((sum, value) => sum - value * Math.log2(value), 0);

  return {
    qubit: `q${qubit}`,
    x,
    y,
    z,
    purity,
    entropy,
    coherence: Math.sqrt(Math.max(0, x ** 2 + y ** 2)),
    phase: Math.atan2(y, x),
  };
}

function diagnostics(workspace, metrics, measuredQubits) {
  const notes = [];
  const occupiedColumns = sortUnique(workspace.operations.map((operation) => operation.column));
  const maxUnitaryColumn = workspace.operations
    .filter((operation) => operation.gateId !== 'MEASURE')
    .reduce((max, operation) => Math.max(max, operation.column), -1);

  if (!workspace.operations.length) {
    notes.push({
      level: 'warning',
      text: 'The circuit is empty. Drag a gate into the timeline or load a preset to start simulating.',
    });
  }

  if (!workspace.operations.some((operation) => operation.gateId === 'MEASURE')) {
    notes.push({
      level: 'info',
      text: 'No readout gates are placed yet. The local simulator samples the full register at the terminal state.',
    });
  }

  if (
    workspace.operations.some(
      (operation) => operation.gateId === 'MEASURE' && operation.column < maxUnitaryColumn
    )
  ) {
    notes.push({
      level: 'warning',
      text: 'Mid-circuit measurement markers are treated as end-of-circuit readout in the frontend simulator.',
    });
  }

  if (metrics.longRangeGateCount > 0) {
    notes.push({
      level: 'warning',
      text: `There ${metrics.longRangeGateCount === 1 ? 'is' : 'are'} ${metrics.longRangeGateCount} non-local entangler${metrics.longRangeGateCount === 1 ? '' : 's'}. Expect routing overhead on nearest-neighbor hardware.`,
    });
  }

  if (metrics.entanglingGateCount === 0 && workspace.numQubits > 1 && metrics.gateCount > 0) {
    notes.push({
      level: 'info',
      text: 'Everything is still separable. Add CNOT, CZ, or SWAP to test coupling behavior and routing.',
    });
  }

  if (metrics.estimatedFidelity < 0.82) {
    notes.push({
      level: 'warning',
      text: 'The selected depth and noise profile are likely to wash out weak amplitudes before readout.',
    });
  }

  if (metrics.measurementEntropy > measuredQubits.length - 0.4 && measuredQubits.length > 1) {
    notes.push({
      level: 'success',
      text: 'The measured register is close to maximally spread, which is useful for sampling and mixing experiments.',
    });
  }

  const idleQubits = [];
  for (let qubit = 0; qubit < workspace.numQubits; qubit += 1) {
    const used = workspace.operations.some((operation) => getOperationQubits(operation).includes(qubit));
    if (!used) idleQubits.push(`q${qubit}`);
  }

  if (idleQubits.length) {
    notes.push({
      level: 'info',
      text: `Idle lanes detected: ${idleQubits.join(', ')}. You can shrink the register or use them as ancilla/work qubits.`,
    });
  }

  if (occupiedColumns.length > 0 && occupiedColumns.length < metrics.timelineLength) {
    notes.push({
      level: 'info',
      text: 'There are empty moments in the schedule. Compressing them can reduce depth without changing the unitary.',
    });
  }

  return notes;
}

function chartEntries(probabilities, counts) {
  return Object.entries(probabilities)
    .map(([label, probability]) => ({
      label,
      probability,
      count: counts[label] || 0,
    }))
    .sort((left, right) => right.probability - left.probability);
}

function qasmLineForOperation(operation) {
  if (operation.gateId === 'MEASURE') {
    const qubit = operation.qubits[0];
    return `measure q[${qubit}] -> c[${qubit}];`;
  }

  if (operation.gateId === 'CNOT') {
    return `cx q[${operation.control}],q[${operation.target}];`;
  }

  if (operation.gateId === 'CZ') {
    return `cz q[${operation.control}],q[${operation.target}];`;
  }

  if (operation.gateId === 'SWAP') {
    return `swap q[${operation.qubits[0]}],q[${operation.qubits[1]}];`;
  }

  const gate = operation.gateId.toLowerCase();
  if (isRotationGate(operation.gateId)) {
    return `${gate}(${Number(operation.angle).toFixed(6)}) q[${operation.qubits[0]}];`;
  }

  return `${gate} q[${operation.qubits[0]}];`;
}

export function exportOpenQasm(workspace) {
  const normalized = sanitizeWorkspace(workspace);
  const lines = [
    'OPENQASM 2.0;',
    'include "qelib1.inc";',
    '',
    `qreg q[${normalized.numQubits}];`,
    `creg c[${normalized.numQubits}];`,
    '',
  ];

  normalized.operations.forEach((operation) => {
    lines.push(qasmLineForOperation(operation));
  });

  if (!normalized.operations.some((operation) => operation.gateId === 'MEASURE')) {
    lines.push('');
    for (let qubit = 0; qubit < normalized.numQubits; qubit += 1) {
      lines.push(`measure q[${qubit}] -> c[${qubit}];`);
    }
  }

  return lines.join('\n');
}

export function serializeWorkspace(workspace) {
  const normalized = sanitizeWorkspace(workspace);
  return JSON.stringify(
    {
      version: 1,
      workspace: normalized,
      qasm: exportOpenQasm(normalized),
    },
    null,
    2
  );
}

export function parseWorkspace(text) {
  const payload = JSON.parse(text);
  if (payload?.workspace) return sanitizeWorkspace(payload.workspace);
  return sanitizeWorkspace(payload);
}

export function simulateCircuit(workspace) {
  const normalized = sanitizeWorkspace(workspace);
  const start = performance.now();
  const state = buildStatevector(normalized);
  const stateProbabilities = probabilitiesFromState(state);
  const { measuredQubits, distribution } = readoutDistribution(normalized, stateProbabilities);

  const metrics = {
    gateCount: normalized.operations.length,
    unitaryGateCount: normalized.operations.filter((operation) => operation.gateId !== 'MEASURE').length,
    measurementCount: normalized.operations.filter((operation) => operation.gateId === 'MEASURE').length,
    entanglingGateCount: normalized.operations.filter((operation) => isTwoQubitGate(operation.gateId)).length,
    longRangeGateCount: normalized.operations.filter(
      (operation) => isTwoQubitGate(operation.gateId) && Math.abs(getOperationQubits(operation)[0] - getOperationQubits(operation)[1]) > 1
    ).length,
    depth: sortUnique(normalized.operations.map((operation) => operation.column)).length,
    timelineLength: normalized.operations.length
      ? Math.max(...normalized.operations.map((operation) => operation.column)) + 1
      : 0,
    activeQubits: sortUnique(normalized.operations.flatMap((operation) => getOperationQubits(operation))).length,
    routingPressure: normalized.operations.reduce((sum, operation) => {
      if (!isTwoQubitGate(operation.gateId)) return sum;
      return sum + Math.max(0, Math.abs(getOperationQubits(operation)[0] - getOperationQubits(operation)[1]) - 1);
    }, 0),
  };

  const { probabilities: noisyDistribution, mixRate } = applyNoise(
    distribution,
    normalized.noiseModel,
    metrics
  );
  const counts = deterministicCounts(noisyDistribution, normalized.shots);
  const distributionEntries = chartEntries(noisyDistribution, counts);
  const idealEntries = chartEntries(distribution, deterministicCounts(distribution, normalized.shots));
  const stateEntries = stateProbabilities
    .map((probability, index) => ({
      basis: basisLabel(index, normalized.numQubits),
      probability,
      real: state.real[index],
      imag: state.imag[index],
      magnitude: Math.sqrt(probability),
      phase: Math.atan2(state.imag[index], state.real[index]),
    }))
    .sort((left, right) => right.probability - left.probability);

  const qubitVectors = Array.from(
    { length: normalized.numQubits },
    (_, qubit) => singleQubitObservables(state, normalized.numQubits, qubit)
  );

  const measurementEntropy = distributionEntries.reduce((sum, entry) => {
    if (entry.probability <= 1e-9) return sum;
    return sum - entry.probability * Math.log2(entry.probability);
  }, 0);

  const estimatedFidelity = Object.keys(noisyDistribution).reduce((sum, label) => {
    const ideal = distribution[label] || 0;
    const noisy = noisyDistribution[label] || 0;
    return sum + Math.sqrt(ideal * noisy);
  }, 0);

  const dominantState = distributionEntries[0] || {
    label: measuredQubits.map(() => '0').join(''),
    probability: 1,
  };

  const finished = performance.now();

  const fullMetrics = {
    ...metrics,
    measuredQubitCount: measuredQubits.length,
    measurementEntropy,
    estimatedFidelity,
    mixRate,
    topState: dominantState.label,
    topProbability: dominantState.probability,
    executionTimeMs: Number((finished - start).toFixed(2)),
  };

  return {
    counts,
    probabilities: noisyDistribution,
    measuredQubits,
    distributionEntries,
    idealEntries,
    stateEntries,
    qubitVectors,
    metrics: fullMetrics,
    diagnostics: diagnostics(normalized, fullMetrics, measuredQubits),
    qasm: exportOpenQasm(normalized),
  };
}
