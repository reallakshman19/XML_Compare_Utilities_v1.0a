import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { ciiPhysicalSectionRows, decodeCiiAsciiByteString } from './cii-workspace-physical-file.js';

export const CII_WRITER_2_NODENAME_RELOCATION_POLICY = 'CII_WRITER_2_NODENAME_RELOCATION';

const FROM_START = 2;
const FROM_END = 28;
const TO_START = 28;
const TO_END = 53;
const CONTROL_NONAM_FIELD_INDEX = 3;
const APPROVED = new Set(['REVIEWED', 'LOCKED']);

function text(value) { return String(value ?? '').trim(); }
function numericKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}
function fieldSpan(fieldIndex, widths = CII_SIX_FIELD_WIDTHS) {
  const start = widths.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  return Object.freeze({ start, end: start + widths[fieldIndex], width: widths[fieldIndex] });
}
function asciiName(value, width, blocker, blockers) {
  const name = text(value);
  for (const char of name) if (char.codePointAt(0) > 0x7f) blockers.push(`${blocker}:NON_ASCII`);
  if (name.length > width) blockers.push(`${blocker}:WIDTH:${name.length}>${width}`);
  return name;
}
function rowField(raw, end) {
  const padded = String(raw ?? '').padEnd(TO_END, ' ');
  return end === 'FROM' ? padded.slice(FROM_START, FROM_END) : padded.slice(TO_START, TO_END);
}
function replaceRowField(raw, end, value) {
  const padded = String(raw ?? '').padEnd(TO_END, ' ');
  const width = end === 'FROM' ? FROM_END - FROM_START : TO_END - TO_START;
  const replacement = String(value ?? '').padEnd(width, ' ');
  const start = end === 'FROM' ? FROM_START : TO_START;
  const stop = end === 'FROM' ? FROM_END : TO_END;
  return `${padded.slice(0, start)}${replacement}${padded.slice(stop)}`;
}
function canonicalRow(fromName, toName) {
  return `  ${String(fromName || '').padEnd(FROM_END - FROM_START, ' ')}${String(toName || '').padEnd(TO_END - TO_START, ' ')}`;
}
function isEmptyRow(raw) { return !text(rowField(raw, 'FROM')) && !text(rowField(raw, 'TO')); }
function applyOperations(plan) {
  return (plan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && operation?.family === 'NODE_NAME' && operation?.property === 'Node name / to-name'
    && ['CREATE', 'DELETE'].includes(operation?.action));
}
function operationTargetNode(operation) { return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId); }
function exactBindings(custody) {
  return Object.values(custody?.byElementIndex || {}).filter((binding) => binding?.bindingAuthority === 'EXACT_PARSED_INDEX_AND_ENDPOINTS');
}
function spansForNode(custody, nodeId) {
  const spans = [];
  for (const [spanKey, span] of Object.entries(custody?.bySpan || {})) {
    const owners = (span?.owners || []).filter((owner) => String(owner.nodeId) === String(nodeId));
    if (owners.length) spans.push(Object.freeze({ spanKey, span, owners }));
  }
  return spans;
}
function incidentExactZeroBindings(custody, nodeId) {
  return exactBindings(custody).filter((binding) => Number(binding.pointer) === 0
    && (String(binding.from) === String(nodeId) || String(binding.to) === String(nodeId)))
    .map((binding) => Object.freeze({
      binding, parsedElementIndex: Number(binding.parsedElementIndex),
      end: String(binding.from) === String(nodeId) ? 'FROM' : 'TO',
    }))
    .sort((a, b) => a.parsedElementIndex - b.parsedElementIndex);
}
function blankRedundantCreateFields(custody, rows, nodeId) {
  const fields = [];
  for (const item of spansForNode(custody, nodeId)) {
    const foreign = (item.span?.owners || []).filter((owner) => String(owner.nodeId) !== String(nodeId));
    if (foreign.length) return Object.freeze({ qualified: false, fields: Object.freeze([]) });
    for (const owner of item.owners) {
      const rowIndex = Number(owner.rowIndex); const row = rows[rowIndex]; const end = owner.end;
      if (!row || !['FROM', 'TO'].includes(end) || text(rowField(row.afterText, end))) {
        return Object.freeze({ qualified: false, fields: Object.freeze([]) });
      }
      fields.push(Object.freeze({ rowIndex, end, spanKey: item.spanKey, oldPointer: Number(owner.pointer) }));
    }
  }
  return Object.freeze({ qualified: true, fields: Object.freeze(fields) });
}
function controlEvidence(targetDocument, blockers) {
  const rows = ciiPhysicalSectionRows(targetDocument?.physicalFile, 'CONTROL');
  const row = rows[0]; const span = fieldSpan(CONTROL_NONAM_FIELD_INDEX);
  if (!row) { blockers.push('WRITER_2_NODENAME_CONTROL_ROW_REQUIRED'); return null; }
  const values = decodeCiiNumericRow(row.text); const count = Number(values?.[CONTROL_NONAM_FIELD_INDEX]);
  if (!Number.isSafeInteger(count) || count < 0) blockers.push('WRITER_2_NODENAME_CONTROL_NONAM_INVALID');
  if (String(row.text || '').length < span.end) blockers.push('WRITER_2_NODENAME_CONTROL_ROW_TOO_SHORT');
  return Object.freeze({ row, count, span });
}
function rowStates(targetDocument, blockers) {
  const rows = ciiPhysicalSectionRows(targetDocument?.physicalFile, 'NODENAME');
  return rows.map((row, index) => {
    if (String(row.text || '').length < TO_END) blockers.push(`WRITER_2_NODENAME_ROW_TOO_SHORT:${index + 1}`);
    try {
      decodeCiiAsciiByteString(String(row.text || '').slice(0, TO_END));
    } catch {
      blockers.push(`WRITER_2_NODENAME_ROW_NON_ASCII:${index + 1}`);
    }
    return { oldPointer: index + 1, afterText: String(row.text || ''), touched: false };
  });
}
function validateOperation(operation, targetDocument, blockers) {
  const id = operation?.operationId || 'unknown'; const nodeId = operationTargetNode(operation);
  if (operation?.status !== 'PREVIEW_READY') blockers.push(`WRITER_2_NODENAME_OPERATION_NOT_READY:${id}`);
  if (!APPROVED.has(operation?.matchAuthority?.status)) blockers.push(`WRITER_2_NODENAME_APPROVAL_REQUIRED:${id}`);
  if (operation?.policyAuthority !== CII_WRITER_2_NODENAME_RELOCATION_POLICY) blockers.push(`WRITER_2_NODENAME_POLICY_REQUIRED:${id}`);
  if (!nodeId) blockers.push(`WRITER_2_NODENAME_TARGET_NODE_REQUIRED:${id}`);
  const current = text(targetDocument?.nodeNames?.[nodeId]);
  if (operation.action === 'CREATE') {
    if (current) blockers.push(`WRITER_2_NODENAME_CREATE_TARGET_ALREADY_NAMED:${id}`);
    if (!text(operation.proposed)) blockers.push(`WRITER_2_NODENAME_CREATE_NAME_REQUIRED:${id}`);
  } else if (operation.action === 'DELETE') {
    if (!current || current !== text(operation.before)) blockers.push(`WRITER_2_NODENAME_DELETE_PREIMAGE_MISMATCH:${id}`);
    if (text(operation.proposed)) blockers.push(`WRITER_2_NODENAME_DELETE_PROPOSED_MUST_BE_BLANK:${id}`);
  } else blockers.push(`WRITER_2_NODENAME_ACTION_UNSUPPORTED:${id}`);
  return nodeId;
}

export function buildCiiWriter2NodeNameRelocationPlan({ targetDocument, transferPlan }) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_2_NODENAME_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if (transferPlan?.transferScope?.status !== 'BOUND') blockers.push('WRITER_2_NODENAME_BOUND_TRANSFER_SCOPE_REQUIRED');
  if (targetDocument?.writer1CByteEligible !== true) blockers.push('WRITER_2_NODENAME_ORIGINAL_BYTE_CUSTODY_REQUIRED');
  const custody = targetDocument?.nodeNameEvidence?.physicalCustody;
  if (custody?.status !== 'QUALIFIED') blockers.push('WRITER_2_NODENAME_EXACT_PHYSICAL_CUSTODY_REQUIRED');
  const operations = applyOperations(transferPlan);
  const unsupported = (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && !(operation?.family === 'NODE_NAME' && operation?.property === 'Node name / to-name'
      && ['CREATE', 'DELETE'].includes(operation?.action)));
  for (const operation of unsupported) blockers.push(`WRITER_2_PHASE1_UNSUPPORTED_APPLY:${operation?.operationId || 'unknown'}`);
  if (!operations.length) blockers.push('WRITER_2_NODENAME_NO_MUTATIONS');

  const control = controlEvidence(targetDocument, blockers); const rows = rowStates(targetDocument, blockers);
  if (Number(custody?.rowCount) !== rows.length) blockers.push(`WRITER_2_NODENAME_CUSTODY_ROW_COUNT_MISMATCH:${custody?.rowCount}:${rows.length}`);
  if (control && control.count !== rows.length) blockers.push(`WRITER_2_NODENAME_CONTROL_COUNT_MISMATCH:${control.count}:${rows.length}`);
  const deleteNodes = new Set(); const createRequests = [];
  for (const operation of operations) {
    const nodeId = validateOperation(operation, targetDocument, blockers);
    if (!nodeId) continue;
    if (operation.action === 'DELETE') deleteNodes.add(nodeId);
    else if (operation.action === 'CREATE') createRequests.push(Object.freeze({ operation, nodeId }));
  }

  const deletionClaims = [];
  for (const nodeId of [...deleteNodes].sort((a, b) => numericKey(a) - numericKey(b) || a.localeCompare(b))) {
    const nodeSpans = spansForNode(custody, nodeId);
    if (!nodeSpans.length) { blockers.push(`WRITER_2_NODENAME_DELETE_PHYSICAL_FIELD_REQUIRED:${nodeId}`); continue; }
    for (const item of nodeSpans) {
      const foreign = (item.span.owners || []).filter((owner) => !deleteNodes.has(String(owner.nodeId)));
      if (foreign.length) {
        blockers.push(`WRITER_2_NODENAME_DELETE_UNAPPROVED_ALIAS:${item.spanKey}:${foreign.map((owner) => owner.nodeId).join(',')}`);
        continue;
      }
      const owner = item.owners[0]; const row = rows[Number(owner.rowIndex)];
      if (!row) { blockers.push(`WRITER_2_NODENAME_DELETE_ROW_MISSING:${item.spanKey}`); continue; }
      const end = owner.end; row.afterText = replaceRowField(row.afterText, end, ''); row.touched = true;
      deletionClaims.push(Object.freeze({ nodeId, oldPointer: Number(owner.pointer), rowIndex: Number(owner.rowIndex), end, spanKey: item.spanKey }));
    }
  }

  const deletedPointers = new Set(rows.filter((row) => row.touched && isEmptyRow(row.afterText)).map((row) => row.oldPointer));
  const retainedRows = rows.filter((row) => !deletedPointers.has(row.oldPointer));
  const oldToNewPointer = {};
  retainedRows.forEach((row, index) => { oldToNewPointer[row.oldPointer] = index + 1; });
  for (const pointer of deletedPointers) oldToNewPointer[pointer] = 0;

  const createGroups = new Map(); const redundantCreateClaims = [];
  for (const request of createRequests.sort((a, b) => numericKey(a.nodeId) - numericKey(b.nodeId) || a.nodeId.localeCompare(b.nodeId))) {
    const candidates = incidentExactZeroBindings(custody, request.nodeId);
    if (!candidates.length) { blockers.push(`WRITER_2_NODENAME_CREATE_ZERO_POINTER_OWNER_REQUIRED:${request.nodeId}`); continue; }
    const redundant = blankRedundantCreateFields(custody, rows, request.nodeId);
    if (!redundant.qualified) {
      blockers.push(`WRITER_2_NODENAME_CREATE_EXISTING_FIELD_USE_WRITER_1C:${request.nodeId}`); continue;
    }
    const selected = candidates[0]; const index = selected.parsedElementIndex;
    const group = createGroups.get(index) || { parsedElementIndex: index, fromName: '', toName: '', operationIds: [] };
    const width = selected.end === 'FROM' ? FROM_END - FROM_START : TO_END - TO_START;
    const name = asciiName(request.operation.proposed, width, `WRITER_2_NODENAME_CREATE_NAME_INVALID:${request.nodeId}`, blockers);
    for (const field of redundant.fields) {
      const row = rows[field.rowIndex]; row.afterText = replaceRowField(row.afterText, field.end, name); row.touched = true;
      redundantCreateClaims.push(Object.freeze({ nodeId: request.nodeId, oldPointer: field.oldPointer, rowIndex: field.rowIndex, end: field.end, spanKey: field.spanKey, operationId: request.operation.operationId }));
    }
    if (selected.end === 'FROM') {
      if (group.fromName && group.fromName !== name) blockers.push(`WRITER_2_NODENAME_CREATE_OWNER_CONFLICT:${index}:FROM`);
      else group.fromName = name;
    } else {
      if (group.toName && group.toName !== name) blockers.push(`WRITER_2_NODENAME_CREATE_OWNER_CONFLICT:${index}:TO`);
      else group.toName = name;
    }
    group.operationIds.push(request.operation.operationId); createGroups.set(index, group);
  }

  const appendedRows = [...createGroups.values()].sort((a, b) => a.parsedElementIndex - b.parsedElementIndex).map((group, index) => Object.freeze({
    newPointer: retainedRows.length + index + 1, parsedElementIndex: group.parsedElementIndex,
    fromName: group.fromName, toName: group.toName, rowText: canonicalRow(group.fromName, group.toName),
    operationIds: Object.freeze([...group.operationIds].sort()),
  }));
  const appendByElement = new Map(appendedRows.map((row) => [row.parsedElementIndex, row]));
  const pointerChanges = [];
  for (const binding of exactBindings(custody).sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex))) {
    const oldPointer = Number(binding.pointer); let newPointer = oldPointer;
    if (oldPointer > 0) newPointer = Number(oldToNewPointer[oldPointer]);
    else if (appendByElement.has(Number(binding.parsedElementIndex))) newPointer = appendByElement.get(Number(binding.parsedElementIndex)).newPointer;
    if (newPointer !== oldPointer) {
      if (binding.bindingAuthority !== 'EXACT_PARSED_INDEX_AND_ENDPOINTS') {
        blockers.push(`WRITER_2_NODENAME_POINTER_BINDING_EXACT_REQUIRED:${binding.parsedElementIndex}`);
      }
      if (binding.pointerField?.qualified !== true || Number(binding.pointerField?.width) !== 13) {
        blockers.push(`WRITER_2_NODENAME_POINTER_FIELD_CUSTODY_REQUIRED:${binding.parsedElementIndex}`);
      }
      pointerChanges.push(Object.freeze({
        parsedElementIndex: Number(binding.parsedElementIndex), blockIndex: Number(binding.blockIndex),
        from: String(binding.from), to: String(binding.to), oldPointer, newPointer, pointerField: binding.pointerField,
      }));
    }
  }

  const finalRows = Object.freeze([
    ...retainedRows.map((row, index) => Object.freeze({ oldPointer: row.oldPointer, newPointer: index + 1, rowText: row.afterText, touched: row.touched })),
    ...appendedRows.map((row) => Object.freeze({ oldPointer: null, newPointer: row.newPointer, rowText: row.rowText, touched: true,
      parsedElementIndex: row.parsedElementIndex, operationIds: row.operationIds })),
  ]);
  const ready = blockers.length === 0;
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2NodeNameRelocationPlan.v1', status: ready ? 'READY' : 'BLOCKED', ready,
    rowCountBefore: rows.length, rowCountAfter: finalRows.length,
    controlCountBefore: control?.count ?? null, controlCountAfter: finalRows.length,
    oldToNewPointer: Object.freeze(oldToNewPointer), deletedPointers: Object.freeze([...deletedPointers].sort((a, b) => a - b)),
    deletionClaims: Object.freeze(deletionClaims), redundantCreateClaims: Object.freeze(redundantCreateClaims),
    appendedRows: Object.freeze(appendedRows), finalRows,
    pointerChanges: Object.freeze(pointerChanges), operationCount: operations.length,
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

export const _test = Object.freeze({ canonicalRow, replaceRowField, rowField, isEmptyRow, fieldSpan, blankRedundantCreateFields });