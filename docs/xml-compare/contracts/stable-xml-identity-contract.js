export const STABLE_XML_IDENTITY_SCHEMA = 'stable-xml-identity/v1';

const BASES = new Set([
  'guid',
  'line-node-pair',
  'line-element-node-role',
  'source-ref',
  'geometry-hash',
  'synthetic-index',
  'unknown',
]);

function clean(value) {
  return String(value ?? '').trim();
}

function confidence(value, basis) {
  const number = Number(value);
  if (Number.isFinite(number)) return Math.max(0, Math.min(1, number));
  if (basis === 'guid') return 1;
  if (basis === 'line-node-pair') return 0.9;
  if (basis === 'line-element-node-role') return 0.85;
  if (basis === 'source-ref') return 0.7;
  if (basis === 'geometry-hash') return 0.55;
  if (basis === 'synthetic-index') return 0.2;
  return 0;
}

function warningsOf(items = []) {
  return Object.freeze((Array.isArray(items) ? items : [items]).map(clean).filter(Boolean));
}

export function createStableXmlIdentity(input = {}) {
  const basis = BASES.has(clean(input.identityBasis)) ? clean(input.identityBasis) : 'unknown';
  return Object.freeze({
    schema: STABLE_XML_IDENTITY_SCHEMA,
    sourceId: clean(input.sourceId),
    recordUid: clean(input.recordUid),
    stableKey: clean(input.stableKey),
    identityBasis: basis,
    identityConfidence: confidence(input.identityConfidence, basis),
    warnings: warningsOf(input.warnings),
  });
}

export function createStableIdentitySummary(identities = []) {
  const normalized = (Array.isArray(identities) ? identities : []).map(createStableXmlIdentity);
  const stable = normalized.filter((item) => !['synthetic-index', 'unknown'].includes(item.identityBasis));
  return Object.freeze({
    recordCount: normalized.length,
    stableCount: stable.filter((item) => item.stableKey && item.identityConfidence >= 0.5).length,
    lowConfidenceCount: normalized.filter((item) => item.identityConfidence < 0.5).length,
    syntheticFallbackCount: normalized.filter((item) => item.identityBasis === 'synthetic-index').length,
    unknownCount: normalized.filter((item) => item.identityBasis === 'unknown').length,
  });
}

export function identityReadyForConnector(summary = {}) {
  const recordCount = Number(summary.recordCount) || 0;
  const stableCount = Number(summary.stableCount) || 0;
  const syntheticCount = Number(summary.syntheticFallbackCount) || 0;
  const unknownCount = Number(summary.unknownCount) || 0;
  if (recordCount <= 0) return false;
  if (stableCount <= 0) return false;
  return syntheticCount + unknownCount < recordCount;
}
