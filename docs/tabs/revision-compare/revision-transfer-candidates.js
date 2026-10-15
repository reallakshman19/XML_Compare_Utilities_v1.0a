/** Deterministic transfer candidate semantics over indexed or scanning evidence lookup. */
import { deepFreeze } from './revision-contract-utils.js';
import {
  createRevisionCompareTransferAddress, resolveRevisionCompareTransferAddress,
  revisionCompareRelativeFieldPath, REVISION_COMPARE_TARGET_STATE,
} from './revision-transfer-address.js';
import { classifyRevisionCompareTransferField } from './revision-transfer-policy.js';
import {
  createRevisionCompareTransferCandidateIndex, createRevisionCompareTransferScanningLookup,
} from './revision-transfer-candidate-index.js';

export const REVISION_COMPARE_TRANSFER_PROPERTY_GROUP = Object.freeze({
  DESCRIPTION: 'DESCRIPTION', MATERIAL_AND_SPECIFICATION: 'MATERIAL_AND_SPECIFICATION',
  RATING_AND_DIMENSIONS: 'RATING_AND_DIMENSIONS', WEIGHT_AND_LENGTH: 'WEIGHT_AND_LENGTH',
  OTHER_ALLOWED: 'OTHER_ALLOWED', PROTECTED_OR_CONTROLLED: 'PROTECTED_OR_CONTROLLED',
});
const GROUPS = Object.freeze({
  description: 'DESCRIPTION', material: 'MATERIAL_AND_SPECIFICATION', specification: 'MATERIAL_AND_SPECIFICATION',
  rating: 'RATING_AND_DIMENSIONS', nominalSize: 'RATING_AND_DIMENSIONS', wallThickness: 'RATING_AND_DIMENSIONS',
  weight: 'WEIGHT_AND_LENGTH', length: 'WEIGHT_AND_LENGTH',
});
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function uniqueBlockers(values) { return Object.freeze([...new Set(values)]); }
export function revisionCompareTransferPropertyGroup(propertyKey, policy) {
  if (policy?.classification !== 'ALLOWED') return REVISION_COMPARE_TRANSFER_PROPERTY_GROUP.PROTECTED_OR_CONTROLLED;
  return GROUPS[propertyKey] ?? REVISION_COMPARE_TRANSFER_PROPERTY_GROUP.OTHER_ALLOWED;
}
function globalBlockers(state) {
  const blockers = [];
  if (state?.basisStatus !== 'CURRENT') blockers.push('A CURRENT comparison basis is required.');
  if (state?.compare?.audit?.validation?.status !== 'READY') blockers.push('A READY comparison audit is required.');
  if (state?.review?.session?.status !== 'CURRENT') blockers.push('A CURRENT review session is required.');
  if (state?.decision?.ledger?.status !== 'CURRENT') blockers.push('A CURRENT ambiguity-decision ledger is required.');
  if (!state?.slots?.baseline?.jsonSnapshot || !state?.slots?.candidate?.jsonSnapshot) blockers.push('Lossless Rev A and Rev B snapshots are required.');
  return blockers;
}
function reviewItem(lookup, differenceId, blockers) {
  const item = lookup.reviewItem(differenceId, blockers);
  if (item && item.reviewState !== 'REVIEWED') blockers.push(`Review item ${differenceId} is ${item.reviewState}; only REVIEWED items are transferable.`);
  return item;
}
function targetRelationship(row, lookup, blockers) {
  if (row?.targetRecordId) return { targetRecordId: row.targetRecordId, targetDifferenceId: row.differenceId, decisionState: 'NOT_REQUIRED' };
  if (row?.matchCertainty !== 'AMBIGUOUS') { blockers.push('The audited source row has no target relationship.'); return null; }
  const decision = lookup.decision(row.differenceId, blockers); if (!decision) return null;
  if (decision.decisionState !== 'ACCEPTED_CANDIDATE') blockers.push(`Ambiguity decision ${row.differenceId} is ${decision.decisionState}; ACCEPTED_CANDIDATE is required.`);
  if (decision.decisionState !== 'ACCEPTED_CANDIDATE') return null;
  const target = lookup.targetRow(decision.acceptedTargetDifferenceId, decision.acceptedTargetRecordId, blockers);
  return target ? { targetRecordId: target.targetRecordId, targetDifferenceId: target.differenceId, decisionState: decision.decisionState } : null;
}
function evidenceAddress(state, row, target, property, lookup, blockers) {
  const revA = state?.slots?.baseline?.jsonSnapshot; const revB = state?.slots?.candidate?.jsonSnapshot;
  const targetEntity = lookup.targetEntity(target.targetRecordId, blockers); if (!targetEntity) return { path: '' };
  const source = lookup.sourceOwner(row.sourceRecordId, property.revAEvidencePath, blockers); if (!source) return { path: '', targetEntity };
  let path = '';
  try { path = revisionCompareRelativeFieldPath(source.canonicalPath, property.revAEvidencePath); }
  catch (error) { blockers.push(error.message); return { path: '', targetEntity }; }
  if (property.revBEvidencePath) {
    const owner = lookup.targetOwner(target.targetRecordId, property.revBEvidencePath, blockers); if (!owner) return { path, targetEntity };
    if (owner.canonicalPath !== targetEntity.canonicalPath) blockers.push('Rev B evidence path does not belong to the selected target entity.');
    try { path = revisionCompareRelativeFieldPath(owner.canonicalPath, property.revBEvidencePath); }
    catch (error) { blockers.push(error.message); return { path, targetEntity }; }
  }
  const present = Boolean(property.revBEvidencePath);
  try {
    const address = createRevisionCompareTransferAddress({
      targetDocumentId: revB.sourceDocumentId, targetDocumentSha256: revB.sourceContentSha256,
      targetEntityId: target.targetRecordId, entityCanonicalPath: targetEntity.canonicalPath,
      fieldPath: path, expectedTargetState: present ? REVISION_COMPARE_TARGET_STATE.PRESENT : REVISION_COMPARE_TARGET_STATE.ABSENT,
      expectedEntitySha256: targetEntity.entitySha256, ...(present ? { expectedCurrentValue: property.revBValue } : {}),
    });
    const resolution = resolveRevisionCompareTransferAddress(revB, address); blockers.push(...resolution.blockers);
    return { path, targetEntity, address, resolution };
  } catch (error) { blockers.push(error.message); return { path, targetEntity }; }
}
function fieldCandidate(state, row, target, property, pairBlockers, lookup) {
  const blockers = [...pairBlockers]; const evidence = evidenceAddress(state, row, target, property, lookup, blockers);
  const path = evidence.path ?? ''; const policy = classifyRevisionCompareTransferField({ propertyKey: property.propertyKey, fieldPath: path });
  blockers.push(...policy.blockers);
  const field = {
    fieldKey: `${encodeURIComponent(property.propertyKey)}|${encodeURIComponent(path)}`,
    propertyKey: property.propertyKey, revAEvidencePath: property.revAEvidencePath,
    revBEvidencePath: property.revBEvidencePath ?? null, targetFieldPath: path,
    sourceValue: property.revAValue, targetState: property.revBEvidencePath ? 'PRESENT' : 'ABSENT',
    policy, propertyGroup: revisionCompareTransferPropertyGroup(property.propertyKey, policy),
    eligible: blockers.length === 0, blockers: uniqueBlockers(blockers),
  };
  if (property.revBEvidencePath) field.targetValue = property.revBValue;
  return deepFreeze(field);
}
function pairCandidate(state, row, sharedBlockers, lookup) {
  const blockers = [...sharedBlockers]; reviewItem(lookup, row.differenceId, blockers);
  const target = targetRelationship(row, lookup, blockers);
  if (target?.targetDifferenceId !== row.differenceId) reviewItem(lookup, target?.targetDifferenceId, blockers);
  if (!row.sourceRecordId) blockers.push('A stable Rev A source record identity is required.');
  const fields = target ? (row.changedProperties ?? []).map((property) => fieldCandidate(state, row, target, property, blockers, lookup)) : [];
  if (!fields.length) blockers.push('No changed-property evidence is available for transfer selection.');
  return deepFreeze({
    differenceId: row.differenceId, sourceRecordId: row.sourceRecordId ?? null,
    targetRecordId: target?.targetRecordId ?? null, targetDifferenceId: target?.targetDifferenceId ?? null,
    decisionState: target?.decisionState ?? 'UNRESOLVED', matchCertainty: row.matchCertainty,
    fields: Object.freeze(fields), eligible: blockers.length === 0 && fields.some((field) => field.eligible),
    blockers: uniqueBlockers(blockers),
  });
}
export function deriveRevisionCompareTransferCandidatesWithLookup(state, lookup) {
  const shared = globalBlockers(state);
  const rows = lookup.rows.filter((row) => row.sourceRecordId && row.differenceCategory !== 'UNCHANGED');
  return Object.freeze(rows.map((row) => pairCandidate(state, row, shared, lookup))
    .sort((a, b) => compareText(a.differenceId, b.differenceId)));
}
export function deriveRevisionCompareTransferCandidates(state, index = createRevisionCompareTransferCandidateIndex(state)) {
  return deriveRevisionCompareTransferCandidatesWithLookup(state, index);
}
export function deriveRevisionCompareTransferCandidatesScanning(state) {
  return deriveRevisionCompareTransferCandidatesWithLookup(state, createRevisionCompareTransferScanningLookup(state));
}
export const _test = Object.freeze({ compareText, evidenceAddress, fieldCandidate, globalBlockers, pairCandidate, targetRelationship });
