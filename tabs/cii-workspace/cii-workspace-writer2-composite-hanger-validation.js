import { stableStringify } from './cii-workspace-contracts.js';
import { CII_SIX_FIELD_WIDTHS, decodeCiiNumericRow } from '../../parser/fixed-field.js';
import { ciiPhysicalSectionRows } from './cii-workspace-physical-file.js';
import { buildCiiWriter2NodeNameRelocationPlan } from './cii-workspace-writer2-nodename-relocation.js';
import { buildCiiWriter2SifDeleteRelocationPlan, CII_WRITER_2_SIF_CREATE_BLOCKER } from './cii-workspace-writer2-sif-delete.js';
import {
  buildCiiWriter2HangerDeletePlan, CII_WRITER_2_HANGER_CREATE_BLOCKER,
} from './cii-workspace-writer2-hanger-delete.js';
import { CII_HANGER_LAYOUTS } from './cii-workspace-hanger.js';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const HANGER_PROPERTY = 'Hanger presence';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const WIDTH = 13;
const SIF_ROWS = 10;
const EXECUTION_ROWS = 4;

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sortedUnique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sameStrings(left, right) {
  const a = sortedUnique(left); const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function exactIdsForValidation(values, code, errors) {
  if (!Array.isArray(values)) { errors.push(`${code}_ARRAY_REQUIRED`); return []; }
  const ids = values.map(text);
  if (ids.some((id) => !id)) errors.push(`${code}_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) errors.push(`${code}_DUPLICATE_ID`);
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function exactOperationIdsForValidation(operations, code, errors) {
  return exactIdsForValidation((operations || []).map(operationId), code, errors);
}
function isMutable(operation) { return operation?.action !== 'KEEP'; }
function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function isNodeMutation(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'NODE_NAME'
    && operation?.property === NODE_PROPERTY && ['CREATE', 'DELETE'].includes(operation?.action);
}
function isSifCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY && operation?.action === 'CREATE';
}
function isSifDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY && operation?.action === 'DELETE';
}
function isHangerCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY && operation?.action === 'CREATE';
}
function isHangerDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY && operation?.action === 'DELETE';
}
function supportedApply(operation) { return isNodeMutation(operation) || isSifDelete(operation) || isHangerDelete(operation); }
function appliedOperations(transferPlan) {
  return (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
}
function excludedOperations(transferPlan) {
  return (transferPlan?.excludedOperations || []).filter((operation) => operation?.scopeDecision === 'EXCLUDE');
}
function independentBoundScopeCustody(transferPlan, before) {
  const errors = []; const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    errors.push('CANONICAL_BOUND_SCOPE_REQUIRED');
  }
  const allPlanRows = [...(transferPlan?.operations || []), ...(transferPlan?.excludedOperations || [])];
  exactOperationIdsForValidation(allPlanRows, 'PLAN_OPERATION', errors);
  const appliedRows = appliedOperations(transferPlan).filter(isMutable);
  const excludedRows = excludedOperations(transferPlan).filter(isMutable);
  const appliedIds = exactOperationIdsForValidation(appliedRows, 'PLAN_APPLY', errors);
  const excludedIds = exactOperationIdsForValidation(excludedRows, 'PLAN_EXCLUDE', errors);
  if (appliedIds.some((id) => excludedIds.includes(id))) errors.push('PLAN_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = [...appliedIds, ...excludedIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const scopeAppliedIds = exactIdsForValidation(scope?.appliedOperationIds, 'SCOPE_APPLY', errors);
  const scopeExcludedIds = exactIdsForValidation(scope?.excludedOperationIds, 'SCOPE_EXCLUDE', errors);
  const scopeCandidateIds = exactIdsForValidation(scope?.candidateOperationIds, 'SCOPE_CANDIDATE', errors);
  if (scopeAppliedIds.some((id) => scopeExcludedIds.includes(id))) errors.push('SCOPE_APPLY_EXCLUDE_OVERLAP');
  if (!sameStrings(appliedIds, scopeAppliedIds)) errors.push('SCOPE_APPLY_SET_MISMATCH');
  if (!sameStrings(excludedIds, scopeExcludedIds)) errors.push('SCOPE_EXCLUDE_SET_MISMATCH');
  if (!sameStrings(candidateIds, scopeCandidateIds)) errors.push('SCOPE_CANDIDATE_SET_MISMATCH');

  const sourceAuthorityKind = text(scope?.sourceAuthorityKind || transferPlan?.sourceAuthorityKind || 'DOCUMENT').toUpperCase();
  let sourceSha256 = ''; let sourceSetSha256 = '';
  if (sourceAuthorityKind === 'SOURCE_SET') {
    sourceSetSha256 = text(transferPlan?.sourceSetSha256 || transferPlan?.sourceAuthority?.sourceSetSha256);
    if (!sourceSetSha256 || sourceSetSha256 !== text(scope?.sourceSetSha256)) errors.push('SCOPE_SOURCE_SET_HASH_MISMATCH');
  } else {
    sourceSha256 = text(transferPlan?.sourceDocument?.contentSha256);
    if (!sourceSha256 || sourceSha256 !== text(scope?.sourceSha256)) errors.push('SCOPE_SOURCE_HASH_MISMATCH');
  }

  const normalizedTargetSha256 = text(before?.contentSha256);
  if (!normalizedTargetSha256 || (text(transferPlan?.targetDocument?.contentSha256) && text(transferPlan?.targetDocument?.contentSha256) !== normalizedTargetSha256)) {
    errors.push('NORMALIZED_TARGET_HASH_MISMATCH');
  }
  const targetAuthorityKind = text(scope?.targetAuthorityKind || transferPlan?.targetAuthorityKind || 'DOCUMENT').toUpperCase();
  let originalTargetSha256 = '';
  if (targetAuthorityKind === 'ORIGINAL_TARGET') {
    originalTargetSha256 = text(transferPlan?.targetAuthority?.originalSha256);
    if (!originalTargetSha256 || originalTargetSha256 !== text(scope?.targetSha256)) errors.push('SCOPE_ORIGINAL_TARGET_HASH_MISMATCH');
  } else if (text(scope?.targetSha256) !== normalizedTargetSha256) errors.push('SCOPE_TARGET_HASH_MISMATCH');

  return Object.freeze({
    errors: Object.freeze(errors),
    custody: Object.freeze({
      parentScopeId: text(scope?.scopeId), sourceAuthorityKind, sourceSha256, sourceSetSha256,
      targetAuthorityKind, targetSha256: normalizedTargetSha256, originalTargetSha256, parentTargetSha256: text(scope?.targetSha256),
      candidateOperationIds: Object.freeze(candidateIds), appliedOperationIds: Object.freeze(appliedIds), excludedOperationIds: Object.freeze(excludedIds),
    }),
  });
}
function projectPlan(transferPlan, predicate, family, parentCustody) {
  const projectedApply = []; const siblingExcludes = []; const keeps = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision === 'APPLY') {
      if (predicate(operation)) projectedApply.push(operation);
      else siblingExcludes.push(Object.freeze({ ...operation, scopeDecision: 'EXCLUDE' }));
    } else keeps.push(operation);
  }
  return Object.freeze({
    ...transferPlan,
    operations: Object.freeze([...keeps, ...projectedApply]),
    excludedOperations: Object.freeze([...(transferPlan?.excludedOperations || []), ...siblingExcludes]),
    transferScope: transferPlan.transferScope,
    familyProjection: Object.freeze({
      schema: 'CIIWorkspaceWriter2FamilyProjection.v1', status: 'DERIVED_BOUND_SUBSET', authority: 'PARENT_TRANSFER_SCOPE_SUBSET_ONLY', family,
      parentScopeId: parentCustody.parentScopeId, parentAppliedOperationIds: parentCustody.appliedOperationIds,
      projectedAppliedOperationIds: Object.freeze(sortedUnique(projectedApply.map(operationId))),
      siblingAppliedOperationIds: Object.freeze(sortedUnique(siblingExcludes.map(operationId))),
    }),
  });
}
function integerField(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_INTEGER_INVALID');
  const token = String(number);
  if (token.length > WIDTH) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_INTEGER_OVERFLOW');
  return token.padStart(WIDTH, ' ');
}
function exponential(value) {
  const [mantissa, rawExponent] = Number(value).toExponential(6).toUpperCase().split('E');
  const exponent = Number(rawExponent);
  return `${mantissa}E${exponent < 0 ? '-' : '+'}${String(Math.abs(exponent)).padStart(2, '0')}`;
}
function independentSig6(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_NUMERIC_INVALID');
  const absolute = Math.abs(number);
  if (absolute < 1e-12) return '0.000000';
  if (absolute >= 1e9 || absolute < 1e-6) return exponential(number);
  if (absolute < 1.0) return number.toFixed(6);
  const integerDigits = String(Math.trunc(absolute)).length;
  return number.toFixed(Math.max(1, 6 - integerDigits));
}
function numericField(value) {
  const token = independentSig6(value);
  if (token.length > WIDTH) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_NUMERIC_OVERFLOW');
  return token.padStart(WIDTH, ' ');
}
function lineEnding(kind) {
  if (kind === 'CRLF') return '\r\n';
  if (kind === 'LF') return '\n';
  if (kind === 'CR') return '\r';
  if (kind === 'NONE') return '';
  throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_LINE_ENDING_UNSUPPORTED:${kind || 'EMPTY'}`);
}
function sectionEnvelope(document, wanted) {
  const names = new Set((Array.isArray(wanted) ? wanted : [wanted]).map((item) => String(item).toUpperCase()));
  const lines = document?.physicalFile?.lines || [];
  const markerIndex = lines.findIndex((line) => names.has(markerName(line.text)));
  if (markerIndex < 0) throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_SECTION_NOT_FOUND:${[...names].join('|')}`);
  let nextIndex = markerIndex + 1;
  while (nextIndex < lines.length && markerName(lines[nextIndex].text) === null) nextIndex += 1;
  if (nextIndex >= lines.length) throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_NEXT_SECTION_REQUIRED:${[...names].join('|')}`);
  return { marker: lines[markerIndex], nextMarker: lines[nextIndex], rows: lines.slice(markerIndex + 1, nextIndex) };
}
function controlField(before, rowIndex, fieldIndex, beforeCount, afterCount, kind, authorityFamily) {
  const rows = ciiPhysicalSectionRows(before?.physicalFile, 'CONTROL', { includeBlank: true });
  const row = rows[rowIndex];
  if (!row) throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_CONTROL_ROW_REQUIRED:${rowIndex + 1}`);
  const startColumn = CII_SIX_FIELD_WIDTHS.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
  const byteStart = Number(row.byteStart) + startColumn; const byteEnd = byteStart + WIDTH;
  const original = String(before?.physicalFile?.originalByteString || '');
  const beforeField = original.slice(byteStart, byteEnd);
  if (beforeField !== integerField(beforeCount)) throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_CONTROL_PREIMAGE:${kind}`);
  return { authorityFamily, kind, byteStart, byteEnd, beforeField, afterField: integerField(afterCount) };
}
function nodeExpectedClaims(before, plan) {
  const original = String(before?.physicalFile?.originalByteString || '');
  const claims = [controlField(before, 0, 3, plan.controlCountBefore, plan.controlCountAfter, 'CONTROL_NONAM', 'WRITER_2_NODENAME')];
  for (const change of plan.pointerChanges || []) {
    const byteStart = Number(change.pointerField?.byteStart); const byteEnd = Number(change.pointerField?.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== WIDTH) {
      throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_NODE_POINTER_SPAN');
    }
    claims.push({
      authorityFamily: 'WRITER_2_NODENAME', kind: 'ELEMENT_NODENAME_POINTER', parsedElementIndex: Number(change.parsedElementIndex),
      byteStart, byteEnd, beforeField: original.slice(byteStart, byteEnd), afterField: integerField(change.newPointer),
    });
  }
  const envelope = sectionEnvelope(before, 'NODENAME');
  if (envelope.rows.some((row) => !String(row.text || '').trim())) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_BLANK_NODENAME_ROW');
  if (envelope.rows.some((row) => String(row.text || '').length !== 53)) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_NODENAME_WIDTH');
  if (envelope.rows.length !== Number(plan.rowCountBefore)) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_NODENAME_PRECOUNT');
  const appendEnding = envelope.rows.length ? envelope.rows[envelope.rows.length - 1].lineEnding : envelope.marker.lineEnding;
  const afterField = (plan.finalRows || []).map((row) => {
    const ending = row.oldPointer == null ? appendEnding : envelope.rows[Number(row.oldPointer) - 1]?.lineEnding;
    if (!ending || ending === 'NONE') throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_NODENAME_ENDING:${row.oldPointer ?? 'NEW'}`);
    return `${String(row.rowText)}${lineEnding(ending)}`;
  }).join('');
  claims.push({
    authorityFamily: 'WRITER_2_NODENAME', kind: 'NODENAME_SECTION_PAYLOAD',
    byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: original.slice(Number(envelope.marker.byteEnd), Number(envelope.nextMarker.byteStart)), afterField,
  });
  return claims;
}
function sifExpectedClaims(before, plan) {
  const original = String(before?.physicalFile?.originalByteString || '');
  const claims = [controlField(before, 2, 4, plan.controlCountBefore, plan.controlCountAfter, 'CONTROL_SIF_TEE_COUNT', 'WRITER_2_SIF_DELETE')];
  for (const change of plan.pointerChanges || []) {
    const byteStart = Number(change.pointerField?.byteStart); const byteEnd = Number(change.pointerField?.byteEnd);
    if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteEnd - byteStart !== WIDTH) {
      throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_SIF_POINTER_SPAN');
    }
    claims.push({
      authorityFamily: 'WRITER_2_SIF_DELETE', kind: 'ELEMENT_SIF_TEE_POINTER', parsedElementIndex: Number(change.parsedElementIndex),
      byteStart, byteEnd, beforeField: original.slice(byteStart, byteEnd), afterField: integerField(change.newPointer),
    });
  }
  const envelope = sectionEnvelope(before, ['SIF&TEES', 'SIF']);
  if (envelope.rows.length !== Number(plan.blockCountBefore) * SIF_ROWS) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_SIF_PRECOUNT');
  const retained = [];
  for (const pointer of plan.retainedPointers || []) {
    const start = (Number(pointer) - 1) * SIF_ROWS;
    const rows = envelope.rows.slice(start, start + SIF_ROWS);
    if (rows.length !== SIF_ROWS) throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_SIF_BLOCK_TRUNCATED:${pointer}`);
    for (const row of rows) {
      if (row.lineEnding === 'NONE') throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_SIF_ENDING:${pointer}:${row.lineNumber}`);
      retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
    }
  }
  claims.push({
    authorityFamily: 'WRITER_2_SIF_DELETE', kind: 'SIF_TEE_SECTION_PAYLOAD',
    byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: original.slice(Number(envelope.marker.byteEnd), Number(envelope.nextMarker.byteStart)), afterField: retained.join(''),
  });
  return claims;
}
function ceilDiv(value, divisor) { return Math.floor(value / divisor) + (value % divisor ? 1 : 0); }
function hangerPhysicalCounts(before) {
  const control = before?.hangerEvidence?.control || {};
  const numelt = Number(control.numelt); const numnoz = Number(control.numnoz); const count = Number(before?.hangerEvidence?.count);
  if (![numelt, numnoz, count].every(Number.isSafeInteger) || numelt < 0 || numnoz < 0 || count <= 0) {
    throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_HANGER_COUNTS_INVALID');
  }
  const prefixRows = ceilDiv(numelt, 6) + 4 * numnoz;
  const hangerRows = 2 + 5 * count + 5 * ceilDiv(count, 6);
  return { count, prefixRows, hangerRows, rowCountBefore: prefixRows + hangerRows + EXECUTION_ROWS, rowCountAfter: prefixRows + EXECUTION_ROWS };
}
function hangerExpectedClaims(before, plan) {
  if (plan?.compaction?.deleteAll !== true || Number(plan.countAfter) !== 0) {
    throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_DELETE_ALL_PLAN_REQUIRED');
  }
  const claims = [controlField(before, 0, 2, plan.controlCountBefore, 0, 'CONTROL_HANGER_COUNT', 'WRITER_2_HANGER_DELETE_ALL')];
  const envelope = sectionEnvelope(before, 'MISCEL_1');
  const original = String(before?.physicalFile?.originalByteString || '');
  const counts = hangerPhysicalCounts(before);
  if (Number(plan.countBefore) !== counts.count) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_HANGER_PRECOUNT_MISMATCH');
  if (envelope.rows.length !== counts.rowCountBefore) {
    throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_MISCEL_PRECOUNT:${envelope.rows.length}:${counts.rowCountBefore}`);
  }
  const retainedRows = [
    ...envelope.rows.slice(0, counts.prefixRows),
    ...envelope.rows.slice(envelope.rows.length - EXECUTION_ROWS),
  ];
  if (retainedRows.length !== counts.rowCountAfter) throw new Error('WRITER_2_COMPOSITE_HANGER_VALIDATOR_MISCEL_POSTCOUNT_DERIVATION');
  const retained = [];
  for (const row of retainedRows) {
    if (row.lineEnding === 'NONE') throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_MISCEL_ENDING:${row.lineNumber}`);
    retained.push(original.slice(Number(row.byteStart), Number(row.byteEnd)));
  }
  claims.push({
    authorityFamily: 'WRITER_2_HANGER_DELETE_ALL', kind: 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD',
    byteStart: Number(envelope.marker.byteEnd), byteEnd: Number(envelope.nextMarker.byteStart),
    beforeField: original.slice(Number(envelope.marker.byteEnd), Number(envelope.nextMarker.byteStart)), afterField: retained.join(''),
  });
  return claims;
}
function arbitrateExpected(claims, original) {
  const sorted = claims.filter((item) => item.beforeField !== item.afterField)
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd || a.authorityFamily.localeCompare(b.authorityFamily));
  for (const claim of sorted) {
    if (original.slice(claim.byteStart, claim.byteEnd) !== claim.beforeField) {
      throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_PREIMAGE_MISMATCH:${claim.authorityFamily}:${claim.kind}`);
    }
  }
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].byteStart < sorted[index - 1].byteEnd) {
      throw new Error(`WRITER_2_COMPOSITE_HANGER_VALIDATOR_OVERLAP:${sorted[index - 1].authorityFamily}:${sorted[index - 1].kind}:${sorted[index].authorityFamily}:${sorted[index].kind}`);
    }
  }
  return sorted;
}
function applyExpected(original, claims) {
  let cursor = 0; let output = '';
  for (const claim of claims) {
    output += original.slice(cursor, claim.byteStart) + claim.afterField;
    cursor = claim.byteEnd;
  }
  return output + original.slice(cursor);
}
function connectivity(document) {
  return (document?.parsed?.elements || []).map((item) => ({ index: Number(item.index), from: String(item.from), to: String(item.to) }));
}
function sectionOrder(document) {
  return (document?.physicalFile?.lines || []).map((line) => markerName(line.text)).filter(Boolean);
}
function controlValue(document, rowIndex, fieldIndex) {
  const row = ciiPhysicalSectionRows(document?.physicalFile, 'CONTROL')[rowIndex];
  const values = row ? decodeCiiNumericRow(row.text) : [];
  return Number(values?.[fieldIndex]);
}
function nodePointerSnapshot(document) {
  return Object.values(document?.nodeNameEvidence?.physicalCustody?.byElementIndex || {}).map((item) => ({
    parsedElementIndex: Number(item.parsedElementIndex), pointer: Number(item.pointer),
  })).sort((a, b) => a.parsedElementIndex - b.parsedElementIndex);
}
function expectedNodePointers(before, plan) {
  const changes = new Map((plan?.pointerChanges || []).map((item) => [Number(item.parsedElementIndex), Number(item.newPointer)]));
  return nodePointerSnapshot(before).map((item) => ({ ...item, pointer: changes.has(item.parsedElementIndex) ? changes.get(item.parsedElementIndex) : item.pointer }));
}
function sifPointerSnapshot(document) {
  return Object.values(document?.sifWriter1CEvidence?.byParsedElementIndex || {}).map((item) => ({
    parsedElementIndex: Number(item.parsedElementIndex), pointer: Number(item.pointer),
  })).sort((a, b) => a.parsedElementIndex - b.parsedElementIndex);
}
function expectedSifPointers(before, plan) {
  const changes = new Map((plan?.pointerChanges || []).map((item) => [Number(item.parsedElementIndex), Number(item.newPointer)]));
  return sifPointerSnapshot(before).map((item) => ({ ...item, pointer: changes.has(item.parsedElementIndex) ? changes.get(item.parsedElementIndex) : item.pointer }));
}
function mutationTestimony(writerResult) {
  return (writerResult?.mutations || []).map((item) => ({
    authorityFamily: item.authorityFamily, kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
function expectedTestimony(claims) {
  return claims.map((item) => ({
    authorityFamily: item.authorityFamily, kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
function nodePlanTestimony(plan) {
  if (!plan) return null;
  return {
    rowCountAfter: Number(plan.rowCountAfter), oldToNewPointer: plan.oldToNewPointer || {},
    pointerChanges: (plan.pointerChanges || []).map((item) => [Number(item.parsedElementIndex), Number(item.oldPointer), Number(item.newPointer)]),
  };
}
function sifPlanTestimony(plan) {
  if (!plan) return null;
  return {
    blockCountAfter: Number(plan.blockCountAfter), deletedPointers: [...(plan.deletedPointers || [])], oldToNewPointer: plan.oldToNewPointer || {},
    pointerChanges: (plan.pointerChanges || []).map((item) => [Number(item.parsedElementIndex), Number(item.oldPointer), Number(item.newPointer)]),
  };
}
function hangerPlanTestimony(plan) {
  if (!plan) return null;
  return {
    countBefore: Number(plan.countBefore), countAfter: Number(plan.countAfter), deletedRecordIndices: [...(plan.deletedRecordIndices || [])],
    deletedNodes: [...(plan.deletedNodes || [])], deleteAll: plan?.compaction?.deleteAll === true,
    expectedMiscelRowsAfter: Number(plan?.compaction?.expectedMiscelRowsAfter),
  };
}
function parentScopeTestimony(value) {
  if (!value) return null;
  return {
    parentScopeId: text(value.parentScopeId), sourceAuthorityKind: text(value.sourceAuthorityKind),
    sourceSha256: text(value.sourceSha256), sourceSetSha256: text(value.sourceSetSha256),
    targetAuthorityKind: text(value.targetAuthorityKind), targetSha256: text(value.targetSha256),
    originalTargetSha256: text(value.originalTargetSha256), parentTargetSha256: text(value.parentTargetSha256),
    candidateOperationIds: [...(value.candidateOperationIds || [])], appliedOperationIds: [...(value.appliedOperationIds || [])], excludedOperationIds: [...(value.excludedOperationIds || [])],
  };
}

export function validateCiiWriter2CompositeWithHangerRoundTrip(before, after, targetGraph, transferPlan, writerResult) {
  const errors = [];
  const scopeCheck = independentBoundScopeCustody(transferPlan, before);
  errors.push(...scopeCheck.errors);
  const applied = appliedOperations(transferPlan);
  const sifCreates = applied.filter(isSifCreate);
  const hangerCreates = applied.filter(isHangerCreate);
  if (sifCreates.length) errors.push(`${CII_WRITER_2_SIF_CREATE_BLOCKER}:${sifCreates.map((item) => item.operationId || 'unknown').join(',')}`);
  if (hangerCreates.length) errors.push(`${CII_WRITER_2_HANGER_CREATE_BLOCKER}:${hangerCreates.map((item) => item.operationId || 'unknown').join(',')}`);
  const unsupported = applied.filter((operation) => !supportedApply(operation) && !isSifCreate(operation) && !isHangerCreate(operation));
  if (unsupported.length) errors.push(`UNSUPPORTED_APPLY:${unsupported.map((item) => item.operationId || 'unknown').join(',')}`);

  const nodeCount = applied.filter(isNodeMutation).length;
  const sifCount = applied.filter(isSifDelete).length;
  const hangerCount = applied.filter(isHangerDelete).length;
  if (!nodeCount && !sifCount && !hangerCount) errors.push('NO_COMPOSITE_MUTATIONS');
  const scopeReady = scopeCheck.errors.length === 0;
  const nodePlan = nodeCount && scopeReady ? buildCiiWriter2NodeNameRelocationPlan({
    targetDocument: before, transferPlan: projectPlan(transferPlan, isNodeMutation, 'WRITER_2_NODENAME', scopeCheck.custody),
  }) : null;
  const sifPlan = sifCount && scopeReady ? buildCiiWriter2SifDeleteRelocationPlan({
    targetDocument: before, targetGraph, transferPlan: projectPlan(transferPlan, isSifDelete, 'WRITER_2_SIF_DELETE', scopeCheck.custody),
  }) : null;
  const hangerPlan = hangerCount && scopeReady ? buildCiiWriter2HangerDeletePlan({
    targetDocument: before, transferPlan: projectPlan(transferPlan, isHangerDelete, 'WRITER_2_HANGER_DELETE_ALL', scopeCheck.custody),
  }) : null;
  if (nodePlan && !nodePlan.ready) errors.push(...nodePlan.blockers.map((item) => `INDEPENDENT_NODE_PLAN_BLOCKED:${item}`));
  if (sifPlan && !sifPlan.ready) errors.push(...sifPlan.blockers.map((item) => `INDEPENDENT_SIF_PLAN_BLOCKED:${item}`));
  if (hangerPlan && !hangerPlan.ready) errors.push(...hangerPlan.blockers.map((item) => `INDEPENDENT_HANGER_PLAN_BLOCKED:${item}`));
  if (hangerPlan && (hangerPlan?.compaction?.deleteAll !== true || Number(hangerPlan.countAfter) !== 0)) {
    errors.push('INDEPENDENT_HANGER_DELETE_ALL_SCOPE_NOT_PROVEN');
  }

  const original = String(before?.physicalFile?.originalByteString || '');
  const expectedClaims = [];
  if (nodePlan?.ready) expectedClaims.push(...nodeExpectedClaims(before, nodePlan));
  if (sifPlan?.ready) expectedClaims.push(...sifExpectedClaims(before, sifPlan));
  if (hangerPlan?.ready && hangerPlan?.compaction?.deleteAll === true) expectedClaims.push(...hangerExpectedClaims(before, hangerPlan));
  const arbitrated = arbitrateExpected(expectedClaims, original);
  const expectedBytes = applyExpected(original, arbitrated);
  const actualBytes = String(after?.physicalFile?.originalByteString || '');

  if (after?.writer1CByteEligible !== true) errors.push('POST_ORIGINAL_BYTE_CUSTODY_NOT_QUALIFIED');
  if (actualBytes !== expectedBytes) errors.push('EXACT_TRI_FAMILY_POSTIMAGE_MISMATCH');
  if (writerResult?.byteString == null || String(writerResult.byteString) !== actualBytes) errors.push('RESULT_BYTES_MISMATCH');
  if (writerResult?.schema !== 'CIIWorkspaceWriter2CompositeHangerResult.v1' || writerResult?.status !== 'APPLIED'
    || writerResult?.writer !== 'WRITER_2' || writerResult?.mode !== 'ONE_ORIGINAL_PREIMAGE_COMPOSITE') {
    errors.push('RESULT_CONTRACT_MISMATCH');
  }
  if (Number(writerResult?.mutationCount) !== arbitrated.length) errors.push('COMPOSITE_MUTATION_COUNT_MISMATCH');
  if (stableStringify(mutationTestimony(writerResult)) !== stableStringify(expectedTestimony(arbitrated))) {
    errors.push('COMPOSITE_MUTATION_TESTIMONY_MISMATCH');
  }
  if (stableStringify(parentScopeTestimony(writerResult?.parentScopeCustody)) !== stableStringify(parentScopeTestimony(scopeCheck.custody))) {
    errors.push('PARENT_SCOPE_TESTIMONY_MISMATCH');
  }

  const counts = writerResult?.familyMutationCounts || {};
  if (Number(counts.nodeNameOperations) !== nodeCount || Number(counts.sifDeleteOperations) !== sifCount || Number(counts.hangerDeleteOperations) !== hangerCount) {
    errors.push('FAMILY_OPERATION_COUNT_TESTIMONY_MISMATCH');
  }
  const expectedNodeClaims = arbitrated.filter((item) => item.authorityFamily === 'WRITER_2_NODENAME').length;
  const expectedSifClaims = arbitrated.filter((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE').length;
  const expectedHangerClaims = arbitrated.filter((item) => item.authorityFamily === 'WRITER_2_HANGER_DELETE_ALL').length;
  if (Number(counts.nodeNameClaims) !== expectedNodeClaims || Number(counts.sifDeleteClaims) !== expectedSifClaims || Number(counts.hangerDeleteClaims) !== expectedHangerClaims) {
    errors.push('FAMILY_CLAIM_COUNT_TESTIMONY_MISMATCH');
  }

  if (nodePlan) {
    if (after?.nodeNameEvidence?.physicalCustody?.status !== 'QUALIFIED') errors.push('POST_NODENAME_CUSTODY_NOT_QUALIFIED');
    if (controlValue(after, 0, 3) !== Number(nodePlan.controlCountAfter)) errors.push('POST_NODENAME_CONTROL_COUNT_MISMATCH');
    if (stableStringify(nodePointerSnapshot(after)) !== stableStringify(expectedNodePointers(before, nodePlan))) errors.push('POST_NODENAME_POINTER_MISMATCH');
    if (stableStringify(nodePlanTestimony(writerResult?.components?.nodeName?.relocationPlan)) !== stableStringify(nodePlanTestimony(nodePlan))) {
      errors.push('NODE_COMPONENT_RELOCATION_TESTIMONY_MISMATCH');
    }
  }
  if (sifPlan) {
    if (after?.sifWriter1CEvidence?.status !== 'QUALIFIED') errors.push('POST_SIF_CUSTODY_NOT_QUALIFIED');
    if (controlValue(after, 2, 4) !== Number(sifPlan.controlCountAfter)) errors.push('POST_SIF_CONTROL_COUNT_MISMATCH');
    if (ciiPhysicalSectionRows(after?.physicalFile, ['SIF&TEES', 'SIF']).length !== Number(sifPlan.blockCountAfter) * SIF_ROWS) errors.push('POST_SIF_ROW_COUNT_MISMATCH');
    if (stableStringify(sifPointerSnapshot(after)) !== stableStringify(expectedSifPointers(before, sifPlan))) errors.push('POST_SIF_POINTER_MISMATCH');
    if (stableStringify(sifPlanTestimony(writerResult?.components?.sifDelete?.relocationPlan)) !== stableStringify(sifPlanTestimony(sifPlan))) {
      errors.push('SIF_COMPONENT_RELOCATION_TESTIMONY_MISMATCH');
    }
  }
  if (hangerPlan) {
    if (controlValue(after, 0, 2) !== 0) errors.push('POST_HANGER_CONTROL_COUNT_MISMATCH');
    if (after?.hangerEvidence?.status !== 'QUALIFIED' || Number(after?.hangerEvidence?.count) !== 0
      || after?.hangerEvidence?.layout !== CII_HANGER_LAYOUTS.NONE || (after?.hangerEvidence?.nodes || []).length !== 0) {
      errors.push('POST_HANGER_CUSTODY_MISMATCH');
    }
    const expectedRowsAfter = hangerPhysicalCounts(before).rowCountAfter;
    if (ciiPhysicalSectionRows(after?.physicalFile, 'MISCEL_1').length !== expectedRowsAfter) errors.push('POST_HANGER_MISCEL_ROW_COUNT_MISMATCH');
    if (stableStringify(hangerPlanTestimony(writerResult?.components?.hangerDeleteAll?.deletePlan)) !== stableStringify(hangerPlanTestimony(hangerPlan))) {
      errors.push('HANGER_COMPONENT_PLAN_TESTIMONY_MISMATCH');
    }
  }

  if (stableStringify(connectivity(before)) !== stableStringify(connectivity(after))) errors.push('CONNECTIVITY_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('SECTION_ORDER_CHANGED');
  if (errors.length) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_ROUNDTRIP_FAILED:${[...new Set(errors)].join('|')}`);

  return Object.freeze({
    schema: 'CIIWorkspaceWriter2CompositeHangerValidation.v1', status: 'PASS',
    checks: Object.freeze([
      'INDEPENDENT_PARENT_SCOPE_CUSTODY', 'INDEPENDENT_NODE_PLAN', 'INDEPENDENT_SIF_PLAN', 'INDEPENDENT_HANGER_DELETE_ALL_PLAN',
      'INDEPENDENT_ORIGINAL_COORDINATE_ARBITRATION', 'EXACT_FULL_BYTE_POSTIMAGE', 'POST_FAMILY_CUSTODY',
      'CONNECTIVITY_STABLE', 'SECTION_ORDER_STABLE', 'WRITER_TESTIMONY_MATCH',
    ]),
    nodeNameOperations: nodeCount, sifDeleteOperations: sifCount, hangerDeleteOperations: hangerCount,
    mutationCount: arbitrated.length,
  });
}

export const _test = Object.freeze({
  markerName, sortedUnique, sameStrings, independentBoundScopeCustody, projectPlan,
  integerField, independentSig6, sectionEnvelope, controlField, nodeExpectedClaims, sifExpectedClaims,
  hangerPhysicalCounts, hangerExpectedClaims, arbitrateExpected, applyExpected,
});