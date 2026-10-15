import { deepFreeze } from './cii-workspace-contracts.js';
import { ciiPhysicalByteString, ciiPhysicalSectionRows, decodeCiiAsciiByteString } from './cii-workspace-physical-file.js';
import { CII_HANGER_LAYOUTS } from './cii-workspace-hanger.js';
import { qualifyCiiWriter2HangerRecordBindings } from './cii-workspace-writer2-hanger-record-binding.js';
import { retainedCiiWriter2HangerTailRows } from './cii-workspace-writer2-hanger-tail-order.js';

export const CII_WRITER_2_HANGER_DELETE_POLICY = 'CII_WRITER_2_HANGER_DELETE_COMPACTION';
export const CII_WRITER_2_HANGER_CREATE_BLOCKER = 'WRITER_2_HANGER_CREATE_PAYLOAD_SEMANTICS_NOT_QUALIFIED';
export const CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER = 'WRITER_2_HANGER_PARTIAL_MULTI_RECORD_TAIL_ORDER_UNQUALIFIED';

const HANGER_PRESENCE_PROPERTY = 'Hanger presence';
const HANGER_PRESENCE_AUTHORITY = 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE';
const APPROVED = new Set(['REVIEWED', 'LOCKED']);
const CONTROL_NOHGRS_FIELD = Object.freeze({ rowIndex: 0, fieldIndex: 2, start: 28, end: 41, width: 13 });
const VALUES_PER_PACKED_ROW = 6;
const FIELD_WIDTH = 13;
const PACKED_PREFIX = 2;
const EXECUTION_ROWS = 4;

function text(value) { return String(value ?? '').trim(); }
function bool(value) { return value === true; }
function ceilDiv(value, divisor) { return Math.floor(value / divisor) + (value % divisor ? 1 : 0); }
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
  if (!String(operation?.evidenceAuthority || operation?.sourceEvidence?.authority || '').includes(HANGER_PRESENCE_AUTHORITY)) {
    blockers.push('WRITER_2_HANGER_NODE_PRESENCE_AUTHORITY_REQUIRED');
  }
  if (!values.source && values.target) {
    return deepFreeze({ ...operation, action: 'DELETE', status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY',
      blockers: deepFreeze(blockers), before: true, proposed: false, policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY });
  }
  if (values.source && !values.target) {
    blockers.push(CII_WRITER_2_HANGER_CREATE_BLOCKER);
    return deepFreeze({ ...operation, action: 'CREATE', status: 'BLOCKED', blockers: deepFreeze(blockers),
      before: false, proposed: true, policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY });
  }
  return deepFreeze({ ...operation, action: 'KEEP', status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY',
    blockers: deepFreeze(blockers), before: values.target, proposed: values.source });
}
function routeOperation(operation) {
  if (operation?.family === 'HANGER' && operation?.property === HANGER_PRESENCE_PROPERTY) return routePresence(operation);
  if (operation?.action === 'KEEP') return operation;
  return deepFreeze({ ...operation, action: 'BLOCKED', status: 'BLOCKED',
    blockers: deepFreeze([...new Set([...(operation?.blockers || []), 'WRITER_2_HANGER_DELETE_PHASE_ONLY'])]) });
}

export function applyCiiWriter2HangerDeletePlanContract(plan) {
  if (!plan) return plan;
  const operations = deepFreeze((plan.operations || []).map(routeOperation));
  const summary = operationSummary(operations);
  const deleteReady = operations.filter((item) => item.family === 'HANGER' && item.property === HANGER_PRESENCE_PROPERTY
    && item.action === 'DELETE' && item.status === 'PREVIEW_READY' && item.policyAuthority === CII_WRITER_2_HANGER_DELETE_POLICY);
  const blockers = (plan.blockers || []).filter((item) => item !== 'NO_TRANSFERABLE_PREVIEW_OPERATIONS');
  if (!deleteReady.length) blockers.push('NO_WRITER_2_HANGER_DELETE_TRANSFERABLE_OPERATIONS');
  const unique = deepFreeze([...new Set(blockers)]);
  return deepFreeze({ ...plan,
    mutationAuthority: unique.length ? 'BLOCKED' : 'WRITER_2_HANGER_DELETE_CONDITIONAL',
    operations, status: unique.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: unique,
    summary: deepFreeze({ ...summary, writer2HangerDeleteMutationCount: deleteReady.length }),
    policy: deepFreeze({ ...(plan.policy || {}),
      hangerMutation: 'EXISTING_HANGER_DELETE_PLANNER_WITH_QUALIFIED_RECORD_BINDING',
      hangerPhysicalMutation: 'DELETE_ALL_ONLY_UNCHANGED',
      hangerCreate: 'BLOCKED_PAYLOAD_SEMANTICS_NOT_QUALIFIED', topologyMutation: 'BLOCKED' }),
  });
}

function applyDeletes(plan) {
  return (plan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && operation?.family === 'HANGER' && operation?.property === HANGER_PRESENCE_PROPERTY && operation?.action === 'DELETE');
}
function packedField(row, valueIndex, label, blockers) {
  const column = valueIndex % VALUES_PER_PACKED_ROW;
  const start = PACKED_PREFIX + column * FIELD_WIDTH; const end = start + FIELD_WIDTH;
  const raw = String(row?.text || '');
  if (raw.slice(0, PACKED_PREFIX) !== '  ') blockers.push(`WRITER_2_HANGER_PACKED_PREFIX_REQUIRED:${label}:${Math.floor(valueIndex / VALUES_PER_PACKED_ROW) + 1}`);
  if (raw.length < end) { blockers.push(`WRITER_2_HANGER_PACKED_FIELD_WIDTH_REQUIRED:${label}:${valueIndex + 1}`); return null; }
  const rawField = raw.slice(start, end);
  try { decodeCiiAsciiByteString(rawField); } catch { blockers.push(`WRITER_2_HANGER_PACKED_FIELD_ASCII_REQUIRED:${label}:${valueIndex + 1}`); }
  const value = Number(rawField.trim());
  if (!Number.isSafeInteger(value)) blockers.push(`WRITER_2_HANGER_PACKED_INTEGER_REQUIRED:${label}:${valueIndex + 1}`);
  return Object.freeze({ valueIndex: valueIndex + 1, value, rawField,
    byteStart: Number(row.byteStart) + start, byteEnd: Number(row.byteStart) + end, width: FIELD_WIDTH });
}
function extractPacked(rows, count, label, blockers) {
  const expectedRows = ceilDiv(count, VALUES_PER_PACKED_ROW);
  if (rows.length !== expectedRows) blockers.push(`WRITER_2_HANGER_PACKED_ROW_COUNT_REQUIRED:${label}:${rows.length}:${expectedRows}`);
  const fields = [];
  for (let index = 0; index < count; index += 1) {
    const row = rows[Math.floor(index / VALUES_PER_PACKED_ROW)];
    if (!row) continue;
    const field = packedField(row, index, label, blockers); if (field) fields.push(field);
  }
  if (count > 0 && rows.length) {
    const usedLast = count % VALUES_PER_PACKED_ROW || VALUES_PER_PACKED_ROW;
    const tail = String(rows[rows.length - 1].text || '').slice(PACKED_PREFIX + usedLast * FIELD_WIDTH);
    if (tail.trim()) blockers.push(`WRITER_2_HANGER_PACKED_TRAILING_DATA:${label}`);
  }
  return Object.freeze({ label, rowCount: rows.length, fields: Object.freeze(fields) });
}
function rowGroup(rows, start, count) { return Object.freeze(rows.slice(start, start + count)); }
function physicalCustody(targetDocument, blockers) {
  const evidence = targetDocument?.hangerEvidence;
  if (evidence?.status !== 'QUALIFIED') { blockers.push('WRITER_2_HANGER_QUALIFIED_NODE_CUSTODY_REQUIRED'); return null; }
  if (evidence?.layout !== CII_HANGER_LAYOUTS.SYNCHRONIZER) {
    blockers.push(`WRITER_2_HANGER_CANONICAL_LAYOUT_REQUIRED:${evidence?.layout || 'UNRESOLVED'}`); return null;
  }
  const physicalFile = targetDocument?.physicalFile;
  if (targetDocument?.writer1CByteEligible !== true || physicalFile?.writer1CByteEligible !== true) {
    blockers.push('WRITER_2_HANGER_ORIGINAL_BYTE_CUSTODY_REQUIRED'); return null;
  }
  const controlRows = ciiPhysicalSectionRows(physicalFile, 'CONTROL', { includeBlank: true });
  if (controlRows.length < 4) { blockers.push('WRITER_2_HANGER_CONTROL_ROWS_REQUIRED'); return null; }
  const controlRow = controlRows[CONTROL_NOHGRS_FIELD.rowIndex];
  if (String(controlRow?.text || '').length < CONTROL_NOHGRS_FIELD.end) blockers.push('WRITER_2_HANGER_CONTROL_NOHGRS_FIELD_WIDTH_REQUIRED');
  const controlBeforeField = String(controlRow?.text || '').slice(CONTROL_NOHGRS_FIELD.start, CONTROL_NOHGRS_FIELD.end);
  const controlCount = Number(controlBeforeField.trim());
  const count = Number(evidence.count);
  if (!Number.isSafeInteger(controlCount) || controlCount !== count || Number(evidence?.control?.nohgrs) !== count) {
    blockers.push(`WRITER_2_HANGER_CONTROL_COUNT_CUSTODY_REQUIRED:${controlCount}:${count}`);
  }

  const allRows = ciiPhysicalSectionRows(physicalFile, 'MISCEL_1', { includeBlank: true });
  const rows = ciiPhysicalSectionRows(physicalFile, 'MISCEL_1');
  if (allRows.length !== rows.length) blockers.push('WRITER_2_HANGER_CANONICAL_MISCEL_BLANK_ROWS_UNSUPPORTED');
  const numelt = Number(evidence?.control?.numelt); const numnoz = Number(evidence?.control?.numnoz);
  if (!Number.isSafeInteger(numelt) || numelt < 0 || !Number.isSafeInteger(numnoz) || numnoz < 0) {
    blockers.push('WRITER_2_HANGER_CONTROL_PREFIX_COUNTS_REQUIRED'); return null;
  }
  const rrmatRows = ceilDiv(numelt, 6); const nozzleRows = numnoz * 4;
  const packedRows = ceilDiv(count, 6);
  const hangerRows = count > 0 ? 2 + packedRows + 5 * count + 4 * packedRows : 0;
  const expectedRows = rrmatRows + nozzleRows + hangerRows + EXECUTION_ROWS;
  if (rows.length !== expectedRows) blockers.push(`WRITER_2_HANGER_MISCEL_ROW_COUNT_REQUIRED:${rows.length}:${expectedRows}`);
  if (!count) blockers.push('WRITER_2_HANGER_DELETE_TARGET_HAS_NO_HANGERS');

  const prefixRows = rrmatRows + nozzleRows; let cursor = prefixRows;
  const defaultRows = rowGroup(rows, cursor, count > 0 ? 2 : 0); cursor += defaultRows.length;
  const ihgrNodeRows = rowGroup(rows, cursor, packedRows); cursor += packedRows;
  const hgrdatTagGuidRows = rowGroup(rows, cursor, 4 * count); cursor += 4 * count;
  const ihgrfreeRows = rowGroup(rows, cursor, count); cursor += count;
  const ihgrnumRows = rowGroup(rows, cursor, packedRows); cursor += packedRows;
  const ihgrtableRows = rowGroup(rows, cursor, packedRows); cursor += packedRows;
  const ihgrshortRows = rowGroup(rows, cursor, packedRows); cursor += packedRows;
  const ihgrcnRows = rowGroup(rows, cursor, packedRows); cursor += packedRows;
  const executionRows = rowGroup(rows, cursor, EXECUTION_ROWS); cursor += EXECUTION_ROWS;
  if (cursor !== rows.length) blockers.push(`WRITER_2_HANGER_MISCEL_LAYOUT_CURSOR_MISMATCH:${cursor}:${rows.length}`);

  const ihgrNode = extractPacked(ihgrNodeRows, count, 'IHGRNODE', blockers);
  const ihgrnum = extractPacked(ihgrnumRows, count, 'IHGRNUM', blockers);
  const ihgrtable = extractPacked(ihgrtableRows, count, 'IHGRTABLE', blockers);
  const ihgrshort = extractPacked(ihgrshortRows, count, 'IHGRSHORT', blockers);
  const ihgrcn = extractPacked(ihgrcnRows, count, 'IHGRCN', blockers);
  const packed = Object.freeze({ IHGRNODE: ihgrNode, IHGRNUM: ihgrnum, IHGRTABLE: ihgrtable, IHGRSHORT: ihgrshort, IHGRCN: ihgrcn });
  const expectedNodes = [...(evidence.nodes || [])].map((node) => String(node));
  const physicalNodes = ihgrNode.fields.map((field) => String(field.value));
  if (expectedNodes.length !== physicalNodes.length || expectedNodes.some((node, index) => node !== physicalNodes[index])) {
    blockers.push('WRITER_2_HANGER_IHGRNODE_RECORD_ORDER_CUSTODY_REQUIRED');
  }
  const recordBinding = qualifyCiiWriter2HangerRecordBindings({ count, tailRows: hgrdatTagGuidRows, ihgrfreeRows, packed });
  const payloadStart = rows[0]?.byteStart; const payloadEnd = rows[rows.length - 1]?.byteEnd;
  if (!Number.isSafeInteger(payloadStart) || !Number.isSafeInteger(payloadEnd) || payloadEnd < payloadStart) {
    blockers.push('WRITER_2_HANGER_MISCEL_PAYLOAD_SPAN_REQUIRED');
  }
  return deepFreeze({
    status: blockers.length ? 'BLOCKED' : 'QUALIFIED', layout: evidence.layout, count, rrmatRows, nozzleRows, packedRows,
    expectedRowCount: expectedRows,
    tailOrderAuthority: count <= 1 ? 'ORDER_EQUIVALENT_FOR_SINGLE_RECORD'
      : recordBinding.status === 'QUALIFIED' ? recordBinding.tailAuthority : 'UNRESOLVED_INTER_EMITTER_HGRDAT_TAG_GUID_ORDER',
    control: Object.freeze({
      count: controlCount, rowLineNumber: controlRow?.lineNumber ?? null,
      byteStart: Number(controlRow?.byteStart) + CONTROL_NOHGRS_FIELD.start,
      byteEnd: Number(controlRow?.byteStart) + CONTROL_NOHGRS_FIELD.end,
      width: CONTROL_NOHGRS_FIELD.width, beforeField: controlBeforeField,
    }),
    miscelPayload: Object.freeze({ byteStart: payloadStart, byteEnd: payloadEnd,
      beforeField: Number.isSafeInteger(payloadStart) && Number.isSafeInteger(payloadEnd)
        ? ciiPhysicalByteString(physicalFile, payloadStart, payloadEnd) : '' }),
    defaultRows, hgrdatTagGuidRows, ihgrfreeRows, executionRows, packed, recordBinding,
  });
}
function targetNodeId(operation, blockers) {
  const raw = text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId);
  const ids = raw.split('|').map((item) => item.trim()).filter(Boolean);
  if (ids.length !== 1) { blockers.push(`WRITER_2_HANGER_TARGET_NODE_CARDINALITY_ONE_REQUIRED:${operation?.operationId || 'unknown'}:${ids.length}`); return null; }
  return ids[0];
}
function mapping(count, deleted) {
  const result = {}; let next = 1;
  for (let index = 1; index <= count; index += 1) {
    if (deleted.has(index)) result[index] = 0;
    else { result[index] = next; next += 1; }
  }
  return Object.freeze(result);
}
function retainedPackedFields(custody, retained) {
  const out = {};
  for (const [label, packed] of Object.entries(custody?.packed || {})) {
    out[label] = Object.freeze(packed.fields.filter((field) => retained.has(Number(field.valueIndex))));
  }
  return Object.freeze(out);
}

export function buildCiiWriter2HangerDeletePlan({ targetDocument, transferPlan }) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_2_HANGER_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if (transferPlan?.transferScope?.status !== 'BOUND') blockers.push('WRITER_2_HANGER_BOUND_TRANSFER_SCOPE_REQUIRED');
  const custody = physicalCustody(targetDocument, blockers);
  const deletes = applyDeletes(transferPlan);
  const unsupported = (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && !(operation?.family === 'HANGER' && operation?.property === HANGER_PRESENCE_PROPERTY && operation?.action === 'DELETE'));
  for (const operation of unsupported) blockers.push(`WRITER_2_HANGER_DELETE_UNSUPPORTED_APPLY:${operation?.operationId || 'unknown'}`);
  if (!deletes.length) blockers.push('WRITER_2_HANGER_DELETE_NO_MUTATIONS');

  const selectedRecords = new Set(); const selectedNodes = new Set(); const deletionClaims = [];
  for (const operation of deletes) {
    const id = operation?.operationId || 'unknown';
    if (operation?.status !== 'PREVIEW_READY') blockers.push(`WRITER_2_HANGER_DELETE_OPERATION_NOT_READY:${id}`);
    if (!APPROVED.has(operation?.matchAuthority?.status)) blockers.push(`WRITER_2_HANGER_DELETE_APPROVAL_REQUIRED:${id}`);
    if (operation?.policyAuthority !== CII_WRITER_2_HANGER_DELETE_POLICY) blockers.push(`WRITER_2_HANGER_DELETE_POLICY_REQUIRED:${id}`);
    if (operation?.before !== true || operation?.proposed !== false) blockers.push(`WRITER_2_HANGER_DELETE_PRESENCE_PREIMAGE_REQUIRED:${id}`);
    const nodeId = targetNodeId(operation, blockers); if (!nodeId) continue;
    if (selectedNodes.has(nodeId)) { blockers.push(`WRITER_2_HANGER_DELETE_DUPLICATE_NODE_OPERATION:${nodeId}`); continue; }
    selectedNodes.add(nodeId);
    const records = targetDocument?.hangerEvidence?.byNode?.[nodeId] || [];
    if (!records.length) { blockers.push(`WRITER_2_HANGER_DELETE_TARGET_RECORD_REQUIRED:${id}:${nodeId}`); continue; }
    const recordIndices = [];
    for (const record of records) {
      const index = Number(record?.recordIndex);
      if (!Number.isSafeInteger(index) || index < 1 || index > Number(custody?.count || 0)) {
        blockers.push(`WRITER_2_HANGER_DELETE_RECORD_INDEX_REQUIRED:${id}:${record?.recordIndex}`); continue;
      }
      const physicalNode = custody?.packed?.IHGRNODE?.fields?.[index - 1]?.value;
      if (String(physicalNode) !== nodeId) { blockers.push(`WRITER_2_HANGER_DELETE_RECORD_NODE_MISMATCH:${id}:${index}:${physicalNode}:${nodeId}`); continue; }
      selectedRecords.add(index); recordIndices.push(index);
    }
    deletionClaims.push(Object.freeze({ operationId: id, nodeId, recordIndices: Object.freeze(recordIndices.sort((a, b) => a - b)) }));
  }

  const countBefore = Number(custody?.count || 0);
  const deleteAll = countBefore > 0 && selectedRecords.size === countBefore;
  const partialMultiRecordDelete = countBefore > 1 && selectedRecords.size > 0 && !deleteAll;
  const partialRecordBindingQualified = !partialMultiRecordDelete || custody?.recordBinding?.status === 'QUALIFIED';
  if (partialMultiRecordDelete && !partialRecordBindingQualified) {
    blockers.push(CII_WRITER_2_HANGER_PARTIAL_MULTI_DELETE_BLOCKER);
    for (const code of custody?.recordBinding?.blockers || []) blockers.push(`WRITER_2_HANGER_PARTIAL_RECORD_BINDING_REQUIRED:${code}`);
  }

  const retained = new Set();
  for (let index = 1; index <= countBefore; index += 1) if (!selectedRecords.has(index)) retained.add(index);
  const oldToNewRecordIndex = mapping(countBefore, selectedRecords);
  const countAfter = countBefore - selectedRecords.size; const packedRowsAfter = ceilDiv(countAfter, VALUES_PER_PACKED_ROW);
  const hangerRowsAfter = countAfter > 0 ? 2 + packedRowsAfter + 5 * countAfter + 4 * packedRowsAfter : 0;
  const expectedMiscelRowsAfter = Number(custody?.rrmatRows || 0) + Number(custody?.nozzleRows || 0) + hangerRowsAfter + EXECUTION_ROWS;
  const ready = blockers.length === 0;
  const retainedIndices = Object.freeze([...retained].sort((a, b) => a - b));
  const retainedTailRowIndices = partialMultiRecordDelete && partialRecordBindingQualified
    ? retainedCiiWriter2HangerTailRows(custody?.recordBinding?.tailQualification, retainedIndices)
    : Object.freeze([]);
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2HangerDeletePlan.v1', status: ready ? 'READY' : 'BLOCKED', ready,
    policyAuthority: CII_WRITER_2_HANGER_DELETE_POLICY,
    countBefore, countAfter, controlCountBefore: custody?.control?.count ?? null, controlCountAfter: countAfter,
    deletedRecordIndices: Object.freeze([...selectedRecords].sort((a, b) => a - b)),
    retainedRecordIndices: retainedIndices, oldToNewRecordIndex,
    deletedNodes: Object.freeze([...selectedNodes].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))),
    retainedNodes: Object.freeze((custody?.packed?.IHGRNODE?.fields || []).filter((field) => retained.has(Number(field.valueIndex))).map((field) => String(field.value))),
    deletionClaims: Object.freeze(deletionClaims), operationCount: deletes.length,
    physicalCustody: custody,
    compaction: Object.freeze({
      canonicalIhgrNodeFirstOnly: true, deleteAll, partialMultiRecordDelete,
      partialRecordCompactionAuthorized: !partialMultiRecordDelete || partialRecordBindingQualified,
      plannerPartialRecordAuthority: partialMultiRecordDelete && partialRecordBindingQualified,
      physicalPartialWriteAuthority: false,
      physicalWriterScope: 'DELETE_ALL_ONLY_UNCHANGED',
      tailOrderAuthority: deleteAll || countBefore <= 1 ? 'NOT_REQUIRED_FOR_AUTHORIZED_DELETE'
        : partialRecordBindingQualified ? custody?.recordBinding?.authority : 'UNRESOLVED_INTER_EMITTER_HGRDAT_TAG_GUID_ORDER',
      hangerHeaderRowsRetained: countAfter > 0,
      packedRowsBefore: custody?.packedRows ?? null, packedRowsAfter,
      expectedMiscelRowsBefore: custody?.expectedRowCount ?? null, expectedMiscelRowsAfter,
      retainedOpaqueHgrdatTagGuidRecordIndices: partialMultiRecordDelete && !partialRecordBindingQualified ? Object.freeze([]) : retainedIndices,
      retainedHgrdatTagGuidRowIndices: retainedTailRowIndices,
      retainedIhgrfreeRecordIndices: partialMultiRecordDelete && !partialRecordBindingQualified ? Object.freeze([]) : retainedIndices,
      retainedPackedFields: retainedPackedFields(custody, retained),
      recordBindingAuthority: partialRecordBindingQualified ? custody?.recordBinding?.authority || null : null,
    }),
    blockers: Object.freeze([...new Set(blockers)]),
    createAuthority: Object.freeze({ ready: false, blocker: CII_WRITER_2_HANGER_CREATE_BLOCKER,
      reason: 'Writer2 HANGER CREATE would require authoritative construction/default semantics for every HGRDAT/TAG/GUID/IHGRFREE/packed-array field.' }),
  });
}

export function ciiWriter2HangerDeleteReadiness(transferPlan, targetDocument) {
  const deletePlan = buildCiiWriter2HangerDeletePlan({ targetDocument, transferPlan });
  return deepFreeze({ schema: 'CIIWorkspaceWriter2HangerDeleteReadiness.v1', status: deletePlan.ready ? 'READY' : 'BLOCKED',
    ready: deletePlan.ready, mutationCount: deletePlan.operationCount, mutationOperationCount: deletePlan.operationCount,
    blockers: deletePlan.blockers, deletePlan });
}

export const _test = Object.freeze({ ceilDiv, presenceValues, routePresence, routeOperation, mapping, extractPacked, physicalCustody });
