import { createCiiTransferScopeSelection } from './cii-workspace-transfer-scope.js';
import { assertCiiMsBm001Authority } from './cii-workspace-multisource-nodename-authority.js';
import {
  ciiBm001CorrespondenceCoverage,
  ciiCanonicalNodeNameMutationSelection,
  ciiNodeNameMutationOperation,
} from './cii-workspace-multisource-bm001-correspondence.js';

function text(value) { return String(value ?? '').trim(); }
function candidateOperations(plan) {
  const rows = new Map();
  for (const operation of [...(plan?.operations || []), ...(plan?.excludedOperations || [])]) {
    const id = text(operation?.operationId);
    if (id && !rows.has(id)) rows.set(id, operation);
  }
  return [...rows.values()];
}

export function ciiExpectedNodeNameOperation(operation) {
  return ciiNodeNameMutationOperation(operation);
}

export async function createCiiExpectedNodeNameSourceSetSelection(plan, options = {}) {
  const sourceSetSha256 = text(plan?.sourceSetSha256 || plan?.sourceAuthority?.sourceSetSha256);
  const targetSha256 = text(plan?.targetAuthority?.originalSha256);
  const authority = await assertCiiMsBm001Authority(sourceSetSha256, targetSha256, options.cryptoRef);
  if (plan?.status !== 'PREVIEW_READY') throw new Error('CII_MS_EXPECTED_NODENAME_TRANSFER_PLAN_NOT_READY');

  const correspondenceCoverage = ciiBm001CorrespondenceCoverage(plan, authority.rows);
  if (correspondenceCoverage.status !== 'READY') {
    throw new Error(`CII_MS_BM001_CORRESPONDENCE_COVERAGE_REQUIRED:${correspondenceCoverage.matchedRowCount}/${correspondenceCoverage.expectedRowCount}`);
  }

  const candidates = candidateOperations(plan);
  const canonical = ciiCanonicalNodeNameMutationSelection(candidates);
  if (canonical.conflicts.length) {
    throw new Error(`CII_MS_WRITER2_PHYSICAL_MUTATION_CONFLICT:${canonical.conflicts.map((item) => item.physicalTargetKey).join(',')}`);
  }
  const applySet = new Set(canonical.appliedOperationIds);
  const decisions = {}; const applied = []; const excluded = [];
  for (const operation of candidates) {
    const id = text(operation?.operationId); if (!id || operation?.action === 'KEEP') continue;
    if (applySet.has(id)) { decisions[id] = 'APPLY'; applied.push(id); }
    else { decisions[id] = 'EXCLUDE'; excluded.push(id); }
  }
  if (!applied.length) throw new Error('CII_MS_EXPECTED_NODENAME_NO_APPLY_OPERATIONS');
  const selection = createCiiTransferScopeSelection(plan, decisions);
  return Object.freeze({
    selection,
    authority: Object.freeze({
      benchmark: 'BM-001', rowCount: authority.rowCount, sha256: authority.sha256,
      correspondenceCoverage,
    }),
    appliedOperationIds: Object.freeze(applied.sort()),
    excludedOperationIds: Object.freeze(excluded.sort()),
    corroborationGroups: canonical.corroborationGroups,
    duplicateCorroborationOperationIds: canonical.duplicateOperationIds,
    physicalMutationConflicts: canonical.conflicts,
  });
}

export const _test = Object.freeze({ candidateOperations });