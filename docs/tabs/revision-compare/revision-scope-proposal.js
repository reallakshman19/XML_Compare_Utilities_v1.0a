/** Deterministic common and one-sided branch proposal for RC-001. */

import { cleanText, deepFreeze, deterministicId, frozenStrings } from './revision-contract-utils.js';

export const REVISION_SCOPE_PROPOSAL_SCHEMA = 'RevisionScopeProposal.v1';

function byId(entries) {
  return new Map((entries ?? []).map((entry) => [entry.branchId, entry]));
}

function commonEntry(left, right) {
  return deepFreeze({
    branchId: left.branchId,
    label: left.label,
    site: left.site || right.site,
    owner: left.owner || right.owner,
    componentCountA: left.componentCount,
    componentCountB: right.componentCount,
    recordCountA: left.recordCount,
    recordCountB: right.recordCount,
  });
}

function oneSidedEntry(entry, side) {
  return deepFreeze({
    branchId: entry.branchId,
    label: entry.label,
    site: entry.site,
    owner: entry.owner,
    side,
    componentCount: entry.componentCount,
    recordCount: entry.recordCount,
  });
}

function normalizeDecisions(decisions) {
  const result = {};
  for (const [branchId, decision] of Object.entries(decisions ?? {})) {
    if (!decision?.excluded) continue;
    result[cleanText(branchId)] = deepFreeze({
      excluded: true,
      reason: cleanText(decision.reason) || 'USER_EXCLUDED',
    });
  }
  return deepFreeze(result);
}

function exclusionEntries(decisions, groupMap) {
  return Object.keys(decisions).sort().map((branchId) => deepFreeze({
    branchId,
    group: groupMap.get(branchId) ?? 'UNKNOWN',
    status: 'EXCLUDED',
    reason: decisions[branchId].reason,
  }));
}

function includedIds(entries, decisions) {
  return frozenStrings(entries.map((entry) => entry.branchId).filter((id) => !decisions[id]));
}

function sum(entries, key) {
  return entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);
}

function proposalSummary(common, onlyA, onlyB, includedA, includedB, indexA, indexB, excludedCount) {
  const idsA = new Set(includedA);
  const idsB = new Set(includedB);
  return deepFreeze({
    commonBranchCount: common.length,
    revAOnlyBranchCount: onlyA.length,
    revBOnlyBranchCount: onlyB.length,
    includedBranchCountA: includedA.length,
    includedBranchCountB: includedB.length,
    excludedBranchCount: excludedCount,
    retainedComponentCountA: sum([...indexA.values()].filter((entry) => idsA.has(entry.branchId)), 'componentCount'),
    retainedComponentCountB: sum([...indexB.values()].filter((entry) => idsB.has(entry.branchId)), 'componentCount'),
    retainedRecordCountA: sum([...indexA.values()].filter((entry) => idsA.has(entry.branchId)), 'recordCount'),
    retainedRecordCountB: sum([...indexB.values()].filter((entry) => idsB.has(entry.branchId)), 'recordCount'),
  });
}

function proposalWarnings(common, onlyA, onlyB, exclusions) {
  const warnings = [];
  if (!common.length) warnings.push('No exact common branches were found; one-sided scope remains visible.');
  if (onlyA.length) warnings.push(`${onlyA.length} Rev A-only branch(es) are included as removal candidates.`);
  if (onlyB.length) warnings.push(`${onlyB.length} Rev B-only branch(es) are included as addition candidates.`);
  const oneSidedExcluded = exclusions.filter((entry) => entry.group !== 'COMMON').length;
  if (oneSidedExcluded) warnings.push(`${oneSidedExcluded} one-sided branch(es) were explicitly excluded.`);
  return Object.freeze(warnings);
}

function classifyBranches(indexA, indexB) {
  const common = [], onlyA = [], onlyB = [], groups = new Map();
  for (const id of frozenStrings([...indexA.keys(), ...indexB.keys()])) {
    if (indexA.has(id) && indexB.has(id)) {
      common.push(commonEntry(indexA.get(id), indexB.get(id)));
      groups.set(id, 'COMMON');
    } else if (indexA.has(id)) {
      onlyA.push(oneSidedEntry(indexA.get(id), 'REV_A_ONLY'));
      groups.set(id, 'REV_A_ONLY');
    } else {
      onlyB.push(oneSidedEntry(indexB.get(id), 'REV_B_ONLY'));
      groups.set(id, 'REV_B_ONLY');
    }
  }
  return { common, onlyA, onlyB, groups };
}

function proposalIdentity(revA, revB, classified, includedA, includedB, excluded) {
  return {
    schema: REVISION_SCOPE_PROPOSAL_SCHEMA,
    revADocumentId: revA.document.documentId,
    revBDocumentId: revB.document.documentId,
    commonBranchIds: classified.common.map((entry) => entry.branchId),
    revAOnlyBranchIds: classified.onlyA.map((entry) => entry.branchId),
    revBOnlyBranchIds: classified.onlyB.map((entry) => entry.branchId),
    includedBranchIdsA: includedA,
    includedBranchIdsB: includedB,
    excludedBranches: excluded,
  };
}

/** Build the deterministic common and one-sided branch proposal. */
export async function createRevisionScopeProposal(revA, revB, decisions, cryptoRef) {
  if (!revA?.document || !revB?.document) throw new Error('Both revisions must be loaded before scope can be proposed.');
  const indexA = byId(revA.branchIndex), indexB = byId(revB.branchIndex);
  const classified = classifyBranches(indexA, indexB);
  const normalized = normalizeDecisions(decisions);
  const excluded = Object.freeze(exclusionEntries(normalized, classified.groups));
  const includedA = includedIds([...classified.common, ...classified.onlyA], normalized);
  const includedB = includedIds([...classified.common, ...classified.onlyB], normalized);
  const summary = proposalSummary(classified.common, classified.onlyA, classified.onlyB, includedA, includedB, indexA, indexB, excluded.length);
  const errors = [];
  if (!includedA.length) errors.push('Rev A included scope is empty.');
  if (!includedB.length) errors.push('Rev B included scope is empty.');
  const identity = proposalIdentity(revA, revB, classified, includedA, includedB, excluded);
  return deepFreeze({
    ...identity,
    proposalId: await deterministicId('scope-proposal', identity, cryptoRef),
    commonBranches: classified.common,
    revAOnlyBranches: classified.onlyA,
    revBOnlyBranches: classified.onlyB,
    summary,
    warnings: proposalWarnings(classified.common, classified.onlyA, classified.onlyB, excluded),
    validation: deepFreeze({ status: errors.length ? 'BLOCKED' : 'READY', errors }),
  });
}

export function updateScopeDecision(decisions, branchId, excluded, reason = 'USER_EXCLUDED') {
  const next = { ...(decisions ?? {}) };
  if (excluded) next[cleanText(branchId)] = { excluded: true, reason: cleanText(reason) || 'USER_EXCLUDED' };
  else delete next[cleanText(branchId)];
  return normalizeDecisions(next);
}

export function updateScopeGroup(decisions, branchIds, include) {
  let next = normalizeDecisions(decisions);
  for (const branchId of branchIds) next = updateScopeDecision(next, branchId, !include);
  return next;
}
