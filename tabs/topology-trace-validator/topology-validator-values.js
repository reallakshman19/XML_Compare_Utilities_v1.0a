/**
 * Functionality: shared immutable value helpers for the topology validator.
 * Parameters are explicit JSON-compatible values. Outputs are frozen copies,
 * normalized primitives, or deterministic semantic hashes. Fallback: none for
 * missing engineering coordinates; invalid points remain null.
 */

export const TOPOLOGY_VIEW_MODEL_SCHEMA = 'TopologySvgViewModel.v1';
export const CANONICAL_TOPOLOGY_SCHEMA = 'CanonicalTopology.v1';
export const TRACE_LEDGER_SCHEMA = 'TopologyTraceLedger.v1';
export const GEOMETRY_TOLERANCE_MM = 0.5;

export const FINAL_DISPOSITIONS = Object.freeze([
  'EMIT_ROUTE_EDGE',
  'EMIT_INLINE_COMPONENT_EDGE',
  'EMIT_BEND_EDGE_SET',
  'EMIT_POINT_FEATURE',
  'EMIT_TEE_JUNCTION',
  'EMIT_OLET_JUNCTION',
  'EMIT_SUPPORT_ATTACHMENT',
  'SPLIT_HEADER_AT_JUNCTION',
  'MERGE_IN_CII_PROJECTION',
  'DEFER_SUPPORT',
  'EXTERNAL_BOUNDARY',
  'BLOCK_AMBIGUOUS',
]);

export const PROJECTION_CARDINALITIES = Object.freeze([
  'ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'POINT_ONLY',
  'JUNCTION_ONLY', 'DEFERRED', 'BLOCKED',
]);

export const COMPONENT_CATEGORIES = Object.freeze([
  'PIPE', 'VALVE', 'FLANGE', 'GASK', 'ELBO/BEND', 'TEE', 'OLET',
  'INST', 'REDUCER', 'SUPPORT',
]);

export const ROUTE_COMPONENT_TYPES = Object.freeze([
  'PIPE', 'ELBO', 'BEND', 'TEE', 'OLET', 'VALV', 'VALVE', 'FLAN',
  'FLANGE', 'GASK', 'GASKET', 'REDU', 'REDUCER', 'INST', 'INSTRUMENT',
]);

/** @param {unknown} value @returns {string} */
export function componentCategory(value) {
  const type = cleanText(value).toUpperCase();
  const aliases = {
    PIPE: 'PIPE', VALV: 'VALVE', VALVE: 'VALVE', FLAN: 'FLANGE', FLANGE: 'FLANGE',
    GASK: 'GASK', GASKET: 'GASK', ELBO: 'ELBO/BEND', BEND: 'ELBO/BEND', TEE: 'TEE',
    OLET: 'OLET', INST: 'INST', INSTRUMENT: 'INST', REDU: 'REDUCER', REDUCER: 'REDUCER',
    SUPPORT: 'SUPPORT', BRANCH: 'BRANCH',
  };
  return aliases[type] ?? type;
}

/** @param {unknown} value @returns {string} */
export function cleanText(value) {
  return String(value ?? '').trim();
}

/** @param {unknown} value @returns {unknown[]} */
export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {unknown} value @returns {number|null} */
export function finiteNumber(value) {
  if (value === null || value === undefined || cleanText(value) === '') return null;
  const number = Number(cleanText(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

/** @param {unknown} value @returns {{x:number,y:number,z:number}|null} */
export function strictPoint(value) {
  if (!value || typeof value !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (value);
  const x = finiteNumber(record.x ?? record.X);
  const y = finiteNumber(record.y ?? record.Y);
  const z = finiteNumber(record.z ?? record.Z);
  return x === null || y === null || z === null ? null : Object.freeze({ x, y, z });
}

/** @param {unknown[]} values @returns {string[]} */
export function uniqueText(values) {
  return Object.freeze([...new Set(values.map(cleanText).filter(Boolean))]);
}

/** @param {unknown} value @returns {unknown} */
export function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/** @template T @param {T} value @returns {Readonly<T>} */
export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach((child) => deepFreeze(child));
  return Object.freeze(value);
}

/** @param {unknown} value @returns {string} */
export function semanticStringify(value) {
  if (Array.isArray(value)) return `[${value.map(semanticStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${semanticStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** @param {unknown} value @returns {string} */
export function semanticHash(value) {
  const text = semanticStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** @param {unknown} value @returns {string} */
export function escapeMarkup(value) {
  return cleanText(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

/** @param {unknown} value @returns {Record<string, unknown>} */
export function objectRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}
