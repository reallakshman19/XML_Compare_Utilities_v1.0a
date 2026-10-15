import { normalizeSequentialReference } from '../source/sequential-reference-normalization.js';
import {
  EXTERNAL_BOUNDARY_POLICY_CLASSIFICATIONS,
  SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY,
  matchSequentialExternalBoundaryPolicy,
} from '../policy/sequential-external-boundary-policy.js';

export const BOUNDARY_REFERENCE_CLASSIFICATIONS = EXTERNAL_BOUNDARY_POLICY_CLASSIFICATIONS;

function result(common, status, dialect, basis, confidence, patternId = null) {
  return Object.freeze({
    ...common,
    status,
    dialect,
    patternId,
    basis: Object.freeze(basis),
    confidence,
  });
}

export function classifySequentialBoundaryReference(referenceValue, boundaryRole) {
  const normalized = normalizeSequentialReference(referenceValue);
  const policy = SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY;
  const common = {
    schema: policy.classificationSchema,
    boundaryRole: String(boundaryRole || '').toUpperCase(),
    rawReference: normalized.rawReference,
    normalizedReference: normalized.normalizedReference,
    normalizationOperations: normalized.operations,
    policySchema: policy.schema,
    policyId: policy.policyId,
    policyRevision: policy.revision,
    policyDialect: policy.sourceDialect,
    policyFingerprint: policy.policyFingerprint,
  };
  const match = matchSequentialExternalBoundaryPolicy(normalized.normalizedReference);
  if (match) {
    return result(common, match.status, match.dialect, match.basis, match.confidence, match.patternId);
  }
  return result(common,
    BOUNDARY_REFERENCE_CLASSIFICATIONS.UNCLASSIFIED,
    null,
    [],
    'UNCLASSIFIED');
}
