/** Immutable derived indexes for bounded Revision Compare transfer candidate lookup. */
import { revisionCompareDollarPathToPointer } from './revision-transfer-address.js';

export const REVISION_COMPARE_TRANSFER_CANDIDATE_INDEX_SCHEMA = 'RevisionCompareTransferCandidateIndex.v1';

function add(map, key, value) {
  const values = map.get(key) ?? []; values.push(value); map.set(key, values);
}
function multiMap(values, keyFor) {
  const map = new Map(); for (const value of values ?? []) add(map, keyFor(value), value); return map;
}
function acceptedTargetKey(differenceId, targetRecordId) { return `${differenceId}\u0000${targetRecordId}`; }
function unique(values, label, blockers) {
  if (!values?.length) blockers.push(`${label} resolves to zero records.`);
  if ((values?.length ?? 0) > 1) blockers.push(`${label} resolves to multiple records.`);
  return values?.length === 1 ? values[0] : null;
}
function ownerFromEntries(entries, entityId, evidencePath, blockers) {
  let pointer;
  try { pointer = revisionCompareDollarPathToPointer(evidencePath); }
  catch (error) { blockers.push(error.message); return null; }
  const matches = (entries ?? []).filter((entry) => entry.entityId === entityId
    && (pointer === entry.canonicalPath || pointer.startsWith(`${entry.canonicalPath}/`)))
    .sort((a, b) => b.canonicalPath.length - a.canonicalPath.length);
  if (!matches.length) blockers.push(`Entity ${entityId} does not own evidence path ${evidencePath}.`);
  if (matches.length > 1 && matches[0].canonicalPath.length === matches[1].canonicalPath.length) {
    blockers.push(`Entity ${entityId} resolves to multiple canonical paths.`); return null;
  }
  return matches[0] ?? null;
}
function indexedOwner(map, entityId, evidencePath, blockers) {
  return ownerFromEntries(map.get(entityId) ?? [], entityId, evidencePath, blockers);
}
function authorityReferences(state) {
  return Object.freeze({
    basisStatus: state?.basisStatus ?? null, audit: state?.compare?.audit ?? null,
    review: state?.review?.session ?? null, decision: state?.decision?.ledger ?? null,
    revA: state?.slots?.baseline?.jsonSnapshot ?? null, revB: state?.slots?.candidate?.jsonSnapshot ?? null,
  });
}
function sameReferences(left, right) {
  return Boolean(left && right && left.basisStatus === right.basisStatus && left.audit === right.audit
    && left.review === right.review && left.decision === right.decision
    && left.revA === right.revA && left.revB === right.revB);
}
export function createRevisionCompareTransferCandidateIndex(state) {
  const auditRows = state?.compare?.audit?.differenceRows ?? [];
  const reviewItems = state?.review?.session?.items ?? [];
  const decisions = state?.decision?.ledger?.decisions ?? [];
  const revAEntities = state?.slots?.baseline?.jsonSnapshot?.entityIndex ?? [];
  const revBEntities = state?.slots?.candidate?.jsonSnapshot?.entityIndex ?? [];
  const rowsByDifferenceId = multiMap(auditRows, (row) => row.differenceId);
  const targetRows = multiMap(auditRows.filter((row) => row.targetRecordId),
    (row) => acceptedTargetKey(row.differenceId, row.targetRecordId));
  const reviewByDifferenceId = multiMap(reviewItems, (item) => item.differenceId);
  const decisionsByDifferenceId = multiMap(decisions, (item) => item.differenceId);
  const revAByEntityId = multiMap(revAEntities, (entry) => entry.entityId);
  const revBByEntityId = multiMap(revBEntities, (entry) => entry.entityId);
  const stats = Object.freeze({
    auditRows: auditRows.length, reviewItems: reviewItems.length, decisions: decisions.length,
    revAEntities: revAEntities.length, revBEntities: revBEntities.length, constructionPasses: 7,
  });
  return Object.freeze({
    schema: REVISION_COMPARE_TRANSFER_CANDIDATE_INDEX_SCHEMA,
    references: authorityReferences(state), rows: Object.freeze([...auditRows]), stats,
    row: (differenceId, blockers) => unique(rowsByDifferenceId.get(differenceId), `Audit row ${differenceId}`, blockers),
    reviewItem: (differenceId, blockers) => unique(reviewByDifferenceId.get(differenceId), `Review item ${differenceId}`, blockers),
    decision: (differenceId, blockers) => unique(decisionsByDifferenceId.get(differenceId), `Decision ${differenceId}`, blockers),
    targetRow: (differenceId, targetRecordId, blockers) => unique(targetRows.get(acceptedTargetKey(differenceId, targetRecordId)), `Accepted target ${differenceId}`, blockers),
    sourceEntity: (entityId, blockers) => unique(revAByEntityId.get(entityId), `Rev A entity ${entityId}`, blockers),
    targetEntity: (entityId, blockers) => unique(revBByEntityId.get(entityId), `Rev B entity ${entityId}`, blockers),
    sourceOwner: (entityId, path, blockers) => indexedOwner(revAByEntityId, entityId, path, blockers),
    targetOwner: (entityId, path, blockers) => indexedOwner(revBByEntityId, entityId, path, blockers),
  });
}
export function createRevisionCompareTransferScanningLookup(state) {
  const rows = state?.compare?.audit?.differenceRows ?? [];
  const review = state?.review?.session?.items ?? [];
  const decisions = state?.decision?.ledger?.decisions ?? [];
  const revA = state?.slots?.baseline?.jsonSnapshot?.entityIndex ?? [];
  const revB = state?.slots?.candidate?.jsonSnapshot?.entityIndex ?? [];
  return Object.freeze({
    rows: Object.freeze([...rows]),
    row: (id, blockers) => unique(rows.filter((item) => item.differenceId === id), `Audit row ${id}`, blockers),
    reviewItem: (id, blockers) => unique(review.filter((item) => item.differenceId === id), `Review item ${id}`, blockers),
    decision: (id, blockers) => unique(decisions.filter((item) => item.differenceId === id), `Decision ${id}`, blockers),
    targetRow: (differenceId, targetId, blockers) => unique(rows.filter((item) => item.differenceId === differenceId && item.targetRecordId === targetId), `Accepted target ${differenceId}`, blockers),
    sourceEntity: (id, blockers) => unique(revA.filter((item) => item.entityId === id), `Rev A entity ${id}`, blockers),
    targetEntity: (id, blockers) => unique(revB.filter((item) => item.entityId === id), `Rev B entity ${id}`, blockers),
    sourceOwner: (id, path, blockers) => ownerFromEntries(revA, id, path, blockers),
    targetOwner: (id, path, blockers) => ownerFromEntries(revB, id, path, blockers),
  });
}
export function createRevisionCompareTransferCandidateCache(derive) {
  let references = null; let result = null; let builds = 0; let hits = 0;
  return Object.freeze({
    get(state) {
      const next = authorityReferences(state);
      if (sameReferences(references, next)) { hits += 1; return result; }
      const index = createRevisionCompareTransferCandidateIndex(state);
      result = Object.freeze({ index, candidates: derive(state, index) }); references = next; builds += 1; return result;
    },
    evidence: () => Object.freeze({ builds, hits }),
    clear: () => { references = null; result = null; },
  });
}
export const _test = Object.freeze({ acceptedTargetKey, authorityReferences, ownerFromEntries, sameReferences, unique });
