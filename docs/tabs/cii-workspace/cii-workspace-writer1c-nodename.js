const APPROVED = new Set(['REVIEWED', 'LOCKED']);
const POLICY = 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function isNodeNameCopy(operation) {
  return operation?.family === 'NODE_NAME'
    && operation?.property === 'Node name / to-name'
    && operation?.action === 'COPY';
}
function isWriter1CSifCopy(operation) {
  return operation?.family === 'SIF_TEE' && operation?.action === 'COPY'
    && ['CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK', 'CII_WRITER_1C_SIF_OUT_PLANE_EXISTING_BLOCK'].includes(operation?.policyAuthority);
}
function noMutation(operation) {
  return operation?.action === 'KEEP' && ['PREVIEW_READY', 'PROTECTED'].includes(operation?.status);
}
function targetNodeId(operation) {
  return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId);
}
function canonicalField(value, width) {
  const normalized = text(value);
  for (const char of normalized) {
    if (char.codePointAt(0) > 0x7f) return { error: 'WRITER_1C_NODENAME_NON_ASCII' };
  }
  if (normalized.length > width) return { error: 'WRITER_1C_NODENAME_FIELD_OVERFLOW' };
  return { value: normalized.padEnd(width, ' '), semantic: normalized };
}
function spanEntries(custody) {
  return Object.entries(custody?.bySpan || {}).map(([key, span]) => ({ key, span }));
}
function spansForNode(custody, nodeId) {
  return spanEntries(custody).filter(({ span }) => (span?.owners || []).some((owner) => String(owner.nodeId) === String(nodeId)));
}
function pointerZeroTouchesNode(custody, nodeId) {
  return Object.values(custody?.byElementIndex || {}).some((item) => item?.pointer === 0
    && [String(item?.from || ''), String(item?.to || '')].includes(String(nodeId)));
}
function operationMap(operations) {
  const out = new Map();
  for (const operation of operations) {
    const nodeId = targetNodeId(operation);
    if (nodeId) out.set(nodeId, operation);
  }
  return out;
}
function pushBlocker(blockers, code, operation, detail = '') {
  const suffix = [operationId(operation), detail].filter(Boolean).join(':');
  blockers.push(suffix ? `${code}:${suffix}` : code);
}
function validateOperation(operation, blockers) {
  if (noMutation(operation) || isWriter1CSifCopy(operation)) return false;
  if (!isNodeNameCopy(operation)) {
    pushBlocker(blockers, 'WRITER_1C_UNSUPPORTED_OPERATION', operation,
      `${operation?.family || 'UNKNOWN'}:${operation?.property || 'UNKNOWN'}:${operation?.action || 'UNKNOWN'}`);
    return false;
  }
  if (operation?.status !== 'PREVIEW_READY') pushBlocker(blockers, 'WRITER_1C_OPERATION_NOT_PREVIEW_READY', operation);
  if (!APPROVED.has(operation?.matchAuthority?.status)) pushBlocker(blockers, 'WRITER_1C_APPROVAL_REQUIRED', operation);
  if (operation?.scopeDecision !== 'APPLY') pushBlocker(blockers, 'WRITER_1C_EXPLICIT_APPLY_REQUIRED', operation);
  if (operation?.policyAuthority !== POLICY) pushBlocker(blockers, 'WRITER_1C_NODENAME_POLICY_AUTHORITY_REQUIRED', operation);
  if (!targetNodeId(operation)) pushBlocker(blockers, 'WRITER_1C_NODENAME_TARGET_NODE_REQUIRED', operation);
  return true;
}
function claimForSpan(operation, key, span, blockers) {
  const encoded = canonicalField(operation?.proposed, Number(span?.width));
  if (encoded.error) { pushBlocker(blockers, encoded.error, operation, key); return null; }
  if (text(span?.value) !== text(operation?.before)) {
    pushBlocker(blockers, 'WRITER_1C_NODENAME_PREIMAGE_MISMATCH', operation, key); return null;
  }
  return Object.freeze({
    spanKey: key, byteStart: Number(span.byteStart), byteEnd: Number(span.byteEnd), width: Number(span.width),
    lineNumber: Number(span.lineNumber), startColumn: Number(span.startColumn), endColumn: Number(span.endColumn),
    fieldIdentity: span.fieldIdentity, section: 'NODENAME', beforeField: span.rawField, afterField: encoded.value,
    semanticBefore: text(span.value), semanticAfter: encoded.semantic, operationId: operationId(operation),
    targetNodeId: targetNodeId(operation), owners: span.owners || Object.freeze([]),
  });
}
function arbitrateClaims(claims, operationsByNode, blockers) {
  const grouped = new Map();
  for (const claim of claims) {
    if (!grouped.has(claim.spanKey)) grouped.set(claim.spanKey, []);
    grouped.get(claim.spanKey).push(claim);
  }
  const mutations = [];
  for (const [spanKey, group] of grouped) {
    const before = new Set(group.map((claim) => claim.beforeField));
    const after = new Set(group.map((claim) => claim.afterField));
    if (before.size !== 1 || after.size !== 1) {
      blockers.push(`WRITER_1C_NODENAME_SHARED_RECORD_CONFLICT:${spanKey}`); continue;
    }
    const ownerNodes = [...new Set(group[0].owners.map((owner) => String(owner.nodeId)))];
    const requested = ownerNodes.map((nodeId) => operationsByNode.get(nodeId)).filter(Boolean);
    const unselected = ownerNodes.filter((nodeId) => !operationsByNode.has(nodeId));
    if (unselected.length && group[0].beforeField !== group[0].afterField) {
      blockers.push(`WRITER_1C_NODENAME_UNAPPROVED_ALIAS_EFFECT:${spanKey}:${unselected.join(',')}`); continue;
    }
    const requestedAfter = new Set(requested.map((operation) => canonicalField(operation.proposed, group[0].width).value));
    if (requestedAfter.size > 1) {
      blockers.push(`WRITER_1C_NODENAME_SHARED_RECORD_CONFLICT:${spanKey}`); continue;
    }
    mutations.push(Object.freeze({
      ...group[0], operationIds: Object.freeze([...new Set(group.map((claim) => claim.operationId))].sort()),
      targetNodeIds: Object.freeze([...new Set(group.map((claim) => claim.targetNodeId))].sort()),
    }));
  }
  return mutations.sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
}

export function buildWriter1CNodeNamePlan({ transferPlan, targetDocument, allowEmpty = false }) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_1C_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if (transferPlan?.transferScope?.status !== 'BOUND') blockers.push('WRITER_1C_BOUND_TRANSFER_SCOPE_REQUIRED');
  const mutable = []; const operations = transferPlan?.operations || [];
  for (const operation of operations) if (validateOperation(operation, blockers)) mutable.push(operation);
  const custody = targetDocument?.nodeNameEvidence?.physicalCustody;
  if (mutable.length) {
    if (targetDocument?.writer1CByteEligible !== true) blockers.push('WRITER_1C_ORIGINAL_BYTE_CUSTODY_REQUIRED');
    if (custody?.status !== 'QUALIFIED') blockers.push(...(custody?.blockers || ['WRITER_1C_NODENAME_PHYSICAL_CUSTODY_REQUIRED']));
  }
  const byNode = operationMap(mutable); const claims = [];
  for (const operation of mutable) {
    const nodeId = targetNodeId(operation); const spans = spansForNode(custody, nodeId);
    if (!spans.length) {
      if (pointerZeroTouchesNode(custody, nodeId)) {
        pushBlocker(blockers, 'WRITER_1C_NODENAME_POINTER_REQUIRED', operation);
        pushBlocker(blockers, 'WRITER_1C_NODENAME_CREATE_REQUIRES_WRITER_2', operation);
      } else pushBlocker(blockers, 'WRITER_1C_NODENAME_ROW_OUT_OF_RANGE', operation);
      continue;
    }
    for (const { key, span } of spans) {
      const claim = claimForSpan(operation, key, span, blockers); if (claim) claims.push(claim);
    }
  }
  const mutations = arbitrateClaims(claims, byNode, blockers);
  if (!allowEmpty && !mutations.length) blockers.push('WRITER_1C_NO_MUTATIONS');
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CNodeNamePlan.v1', status: blockers.length ? 'BLOCKED' : 'READY', ready: blockers.length === 0,
    mutationCount: mutations.length, mutations: Object.freeze(mutations), blockers: Object.freeze([...new Set(blockers)]),
  });
}

export const CII_WRITER_1C_NODENAME_POLICY = POLICY;
