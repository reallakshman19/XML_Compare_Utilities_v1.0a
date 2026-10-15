import { deepFreeze } from './cii-workspace-contracts.js';

export const CII_WRITER_2_SIF_DELETE_POLICY = 'CII_WRITER_2_SIF_TEE_DELETE_RELOCATION';
export const CII_WRITER_2_SIF_CREATE_BLOCKER = 'WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30';

const SIF_PRESENCE_PROPERTY = 'SIF/Tee record presence';
const SIF_PRESENCE_AUTHORITY = 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD';
const APPROVED = new Set(['REVIEWED', 'LOCKED']);

function text(value) { return String(value ?? '').trim(); }
function bool(value) { return value === true; }
function edgeMap(graph) { return new Map((graph?.edges || []).map((edge) => [String(edge.elementId), edge])); }
function operationSummary(operations) {
  const byAction = {};
  for (const operation of operations || []) byAction[operation.action || 'UNKNOWN'] = (byAction[operation.action || 'UNKNOWN'] || 0) + 1;
  return deepFreeze({
    operationCount: (operations || []).length,
    previewReadyCount: (operations || []).filter((item) => item.status === 'PREVIEW_READY').length,
    blockedCount: (operations || []).filter((item) => item.status === 'BLOCKED').length,
    protectedCount: (operations || []).filter((item) => item.status === 'PROTECTED').length,
    byAction: deepFreeze(byAction),
  });
}
function presenceValues(operation) {
  return Object.freeze({
    source: bool(operation?.sourceEvidence?.value ?? operation?.proposed),
    target: bool(operation?.targetEvidence?.value ?? operation?.before),
  });
}
function routePresence(operation) {
  const values = presenceValues(operation); const blockers = [];
  if (!String(operation?.evidenceAuthority || operation?.sourceEvidence?.authority || '').includes(SIF_PRESENCE_AUTHORITY)) {
    blockers.push('WRITER_2_SIF_POINTER_PRESENCE_AUTHORITY_REQUIRED');
  }
  if (!values.source && values.target) {
    return deepFreeze({ ...operation, action: 'DELETE', status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY',
      blockers: deepFreeze(blockers), before: true, proposed: false, policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY });
  }
  if (values.source && !values.target) {
    blockers.push(CII_WRITER_2_SIF_CREATE_BLOCKER);
    return deepFreeze({ ...operation, action: 'CREATE', status: 'BLOCKED', blockers: deepFreeze(blockers),
      before: false, proposed: true, policyAuthority: CII_WRITER_2_SIF_DELETE_POLICY });
  }
  return deepFreeze({ ...operation, action: 'KEEP', status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY',
    blockers: deepFreeze(blockers), before: values.target, proposed: values.source });
}
function routeOperation(operation) {
  if (operation?.family === 'SIF_TEE' && operation?.property === SIF_PRESENCE_PROPERTY) return routePresence(operation);
  if (operation?.action === 'KEEP') return operation;
  return deepFreeze({ ...operation, action: 'BLOCKED', status: 'BLOCKED',
    blockers: deepFreeze([...new Set([...(operation?.blockers || []), 'WRITER_2_SIF_DELETE_PHASE_ONLY'])]) });
}

export function applyCiiWriter2SifDeletePlanContract(plan) {
  if (!plan) return plan;
  const operations = deepFreeze((plan.operations || []).map(routeOperation));
  const summary = operationSummary(operations);
  const deleteReady = operations.filter((item) => item.family === 'SIF_TEE' && item.property === SIF_PRESENCE_PROPERTY
    && item.action === 'DELETE' && item.status === 'PREVIEW_READY' && item.policyAuthority === CII_WRITER_2_SIF_DELETE_POLICY);
  const blockers = (plan.blockers || []).filter((item) => item !== 'NO_TRANSFERABLE_PREVIEW_OPERATIONS');
  if (!deleteReady.length) blockers.push('NO_WRITER_2_SIF_DELETE_TRANSFERABLE_OPERATIONS');
  const unique = deepFreeze([...new Set(blockers)]);
  return deepFreeze({ ...plan,
    mutationAuthority: unique.length ? 'BLOCKED' : 'WRITER_2_SIF_DELETE_RELOCATION_CONDITIONAL',
    operations, status: unique.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: unique, summary,
    policy: deepFreeze({ ...(plan.policy || {}), sifTeeMutation: 'V11_EXISTING_BLOCK_DELETE_REINDEX_ONLY',
      sifTeeCreate: 'BLOCKED_ITEMS_27_30_UNRESOLVED', hangerMutation: 'BLOCKED', topologyMutation: 'BLOCKED' }),
  });
}

function applyDeletes(plan) {
  return (plan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && operation?.family === 'SIF_TEE' && operation?.property === SIF_PRESENCE_PROPERTY
    && operation?.action === 'DELETE');
}
function targetElementId(operation, blockers) {
  const raw = text(operation?.targetEvidence?.identity);
  const ids = raw.split('|').map((item) => item.trim()).filter(Boolean);
  if (ids.length !== 1) {
    blockers.push(`WRITER_2_SIF_TARGET_ELEMENT_CARDINALITY_ONE_REQUIRED:${operation?.operationId || 'unknown'}:${ids.length}`);
    return null;
  }
  return ids[0];
}
function exactBindings(custody) {
  return Object.values(custody?.byParsedElementIndex || {}).filter((binding) => binding?.bindingAuthority === 'EXACT_PARSED_INDEX_AND_ENDPOINTS');
}
function pointerMapping(blockCount, deletedPointers) {
  const mapping = {}; let next = 1;
  for (let oldPointer = 1; oldPointer <= blockCount; oldPointer += 1) {
    if (deletedPointers.has(oldPointer)) mapping[oldPointer] = 0;
    else { mapping[oldPointer] = next; next += 1; }
  }
  return Object.freeze(mapping);
}

export function buildCiiWriter2SifDeleteRelocationPlan({ targetDocument, targetGraph, transferPlan }) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_2_SIF_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if (transferPlan?.transferScope?.status !== 'BOUND') blockers.push('WRITER_2_SIF_BOUND_TRANSFER_SCOPE_REQUIRED');
  if (targetDocument?.writer1CByteEligible !== true) blockers.push('WRITER_2_SIF_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  const custody = targetDocument?.sifWriter1CEvidence;
  if (custody?.status !== 'QUALIFIED') blockers.push('WRITER_2_SIF_EXACT_V11_PHYSICAL_CUSTODY_REQUIRED');
  if (Number(custody?.neutralVersion?.major) !== 11 || Number(custody?.blockRows) !== 10) blockers.push('WRITER_2_SIF_V11_10_ROW_BLOCK_REQUIRED');
  const blockCount = Number(custody?.controlBlockCount);
  if (!Number.isSafeInteger(blockCount) || blockCount < 0 || Number(custody?.sectionRowCount) !== blockCount * 10) {
    blockers.push('WRITER_2_SIF_CONTROL_CARDINALITY_AUTHORITY_REQUIRED');
  }

  const deletes = applyDeletes(transferPlan);
  const unsupported = (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && !(operation?.family === 'SIF_TEE' && operation?.property === SIF_PRESENCE_PROPERTY && operation?.action === 'DELETE'));
  for (const operation of unsupported) blockers.push(`WRITER_2_SIF_DELETE_UNSUPPORTED_APPLY:${operation?.operationId || 'unknown'}`);
  if (!deletes.length) blockers.push('WRITER_2_SIF_DELETE_NO_MUTATIONS');

  const edges = edgeMap(targetGraph); const selectedElements = new Set(); const deletionClaims = [];
  for (const operation of deletes) {
    const id = operation?.operationId || 'unknown';
    if (operation?.status !== 'PREVIEW_READY') blockers.push(`WRITER_2_SIF_DELETE_OPERATION_NOT_READY:${id}`);
    if (!APPROVED.has(operation?.matchAuthority?.status)) blockers.push(`WRITER_2_SIF_DELETE_APPROVAL_REQUIRED:${id}`);
    if (operation?.policyAuthority !== CII_WRITER_2_SIF_DELETE_POLICY) blockers.push(`WRITER_2_SIF_DELETE_POLICY_REQUIRED:${id}`);
    if (operation?.before !== true || operation?.proposed !== false) blockers.push(`WRITER_2_SIF_DELETE_PRESENCE_PREIMAGE_REQUIRED:${id}`);
    const elementId = targetElementId(operation, blockers); if (!elementId) continue;
    const edge = edges.get(elementId);
    const parsedElementIndex = Number(edge?.parsedElementIndex);
    if (!edge || !Number.isSafeInteger(parsedElementIndex)) { blockers.push(`WRITER_2_SIF_TARGET_ELEMENT_NOT_FOUND:${id}:${elementId}`); continue; }
    const binding = custody?.byParsedElementIndex?.[String(parsedElementIndex)];
    if (!binding || binding.bindingAuthority !== 'EXACT_PARSED_INDEX_AND_ENDPOINTS'
      || String(binding.from) !== String(edge.from) || String(binding.to) !== String(edge.to)) {
      blockers.push(`WRITER_2_SIF_DELETE_EXACT_ELEMENT_BINDING_REQUIRED:${id}:${parsedElementIndex}`); continue;
    }
    const pointer = Number(binding.pointer);
    if (!Number.isSafeInteger(pointer) || pointer < 1 || pointer > blockCount || !custody?.byPointer?.[String(pointer)]) {
      blockers.push(`WRITER_2_SIF_DELETE_EXISTING_POINTER_REQUIRED:${id}:${pointer}`); continue;
    }
    selectedElements.add(parsedElementIndex);
    deletionClaims.push(Object.freeze({ operationId: id, elementId, parsedElementIndex, pointer }));
  }

  const candidatePointers = new Set(deletionClaims.map((claim) => claim.pointer)); const deletedPointers = new Set();
  for (const pointer of [...candidatePointers].sort((a, b) => a - b)) {
    const owners = custody?.byPointer?.[String(pointer)]?.owners || [];
    if (!owners.length) { blockers.push(`WRITER_2_SIF_DELETE_POINTER_OWNER_REQUIRED:${pointer}`); continue; }
    const foreign = owners.filter((owner) => !selectedElements.has(Number(owner.parsedElementIndex)));
    if (foreign.length) {
      blockers.push(`WRITER_2_SIF_DELETE_UNAPPROVED_SHARED_POINTER:${pointer}:${foreign.map((owner) => owner.parsedElementIndex).join(',')}`);
      continue;
    }
    deletedPointers.add(pointer);
  }

  const oldToNewPointer = Number.isSafeInteger(blockCount) ? pointerMapping(blockCount, deletedPointers) : Object.freeze({});
  const pointerChanges = [];
  for (const binding of exactBindings(custody).sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex))) {
    const oldPointer = Number(binding.pointer); let newPointer = oldPointer;
    if (oldPointer > 0 && Object.prototype.hasOwnProperty.call(oldToNewPointer, oldPointer)) newPointer = Number(oldToNewPointer[oldPointer]);
    if (newPointer !== oldPointer) {
      if (binding.pointerField?.qualified !== true || Number(binding.pointerField?.width) !== 13) {
        blockers.push(`WRITER_2_SIF_POINTER_FIELD_CUSTODY_REQUIRED:${binding.parsedElementIndex}`);
      }
      pointerChanges.push(Object.freeze({ parsedElementIndex: Number(binding.parsedElementIndex), blockIndex: Number(binding.blockIndex),
        from: String(binding.from), to: String(binding.to), oldPointer, newPointer, pointerField: binding.pointerField }));
    }
  }

  const retainedPointers = Number.isSafeInteger(blockCount)
    ? Object.freeze(Array.from({ length: blockCount }, (_, index) => index + 1).filter((pointer) => !deletedPointers.has(pointer)))
    : Object.freeze([]);
  const ready = blockers.length === 0;
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2SifDeleteRelocationPlan.v1', status: ready ? 'READY' : 'BLOCKED', ready,
    blockCountBefore: Number.isSafeInteger(blockCount) ? blockCount : null,
    blockCountAfter: Number.isSafeInteger(blockCount) ? blockCount - deletedPointers.size : null,
    controlCountBefore: Number.isSafeInteger(blockCount) ? blockCount : null,
    controlCountAfter: Number.isSafeInteger(blockCount) ? blockCount - deletedPointers.size : null,
    deletedPointers: Object.freeze([...deletedPointers].sort((a, b) => a - b)), retainedPointers,
    oldToNewPointer, pointerChanges: Object.freeze(pointerChanges), deletionClaims: Object.freeze(deletionClaims),
    operationCount: deletes.length, blockers: Object.freeze([...new Set(blockers)]),
    createAuthority: Object.freeze({ ready: false, blocker: CII_WRITER_2_SIF_CREATE_BLOCKER,
      reason: 'V11 items 27-30 remain semantically unresolved; raw 10-row payload synthesis/copy is not authorized.' }),
  });
}

export function ciiWriter2SifDeleteReadiness(transferPlan, targetDocument, targetGraph) {
  const relocationPlan = buildCiiWriter2SifDeleteRelocationPlan({ targetDocument, targetGraph, transferPlan });
  return deepFreeze({ schema: 'CIIWorkspaceWriter2SifDeleteReadiness.v1', status: relocationPlan.ready ? 'READY' : 'BLOCKED',
    ready: relocationPlan.ready, mutationCount: relocationPlan.operationCount, mutationOperationCount: relocationPlan.operationCount,
    blockers: relocationPlan.blockers, relocationPlan });
}

export const _test = Object.freeze({ text, presenceValues, routePresence, routeOperation, operationSummary, pointerMapping, targetElementId });
