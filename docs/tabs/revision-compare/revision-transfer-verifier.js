/** Derived verification evidence for patched Revision Compare Staged-JSON documents. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { serializeRevisionCompareTransferPlan } from './revision-transfer-contracts.js';
import { REVISION_COMPARE_TARGET_STATE } from './revision-transfer-address.js';

export const REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA = 'RevisionCompareTransferAudit.v1';
export const REVISION_COMPARE_TRANSFER_PROOF_SCHEMA = 'RevisionCompareTransferProof.v1';
const AUDIT_PREFIX = 'revision-transfer-audit:';
const PROOF_PREFIX = 'revision-transfer-proof:';

function encodePointerToken(value) { return String(value).replace(/~/g, '~0').replace(/\//g, '~1'); }
function appendPointer(parent, token) { return `${parent === '/' ? '' : parent}/${encodePointerToken(token)}` || '/'; }
function sameValue(left, right) { return stableStringify(left) === stableStringify(right); }
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function stateValue(found, value) {
  const result = { state: found ? REVISION_COMPARE_TARGET_STATE.PRESENT : REVISION_COMPARE_TARGET_STATE.ABSENT };
  if (found) result.value = value;
  return result;
}
function changeRecord(path, kind, beforeFound, beforeValue, afterFound, afterValue) {
  return deepFreeze({
    path, kind,
    before: stateValue(beforeFound, beforeValue),
    after: stateValue(afterFound, afterValue),
  });
}
function discoverChanges(before, after, path = '/') {
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) {
      return [changeRecord(path, 'REPLACED', true, before, true, after)];
    }
    const output = [];
    if (before.length !== after.length) output.push(changeRecord(path, 'ARRAY_LENGTH_CHANGED', true, before.length, true, after.length));
    const length = Math.min(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      output.push(...discoverChanges(before[index], after[index], appendPointer(path, index)));
    }
    return output;
  }
  if (plainObject(before) || plainObject(after)) {
    if (!plainObject(before) || !plainObject(after)) {
      return [changeRecord(path, 'REPLACED', true, before, true, after)];
    }
    const output = []; const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    for (const key of keys) {
      const beforeFound = Object.prototype.hasOwnProperty.call(before, key);
      const afterFound = Object.prototype.hasOwnProperty.call(after, key);
      const nextPath = appendPointer(path, key);
      if (!beforeFound) output.push(changeRecord(nextPath, 'ADDED', false, null, true, after[key]));
      else if (!afterFound) output.push(changeRecord(nextPath, 'REMOVED', true, before[key], false, null));
      else output.push(...discoverChanges(before[key], after[key], nextPath));
    }
    return output;
  }
  return sameValue(before, after) ? [] : [changeRecord(path, 'REPLACED', true, before, true, after)];
}
function parentPath(path) {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}
function collectObjectKeys(value, path = '/', output = new Map()) {
  if (plainObject(value)) {
    output.set(path, Object.freeze(Object.keys(value)));
    for (const key of Object.keys(value)) collectObjectKeys(value[key], appendPointer(path, key), output);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectObjectKeys(item, appendPointer(path, index), output));
  }
  return output;
}
function expectedKeyOrder(before, operations) {
  const additions = new Map();
  for (const entry of operations) {
    if (entry.operation.expectedTargetState !== REVISION_COMPARE_TARGET_STATE.ABSENT) continue;
    const path = parentPath(entry.absoluteFieldPath);
    const key = entry.absoluteFieldPath.slice(entry.absoluteFieldPath.lastIndexOf('/') + 1);
    if (!additions.has(path)) additions.set(path, []);
    additions.get(path).push(key.replace(/~1/g, '/').replace(/~0/g, '~'));
  }
  const result = new Map();
  for (const [path, keys] of collectObjectKeys(before)) result.set(path, Object.freeze([...keys, ...(additions.get(path) ?? [])]));
  return result;
}
function objectKeyOrderProof(before, after, operations) {
  const expected = expectedKeyOrder(before, operations); const actual = collectObjectKeys(after);
  const mismatches = [];
  for (const [path, keys] of expected) {
    if (!sameValue(keys, actual.get(path) ?? null)) mismatches.push(path);
  }
  for (const path of actual.keys()) if (!expected.has(path)) mismatches.push(path);
  return { unchanged: mismatches.length === 0, mismatches: Object.freeze([...new Set(mismatches)].sort()) };
}
function collectArrays(value, path = '/', output = []) {
  if (Array.isArray(value)) {
    output.push({ path, length: value.length });
    value.forEach((item, index) => collectArrays(item, appendPointer(path, index), output));
  } else if (plainObject(value)) {
    Object.keys(value).forEach((key) => collectArrays(value[key], appendPointer(path, key), output));
  }
  return output;
}
function arrayProof(before, after) {
  const left = collectArrays(before).sort((a, b) => a.path.localeCompare(b.path));
  const right = collectArrays(after).sort((a, b) => a.path.localeCompare(b.path));
  return { unchanged: sameValue(left, right), arrays: Object.freeze(right.map((item) => deepFreeze(item))) };
}
function entityShape(snapshot) {
  const byId = new Map((snapshot?.entityIndex ?? []).map((entry) => [entry.entityId, entry.canonicalPath]));
  return Object.freeze((snapshot?.entityIndex ?? []).map((entry) => deepFreeze({
    canonicalPath: entry.canonicalPath, entityKind: entry.entityKind, identity: entry.identity,
    parentCanonicalPath: byId.get(entry.parentEntityId) ?? null,
  })).sort((a, b) => a.canonicalPath.localeCompare(b.canonicalPath)));
}
function envelopeEvidence(snapshot) {
  const value = snapshot.parsedValue;
  if (Array.isArray(value)) return { rootKind: snapshot.rootKind, profile: snapshot.profile, rootKeys: [] };
  const evidence = { rootKind: snapshot.rootKind, profile: snapshot.profile, rootKeys: Object.keys(value) };
  for (const key of ['schema', 'metadata', 'coordinateSystem']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) evidence[key] = value[key];
  }
  return evidence;
}
function expectedChange(operation) {
  return operation.expectedTargetState === REVISION_COMPARE_TARGET_STATE.ABSENT ? 'ADDED' : 'REPLACED';
}
function reconcileChanges(changes, validatedOperations) {
  const expected = new Map(validatedOperations.map((entry) => [entry.absoluteFieldPath, entry.operation]));
  const errors = [];
  if (changes.length !== expected.size) errors.push('Actual semantic mutation count does not match the plan.');
  for (const change of changes) {
    const operation = expected.get(change.path);
    if (!operation) { errors.push(`Unrelated mutation detected at ${change.path}.`); continue; }
    if (change.kind !== expectedChange(operation)) errors.push(`Mutation kind does not match ${operation.operationId}.`);
    if (operation.expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT
        && !sameValue(change.before.value, operation.beforeValue)) errors.push(`Before value mismatch for ${operation.operationId}.`);
    if (!sameValue(change.after.value, operation.afterValue)) errors.push(`After value mismatch for ${operation.operationId}.`);
    expected.delete(change.path);
  }
  for (const operation of expected.values()) errors.push(`Plan operation ${operation.operationId} produced no mutation.`);
  return Object.freeze(errors);
}
function auditRows(validatedOperations, changes) {
  const byPath = new Map(changes.map((change) => [change.path, change]));
  return Object.freeze(validatedOperations.map((entry) => {
    const operation = entry.operation; const change = byPath.get(entry.absoluteFieldPath);
    const row = {
      operationId: operation.operationId, sourceEntityId: operation.sourceEntityId,
      targetEntityId: operation.targetEntityId, targetCanonicalPath: operation.targetCanonicalPath,
      fieldPath: operation.fieldPath, operationType: operation.operationType,
      expectedTargetState: operation.expectedTargetState, proposedValue: operation.afterValue,
      actualValue: change?.after?.value, status: 'APPLIED', reason: 'Verified exact planned mutation.',
      evidenceReferences: operation.evidenceReferences,
    };
    if (operation.expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT) row.beforeValue = operation.beforeValue;
    return deepFreeze(row);
  }));
}
async function artifactIdentity(prefix, material, cryptoRef) {
  const contentSha256 = await sha256Text(stableStringify(material), cryptoRef);
  return { contentSha256, id: `${prefix}${contentSha256}` };
}
async function createAudit(plan, rows, createdAt, cryptoRef) {
  const material = {
    schema: REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA, planId: plan.planId,
    planContentSha256: plan.contentSha256, createdAt, rows,
    summary: { operationCount: rows.length, appliedCount: rows.length, skippedCount: 0, blockedCount: 0 },
    status: 'READY', errors: Object.freeze([]),
  };
  const identity = await artifactIdentity(AUDIT_PREFIX, material, cryptoRef);
  return deepFreeze({ ...material, auditId: identity.id, contentSha256: identity.contentSha256 });
}
async function createProof(input, changes, errors, keyOrder, arrays, cryptoRef) {
  const planText = serializeRevisionCompareTransferPlan(input.plan);
  const serializedPlanSha256 = await sha256Text(planText, cryptoRef);
  const originalEntities = entityShape(input.originalSnapshot); const patchedEntities = entityShape(input.patchedSnapshot);
  const envelopeUnchanged = sameValue(envelopeEvidence(input.originalSnapshot), envelopeEvidence(input.patchedSnapshot));
  const rootProfile = input.originalSnapshot.rootKind === input.patchedSnapshot.rootKind
    && input.originalSnapshot.profile === input.patchedSnapshot.profile;
  const entityCount = originalEntities.length === patchedEntities.length;
  const entityIdentity = sameValue(originalEntities, patchedEntities);
  const proofErrors = [...errors];
  if (!rootProfile) proofErrors.push('Patched target root kind or profile changed.');
  if (!entityCount) proofErrors.push('Patched target entity count changed.');
  if (!entityIdentity) proofErrors.push('Patched target entity identities or hierarchy changed.');
  if (!envelopeUnchanged) proofErrors.push('Patched target schema or envelope evidence changed.');
  const frozenErrors = Object.freeze([...new Set(proofErrors)]);
  const material = {
    schema: REVISION_COMPARE_TRANSFER_PROOF_SCHEMA, planId: input.plan.planId,
    planContentSha256: input.plan.contentSha256, serializedPlanSha256,
    originalTargetDocumentId: input.originalSnapshot.sourceDocumentId,
    originalTargetSha256: input.originalSnapshot.sourceContentSha256,
    patchedTargetDocumentId: input.patchedSnapshot.sourceDocumentId,
    patchedTargetSha256: input.patchedSnapshot.sourceContentSha256,
    createdAt: input.createdAt, actualChanges: Object.freeze(changes),
    invariants: deepFreeze({
      jsonReparseSucceeded: true, supportedRootAndProfile: rootProfile,
      operationReconciliation: frozenErrors.length === 0, protectedFieldsUnchanged: frozenErrors.length === 0,
      entityCountUnchanged: entityCount, entityIdentitiesUnchanged: entityIdentity,
      arrayLengthsAndOrderUnchanged: arrays.unchanged && frozenErrors.length === 0,
      hierarchyAndTopologyUnchanged: entityIdentity && frozenErrors.length === 0,
      schemaAndEnvelopeUnchanged: envelopeUnchanged, unknownFieldsRetained: frozenErrors.length === 0,
      unselectedValuesUnchanged: frozenErrors.length === 0, objectKeyOrderPreserved: keyOrder.unchanged,
      everyMutationCoveredExactlyOnce: frozenErrors.length === 0,
    }),
    entityEvidence: deepFreeze({ original: originalEntities, patched: patchedEntities }),
    arrayEvidence: deepFreeze(arrays), objectKeyOrderEvidence: deepFreeze(keyOrder),
    status: frozenErrors.length ? 'BLOCKED' : 'READY', errors: frozenErrors,
  };
  const identity = await artifactIdentity(PROOF_PREFIX, material, cryptoRef);
  return deepFreeze({ ...material, proofId: identity.id, contentSha256: identity.contentSha256 });
}

export async function verifyRevisionCompareTransferApplication(input, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto;
  const changes = Object.freeze(discoverChanges(input.originalSnapshot.parsedValue, input.patchedSnapshot.parsedValue));
  const errors = [...reconcileChanges(changes, input.validatedOperations)];
  const keyOrder = objectKeyOrderProof(input.originalSnapshot.parsedValue, input.patchedSnapshot.parsedValue, input.validatedOperations);
  const arrays = arrayProof(input.originalSnapshot.parsedValue, input.patchedSnapshot.parsedValue);
  if (!keyOrder.unchanged) errors.push('Existing object-key order or deterministic append order changed.');
  if (!arrays.unchanged) errors.push('Array membership, length, or order changed.');
  const rows = auditRows(input.validatedOperations, changes);
  const audit = await createAudit(input.plan, rows, input.createdAt, cryptoRef);
  const proof = await createProof(input, changes, Object.freeze([...errors]), keyOrder, arrays, cryptoRef);
  if (proof.status !== 'READY') throw new Error(`Patched target verification failed: ${proof.errors.join(' ')}`);
  assertJsonSafe(audit, REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA);
  assertJsonSafe(proof, REVISION_COMPARE_TRANSFER_PROOF_SCHEMA);
  return deepFreeze({ audit, proof });
}

export const _test = Object.freeze({ arrayProof, discoverChanges, objectKeyOrderProof, reconcileChanges });
