const REQUIRED_TABLES = Object.freeze(['table2a', 'table3a']);
function stateFrom(raw, tableReadiness) {
  const suppliedTables = Object.entries(tableReadiness).filter(([, state]) => state.hasContent)
    .map(([name]) => name);
  return Object.freeze({ raw, tableReadiness: Object.freeze(tableReadiness),
    suppliedTables: Object.freeze(suppliedTables), active: suppliedTables.length > 0,
    ready: REQUIRED_TABLES.every((name) => tableReadiness[name]?.hasDataRow === true) });
}
export function buildPipelineRawReadinessState(raw = {}, scan) {
  if (typeof scan !== 'function') throw new TypeError('Raw readiness state requires a scanner.');
  const tableReadiness = Object.fromEntries(Object.entries(raw)
    .map(([name, value]) => [name, scan(value)]));
  return stateFrom(raw, tableReadiness);
}
export function createPipelineRawReadinessSession(scan) {
  if (typeof scan !== 'function') throw new TypeError('Raw readiness session requires a scanner.');
  const cache = new Map();
  function readiness(name, value) {
    const current = cache.get(name);
    if (current?.value === value) return current.state;
    const state = scan(value);
    cache.set(name, Object.freeze({ value, state }));
    return state;
  }
  function resolve(raw = {}) {
    for (const name of cache.keys()) if (!Object.hasOwn(raw, name)) cache.delete(name);
    const tableReadiness = Object.fromEntries(Object.entries(raw)
      .map(([name, value]) => [name, readiness(name, value)]));
    return stateFrom(raw, tableReadiness);
  }
  function reset() { cache.clear(); }
  return Object.freeze({ resolve, reset });
}
export const _test = Object.freeze({ stateFrom });
