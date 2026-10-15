import { deepFreeze } from './cii-workspace-contracts.js';
import { ciiMsBm001AliasKey, parseCiiMsBm001 } from './cii-workspace-multisource-nodename-authority.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from './cii-workspace-writer2-nodename-relocation.js';

const NODE_PROPERTY = 'Node name / to-name';
const WRITER_1C_NODENAME_POLICY = 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD';
const APPROVED = new Set(['REVIEWED', 'LOCKED']);

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sourceAliasCandidates(value) {
  const name = text(value);
  if (!name) return [];
  return name.startsWith('/') ? [name, name.slice(1)] : [name, `/${name}`];
}
function acceptanceSourceNames(acceptance) {
  return Array.isArray(acceptance?.sourceNames) ? acceptance.sourceNames.map(text).filter(Boolean) : [];
}
function acceptanceMatchesRow(acceptance, row) {
  const targetName = text(acceptance?.targetName);
  if (!targetName || targetName !== text(row?.targetName)) return false;
  const rowAliases = new Set((row?.sourceNames || []).map((name) => ciiMsBm001AliasKey(name, row.targetName)));
  return acceptanceSourceNames(acceptance).some((sourceName) => sourceAliasCandidates(sourceName)
    .some((candidate) => rowAliases.has(ciiMsBm001AliasKey(candidate, targetName))));
}
function candidateOperations(plan) {
  const byId = new Map();
  for (const operation of [...(plan?.operations || []), ...(plan?.excludedOperations || [])]) {
    const id = operationId(operation);
    if (id && !byId.has(id)) byId.set(id, operation);
  }
  return [...byId.values()];
}

export function ciiBm001CorrespondenceCoverage(plan, rows = parseCiiMsBm001()) {
  const authorityRows = [...(rows || [])];
  const matched = new Set(); const invalidOperationIds = []; const evidenceOperationIds = [];
  for (const operation of candidateOperations(plan)) {
    const acceptance = operation?.bm001Acceptance;
    if (acceptance?.benchmark !== 'BM-001' || acceptance?.status !== 'BOUND') continue;
    const id = operationId(operation); evidenceOperationIds.push(id);
    let found = false;
    authorityRows.forEach((row, index) => {
      if (!acceptanceMatchesRow(acceptance, row)) return;
      matched.add(Number(row?.rowNumber) || index + 1); found = true;
    });
    if (!found) invalidOperationIds.push(id || 'unknown');
  }
  const rowNumbers = authorityRows.map((row, index) => Number(row?.rowNumber) || index + 1);
  const missingRowNumbers = rowNumbers.filter((number) => !matched.has(number));
  const invalidIds = [...new Set(invalidOperationIds)].sort();
  const evidenceIds = [...new Set(evidenceOperationIds)].sort();
  const status = invalidIds.length ? 'BLOCKED' : 'READY';
  return deepFreeze({
    schema: 'CIIWorkspaceBm001CorrespondenceCoverage.v1',
    benchmark: 'BM-001', status,
    expectedRowCount: authorityRows.length,
    matchedRowCount: matched.size,
    observationStatus: missingRowNumbers.length ? 'PARTIAL' : 'COMPLETE',
    missingRowNumbers: deepFreeze(missingRowNumbers),
    invalidOperationIds: deepFreeze(invalidIds),
    evidenceOperationIds: deepFreeze(evidenceIds),
  });
}

function targetIdentity(operation) {
  return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId);
}
function beforeName(operation) {
  return text(operation?.before ?? operation?.targetEvidence?.value);
}
function proposedName(operation) {
  return text(operation?.proposed ?? operation?.sourceEvidence?.value);
}
export function ciiWriter2NodeNameCardinalityOperation(operation) {
  if (!operationId(operation)) return false;
  if (operation?.family !== 'NODE_NAME' || operation?.property !== NODE_PROPERTY) return false;
  if (!['CREATE', 'DELETE'].includes(operation?.action) || operation?.status !== 'PREVIEW_READY') return false;
  if (operation?.policyAuthority !== CII_WRITER_2_NODENAME_RELOCATION_POLICY) return false;
  if (!APPROVED.has(operation?.matchAuthority?.status) || !targetIdentity(operation)) return false;
  const before = beforeName(operation); const proposed = proposedName(operation);
  if (operation.action === 'CREATE') return !before && Boolean(proposed);
  return Boolean(before) && !proposed;
}

export function ciiWriter1CNodeNameReplacementOperation(operation) {
  if (!operationId(operation)) return false;
  if (operation?.family !== 'NODE_NAME' || operation?.property !== NODE_PROPERTY) return false;
  if (operation?.action !== 'COPY' || operation?.status !== 'PREVIEW_READY') return false;
  if (operation?.policyAuthority !== WRITER_1C_NODENAME_POLICY) return false;
  if (!APPROVED.has(operation?.matchAuthority?.status) || !targetIdentity(operation)) return false;
  const before = beforeName(operation); const proposed = proposedName(operation);
  return Boolean(before) && Boolean(proposed) && before !== proposed;
}

export function ciiNodeNameMutationOperation(operation) {
  return ciiWriter2NodeNameCardinalityOperation(operation) || ciiWriter1CNodeNameReplacementOperation(operation);
}

function physicalMutationKey(operation, predicate) {
  if (!predicate(operation)) return null;
  return `NODE_NAME|${text(operation?.action)}|${targetIdentity(operation)}|${beforeName(operation)}|${proposedName(operation)}`;
}
function physicalTargetKey(operation, predicate) {
  return predicate(operation) ? `NODE_NAME|${targetIdentity(operation)}` : null;
}
function physicalMutationConflicts(operations, predicate, keyFunction) {
  const byTarget = new Map();
  for (const operation of operations || []) {
    const targetKey = physicalTargetKey(operation, predicate); const mutationKey = keyFunction(operation);
    if (!targetKey || !mutationKey) continue;
    if (!byTarget.has(targetKey)) byTarget.set(targetKey, new Map());
    const mutations = byTarget.get(targetKey);
    if (!mutations.has(mutationKey)) mutations.set(mutationKey, []);
    mutations.get(mutationKey).push(operationId(operation));
  }
  const conflicts = [];
  for (const [targetKey, mutations] of byTarget) {
    if (mutations.size <= 1) continue;
    conflicts.push(deepFreeze({
      physicalTargetKey: targetKey,
      mutationKeys: deepFreeze([...mutations.keys()].sort()),
      operationIds: deepFreeze([...mutations.values()].flat().sort()),
    }));
  }
  return deepFreeze(conflicts.sort((a, b) => a.physicalTargetKey.localeCompare(b.physicalTargetKey, undefined, { numeric: true })));
}

export function ciiWriter2PhysicalMutationKey(operation) {
  return physicalMutationKey(operation, ciiWriter2NodeNameCardinalityOperation);
}
export function ciiWriter2PhysicalMutationConflicts(operations = []) {
  return physicalMutationConflicts(operations, ciiWriter2NodeNameCardinalityOperation, ciiWriter2PhysicalMutationKey);
}
export function ciiNodeNamePhysicalMutationKey(operation) {
  return physicalMutationKey(operation, ciiNodeNameMutationOperation);
}
export function ciiNodeNamePhysicalMutationConflicts(operations = []) {
  return physicalMutationConflicts(operations, ciiNodeNameMutationOperation, ciiNodeNamePhysicalMutationKey);
}

function operationRank(operation) {
  const authority = operation?.matchAuthority?.status === 'LOCKED' ? '0' : '1';
  return `${authority}|${text(operation?.sourceId)}|${operationId(operation)}`;
}
function canonicalSelection(operations, conflicts, keyFunction) {
  const conflictedOperationIds = new Set(conflicts.flatMap((item) => item.operationIds));
  const groups = new Map();
  for (const operation of operations || []) {
    if (conflictedOperationIds.has(operationId(operation))) continue;
    const key = keyFunction(operation); if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(operation);
  }
  const appliedOperationIds = []; const duplicateOperationIds = []; const corroborationGroups = [];
  for (const [key, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    const ranked = [...rows].sort((a, b) => operationRank(a).localeCompare(operationRank(b), undefined, { numeric: true }));
    const chosen = ranked[0]; const duplicates = ranked.slice(1);
    appliedOperationIds.push(operationId(chosen));
    duplicateOperationIds.push(...duplicates.map(operationId));
    corroborationGroups.push(deepFreeze({
      physicalMutationKey: key,
      appliedOperationId: operationId(chosen),
      corroboratingOperationIds: deepFreeze(duplicates.map(operationId).sort()),
      sourceIds: deepFreeze([...new Set(ranked.map((row) => text(row?.sourceId)).filter(Boolean))].sort()),
    }));
  }
  return deepFreeze({
    appliedOperationIds: deepFreeze(appliedOperationIds.sort()),
    duplicateOperationIds: deepFreeze(duplicateOperationIds.sort()),
    corroborationGroups: deepFreeze(corroborationGroups),
    conflicts,
  });
}
export function ciiCanonicalNodeNameMutationSelection(operations = []) {
  return canonicalSelection(operations, ciiNodeNamePhysicalMutationConflicts(operations), ciiNodeNamePhysicalMutationKey);
}
export function ciiCanonicalWriter2MutationSelection(operations = []) {
  return (operations || []).some(ciiWriter1CNodeNameReplacementOperation)
    ? ciiCanonicalNodeNameMutationSelection(operations)
    : canonicalSelection(operations, ciiWriter2PhysicalMutationConflicts(operations), ciiWriter2PhysicalMutationKey);
}

export const _test = Object.freeze({
  text, operationId, sourceAliasCandidates, acceptanceSourceNames, acceptanceMatchesRow,
  candidateOperations, targetIdentity, physicalTargetKey, operationRank, beforeName, proposedName,
  physicalMutationKey, physicalMutationConflicts, canonicalSelection,
});