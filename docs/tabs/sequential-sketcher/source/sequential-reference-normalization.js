function text(value) { return String(value ?? '').trim(); }

export function normalizeSequentialReference(referenceValue) {
  const rawReference = text(referenceValue);
  if (!rawReference) {
    return Object.freeze({
      rawReference,
      normalizedReference: '',
      changed: false,
      operations: Object.freeze([]),
    });
  }
  const operations = [];
  let normalizedReference = rawReference;
  if (normalizedReference.includes('\\')) {
    normalizedReference = normalizedReference.replaceAll('\\', '/');
    operations.push('BACKSLASH_TO_SLASH');
  }
  const collapsed = normalizedReference.replace(/\/{2,}/gu, '/');
  if (collapsed !== normalizedReference) operations.push('COLLAPSE_REPEATED_SLASH');
  normalizedReference = collapsed;
  if (!normalizedReference.startsWith('/') && !normalizedReference.startsWith('=')) {
    normalizedReference = `/${normalizedReference}`;
    operations.push('ADD_ROOT_SLASH');
  }
  const upper = normalizedReference.toUpperCase();
  if (upper !== normalizedReference) operations.push('CASE_FOLD_UPPER');
  normalizedReference = upper;
  return Object.freeze({
    rawReference,
    normalizedReference,
    changed: normalizedReference !== rawReference,
    operations: Object.freeze(operations),
  });
}
