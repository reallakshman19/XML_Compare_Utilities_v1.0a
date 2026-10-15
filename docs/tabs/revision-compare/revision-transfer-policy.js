/** Explicit fail-closed writable-field policy for Revision Compare transfer planning. */
import { cleanText, deepFreeze } from './revision-contract-utils.js';

export const REVISION_COMPARE_TRANSFER_POLICY_SCHEMA = 'RevisionCompareTransferFieldPolicy.v1';
export const REVISION_COMPARE_TRANSFER_POLICY_VERSION = 'revision-transfer-field-policy.v1';
export const REVISION_COMPARE_TRANSFER_DIRECTION = 'REV_A_TO_REV_B';

const ALLOWED = deepFreeze({
  description: ['description', 'attributes.DESCRIPTION'],
  material: ['material', 'attributes.MATERIAL'],
  specification: ['specification', 'spec', 'attributes.SPECIFICATION', 'attributes.SPEC'],
  rating: ['rating', 'attributes.RATING'],
  nominalSize: ['nominalSize', 'nominalDiameter', 'outsideDiameter', 'diameter', 'size',
    'attributes.NOMINALSIZE', 'attributes.NOMINALDIAMETER', 'attributes.OD', 'attributes.DIAMETER', 'attributes.SIZE'],
  wallThickness: ['wallThickness', 'thickness', 'attributes.WALLTHICKNESS', 'attributes.THICKNESS'],
  length: ['length', 'attributes.LENGTH'],
  weight: ['weight', 'attributes.WEIGHT'],
});
const CONTROLLED_KEYS = Object.freeze(['supportType', 'position', 'start', 'end', 'points', 'coordinates', 'APOS', 'LPOS', 'POS']);
const PROTECTED_TOKENS = Object.freeze([
  'schema', 'id', 'objectid', 'refno', 'componentrefno', 'guid', 'name', 'tag', 'node', 'branch',
  'parent', 'children', 'components', 'owner', 'connect', 'topology', 'provenance', 'audit', 'review',
  'decision', 'package', 'signoff', 'signature', 'receipt',
]);

export const REVISION_COMPARE_TRANSFER_POLICY = deepFreeze({
  schema: REVISION_COMPARE_TRANSFER_POLICY_SCHEMA, policyVersion: REVISION_COMPARE_TRANSFER_POLICY_VERSION,
  direction: REVISION_COMPARE_TRANSFER_DIRECTION, defaultClassification: 'PROTECTED',
  allowedPropertyKeys: Object.freeze(Object.keys(ALLOWED).sort()), controlledPropertyKeys: CONTROLLED_KEYS,
  structuralOperations: 'FORBIDDEN', entityCreation: 'FORBIDDEN', entityDeletion: 'FORBIDDEN', reparenting: 'FORBIDDEN',
});

function dottedFieldPath(path) {
  return cleanText(path).replace(/^\//, '').split('/').map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~')).join('.');
}
function protectedPath(path) {
  const tokens = dottedFieldPath(path).toLowerCase().split('.');
  return tokens.some((token) => PROTECTED_TOKENS.includes(token));
}
function allowedPath(propertyKey, fieldPath) {
  const candidates = ALLOWED[propertyKey] ?? [];
  return candidates.includes(dottedFieldPath(fieldPath));
}

export function classifyRevisionCompareTransferField(input, policy = REVISION_COMPARE_TRANSFER_POLICY) {
  const propertyKey = cleanText(input?.propertyKey); const fieldPath = cleanText(input?.fieldPath);
  const blockers = [];
  let classification = 'PROTECTED'; let ruleId = 'DEFAULT_PROTECTED';
  if (policy?.schema !== REVISION_COMPARE_TRANSFER_POLICY_SCHEMA || policy.policyVersion !== REVISION_COMPARE_TRANSFER_POLICY_VERSION) {
    blockers.push('Transfer field policy is unsupported or stale.'); ruleId = 'POLICY_VERSION_MISMATCH';
  } else if (CONTROLLED_KEYS.includes(propertyKey) || CONTROLLED_KEYS.some((key) => dottedFieldPath(fieldPath).split('.').includes(key))) {
    classification = 'CONTROLLED'; ruleId = 'CONTROLLED_ENGINEERING_FIELD';
    blockers.push('Controlled geometry, support/restraint, or node-owned engineering fields are not writable in policy v1.');
  } else if (protectedPath(fieldPath)) {
    ruleId = 'PROTECTED_IDENTITY_OR_STRUCTURE'; blockers.push('Identity, hierarchy, topology, provenance, or evidence fields are protected.');
  } else if (allowedPath(propertyKey, fieldPath)) {
    classification = 'ALLOWED'; ruleId = `ALLOW_${propertyKey.toUpperCase()}`;
  } else {
    blockers.push(`Field ${fieldPath || '(missing)'} is not explicitly writable for property ${propertyKey || '(missing)'}.`);
  }
  return deepFreeze({
    schema: 'RevisionCompareTransferPolicyDecision.v1', policyVersion: policy?.policyVersion ?? null,
    propertyKey, fieldPath, classification, ruleId, writable: classification === 'ALLOWED' && blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export const _test = Object.freeze({ allowedPath, dottedFieldPath, protectedPath });
