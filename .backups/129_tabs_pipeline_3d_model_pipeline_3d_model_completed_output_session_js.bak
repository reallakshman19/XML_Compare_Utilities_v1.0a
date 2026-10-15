export const PIPELINE_COMPLETED_OUTPUT_EMPTY = 'EMPTY';
export const PIPELINE_COMPLETED_OUTPUT_BUILT = 'BUILT';
export const PIPELINE_COMPLETED_OUTPUT_REUSED = 'REUSED';
export const PIPELINE_COMPLETED_OUTPUT_FAILED = 'FAILED';
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function canonicalValue(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  if (!plain(value)) throw new TypeError('Pipeline output input identity must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalValue(value[key])]));
}
function inputIdentity(input = {}) {
  return { ...input,
    table2Text: input.profileRaw ? null : input.table2Text,
    table3Text: input.profileRaw ? null : input.table3Text };
}
function inputSignature(input) {
  return JSON.stringify(canonicalValue(inputIdentity(input)));
}
function freezeTree(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (!Array.isArray(value) && !plain(value)) {
    throw new TypeError('Completed Pipeline output must contain plain immutable data.');
  }
  if (seen.has(value)) return value;
  seen.add(value); Object.values(value).forEach((item) => freezeTree(item, seen));
  return Object.isFrozen(value) ? value : Object.freeze(value);
}
function resolutionSnapshot(disposition, counts, output) {
  return Object.freeze({ disposition, buildCount: counts.build,
    reuseCount: counts.reuse, failureCount: counts.failure, hasOutput: Boolean(output) });
}
export function createPipelineCompletedOutputSession(buildOutput) {
  if (typeof buildOutput !== 'function') throw new TypeError('Completed output session requires a builder.');
  let signature = null, output = null, disposition = PIPELINE_COMPLETED_OUTPUT_EMPTY;
  const counts = { build: 0, reuse: 0, failure: 0 };
  function resolve(input) {
    const nextSignature = inputSignature(input);
    if (output && signature === nextSignature) {
      counts.reuse += 1; disposition = PIPELINE_COMPLETED_OUTPUT_REUSED; return output;
    }
    try {
      const built = buildOutput(input);
      if (!built || typeof built !== 'object') throw new TypeError('Pipeline output builder must return an object.');
      const immutable = freezeTree(built);
      signature = nextSignature; output = immutable; counts.build += 1;
      disposition = PIPELINE_COMPLETED_OUTPUT_BUILT; return output;
    } catch (error) {
      counts.failure += 1; disposition = PIPELINE_COMPLETED_OUTPUT_FAILED; throw error;
    }
  }
  function reset() { signature = null; output = null; disposition = PIPELINE_COMPLETED_OUTPUT_EMPTY; }
  function snapshot() { return resolutionSnapshot(disposition, counts, output); }
  return Object.freeze({ resolve, reset, snapshot });
}
export const _test = Object.freeze({ canonicalValue, inputIdentity, inputSignature, freezeTree,
  resolutionSnapshot });
