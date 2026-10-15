import { stableStringify } from './cii-workspace-contracts.js';
import { ciiPhysicalSectionRows } from './cii-workspace-physical-file.js';

const NODE_POLICY = 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD';
const SIF_POLICIES = new Set(['CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK', 'CII_WRITER_1C_SIF_OUT_PLANE_EXISTING_BLOCK']);
const SIF_CONTEXT_AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';

function text(value) { return String(value ?? '').trim(); }
function targetNodeId(operation) { return text(operation?.targetEvidence?.identity || operation?.targetEvidence?.nodeId); }
function applyNodeNameOperations(plan) {
  return (plan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && operation?.family === 'NODE_NAME' && operation?.property === 'Node name / to-name'
    && operation?.action === 'COPY' && operation?.status === 'PREVIEW_READY'
    && operation?.policyAuthority === NODE_POLICY);
}
function applySifOperations(plan) {
  return (plan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY'
    && operation?.family === 'SIF_TEE' && operation?.action === 'COPY'
    && operation?.status === 'PREVIEW_READY' && SIF_POLICIES.has(operation?.policyAuthority));
}
function encodeName(value, width) {
  const normalized = text(value);
  for (const char of normalized) if (char.codePointAt(0) > 0x7f) throw new Error('WRITER_1C_VALIDATOR_NON_ASCII');
  if (normalized.length > width) throw new Error('WRITER_1C_VALIDATOR_FIELD_OVERFLOW');
  return normalized.padEnd(width, ' ');
}
function exponential(value) {
  const [mantissa, rawExponent] = Number(value).toExponential(6).toUpperCase().split('E');
  const exponent = Number(rawExponent); const sign = exponent < 0 ? '-' : '+';
  return `${mantissa}E${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
}
function independentSig6(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('WRITER_1C_VALIDATOR_NONFINITE_SIF');
  const absolute = Math.abs(number);
  if (absolute < 1e-12) return '0.000000';
  if (absolute >= 1e9 || absolute < 1e-6) return exponential(number);
  if (absolute < 1.0) return number.toFixed(6);
  const integerDigits = String(Math.trunc(absolute)).length;
  return number.toFixed(Math.max(1, 6 - integerDigits));
}
function sameNumber(left, right) {
  const a = Number(left); const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-12);
}
function nodeAuthorizedSpans(beforeDocument, transferPlan, errors) {
  const custody = beforeDocument?.nodeNameEvidence?.physicalCustody; const operations = applyNodeNameOperations(transferPlan);
  const byNode = new Map(operations.map((operation) => [targetNodeId(operation), operation])); const spans = [];
  for (const [spanKey, span] of Object.entries(custody?.bySpan || {})) {
    const ownerNodes = [...new Set((span.owners || []).map((owner) => String(owner.nodeId)))];
    const selected = ownerNodes.map((nodeId) => byNode.get(nodeId)).filter(Boolean);
    if (!selected.length) continue;
    const desired = new Set(selected.map((operation) => encodeName(operation.proposed, Number(span.width))));
    if (desired.size !== 1) { errors.push(`AUTHORIZED_SPAN_CONFLICT:${spanKey}`); continue; }
    const unselected = ownerNodes.filter((nodeId) => !byNode.has(nodeId)); const afterField = [...desired][0];
    if (unselected.length && afterField !== span.rawField) errors.push(`AUTHORIZED_SPAN_UNAPPROVED_ALIAS:${spanKey}:${unselected.join(',')}`);
    for (const operation of selected) if (text(operation.before) !== text(span.value)) errors.push(`AUTHORIZED_SPAN_PREIMAGE_MISMATCH:${operation.operationId}:${spanKey}`);
    spans.push(Object.freeze({
      spanKey, byteStart: Number(span.byteStart), byteEnd: Number(span.byteEnd), beforeField: span.rawField, afterField,
      family: 'NODE_NAME', targetNodeIds: Object.freeze(selected.map(targetNodeId).sort()),
    }));
  }
  const selectedNodes = new Set(operations.map(targetNodeId));
  for (const nodeId of selectedNodes) if (!spans.some((span) => span.targetNodeIds.includes(nodeId))) errors.push(`AUTHORIZED_NODE_SPAN_MISSING:${nodeId}`);
  return spans;
}
function sifOwnerKey(parsedElementIndex, slot, item) { return `${Number(parsedElementIndex)}|${Number(slot)}|${Number(item)}`; }
function sifFieldKey(operation) {
  if (operation?.policyAuthority === 'CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK') return 'ii';
  if (operation?.policyAuthority === 'CII_WRITER_1C_SIF_OUT_PLANE_EXISTING_BLOCK') return 'io';
  return null;
}
function validateSifContext(operation, errors) {
  const context = operation?.sifContext || {}; const sourceCode = text(context.sourceCode).toUpperCase(); const targetCode = text(context.targetCode).toUpperCase();
  if (context.status !== 'QUALIFIED' || context.authority !== SIF_CONTEXT_AUTHORITY || !sourceCode || sourceCode !== targetCode) {
    errors.push(`SIF_CODE_CONTEXT_NOT_QUALIFIED:${operation?.operationId || 'unknown'}`);
  }
}
function sifAuthorizedSpans(beforeDocument, transferPlan, errors) {
  const custody = beforeDocument?.sifWriter1CEvidence; const operations = applySifOperations(transferPlan); const claims = [];
  if (!operations.length) return [];
  if (custody?.status !== 'QUALIFIED' || Number(custody?.neutralVersion?.major) !== 11) errors.push('SIF_V11_PHYSICAL_CUSTODY_REQUIRED');
  const byOwner = new Map();
  for (const operation of operations) {
    validateSifContext(operation, errors);
    const meta = operation?.sifField || {}; const fieldKey = sifFieldKey(operation);
    const binding = custody?.byParsedElementIndex?.[String(Number(meta.targetParsedElementIndex))];
    const block = binding ? custody?.byPointer?.[String(binding.pointer)] : null; const slot = block?.slots?.[Number(meta.slot)]; const field = fieldKey ? slot?.[fieldKey] : null;
    const expectedItem = fieldKey === 'ii' ? 3 : fieldKey === 'io' ? 4 : null;
    if (!binding || binding.bindingAuthority !== 'EXACT_PARSED_INDEX_AND_ENDPOINTS'
      || Number(binding.pointer) !== Number(meta.targetPointer) || Number(binding.pointer) <= 0
      || !field?.qualified || Number(field.item) !== expectedItem || Number(meta.item) !== expectedItem) {
      errors.push(`SIF_AUTHORIZED_FIELD_CUSTODY_MISMATCH:${operation?.operationId || 'unknown'}`); continue;
    }
    if (String(slot.node) !== String(meta.targetNode) || Number(slot.type) !== Number(meta.targetType)
      || Number(meta.sourceType) !== Number(meta.targetType) || meta.nodeMappingQualified !== true) {
      errors.push(`SIF_AUTHORIZED_FIELD_CONTEXT_MISMATCH:${operation?.operationId || 'unknown'}`); continue;
    }
    if (Number(meta.sourceNeutralVersion) !== 11 || Number(meta.targetNeutralVersion) !== 11) errors.push(`SIF_AUTHORIZED_EDITION_MISMATCH:${operation.operationId}`);
    const before = Number(operation.before); const proposed = Number(operation.proposed);
    if (!Number.isFinite(before) || before < 1.0 || !Number.isFinite(proposed) || proposed < 1.0 || !sameNumber(field.numericValue, before)) {
      errors.push(`SIF_AUTHORIZED_VALUE_DOMAIN_OR_PREIMAGE_MISMATCH:${operation.operationId}`); continue;
    }
    const token = independentSig6(proposed); const width = Number(field.width);
    if (token.length > width) { errors.push(`SIF_AUTHORIZED_FIELD_OVERFLOW:${operation.operationId}`); continue; }
    const spanKey = `${field.byteStart}:${field.byteEnd}`; const physical = custody?.bySpan?.[spanKey];
    if (!physical) { errors.push(`SIF_AUTHORIZED_SPAN_MISSING:${operation.operationId}:${spanKey}`); continue; }
    const owner = sifOwnerKey(meta.targetParsedElementIndex, meta.slot, meta.item); byOwner.set(owner, operation);
    claims.push(Object.freeze({
      spanKey, byteStart: Number(field.byteStart), byteEnd: Number(field.byteEnd), beforeField: field.rawField,
      afterField: token.padStart(width, ' '), family: 'SIF_TEE', operation, owners: physical.owners || Object.freeze([]),
    }));
  }
  const grouped = new Map(); for (const claim of claims) { if (!grouped.has(claim.spanKey)) grouped.set(claim.spanKey, []); grouped.get(claim.spanKey).push(claim); }
  const spans = [];
  for (const [spanKey, group] of grouped) {
    const desired = new Set(group.map((claim) => claim.afterField)); const before = new Set(group.map((claim) => claim.beforeField));
    if (desired.size !== 1 || before.size !== 1) { errors.push(`SIF_AUTHORIZED_SHARED_SPAN_CONFLICT:${spanKey}`); continue; }
    const ownerKeys = [...new Set((group[0].owners || []).map((owner) => sifOwnerKey(owner.parsedElementIndex, owner.slot, owner.item)))];
    const unselected = ownerKeys.filter((key) => !byOwner.has(key));
    if (unselected.length && group[0].beforeField !== group[0].afterField) errors.push(`SIF_AUTHORIZED_UNAPPROVED_ALIAS:${spanKey}:${unselected.join(',')}`);
    const allRequested = ownerKeys.map((key) => byOwner.get(key)).filter(Boolean);
    const allDesired = new Set(allRequested.map((operation) => independentSig6(operation.proposed).padStart(group[0].afterField.length, ' ')));
    if (allDesired.size > 1) { errors.push(`SIF_AUTHORIZED_SHARED_SPAN_CONFLICT:${spanKey}`); continue; }
    spans.push(Object.freeze({
      spanKey, byteStart: group[0].byteStart, byteEnd: group[0].byteEnd, beforeField: group[0].beforeField,
      afterField: group[0].afterField, family: 'SIF_TEE', operationIds: Object.freeze(group.map((item) => item.operation.operationId).sort()),
    }));
  }
  return spans;
}
function independentAuthorizedSpans(beforeDocument, transferPlan, errors) {
  const spans = [...nodeAuthorizedSpans(beforeDocument, transferPlan, errors), ...sifAuthorizedSpans(beforeDocument, transferPlan, errors)]
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd);
  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index - 1].byteStart < spans[index].byteEnd && spans[index].byteStart < spans[index - 1].byteEnd) {
      errors.push(`AUTHORIZED_SPAN_OVERLAP:${spans[index - 1].spanKey}:${spans[index].spanKey}`);
    }
  }
  return spans;
}
function actualByteDiff(beforeBytes, afterBytes, spans, errors) {
  if (beforeBytes.length !== afterBytes.length) { errors.push('BYTE_LENGTH_CHANGED'); return []; }
  const changed = []; let spanIndex = 0;
  for (let index = 0; index < beforeBytes.length; index += 1) {
    if (beforeBytes.charCodeAt(index) === afterBytes.charCodeAt(index)) continue;
    changed.push(index);
    while (spanIndex < spans.length && index >= spans[spanIndex].byteEnd) spanIndex += 1;
    const span = spans[spanIndex];
    if (!span || index < span.byteStart || index >= span.byteEnd) errors.push(`UNAUTHORIZED_BYTE_CHANGE:${index}`);
  }
  for (const span of spans) {
    if (beforeBytes.slice(span.byteStart, span.byteEnd) !== span.beforeField) errors.push(`VALIDATOR_BEFORE_FIELD_MISMATCH:${span.spanKey}`);
    if (afterBytes.slice(span.byteStart, span.byteEnd) !== span.afterField) errors.push(`VALIDATOR_AFTER_FIELD_MISMATCH:${span.spanKey}`);
  }
  return changed;
}
function sectionOrder(document) {
  return (document?.physicalFile?.lines || []).map((line) => String(line.text || '').match(/^\s*#\$\s*(.*?)\s*$/)?.[1]?.toUpperCase()).filter(Boolean);
}
function sectionCount(document, names) { return ciiPhysicalSectionRows(document?.physicalFile, names).length; }
function pointerSnapshot(document) {
  return Object.values(document?.auxiliaryEvidence?.elements || {}).map((item) => ({
    parsedElementIndex: item.parsedElementIndex, from: item.from, to: item.to, pointers: item.pointers,
  }));
}
function sifStructureSnapshot(document) {
  const custody = document?.sifWriter1CEvidence || {};
  return {
    neutralVersion: custody.neutralVersion?.major ?? null, blockRows: custody.blockRows, controlBlockCount: custody.controlBlockCount,
    sectionRowCount: custody.sectionRowCount,
    elements: Object.values(custody.byParsedElementIndex || {}).map((item) => ({
      parsedElementIndex: item.parsedElementIndex, blockIndex: item.blockIndex, from: item.from, to: item.to, pointer: item.pointer,
    })),
    blocks: Object.values(custody.byPointer || {}).map((block) => ({
      pointer: block.pointer,
      slots: [1, 2].map((slot) => ({ slot, node: block.slots?.[slot]?.node, type: block.slots?.[slot]?.type })),
      ownerElements: (block.owners || []).map((owner) => owner.parsedElementIndex).sort((a, b) => a - b),
    })),
  };
}
function connectivity(document) {
  return (document?.parsed?.elements || []).map((item) => ({ index: item.index, from: item.from, to: item.to }));
}
function structuralChecks(before, after, errors) {
  if (before?.physicalFile?.byteLength !== after?.physicalFile?.byteLength) errors.push('PHYSICAL_BYTE_LENGTH_CHANGED');
  if ((before?.physicalFile?.lines || []).length !== (after?.physicalFile?.lines || []).length) errors.push('PHYSICAL_LINE_COUNT_CHANGED');
  if (stableStringify(before?.physicalFile?.lineEndings?.sequence) !== stableStringify(after?.physicalFile?.lineEndings?.sequence)) errors.push('LINE_ENDING_SEQUENCE_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('SECTION_ORDER_CHANGED');
  const beforeElementRows = ciiPhysicalSectionRows(before?.physicalFile, 'ELEMENTS'); const afterElementRows = ciiPhysicalSectionRows(after?.physicalFile, 'ELEMENTS');
  if (beforeElementRows.length !== afterElementRows.length || beforeElementRows.length % 15 !== 0 || afterElementRows.length % 15 !== 0) errors.push('ELEMENT_15_ROW_CARDINALITY_CHANGED');
  if (stableStringify(pointerSnapshot(before)) !== stableStringify(pointerSnapshot(after))) errors.push('AUXILIARY_POINTER_OWNERSHIP_CHANGED');
  if (stableStringify(sifStructureSnapshot(before)) !== stableStringify(sifStructureSnapshot(after))) errors.push('SIF_TEE_STRUCTURE_TYPE_OR_OWNERSHIP_CHANGED');
  if (stableStringify(ciiPhysicalSectionRows(before?.physicalFile, 'CONTROL').map((row) => row.text))
    !== stableStringify(ciiPhysicalSectionRows(after?.physicalFile, 'CONTROL').map((row) => row.text))) errors.push('CONTROL_VALUES_CHANGED');
  for (const [label, names] of [['NODENAME', 'NODENAME'], ['SIF_TEE', ['SIF&TEES', 'SIF']], ['RESTRANT', 'RESTRANT'], ['RIGID', 'RIGID'], ['MISCEL_1', 'MISCEL_1']]) {
    if (sectionCount(before, names) !== sectionCount(after, names)) errors.push(`${label}_ROW_COUNT_CHANGED`);
  }
  if (stableStringify(before?.parsed?.nodes || {}) !== stableStringify(after?.parsed?.nodes || {})) errors.push('NODE_IDENTITIES_OR_GEOMETRY_CHANGED');
  if (stableStringify(connectivity(before)) !== stableStringify(connectivity(after))) errors.push('ELEMENT_CONNECTIVITY_CHANGED');
}
function nonSifAuxiliarySnapshot(document) {
  const aux = document?.auxiliaryEvidence || {};
  return { restraints: aux.restraints || null, rigids: aux.rigids || null, miscel1SectionRowCount: aux.miscel1SectionRowCount ?? null };
}
function nodeSemanticChecks(before, after, transferPlan, errors) {
  const expected = { ...(before?.nodeNames || {}) }; const operations = applyNodeNameOperations(transferPlan); const intended = new Set();
  for (const operation of operations) { const nodeId = targetNodeId(operation); expected[nodeId] = text(operation.proposed); intended.add(nodeId); }
  if (stableStringify(expected) !== stableStringify(after?.nodeNames || {})) errors.push('NODE_NAME_SEMANTIC_POSTCONDITION_FAILED');
  const actualChanged = new Set([...new Set([...Object.keys(before?.nodeNames || {}), ...Object.keys(after?.nodeNames || {})])]
    .filter((nodeId) => text(before?.nodeNames?.[nodeId]) !== text(after?.nodeNames?.[nodeId])));
  const unexpected = [...actualChanged].filter((nodeId) => !intended.has(nodeId));
  if (unexpected.length) errors.push(`UNEXPECTED_NODE_NAME_DELTA:${unexpected.join(',')}`);
  return { intended: intended.size, actual: actualChanged.size, unexpected: unexpected.length };
}
function sifSemanticChecks(after, transferPlan, errors) {
  const operations = applySifOperations(transferPlan); let actual = 0;
  for (const operation of operations) {
    const meta = operation?.sifField || {}; const custody = after?.sifWriter1CEvidence; const binding = custody?.byParsedElementIndex?.[String(Number(meta.targetParsedElementIndex))];
    const block = binding ? custody?.byPointer?.[String(binding.pointer)] : null; const slot = block?.slots?.[Number(meta.slot)]; const field = slot?.[sifFieldKey(operation)];
    if (!field?.qualified || !sameNumber(field.numericValue, operation.proposed)) errors.push(`SIF_SEMANTIC_POSTCONDITION_FAILED:${operation.operationId}`);
    else actual += 1;
  }
  return { intended: operations.length, actual };
}
function semanticChecks(before, after, transferPlan, errors) {
  const node = nodeSemanticChecks(before, after, transferPlan, errors); const sif = sifSemanticChecks(after, transferPlan, errors);
  if (stableStringify(nonSifAuxiliarySnapshot(before)) !== stableStringify(nonSifAuxiliarySnapshot(after))) errors.push('UNEXPECTED_NON_SIF_AUXILIARY_SEMANTIC_CHANGE');
  if (stableStringify(before?.hangerEvidence || {}) !== stableStringify(after?.hangerEvidence || {})) errors.push('UNEXPECTED_HANGER_SEMANTIC_CHANGE');
  return {
    expectedSemanticDeltaCount: node.intended + sif.intended,
    actualSemanticDeltaCount: node.actual + sif.actual,
    unexpectedSemanticDeltaCount: node.unexpected,
    expectedSifDeltaCount: sif.intended, actualSifDeltaCount: sif.actual,
  };
}
function writerClaimCheck(writerResult, spans, errors) {
  const expected = spans.map((span) => `${span.byteStart}:${span.byteEnd}`).sort();
  const reported = (writerResult?.mutations || []).map((item) => `${Number(item.absoluteByteStart)}:${Number(item.absoluteByteEnd)}`).sort();
  if (stableStringify(expected) !== stableStringify(reported)) errors.push('WRITER_REPORTED_SPAN_SET_MISMATCH');
}

export function validateCiiWriter1CRoundTrip(beforeDocument, afterDocument, transferPlan, writerResult) {
  const errors = [];
  if (beforeDocument?.writer1CByteEligible !== true || afterDocument?.writer1CByteEligible !== true) errors.push('ORIGINAL_BYTE_CUSTODY_REQUIRED');
  const spans = independentAuthorizedSpans(beforeDocument, transferPlan, errors);
  const changed = actualByteDiff(String(beforeDocument?.physicalFile?.originalByteString ?? ''), String(afterDocument?.physicalFile?.originalByteString ?? ''), spans, errors);
  structuralChecks(beforeDocument, afterDocument, errors);
  const semantic = semanticChecks(beforeDocument, afterDocument, transferPlan, errors);
  writerClaimCheck(writerResult, spans, errors);
  if (errors.length) throw new Error(`CII_WRITER_1C_NEGATIVE_ASSURANCE_FAILED:${[...new Set(errors)].join('|')}`);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter1CValidation.v2', status: 'PASS',
    authorizedSpanCount: spans.length, changedByteCount: changed.length,
    expectedSemanticDeltaCount: semantic.expectedSemanticDeltaCount,
    actualSemanticDeltaCount: semantic.actualSemanticDeltaCount,
    unexpectedSemanticDeltaCount: semantic.unexpectedSemanticDeltaCount,
    expectedSifDeltaCount: semantic.expectedSifDeltaCount, actualSifDeltaCount: semantic.actualSifDeltaCount,
    checks: Object.freeze([
      'BYTE_DIFF_SUBSET_OF_INDEPENDENT_AUTHORIZATION', 'EXACT_AUTHORIZED_PREIMAGE_AND_POSTIMAGE',
      'LINE_AND_SECTION_STRUCTURE_UNCHANGED', 'ELEMENT_POINTERS_AND_CONTROL_UNCHANGED',
      'SIF_EDITION_SLOT_TYPE_NODE_AND_OWNERSHIP_UNCHANGED', 'AUXILIARY_SECTION_COUNTS_UNCHANGED',
      'NODE_AND_CONNECTIVITY_UNCHANGED', 'EXPECTED_NODE_NAME_AND_SIF_SEMANTICS_ONLY',
      'NON_SIF_AUXILIARY_AND_HANGER_SEMANTICS_UNCHANGED', 'WRITER_REPORT_MATCHES_INDEPENDENT_SPANS',
    ]),
  });
}
