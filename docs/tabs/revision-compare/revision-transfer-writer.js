/** Atomic deterministic writer for READY Revision Compare transfer plans. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { createRevisionCompareJsonDocumentSnapshot } from './revision-json-document.js';
import {
  resolveRevisionCompareTransferAddress,
  REVISION_COMPARE_TARGET_STATE,
} from './revision-transfer-address.js';
import {
  captureRevisionCompareTransferAuthority, revisionCompareTransferPlanAuthority,
  REVISION_COMPARE_TRANSFER_OPERATION_TYPE, REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX,
  REVISION_COMPARE_TRANSFER_PLAN_SCHEMA,
} from './revision-transfer-contracts.js';
import {
  classifyRevisionCompareTransferField,
  REVISION_COMPARE_TRANSFER_POLICY,
} from './revision-transfer-policy.js';

export const REVISION_COMPARE_PATCHED_TARGET_SCHEMA = 'RevisionComparePatchedTarget.v1';
export const REVISION_COMPARE_TRANSFER_WRITER_POLICY = deepFreeze({
  schema: 'RevisionCompareTransferWriterPolicy.v1', indentationSpaces: 2,
  finalNewlineCount: 1, preserveObjectKeyOrder: true, preserveArrayOrder: true,
  appendMissingKeysInPlanOrder: true, scalarPropertiesOnly: true,
});
const SUPPORTED = Object.freeze(Object.values(REVISION_COMPARE_TRANSFER_OPERATION_TYPE));

function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, cloneJson(value[key])]));
  }
  return value;
}
function decodePointerToken(value) { return String(value).replace(/~1/g, '/').replace(/~0/g, '~'); }
function pointerParts(path) {
  const value = String(path ?? '');
  if (!value.startsWith('/') || value === '/') throw new TypeError('A non-root JSON Pointer is required.');
  return value.slice(1).split('/').map(decodePointerToken);
}
function own(value, key) {
  return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}
function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function scalar(value) {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}
function sameValue(left, right) { return stableStringify(left) === stableStringify(right); }
function snapshotFor(workspace, slotId) { return workspace?.slots?.[slotId]?.jsonSnapshot ?? null; }

function currentPlan(workspace) {
  const transfer = workspace?.transfer;
  const plan = transfer?.plan;
  if (!['PLANNED', 'APPLYING'].includes(transfer?.status)) {
    throw new Error('Transfer apply requires a current PLANNED or APPLYING transfer state.');
  }
  if (transfer.status === 'APPLYING' && (!transfer.applyRequest
      || transfer.applyRequest.planId !== plan?.planId
      || transfer.applyRequest.planContentSha256 !== plan?.contentSha256)) {
    throw new Error('Active transfer apply request does not match the retained plan.');
  }
  if (plan?.schema !== REVISION_COMPARE_TRANSFER_PLAN_SCHEMA || plan.status !== 'READY') {
    throw new Error('Transfer apply requires one current READY RevisionCompareTransferPlan.v1.');
  }
  if (!sameValue(transfer.selection, plan.selection) || transfer.policyVersion !== plan.policyVersion) {
    throw new Error('Current transfer selection or policy does not match the retained plan.');
  }
  if (transfer.sourceDocumentId !== plan.sourceDocument?.documentId
      || transfer.sourceDocumentSha256 !== plan.sourceDocument?.contentSha256
      || transfer.targetDocumentId !== plan.receiverDocument?.documentId
      || transfer.targetDocumentSha256 !== plan.receiverDocument?.contentSha256) {
    throw new Error('Retained transfer state document authority does not match the plan.');
  }
  const liveAuthority = captureRevisionCompareTransferAuthority(workspace);
  if (!sameValue(liveAuthority, revisionCompareTransferPlanAuthority(plan))) {
    throw new Error('Transfer plan authority is stale for the current workspace.');
  }
  return plan;
}

async function assertPlanIntegrity(plan, cryptoRef) {
  const { planId, contentSha256, ...material } = plan;
  const actual = await sha256Text(stableStringify(material), cryptoRef);
  if (actual !== contentSha256 || planId !== `${REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX}${actual}`) {
    throw new Error('Transfer plan identity or content SHA-256 is invalid.');
  }
}
function documentBlockers(plan, revA, revB) {
  const blockers = [];
  if (!revA || plan.sourceDocument?.documentId !== revA.sourceDocumentId
      || plan.sourceDocument?.contentSha256 !== revA.sourceContentSha256) {
    blockers.push('Current Rev A snapshot does not match the transfer plan.');
  }
  if (!revB || plan.receiverDocument?.documentId !== revB.sourceDocumentId
      || plan.receiverDocument?.contentSha256 !== revB.sourceContentSha256) {
    blockers.push('Current Rev B snapshot does not match the transfer plan.');
  }
  return blockers;
}
function operationTypeBlockers(operation) {
  const blockers = [];
  if (operation?.status !== 'READY' || operation.blockers?.length) blockers.push('Operation is not READY.');
  if (!SUPPORTED.includes(operation?.operationType)) blockers.push('Operation type is unsupported.');
  if (!scalar(operation?.afterValue)) blockers.push('Transfer writer v1 supports scalar property values only.');
  if (operation.operationType === REVISION_COMPARE_TRANSFER_OPERATION_TYPE.REPLACE_EXISTING_PROPERTY
      && operation.expectedTargetState !== REVISION_COMPARE_TARGET_STATE.PRESENT) {
    blockers.push('REPLACE_EXISTING_PROPERTY requires PRESENT target state.');
  }
  if (operation.operationType === REVISION_COMPARE_TRANSFER_OPERATION_TYPE.ADD_MISSING_PROPERTY
      && operation.expectedTargetState !== REVISION_COMPARE_TARGET_STATE.ABSENT) {
    blockers.push('ADD_MISSING_PROPERTY requires ABSENT target state.');
  }
  return blockers;
}
function operationIdentityBlockers(operation, plan) {
  const blockers = [];
  if (operation.sourceDocumentId !== plan.sourceDocument.documentId
      || operation.sourceDocumentSha256 !== plan.sourceDocument.contentSha256) {
    blockers.push('Operation source authority does not match the plan.');
  }
  if (operation.targetDocumentId !== plan.receiverDocument.documentId
      || operation.targetDocumentSha256 !== plan.receiverDocument.contentSha256) {
    blockers.push('Operation target authority does not match the plan.');
  }
  if (operation.targetAddress?.targetEntityId !== operation.targetEntityId
      || operation.targetAddress?.entityCanonicalPath !== operation.targetCanonicalPath
      || operation.targetAddress?.fieldPath !== operation.fieldPath) {
    blockers.push('Operation target address does not match operation identity.');
  }
  return blockers;
}
function policyBlockers(operation) {
  const propertyKey = operation?.transferPolicy?.propertyKey;
  const decision = classifyRevisionCompareTransferField({
    propertyKey, fieldPath: operation?.fieldPath,
  }, REVISION_COMPARE_TRANSFER_POLICY);
  const blockers = [...decision.blockers];
  if (!decision.writable || operation?.transferPolicy?.policyVersion !== decision.policyVersion) {
    if (!blockers.length) blockers.push('Operation transfer policy no longer permits the field path.');
  }
  return blockers;
}
function addressBlockers(operation, snapshot) {
  const resolution = resolveRevisionCompareTransferAddress(snapshot, operation.targetAddress);
  const blockers = [...resolution.blockers];
  if (resolution.status === 'READY' && operation.expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT
      && !sameValue(resolution.value, operation.beforeValue)) {
    blockers.push('Operation beforeValue does not match the current target value.');
  }
  return { resolution, blockers };
}
function validateOperation(operation, plan, snapshot, index) {
  const blockers = [
    ...operationTypeBlockers(operation),
    ...operationIdentityBlockers(operation, plan),
    ...policyBlockers(operation),
  ];
  const addressed = addressBlockers(operation, snapshot);
  blockers.push(...addressed.blockers);
  if (blockers.length) {
    throw new Error(`Transfer operation ${index + 1} (${operation?.operationId ?? 'unknown'}) is blocked: ${[...new Set(blockers)].join(' ')}`);
  }
  return deepFreeze({ operation, absoluteFieldPath: addressed.resolution.absoluteFieldPath });
}
function preflightOperations(plan, snapshot) {
  if (!plan.operations?.length) throw new Error('Transfer plan contains no operations.');
  const validated = plan.operations.map((operation, index) => validateOperation(operation, plan, snapshot, index));
  const paths = validated.map((entry) => entry.absoluteFieldPath);
  const ids = validated.map((entry) => entry.operation.operationId);
  if (new Set(ids).size !== ids.length) throw new Error('Transfer plan contains duplicate operation IDs.');
  if (new Set(paths).size !== paths.length) throw new Error('Transfer plan contains duplicate target field addresses.');
  return Object.freeze(validated);
}
function mutableParent(root, absolutePath) {
  const parts = pointerParts(absolutePath); const key = parts.pop(); let current = root;
  for (const part of parts) {
    if (!own(current, part)) throw new Error(`Validated target parent disappeared at ${absolutePath}.`);
    current = current[part];
  }
  if (!plainObject(current)) throw new Error(`Validated target parent is not an object at ${absolutePath}.`);
  return { parent: current, key };
}
function applyValidatedOperation(root, entry) {
  const { operation } = entry; const location = mutableParent(root, entry.absoluteFieldPath);
  const present = own(location.parent, location.key);
  if (operation.expectedTargetState === REVISION_COMPARE_TARGET_STATE.PRESENT && !present) {
    throw new Error(`Target field became absent before apply: ${entry.absoluteFieldPath}.`);
  }
  if (operation.expectedTargetState === REVISION_COMPARE_TARGET_STATE.ABSENT && present) {
    throw new Error(`Target field became present before apply: ${entry.absoluteFieldPath}.`);
  }
  location.parent[location.key] = cloneJson(operation.afterValue);
}
function serializePatchedTarget(value) {
  return `${JSON.stringify(value, null, REVISION_COMPARE_TRANSFER_WRITER_POLICY.indentationSpaces)}\n`;
}
function patchedDocumentId(plan, contentSha256) {
  return `revision-patched:${plan.receiverDocument.documentId}:${contentSha256}`;
}

export async function writeRevisionComparePatchedTarget(workspace, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto; const plan = currentPlan(workspace);
  await assertPlanIntegrity(plan, cryptoRef);
  const revA = snapshotFor(workspace, 'baseline'); const revB = snapshotFor(workspace, 'candidate');
  const blockers = documentBlockers(plan, revA, revB);
  if (blockers.length) throw new Error(blockers.join(' '));
  const validated = preflightOperations(plan, revB); const mutable = cloneJson(revB.parsedValue);
  validated.forEach((entry) => applyValidatedOperation(mutable, entry));
  const patchedTargetText = serializePatchedTarget(mutable); const reparsed = JSON.parse(patchedTargetText);
  const patchedTargetSha256 = await sha256Text(patchedTargetText, cryptoRef);
  const patchedTargetDocumentId = patchedDocumentId(plan, patchedTargetSha256);
  const patchedSnapshot = await createRevisionCompareJsonDocumentSnapshot({
    side: 'REV_B', sourceDocumentId: patchedTargetDocumentId,
    sourceContentSha256: patchedTargetSha256, fileName: revB.fileName,
    profile: revB.profile, parsedValue: reparsed,
  }, cryptoRef);
  const output = deepFreeze({
    schema: REVISION_COMPARE_PATCHED_TARGET_SCHEMA, plan, originalSnapshot: revB,
    patchedSnapshot, patchedTargetText, patchedTargetSha256, patchedTargetDocumentId,
    validatedOperations: validated, writerPolicy: REVISION_COMPARE_TRANSFER_WRITER_POLICY,
  });
  assertJsonSafe(output, REVISION_COMPARE_PATCHED_TARGET_SCHEMA); return output;
}

export const _test = Object.freeze({ cloneJson, mutableParent, preflightOperations, serializePatchedTarget });
