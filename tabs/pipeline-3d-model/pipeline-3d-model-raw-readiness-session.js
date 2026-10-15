const REQUIRED_TABLES = Object.freeze(['table2a', 'table3a']);
const CANONICAL_RAW_PROFILES = new WeakSet();
function stateFrom(raw, tableReadiness) {
  const suppliedTables = Object.entries(tableReadiness).filter(([, state]) => state.hasContent)
    .map(([name]) => name);
  return Object.freeze({ raw, tableReadiness: Object.freeze(tableReadiness),
    suppliedTables: Object.freeze(suppliedTables), active: suppliedTables.length > 0,
    ready: REQUIRED_TABLES.every((name) => tableReadiness[name]?.hasDataRow === true) });
}
function canonicalRawProfile(raw) {
  const entries = Object.entries(raw);
  if (entries.some(([, value]) => typeof value !== 'string')) {
    throw new TypeError('Raw profile identity values must be text.');
  }
  const canonical = Object.freeze(Object.fromEntries(entries));
  CANONICAL_RAW_PROFILES.add(canonical); return canonical;
}
function sameRecords(previous, next) {
  return previous?.length === next.length
    && next.every((record, index) => previous[index] === record);
}
export function isPipelineCanonicalRawProfile(value) {
  return Boolean(value && CANONICAL_RAW_PROFILES.has(value));
}
export function buildPipelineRawReadinessState(raw = {}, scan) {
  if (typeof scan !== 'function') throw new TypeError('Raw readiness state requires a scanner.');
  const tableReadiness = Object.fromEntries(Object.entries(raw)
    .map(([name, value]) => [name, scan(value)]));
  return stateFrom(raw, tableReadiness);
}
export function createPipelineRawReadinessSession(scan) {
  if (typeof scan !== 'function') throw new TypeError('Raw readiness session requires a scanner.');
  const cache = new Map(); let records = null, canonicalRaw = null;
  function record(name, value) {
    const current = cache.get(name); if (current?.value === value) return current;
    const next = Object.freeze({ value, state: scan(value) }); cache.set(name, next); return next;
  }
  function resolve(raw = {}) {
    for (const name of cache.keys()) if (!Object.hasOwn(raw, name)) cache.delete(name);
    const entries = Object.entries(raw), nextRecords = entries.map(([name, value]) => record(name, value));
    if (!sameRecords(records, nextRecords)) {
      records = Object.freeze(nextRecords); canonicalRaw = canonicalRawProfile(raw);
    }
    const tableReadiness = Object.fromEntries(entries
      .map(([name], index) => [name, nextRecords[index].state]));
    return stateFrom(canonicalRaw, tableReadiness);
  }
  function reset() { cache.clear(); records = null; canonicalRaw = null; }
  return Object.freeze({ resolve, reset });
}
export const _test = Object.freeze({ stateFrom, canonicalRawProfile, sameRecords });
