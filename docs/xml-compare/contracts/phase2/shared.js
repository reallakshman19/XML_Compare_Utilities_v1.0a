export const XML_COMPARE_PHASE2_ORCHESTRATOR_SCHEMA = 'xml-compare-phase2-orchestrator/v1';
export const MATCH_CANDIDATE_SET_SCHEMA = 'match-candidate-set/v1';
export const MATCH_DECISION_SCHEMA = 'match-decision/v1';
export const APPROVED_MATCH_SET_SCHEMA = 'approved-match-set/v1';
export const TRANSFORM_POLICY_SCHEMA = 'transform-policy/v1';
export const VALIDATION_MODEL_V2_SCHEMA = 'validation-model/v2';
export const VALIDATION_AUDIT_V2_SCHEMA = 'validation-audit/v2';
export const APPROVED_TRANSFER_CASE_SCHEMA = 'approved-transfer-case/v1';
export const TRANSFER_PLAN_SCHEMA = 'transfer-plan/v1';
export const TRANSFER_PATCH_AUDIT_SCHEMA = 'transfer-patch-audit/v1';
export const POST_TRANSFER_VALIDATION_SCHEMA = 'post-transfer-validation/v1';

export const DEFAULT_TRANSFORM_POLICY = Object.freeze({
  schema: TRANSFORM_POLICY_SCHEMA,
  allowedTransforms: Object.freeze([
    'identity-offset',
    'known-axis-map',
    'known-yup-zup-conversion',
    'manual-approved',
  ]),
  blockFreeAxisPermutation: true,
  diagnosticFreeSearchAllowed: true,
  approved: false,
  approvalBasis: '',
});

export const DEFAULT_NUMERIC_TOLERANCE_POLICY = Object.freeze({
  pressure: Object.freeze({ abs: 0.01, unit: 'MPa' }),
  temperature: Object.freeze({ abs: 0.5, unit: 'C' }),
  coordinate: Object.freeze({ abs: 1, unit: 'mm' }),
  wallThickness: Object.freeze({ abs: 0.01, unit: 'mm' }),
  length: Object.freeze({ abs: 1, unit: 'mm' }),
  default: Object.freeze({ abs: 0, unit: '' }),
});

export const TOLERANCE_BUCKETS = Object.freeze({
  exact: 0.01,
  approx1: 25,
  approx2: 125,
  approx3: 1000,
});

export const APPROVED_STATUSES = new Set(['approved']);
export const BLOCKING_ROW_STATUSES = new Set([
  'DUPLICATE_TARGET_CLAIM',
  'COORDINATE_FRAME_NOT_COMPARABLE',
  'ANCHOR_MISSING',
  'TRANSFORM_NOT_APPROVED',
  'IDENTITY_LOW_CONFIDENCE',
  'MISMATCH',
]);

export function clean(value) {
  return String(value ?? '').trim();
}

export function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function cloneArray(items = []) {
  return Object.freeze([...(Array.isArray(items) ? items : [])]);
}

export function diagnostic(severity = 'INFO', code = '', message = '', ref = {}) {
  return Object.freeze({
    severity: clean(severity),
    code: clean(code),
    message: clean(message),
    ref: Object.freeze({ ...(ref || {}) }),
  });
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return stableObjectJson(value);
  return JSON.stringify(value ?? null);
}

function stableObjectJson(value) {
  const pairs = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
  return `{${pairs.join(',')}}`;
}

export function stableHash(value) {
  const text = stableJson(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function pairKey(sourceUid = '', targetUid = '') {
  return `${clean(sourceUid)}=>${clean(targetUid)}`;
}
