export const SUPPORT_STEEL_WORLD_MATRIX_SCHEMA = 'SupportSteelWorldMatrix.v1';

export const IDENTITY_MATRIX_4X4 = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const WORLD_MATRIX_KEYS = Object.freeze([
  'WORLD_MATRIX',
  'WORLD_TRANSFORM',
  'MATRIX_WORLD',
]);

const LOCAL_MATRIX_KEYS = Object.freeze([
  'LOCAL_MATRIX',
  'LOCAL_TRANSFORM',
  'MATRIX',
  'TRANSFORM',
  'TMAT',
]);

const TRANSLATION_KEYS = Object.freeze([
  'TRANSLATION',
  'LOCAL_TRANSLATION',
  'OFFSET',
]);

export function multiplyMatrices(left, right) {
  const a = normalizeMatrix(left);
  const b = normalizeMatrix(right);
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let index = 0; index < 4; index += 1) {
        out[row * 4 + column] += a[row * 4 + index] * b[index * 4 + column];
      }
    }
  }
  return out;
}

export function transformPoint(matrix, point) {
  if (!point) return null;
  const m = normalizeMatrix(matrix);
  const x = Number(point.x);
  const y = Number(point.y);
  const z = Number(point.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  const w = m[12] * x + m[13] * y + m[14] * z + m[15];
  const divisor = Number.isFinite(w) && Math.abs(w) > 1e-12 ? w : 1;
  return {
    x: (m[0] * x + m[1] * y + m[2] * z + m[3]) / divisor,
    y: (m[4] * x + m[5] * y + m[6] * z + m[7]) / divisor,
    z: (m[8] * x + m[9] * y + m[10] * z + m[11]) / divisor,
  };
}

export function transformDirection(matrix, direction) {
  if (!direction) return null;
  const m = normalizeMatrix(matrix);
  const vector = {
    x: m[0] * direction.x + m[1] * direction.y + m[2] * direction.z,
    y: m[4] * direction.x + m[5] * direction.y + m[6] * direction.z,
    z: m[8] * direction.x + m[9] * direction.y + m[10] * direction.z,
  };
  return normalizeVector(vector);
}

export function resolveNodeTransform(node = {}, attrs = {}) {
  for (const key of WORLD_MATRIX_KEYS) {
    const matrix = parseMatrix(attrs[key] ?? node[key]);
    if (matrix) return { matrix, scope: 'WORLD', basis: key };
  }
  for (const key of LOCAL_MATRIX_KEYS) {
    const matrix = parseMatrix(attrs[key] ?? node[key]);
    if (matrix) return { matrix, scope: 'LOCAL', basis: key };
  }
  for (const key of TRANSLATION_KEYS) {
    const translation = parseTranslation(attrs[key] ?? node[key]);
    if (translation) return { matrix: translationMatrix(translation), scope: 'LOCAL', basis: key };
  }
  return { matrix: [...IDENTITY_MATRIX_4X4], scope: 'LOCAL', basis: 'IDENTITY' };
}

export function composeWorldMatrix(parentWorldMatrix, transform) {
  if (transform?.scope === 'WORLD') return normalizeMatrix(transform.matrix);
  return multiplyMatrices(parentWorldMatrix || IDENTITY_MATRIX_4X4, transform?.matrix || IDENTITY_MATRIX_4X4);
}

export function parseMatrix(value) {
  if (!value) return null;
  if (Array.isArray(value)) return parseMatrixArray(value, 'ROW_MAJOR');
  if (typeof value === 'string') return parseMatrixArray(extractNumbers(value), 'ROW_MAJOR');
  if (typeof value !== 'object') return null;

  if (Array.isArray(value.elements)) {
    const order = String(value.order || value.layout || 'COLUMN_MAJOR').toUpperCase();
    return parseMatrixArray(value.elements, order);
  }
  if (Array.isArray(value.matrix)) {
    const order = String(value.order || value.layout || 'ROW_MAJOR').toUpperCase();
    return parseMatrixArray(value.matrix, order);
  }

  const named = parseNamedMatrix(value);
  if (named) return named;

  const translation = parseTranslation(value.translation || value.position || value.offset);
  if (translation) return translationMatrix(translation);
  return null;
}

export function translationMatrix(point) {
  const parsed = parseTranslation(point) || { x: 0, y: 0, z: 0 };
  return [
    1, 0, 0, parsed.x,
    0, 1, 0, parsed.y,
    0, 0, 1, parsed.z,
    0, 0, 0, 1,
  ];
}

export function transformLocalBounds(matrix, bounds) {
  if (!bounds?.min || !bounds?.max) return null;
  const corners = boundsCorners(bounds).map((point) => transformPoint(matrix, point)).filter(Boolean);
  if (!corners.length) return null;
  const aabb = pointsToAabb(corners);
  const centerLocal = midpoint(bounds.min, bounds.max);
  const halfLocal = {
    x: Math.abs(bounds.max.x - bounds.min.x) / 2,
    y: Math.abs(bounds.max.y - bounds.min.y) / 2,
    z: Math.abs(bounds.max.z - bounds.min.z) / 2,
  };
  const axes = [
    transformedAxis(matrix, { x: 1, y: 0, z: 0 }, halfLocal.x),
    transformedAxis(matrix, { x: 0, y: 1, z: 0 }, halfLocal.y),
    transformedAxis(matrix, { x: 0, y: 0, z: 1 }, halfLocal.z),
  ];
  return {
    worldAabb: aabb,
    worldObb: {
      center: transformPoint(matrix, centerLocal),
      axes: axes.map((entry) => entry.axis),
      halfExtents: axes.map((entry) => entry.extent),
    },
  };
}

export function isIdentityMatrix(matrix, tolerance = 1e-12) {
  const normalized = normalizeMatrix(matrix);
  return normalized.every((value, index) => Math.abs(value - IDENTITY_MATRIX_4X4[index]) <= tolerance);
}

export function normalizeMatrix(value) {
  return parseMatrix(value) || [...IDENTITY_MATRIX_4X4];
}

function parseMatrixArray(values, order) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length === 12) numbers.push(0, 0, 0, 1);
  if (numbers.length !== 16) return null;
  return /COLUMN/u.test(order) ? transpose4(numbers) : numbers;
}

function parseNamedMatrix(value) {
  const keys = [
    'm11', 'm12', 'm13', 'm14',
    'm21', 'm22', 'm23', 'm24',
    'm31', 'm32', 'm33', 'm34',
    'm41', 'm42', 'm43', 'm44',
  ];
  if (!keys.every((key) => value[key] !== undefined)) return null;
  const numbers = keys.map((key) => Number(value[key]));
  return numbers.every(Number.isFinite) ? numbers : null;
}

function parseTranslation(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) {
    const [x, y, z] = value.map(Number);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
  }
  if (typeof value === 'string') {
    const numbers = extractNumbers(value);
    return numbers.length >= 3 ? { x: numbers[0], y: numbers[1], z: numbers[2] } : null;
  }
  if (typeof value !== 'object') return null;
  const x = Number(value.x ?? value.X ?? value.east ?? value.E ?? 0);
  const north = value.y ?? value.Y ?? value.north ?? value.N;
  const south = value.south ?? value.S;
  const y = Number(north ?? (south === undefined ? 0 : -Number(south)));
  const z = Number(value.z ?? value.Z ?? value.up ?? value.U ?? 0);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function transpose4(matrix) {
  const out = new Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) out[row * 4 + column] = matrix[column * 4 + row];
  }
  return out;
}

function extractNumbers(value) {
  return String(value).match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/gu)?.map(Number).filter(Number.isFinite) || [];
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length <= 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function transformedAxis(matrix, axis, halfExtent) {
  const m = normalizeMatrix(matrix);
  const vector = {
    x: m[0] * axis.x + m[1] * axis.y + m[2] * axis.z,
    y: m[4] * axis.x + m[5] * axis.y + m[6] * axis.z,
    z: m[8] * axis.x + m[9] * axis.y + m[10] * axis.z,
  };
  const scale = Math.hypot(vector.x, vector.y, vector.z);
  return { axis: normalizeVector(vector), extent: Math.abs(halfExtent * scale) };
}

function boundsCorners(bounds) {
  const { min, max } = bounds;
  return [
    { x: min.x, y: min.y, z: min.z }, { x: max.x, y: min.y, z: min.z },
    { x: min.x, y: max.y, z: min.z }, { x: max.x, y: max.y, z: min.z },
    { x: min.x, y: min.y, z: max.z }, { x: max.x, y: min.y, z: max.z },
    { x: min.x, y: max.y, z: max.z }, { x: max.x, y: max.y, z: max.z },
  ];
}

function pointsToAabb(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
    max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) },
  };
}

function midpoint(left, right) {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
  };
}
