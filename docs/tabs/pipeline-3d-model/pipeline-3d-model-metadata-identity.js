function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
export function canonicalPipelineMetadataValue(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return Object.freeze(value.map(canonicalPipelineMetadataValue));
  if (!value || typeof value !== 'object') return value;
  if (!plain(value)) throw new TypeError('Pipeline output input identity must be JSON-safe plain data.');
  return Object.freeze(Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalPipelineMetadataValue(value[key])])));
}
export function samePipelineMetadataValue(previous, next) {
  if (next === undefined) return previous === null;
  if (Array.isArray(next)) {
    return Array.isArray(previous) && previous.length === next.length
      && next.every((item, index) => samePipelineMetadataValue(previous[index], item));
  }
  if (!next || typeof next !== 'object') return Object.is(previous, next);
  if (!plain(next)) throw new TypeError('Pipeline output input identity must be JSON-safe plain data.');
  if (!plain(previous)) return false;
  const keys = Object.keys(next);
  return Object.keys(previous).length === keys.length && keys.every((key) =>
    Object.hasOwn(previous, key) && samePipelineMetadataValue(previous[key], next[key]));
}
export function resolvePipelineMetadataIdentity(value, previous = null) {
  if (previous !== null && samePipelineMetadataValue(previous, value)) return previous;
  return canonicalPipelineMetadataValue(value);
}
export const _test = Object.freeze({ plain });
