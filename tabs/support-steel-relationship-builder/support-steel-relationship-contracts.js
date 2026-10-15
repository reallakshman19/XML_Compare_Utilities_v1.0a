export const SUPPORT_STEEL_RELATIONSHIP_SCHEMA = 'SupportSteelRelationshipBundle.v1';
export const SUPPORT_STEEL_EVIDENCE_SOURCE = 'STAGED_JSON_RELATIONSHIP_ENGINE';
export const SUPPORT_STEEL_RELATIONSHIP_SEMANTIC = 'INFERRED_STRUCTURAL_RELATIONSHIP';

export const SUPPORT_STEEL_RELATIONSHIP_STATUSES = Object.freeze([
  'RESOLVED_EXPLICIT',
  'RESOLVED_SPATIAL',
  'RESOLVED_SHARED_OWNER',
  'AMBIGUOUS',
  'UNRESOLVED',
]);

export const SUPPORT_STEEL_RELATIONSHIP_BASES = Object.freeze([
  'SAME_CANONICAL_ID',
  'EXPLICIT_REFERENCE',
  'SHARED_OWNER',
  'ANALYTICAL_GEOMETRY_PROXIMITY',
  'REPRESENTATIVE_POINT_PROXIMITY',
]);

export const SUPPORT_STEEL_RELATIONSHIP_CARDINALITIES = Object.freeze([
  'ONE_TO_ONE',
  'ONE_TO_MANY_AMBIGUOUS',
  'UNRESOLVED',
]);

const DEFAULT_SUPPORT_TYPES = Object.freeze(['ATTA', 'ANCI', 'SUPPORT']);
const DEFAULT_STEEL_TYPES = Object.freeze([
  'STEEL',
  'STEEL_GROUP',
  'STRUCTURE',
  'STRUCTURAL_GROUP',
  'FRMW',
  'SCTN',
  'GROUP',
]);

export const SUPPORT_STEEL_DEFAULT_CONFIG = Object.freeze({
  supportFamilyPattern: '^/(PS-[A-Z0-9_-]+)',
  steelGroupPattern: '^/((?:SL|PS)-[A-Z0-9_.-]+)',
  supportTypes: DEFAULT_SUPPORT_TYPES,
  steelTypes: DEFAULT_STEEL_TYPES,
  projectionToleranceMm: 25,
  ambiguityDeltaMm: 2,
  requireAnalyticalGeometryForSpatialResolution: true,
  memberContactToleranceMm: 2,
  memberCandidateToleranceMm: 25,
  emitNearbyMemberCandidates: true,
  supportPositionKeys: Object.freeze([
    'POS',
    'SUPPORT_POS',
    'SUPPORTPOS',
    'SUPPORT_POSITION',
    'SUPPORTPOSITION',
    'APOS',
    'LPOS',
  ]),
  steelPositionKeys: Object.freeze([
    'WORLD_POS',
    'WORLD_POSITION',
    'POS',
    'CENTRE',
    'CENTER',
    'ORIGIN',
    'APOS',
    'LPOS',
  ]),
  explicitSteelReferenceKeys: Object.freeze([
    'STEEL_REF',
    'STEELREF',
    'STRUCTURE_REF',
    'STRUCTUREREF',
    'SREF',
    'MDSSREF',
    'MDSGUIDEREF',
  ]),
  ownerEvidenceKeys: Object.freeze([
    'OWNER',
  ]),
});

export function resolveSupportSteelConfig(overrides = {}) {
  const supportTypes = normalizeTokenList(overrides.supportTypes, SUPPORT_STEEL_DEFAULT_CONFIG.supportTypes);
  const steelTypes = normalizeTokenList(overrides.steelTypes, SUPPORT_STEEL_DEFAULT_CONFIG.steelTypes);
  const explicitSteelReferenceKeys = normalizeKeyList(
    overrides.explicitSteelReferenceKeys,
    SUPPORT_STEEL_DEFAULT_CONFIG.explicitSteelReferenceKeys,
  );
  const ownerEvidenceKeys = normalizeKeyList(
    overrides.ownerEvidenceKeys,
    SUPPORT_STEEL_DEFAULT_CONFIG.ownerEvidenceKeys,
  );
  return {
    ...SUPPORT_STEEL_DEFAULT_CONFIG,
    ...overrides,
    supportTypes,
    steelTypes,
    explicitSteelReferenceKeys,
    ownerEvidenceKeys,
    requireAnalyticalGeometryForSpatialResolution: booleanValue(
      overrides.requireAnalyticalGeometryForSpatialResolution,
      SUPPORT_STEEL_DEFAULT_CONFIG.requireAnalyticalGeometryForSpatialResolution,
    ),
    emitNearbyMemberCandidates: booleanValue(
      overrides.emitNearbyMemberCandidates,
      SUPPORT_STEEL_DEFAULT_CONFIG.emitNearbyMemberCandidates,
    ),
    projectionToleranceMm: positiveNumber(
      overrides.projectionToleranceMm,
      SUPPORT_STEEL_DEFAULT_CONFIG.projectionToleranceMm,
    ),
    ambiguityDeltaMm: nonNegativeNumber(
      overrides.ambiguityDeltaMm,
      SUPPORT_STEEL_DEFAULT_CONFIG.ambiguityDeltaMm,
    ),
    memberContactToleranceMm: nonNegativeNumber(
      overrides.memberContactToleranceMm,
      SUPPORT_STEEL_DEFAULT_CONFIG.memberContactToleranceMm,
    ),
    memberCandidateToleranceMm: positiveNumber(
      overrides.memberCandidateToleranceMm,
      SUPPORT_STEEL_DEFAULT_CONFIG.memberCandidateToleranceMm,
    ),
  };
}

export function compileIdentityPattern(value, fallback) {
  try {
    return new RegExp(String(value || fallback), 'i');
  } catch {
    return new RegExp(fallback, 'i');
  }
}

function normalizeTokenList(value, fallback) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/u);
  const tokens = source.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean);
  return Object.freeze(tokens.length ? [...new Set(tokens)] : [...fallback]);
}

function normalizeKeyList(value, fallback) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/u);
  const keys = source.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean);
  return Object.freeze(keys.length ? [...new Set(keys)] : [...fallback]);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function booleanValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
}
