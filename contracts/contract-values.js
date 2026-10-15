/** Strict JSON-contract value helpers shared by platform schemas. */

/** @returns {string} trimmed required text. */
export function requiredContractText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

/** @returns {ReadonlyArray<number>} immutable finite XYZ vector. */
export function contractVector3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must contain three coordinates.`);
  const result = value.map(Number);
  if (!result.every(Number.isFinite)) throw new TypeError(`${label} coordinates must be finite.`);
  return Object.freeze(result);
}

function assertJsonNode(value, label, seen) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object') throw new TypeError(`${label} must contain JSON values only.`);
  if (seen.has(value)) throw new TypeError(`${label} must not contain circular references.`);
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must contain plain objects only.`);
  }
  Object.entries(value).forEach(([key, child]) => assertJsonNode(child, `${label}.${key}`, seen));
  seen.delete(value);
}

/** Validate, copy and deeply freeze one JSON-safe value. */
export function immutableJson(value, label) {
  assertJsonNode(value, label, new WeakSet());
  return deepFreezeContractValue(JSON.parse(JSON.stringify(value)));
}

/** Deep-freeze a contract-owned value. */
export function deepFreezeContractValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeContractValue);
  return Object.freeze(value);
}

/** Return true only for an ISO timestamp that round-trips exactly. */
export function isIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}
