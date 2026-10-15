import { stableToken } from '../sequential-sketcher-contract.js';

export const EXTERNAL_BOUNDARY_POLICY_CLASSIFICATIONS = Object.freeze({
  EXTERNAL_REFERENCE_CLASSIFIED: 'EXTERNAL_REFERENCE_CLASSIFIED',
  EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED: 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED',
  UNCLASSIFIED: 'UNCLASSIFIED',
});

const RAW_POLICY = {
  schema: 'SequentialExternalBoundaryPolicy.v1',
  policyId: 'AVEVA_1885_NC_EXTERNAL_BOUNDARY',
  revision: 1,
  sourceDialect: 'AVEVA_1885_NC',
  classificationSchema: 'SequentialBoundaryReferenceClassification.v2',
  patterns: [
    {
      patternId: 'CONTROLLED_DASH_NOZZLE_REFERENCE',
      priority: 300,
      regexSource: '^\\/A-\\d{6}-(?:TP-\\d+|T-\\d+|NOZZLE-[A-Z0-9_.-]+|INLET|OUTLET)$',
      regexFlags: 'u',
      status: 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED',
      dialect: 'AVEVA_CONTROLLED_NOZZLE_REFERENCE',
      basis: ['ANCHORED_EQUIPMENT_REFERENCE', 'CONTROLLED_NOZZLE_SUFFIX'],
      confidence: 'SOURCE_EXPLICIT',
    },
    {
      patternId: 'CONTROLLED_NAMED_CONNECTION_REFERENCE',
      priority: 290,
      regexSource: '^\\/A-\\d{6}\\/(?:PURGE_CONNECTION|DRAIN_CONNECTION|VENT_CONNECTION|INLET|OUTLET|NOZZLE-[A-Z0-9_.-]+)$',
      regexFlags: 'u',
      status: 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED',
      dialect: 'AVEVA_CONTROLLED_CONNECTION_REFERENCE',
      basis: ['ANCHORED_EQUIPMENT_REFERENCE', 'CONTROLLED_CONNECTION_SUFFIX'],
      confidence: 'SOURCE_EXPLICIT',
    },
    {
      patternId: 'DIRECTIONAL_EQUIPMENT_PORT',
      priority: 280,
      regexSource: '^\\/S-\\d+[A-Z]?\\/B\\/(?:INLET|OUTLET)$',
      regexFlags: 'u',
      status: 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED',
      dialect: 'AVEVA_DIRECTIONAL_EQUIPMENT_PORT',
      basis: ['ANCHORED_EQUIPMENT_PORT_REFERENCE', 'EXPLICIT_INLET_OUTLET_ROLE'],
      confidence: 'SOURCE_EXPLICIT',
    },
    {
      patternId: 'EQUIPMENT_REFERENCE_SHAPE',
      priority: 100,
      regexSource: '^\\/A-\\d{6}(?:[-\\/][A-Z0-9_.-]+)+$',
      regexFlags: 'u',
      status: 'EXTERNAL_REFERENCE_CLASSIFIED',
      dialect: 'AVEVA_EQUIPMENT_REFERENCE_SHAPE',
      basis: ['ANCHORED_EQUIPMENT_REFERENCE', 'PHYSICAL_BOUNDARY_ROLE_NOT_PROVEN'],
      confidence: 'IDENTITY_ONLY',
    },
  ],
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const policyFingerprint = stableToken(JSON.stringify(RAW_POLICY));

export const SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY = deepFreeze({
  ...RAW_POLICY,
  policyFingerprint,
});

const COMPILED_PATTERNS = Object.freeze(
  SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.patterns
    .map((pattern) => Object.freeze({
      descriptor: pattern,
      matcher: new RegExp(pattern.regexSource, pattern.regexFlags),
    }))
    .sort((left, right) => right.descriptor.priority - left.descriptor.priority),
);

export function validateSequentialExternalBoundaryPolicy(policy = SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY) {
  const errors = [];
  if (policy?.schema !== 'SequentialExternalBoundaryPolicy.v1') errors.push('POLICY_SCHEMA_INVALID');
  if (!String(policy?.policyId || '').trim()) errors.push('POLICY_ID_MISSING');
  if (!Number.isInteger(policy?.revision) || policy.revision < 1) errors.push('POLICY_REVISION_INVALID');
  if (!Array.isArray(policy?.patterns) || policy.patterns.length === 0) errors.push('POLICY_PATTERNS_MISSING');

  const patternIds = new Set();
  for (const pattern of policy?.patterns || []) {
    if (!String(pattern?.patternId || '').trim()) errors.push('PATTERN_ID_MISSING');
    else if (patternIds.has(pattern.patternId)) errors.push(`PATTERN_ID_DUPLICATE:${pattern.patternId}`);
    else patternIds.add(pattern.patternId);
    if (!Number.isFinite(pattern?.priority)) errors.push(`PATTERN_PRIORITY_INVALID:${pattern?.patternId || 'UNKNOWN'}`);
    if (!Object.values(EXTERNAL_BOUNDARY_POLICY_CLASSIFICATIONS).includes(pattern?.status)) {
      errors.push(`PATTERN_STATUS_INVALID:${pattern?.patternId || 'UNKNOWN'}`);
    }
    try {
      new RegExp(pattern?.regexSource, pattern?.regexFlags);
    } catch {
      errors.push(`PATTERN_REGEX_INVALID:${pattern?.patternId || 'UNKNOWN'}`);
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function matchSequentialExternalBoundaryPolicy(normalizedReference) {
  const reference = String(normalizedReference || '');
  for (const entry of COMPILED_PATTERNS) {
    if (entry.matcher.test(reference)) return entry.descriptor;
  }
  return null;
}
