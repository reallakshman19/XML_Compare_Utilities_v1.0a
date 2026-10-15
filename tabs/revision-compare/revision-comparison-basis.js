/** Immutable RevisionComparisonBasis.v1 creation and validation. */

import { assertJsonSafe, deepFreeze, deterministicId } from './revision-contract-utils.js';
import { REVISION_VISUAL_METADATA_DECLARATION_SCHEMA } from './revision-visual-metadata-declaration.js';

export const REVISION_COMPARISON_BASIS_SCHEMA = 'RevisionComparisonBasis.v1';
const COMPATIBILITY_KEYS = Object.freeze([
  'unitCompatibility',
  'coordinateFrameCompatibility',
  'verticalAxisCompatibility',
]);

function validateCompatibility(basis, errors) {
  for (const key of COMPATIBILITY_KEYS) {
    const item = basis?.[key];
    if (item?.status !== 'COMPATIBLE') errors.push(`${key}.status must be COMPATIBLE`);
  }
}

export function validateRevisionComparisonBasis(basis) {
  const errors = [];
  if (basis?.schema !== REVISION_COMPARISON_BASIS_SCHEMA) errors.push(`schema must be ${REVISION_COMPARISON_BASIS_SCHEMA}`);
  for (const key of ['basisId', 'sessionId', 'revADocumentId', 'revBDocumentId', 'revAContentHash', 'revBContentHash', 'revAScopeIdentity', 'revBScopeIdentity']) {
    if (!String(basis?.[key] ?? '').trim()) errors.push(`${key} is required`);
  }
  if (!Array.isArray(basis?.includedBranchesA) || !basis.includedBranchesA.length) errors.push('includedBranchesA must not be empty');
  if (!Array.isArray(basis?.includedBranchesB) || !basis.includedBranchesB.length) errors.push('includedBranchesB must not be empty');
  if (basis?.visualMetadataDeclaration && basis.visualMetadataDeclaration.schema !== REVISION_VISUAL_METADATA_DECLARATION_SCHEMA) {
    errors.push(`visualMetadataDeclaration.schema must be ${REVISION_VISUAL_METADATA_DECLARATION_SCHEMA}`);
  }
  validateCompatibility(basis, errors);
  if (basis?.validation?.status !== 'READY') errors.push('validation.status must be READY');
  return Object.freeze(errors);
}

function identityPayload(input) {
  const identity = {
    schema: REVISION_COMPARISON_BASIS_SCHEMA,
    sessionId: input.sessionId,
    revADocumentId: input.revA.document.documentId,
    revBDocumentId: input.revB.document.documentId,
    revAContentHash: input.revA.document.sourceHash,
    revBContentHash: input.revB.document.sourceHash,
    revAScopeIdentity: input.revA.document.scopedHash,
    revBScopeIdentity: input.revB.document.scopedHash,
    includedBranchesA: input.proposal.includedBranchIdsA,
    includedBranchesB: input.proposal.includedBranchIdsB,
    excludedBranches: input.proposal.excludedBranches,
    unitCompatibility: input.preflight.compatibility.unitCompatibility,
    coordinateFrameCompatibility: input.preflight.compatibility.coordinateFrameCompatibility,
    verticalAxisCompatibility: input.preflight.compatibility.verticalAxisCompatibility,
  };
  if (input.visualMetadataDeclaration) identity.visualMetadataDeclaration = input.visualMetadataDeclaration;
  return identity;
}

export async function createRevisionComparisonBasis(input, cryptoRef) {
  if (input?.preflight?.status !== 'READY') throw new Error('Comparison basis cannot be approved while preflight is blocked.');
  const identity = identityPayload(input);
  const basis = deepFreeze({
    ...identity,
    basisId: await deterministicId('comparison-basis', identity, cryptoRef),
    scopeSummary: input.proposal.summary,
    warnings: input.preflight.warnings,
    blockers: [],
    validation: deepFreeze({ status: 'READY', errors: [] }),
  });
  const errors = validateRevisionComparisonBasis(basis);
  if (errors.length) throw new TypeError(`Invalid RevisionComparisonBasis: ${errors.join('; ')}`);
  assertJsonSafe(basis, REVISION_COMPARISON_BASIS_SCHEMA);
  return basis;
}

export const _test = Object.freeze({ validateCompatibility });
