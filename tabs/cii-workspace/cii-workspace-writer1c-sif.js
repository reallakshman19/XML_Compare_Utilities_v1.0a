import { formatCiiWriterSig6 } from './cii-workspace-target-writer.js';

const APPROVED = new Set(['REVIEWED', 'LOCKED']);
export const CII_WRITER_1C_SIF_IN_PLANE_POLICY = 'CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK';
export const CII_WRITER_1C_SIF_OUT_PLANE_POLICY = 'CII_WRITER_1C_SIF_OUT_PLANE_EXISTING_BLOCK';
const POLICIES = new Set([CII_WRITER_1C_SIF_IN_PLANE_POLICY, CII_WRITER_1C_SIF_OUT_PLANE_POLICY]);
const DELTA_AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
const SIF_CONTEXT_AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function explicitFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function normalizedCode(value) { return text(value).replace(/\s+/g, ' ').toUpperCase(); }
function noMutation(operation) { return operation?.action === 'KEEP' && ['PREVIEW_READY', 'PROTECTED'].includes(operation?.status); }
function isNodeNameCopy(operation) {
  return operation?.family === 'NODE_NAME' && operation?.property === 'Node name / to-name' && operation?.action === 'COPY';
}
function isSifCopy(operation) {
  return operation?.family === 'SIF_TEE' && operation?.action === 'COPY' && POLICIES.has(operation?.policyAuthority);
}
function pushBlocker(blockers, code, operation, detail = '') {
  const suffix = [operationId(operation), detail].filter(Boolean).join(':');
  blockers.push(suffix ? `${code}:${suffix}` : code);
}
function sameNumber(left, right) {
  if (!explicitFiniteNumber(left) || !explicitFiniteNumber(right)) return false;
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-12);
}
function ownerKey(parsedElementIndex, slot, item) { return `${Number(parsedElementIndex)}|${Number(slot)}|${Number(item)}`; }
function operationOwnerKey(operation) {
  const field = operation?.sifField || {};
  return ownerKey(field.targetParsedElementIndex, field.slot, field.item);
}
function expectedField(operation) {
  const policy = operation?.policyAuthority; const field = operation?.sifField || {};
  if (policy === CII_WRITER_1C_SIF_IN_PLANE_POLICY && field.fieldKey === 'ii' && Number(field.item) === 3) return 'ii';
  if (policy === CII_WRITER_1C_SIF_OUT_PLANE_POLICY && field.fieldKey === 'io' && Number(field.item) === 4) return 'io';
  return null;
}
function validateCodeContext(operation, blockers) {
  const context = operation?.sifContext || {};
  const sourceCode = normalizedCode(context.sourceCode); const targetCode = normalizedCode(context.targetCode);
  if (context.status !== 'QUALIFIED') pushBlocker(blockers, 'WRITER_1C_SIF_CODE_CONTEXT_STATUS_REQUIRED', operation);
  if (context.authority !== SIF_CONTEXT_AUTHORITY) pushBlocker(blockers, 'WRITER_1C_SIF_CODE_CONTEXT_AUTHORITY_REQUIRED', operation);
  if (!sourceCode || !targetCode) pushBlocker(blockers, 'WRITER_1C_SIF_CODE_CONTEXT_VALUES_REQUIRED', operation);
  else if (sourceCode !== targetCode) pushBlocker(blockers, 'WRITER_1C_SIF_CODE_CONTEXT_MISMATCH', operation, `${sourceCode}:${targetCode}`);
}
function validateOperation(operation, blockers) {
  if (noMutation(operation) || isNodeNameCopy(operation)) return false;
  if (!isSifCopy(operation)) {
    pushBlocker(blockers, 'WRITER_1C_UNSUPPORTED_OPERATION', operation,
      `${operation?.family || 'UNKNOWN'}:${operation?.property || 'UNKNOWN'}:${operation?.action || 'UNKNOWN'}`);
    return false;
  }
  if (operation?.status !== 'PREVIEW_READY') pushBlocker(blockers, 'WRITER_1C_SIF_OPERATION_NOT_PREVIEW_READY', operation);
  if (!APPROVED.has(operation?.matchAuthority?.status)) pushBlocker(blockers, 'WRITER_1C_SIF_APPROVAL_REQUIRED', operation);
  if (operation?.scopeDecision !== 'APPLY') pushBlocker(blockers, 'WRITER_1C_SIF_EXPLICIT_APPLY_REQUIRED', operation);
  if (!String(operation?.sourceEvidence?.authority || '').includes(DELTA_AUTHORITY)) pushBlocker(blockers, 'WRITER_1C_SIF_FIELD_AUTHORITY_REQUIRED', operation);
  if (!expectedField(operation)) pushBlocker(blockers, 'WRITER_1C_SIF_POLICY_FIELD_MISMATCH', operation);
  validateCodeContext(operation, blockers);
  const before = operation?.before; const proposed = operation?.proposed;
  if (!explicitFiniteNumber(before) || before < 1.0 || !explicitFiniteNumber(proposed) || proposed < 1.0) {
    pushBlocker(blockers, 'WRITER_1C_SIF_VALUE_DOMAIN_EXPLICIT_GE_1_REQUIRED', operation);
  }
  const sourceType = operation?.sifField?.sourceType; const targetType = operation?.sifField?.targetType;
  if (!explicitFiniteNumber(sourceType) || !explicitFiniteNumber(targetType)) pushBlocker(blockers, 'WRITER_1C_SIF_TYPE_CONTEXT_REQUIRED', operation);
  else if (sourceType !== targetType) pushBlocker(blockers, 'WRITER_1C_SIF_TYPE_CONTEXT_MISMATCH', operation);
  return true;
}
function actualTargetField(operation, targetDocument, blockers) {
  const custody = targetDocument?.sifWriter1CEvidence; const meta = operation?.sifField || {};
  const parsedElementIndex = Number(meta.targetParsedElementIndex); const binding = custody?.byParsedElementIndex?.[String(parsedElementIndex)];
  if (!binding || binding.bindingAuthority !== 'EXACT_PARSED_INDEX_AND_ENDPOINTS') {
    pushBlocker(blockers, 'WRITER_1C_SIF_TARGET_ELEMENT_CUSTODY_MISMATCH', operation, String(parsedElementIndex)); return null;
  }
  if (Number(binding.pointer) !== Number(meta.targetPointer) || Number(binding.pointer) <= 0) {
    pushBlocker(blockers, 'WRITER_1C_SIF_POINTER_MISMATCH', operation, `${binding.pointer}:${meta.targetPointer}`); return null;
  }
  const block = custody?.byPointer?.[String(binding.pointer)]; const slot = block?.slots?.[Number(meta.slot)]; const fieldKey = expectedField(operation);
  const field = fieldKey ? slot?.[fieldKey] : null;
  if (!slot || !field?.qualified) { pushBlocker(blockers, 'WRITER_1C_SIF_FIELD_SPAN_REQUIRED', operation); return null; }
  if (Number(field.item) !== Number(meta.item)) { pushBlocker(blockers, 'WRITER_1C_SIF_ITEM_MISMATCH', operation); return null; }
  if (String(slot.node) !== String(meta.targetNode)) { pushBlocker(blockers, 'WRITER_1C_SIF_NODE_CONTEXT_MISMATCH', operation); return null; }
  const actualType = slot.type; const sourceType = meta.sourceType; const targetType = meta.targetType;
  if (!explicitFiniteNumber(actualType) || !explicitFiniteNumber(sourceType) || !explicitFiniteNumber(targetType)) {
    pushBlocker(blockers, 'WRITER_1C_SIF_TYPE_CONTEXT_REQUIRED', operation); return null;
  }
  if (actualType !== targetType || sourceType !== targetType) {
    pushBlocker(blockers, 'WRITER_1C_SIF_TYPE_CONTEXT_MISMATCH', operation); return null;
  }
  if (meta.nodeMappingQualified !== true) { pushBlocker(blockers, 'WRITER_1C_SIF_NODE_MAPPING_REQUIRED', operation); return null; }
  if (Number(meta.sourceNeutralVersion) !== 11 || Number(meta.targetNeutralVersion) !== 11 || Number(custody?.neutralVersion?.major) !== 11) {
    pushBlocker(blockers, 'WRITER_1C_SIF_NEUTRAL_VERSION_11_REQUIRED', operation); return null;
  }
  if (!sameNumber(field.numericValue, operation.before)) {
    pushBlocker(blockers, 'WRITER_1C_SIF_PREIMAGE_MISMATCH', operation, `${binding.pointer}:${meta.slot}:${meta.item}`); return null;
  }
  return { custody, binding, block, slot, field, fieldKey };
}
function claimForOperation(operation, targetDocument, blockers) {
  const actual = actualTargetField(operation, targetDocument, blockers); if (!actual) return null;
  const token = formatCiiWriterSig6(operation.proposed); const width = Number(actual.field.width);
  if (token.length > width) { pushBlocker(blockers, 'WRITER_1C_SIF_FIELD_OVERFLOW', operation); return null; }
  const afterField = token.padStart(width, ' '); const spanKey = `${actual.field.byteStart}:${actual.field.byteEnd}`;
  const span = actual.custody?.bySpan?.[spanKey];
  if (!span) { pushBlocker(blockers, 'WRITER_1C_SIF_AUTHORIZED_SPAN_MISSING', operation, spanKey); return null; }
  return Object.freeze({
    spanKey, byteStart: Number(actual.field.byteStart), byteEnd: Number(actual.field.byteEnd), width,
    lineNumber: Number(actual.field.lineNumber), startColumn: Number(actual.field.start), endColumn: Number(actual.field.end),
    section: 'SIF&TEES', fieldIdentity: actual.field.fieldIdentity, fieldKey: actual.fieldKey,
    pointer: Number(actual.binding.pointer), slot: Number(operation.sifField.slot), item: Number(operation.sifField.item),
    parsedElementIndex: Number(operation.sifField.targetParsedElementIndex),
    beforeField: actual.field.rawField, afterField, before: actual.field.numericValue, proposed: operation.proposed,
    operationId: operationId(operation), owners: span.owners || Object.freeze([]),
    sifContext: operation.sifContext,
  });
}
function arbitrateClaims(claims, selectedOperations, blockers) {
  const grouped = new Map();
  for (const claim of claims) {
    if (!grouped.has(claim.spanKey)) grouped.set(claim.spanKey, []);
    grouped.get(claim.spanKey).push(claim);
  }
  const operationsByOwner = new Map(selectedOperations.map((operation) => [operationOwnerKey(operation), operation]));
  const mutations = [];
  for (const [spanKey, group] of grouped) {
    const before = new Set(group.map((claim) => claim.beforeField)); const after = new Set(group.map((claim) => claim.afterField));
    if (before.size !== 1 || after.size !== 1) { blockers.push(`WRITER_1C_SIF_SHARED_RECORD_CONFLICT:${spanKey}`); continue; }
    const ownerKeys = [...new Set((group[0].owners || []).map((owner) => ownerKey(owner.parsedElementIndex, owner.slot, owner.item)))];
    const unselected = ownerKeys.filter((key) => !operationsByOwner.has(key));
    if (unselected.length && group[0].beforeField !== group[0].afterField) {
      blockers.push(`WRITER_1C_SIF_UNAPPROVED_ALIAS_EFFECT:${spanKey}:${unselected.join(',')}`); continue;
    }
    const selectedForSpan = ownerKeys.map((key) => operationsByOwner.get(key)).filter(Boolean);
    const requestedAfter = new Set(selectedForSpan.map((operation) => {
      const token = formatCiiWriterSig6(operation.proposed); return token.padStart(group[0].width, ' ');
    }));
    if (requestedAfter.size > 1) { blockers.push(`WRITER_1C_SIF_SHARED_RECORD_CONFLICT:${spanKey}`); continue; }
    mutations.push(Object.freeze({
      ...group[0], operationIds: Object.freeze([...new Set(group.map((claim) => claim.operationId))].sort()),
      ownerBindings: Object.freeze(group[0].owners || []),
    }));
  }
  return mutations.sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
}

export function buildWriter1CSifPlan({ transferPlan, targetDocument, allowEmpty = false }) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_1C_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if (transferPlan?.transferScope?.status !== 'BOUND') blockers.push('WRITER_1C_BOUND_TRANSFER_SCOPE_REQUIRED');
  const selected = [];
  for (const operation of transferPlan?.operations || []) if (validateOperation(operation, blockers)) selected.push(operation);
  const custody = targetDocument?.sifWriter1CEvidence;
  if (selected.length && custody?.status !== 'QUALIFIED') blockers.push(...(custody?.blockers || ['WRITER_1C_SIF_PHYSICAL_CUSTODY_REQUIRED']));
  const claims = selected.map((operation) => claimForOperation(operation, targetDocument, blockers)).filter(Boolean);
  const mutations = arbitrateClaims(claims, selected, blockers);
  if (!allowEmpty && !mutations.length) blockers.push('WRITER_1C_SIF_NO_MUTATIONS');
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CSifPlan.v1', status: blockers.length ? 'BLOCKED' : 'READY', ready: blockers.length === 0,
    mutationCount: mutations.length, mutations: Object.freeze(mutations), blockers: Object.freeze([...new Set(blockers)]),
  });
}

export function isWriter1CSifPolicyAuthority(value) { return POLICIES.has(value); }
