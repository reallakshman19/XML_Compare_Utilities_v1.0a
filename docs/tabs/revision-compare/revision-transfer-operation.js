/** Deterministic field-level transfer operation planning for Revision Compare. */
import { deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import {
  createRevisionCompareTransferAddress, findRevisionCompareEntity,
  findRevisionCompareEntityForEvidencePath, readRevisionCompareSnapshotField,
  resolveRevisionCompareTransferAddress, REVISION_COMPARE_TARGET_STATE,
  revisionCompareRelativeFieldPath,
} from './revision-transfer-address.js';
import { classifyRevisionCompareTransferField } from './revision-transfer-policy.js';
import {
  REVISION_COMPARE_TRANSFER_OPERATION_ID_PREFIX,
  REVISION_COMPARE_TRANSFER_OPERATION_SCHEMA,
  REVISION_COMPARE_TRANSFER_OPERATION_TYPE,
} from './revision-transfer-contracts.js';

function canonical(value) { return JSON.parse(stableStringify(value)); }
function sameValue(left, right) { return stableStringify(left) === stableStringify(right); }
function exactValue(value, rule) {
  return rule === 'trim-preserve-scalar' && typeof value === 'string' ? value.trim() : value;
}
function evidenceMatches(raw, projected, rule) {
  return projected === undefined || sameValue(exactValue(raw, rule), projected);
}
function valueType(value) {
  if (value === null) return 'NULL';
  if (Array.isArray(value)) return 'ARRAY';
  return (typeof value).toUpperCase();
}
function unique(values, label, blockers) {
  if (!values.length) blockers.push(`${label} resolves to zero records.`);
  if (values.length > 1) blockers.push(`${label} resolves to multiple records.`);
  return values.length === 1 ? values[0] : null;
}
function propertyEvidence(row, field, blockers) {
  const values = (row?.changedProperties ?? [])
    .filter((entry) => entry.propertyKey === field.propertyKey);
  if (!values.length) {
    if (row?.matchCertainty !== 'AMBIGUOUS') {
      blockers.push(`Selected property ${field.propertyKey} is not changed in the audit row.`);
    }
    return null;
  }
  const property = unique(values, `Changed property ${field.propertyKey}`, blockers);
  if (property && (property.revAEvidencePath !== field.revAEvidencePath
      || (property.revBEvidencePath ?? null) !== (field.revBEvidencePath ?? null))) {
    blockers.push(`Selected evidence paths for ${field.propertyKey} do not match the audit.`);
  }
  return property;
}
function targetEntityContext(input, blockers) {
  let targetEntity;
  try { targetEntity = findRevisionCompareEntity(input.revB, input.target.targetRecordId); }
  catch (error) { blockers.push(error.message); return null; }
  if (!input.field.revBEvidencePath) return targetEntity;
  try {
    const evidenceEntity = findRevisionCompareEntityForEvidencePath(
      input.revB, input.target.targetRecordId, input.field.revBEvidencePath,
    );
    const evidencePath = revisionCompareRelativeFieldPath(
      evidenceEntity.canonicalPath, input.field.revBEvidencePath,
    );
    if (evidenceEntity.canonicalPath !== targetEntity.canonicalPath
        || evidencePath !== input.field.targetFieldPath) {
      blockers.push('Rev B evidence path does not match the explicit target entity and field path.');
    }
  } catch (error) { blockers.push(error.message); }
  return targetEntity;
}
function operationContext(input, blockers) {
  let sourceEntity;
  try {
    sourceEntity = findRevisionCompareEntityForEvidencePath(
      input.revA, input.item.sourceRecordId, input.field.revAEvidencePath,
    );
  } catch (error) { blockers.push(error.message); }
  const targetEntity = targetEntityContext(input, blockers);
  if (!sourceEntity || !targetEntity) return null;
  let sourceFieldPath;
  try {
    sourceFieldPath = revisionCompareRelativeFieldPath(
      sourceEntity.canonicalPath, input.field.revAEvidencePath,
    );
  } catch (error) { blockers.push(error.message); }
  if (!sourceFieldPath) return null;
  const targetFieldPath = input.field.targetFieldPath;
  const policy = classifyRevisionCompareTransferField({
    propertyKey: input.field.propertyKey, fieldPath: targetFieldPath,
  }, input.policy);
  blockers.push(...policy.blockers);
  const source = readRevisionCompareSnapshotField(input.revA, sourceEntity, sourceFieldPath);
  const before = readRevisionCompareSnapshotField(input.revB, targetEntity, targetFieldPath);
  if (!source.found) blockers.push('Selected Rev A source field resolves to zero fields.');
  return { sourceEntity, targetEntity, sourceFieldPath, targetFieldPath, policy, source, before };
}
function expectedState(context) {
  return context.before.found
    ? REVISION_COMPARE_TARGET_STATE.PRESENT : REVISION_COMPARE_TARGET_STATE.ABSENT;
}
function operationAddress(input, context, blockers) {
  const addressInput = {
    targetDocumentId: input.revB.sourceDocumentId,
    targetDocumentSha256: input.revB.sourceContentSha256,
    targetEntityId: context.targetEntity.entityId,
    entityCanonicalPath: context.targetEntity.canonicalPath,
    fieldPath: context.targetFieldPath,
    expectedTargetState: expectedState(context),
    expectedEntitySha256: context.targetEntity.entitySha256,
  };
  if (context.before.found) addressInput.expectedCurrentValue = context.before.value;
  const address = createRevisionCompareTransferAddress(addressInput);
  blockers.push(...resolveRevisionCompareTransferAddress(input.revB, address).blockers);
  return address;
}
function evidenceReferences(input) {
  return {
    differenceId: input.item.differenceId,
    auditId: input.audit.auditId,
    reviewSessionId: input.review.reviewSessionId,
    reviewRevision: input.review.revision,
    decisionLedgerId: input.decision.ledgerId,
    decisionRevision: input.decision.revision,
    decisionEventId: input.target.decision?.activeEventId ?? null,
    revAEvidencePath: input.field.revAEvidencePath,
    revBEvidencePath: input.field.revBEvidencePath,
  };
}
function operationMaterial(input, context, targetAddress) {
  const present = context.before.found;
  const material = {
    schema: REVISION_COMPARE_TRANSFER_OPERATION_SCHEMA,
    operationType: present
      ? REVISION_COMPARE_TRANSFER_OPERATION_TYPE.REPLACE_EXISTING_PROPERTY
      : REVISION_COMPARE_TRANSFER_OPERATION_TYPE.ADD_MISSING_PROPERTY,
    expectedTargetState: present
      ? REVISION_COMPARE_TARGET_STATE.PRESENT : REVISION_COMPARE_TARGET_STATE.ABSENT,
    sourceDocumentId: input.revA.sourceDocumentId,
    sourceDocumentSha256: input.revA.sourceContentSha256,
    targetDocumentId: input.revB.sourceDocumentId,
    targetDocumentSha256: input.revB.sourceContentSha256,
    sourceEntityId: context.sourceEntity.entityId,
    targetEntityId: context.targetEntity.entityId,
    sourceCanonicalPath: context.sourceEntity.canonicalPath,
    targetCanonicalPath: context.targetEntity.canonicalPath,
    fieldPath: context.targetFieldPath,
    afterValue: context.source.found ? context.source.value : null,
    valueType: context.source.found ? valueType(context.source.value) : 'UNKNOWN',
    transferPolicy: context.policy,
    targetAddress,
    evidenceReferences: evidenceReferences(input),
  };
  if (present) material.beforeValue = context.before.value;
  return canonical(material);
}
function reconcileEvidence(input, property, context, blockers) {
  const rule = property?.normalizationRule ?? 'trim-preserve-scalar';
  if (context.source.found && !evidenceMatches(context.source.value, property?.revAValue, rule)) {
    blockers.push('Rev A source value does not reconcile with comparison evidence.');
  }
  if (context.before.found && !evidenceMatches(context.before.value, property?.revBValue, rule)) {
    blockers.push('Rev B current value does not reconcile with comparison evidence.');
  }
  if (!context.before.found && input.field.revBEvidencePath) {
    blockers.push('An absent Rev B target field must not claim a Rev B evidence value.');
  }
  if (context.source.found && context.before.found
      && sameValue(context.source.value, context.before.value)) {
    blockers.push('Transfer operation would be a no-op.');
  }
}
export async function createRevisionCompareTransferOperation(input, cryptoRef) {
  const blockers = [];
  const property = propertyEvidence(input.row, input.field, blockers);
  const context = operationContext(input, blockers);
  if (!context) return { operation: null, blockers };
  reconcileEvidence(input, property, context, blockers);
  const material = operationMaterial(input, context, operationAddress(input, context, blockers));
  const operationId = `${REVISION_COMPARE_TRANSFER_OPERATION_ID_PREFIX}${await sha256Text(
    JSON.stringify(material), cryptoRef,
  )}`;
  return {
    operation: deepFreeze({
      ...material,
      operationId,
      status: blockers.length ? 'BLOCKED' : 'READY',
      blockers: Object.freeze(blockers),
    }),
    blockers,
  };
}
export const _test = Object.freeze({ evidenceMatches, sameValue, valueType });
