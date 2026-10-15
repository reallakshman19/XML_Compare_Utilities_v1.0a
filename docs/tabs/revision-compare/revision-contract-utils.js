/** Small deterministic helpers shared by Revision Compare contracts. */

import { sha256Text } from './revision-hash.js';

export function cleanText(value) {
  return String(value ?? '').trim();
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}

export function stableStringify(value) {
  return JSON.stringify(canonicalValue(value));
}

export function assertJsonSafe(value, label = 'artifact') {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError(`${label} is not JSON-safe.`);
  const roundTrip = JSON.parse(json);
  if (stableStringify(value) !== stableStringify(roundTrip)) {
    throw new TypeError(`${label} changes during JSON serialization.`);
  }
  return true;
}

export async function deterministicId(prefix, value, cryptoRef) {
  const hash = await sha256Text(stableStringify(value), cryptoRef);
  return `${prefix}:${hash.slice(0, 24)}`;
}

export function frozenStrings(values) {
  return Object.freeze([...new Set((values ?? []).map(cleanText).filter(Boolean))].sort());
}
