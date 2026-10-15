import { compareNodeIds, deepFreeze, stableStringify } from './cii-workspace-contracts.js';
import { intakeCiiWorkspaceDocument } from './cii-workspace-intake.js';

export const CII_NODE_NAME_BENCHMARK_SCHEMA = 'CIIWorkspaceNodeNameBenchmark.v1';
export const CII_SOURCE_TARGET_BENCHMARK_OVERLAY_SCHEMA = 'CIIWorkspaceSourceTargetBenchmarkOverlay.v1';

function text(value) { return String(value ?? '').trim(); }
function normalizedNodeId(value) {
  const raw = text(value); if (!raw) return '';
  const number = Number(raw); return Number.isFinite(number) ? String(Math.round(number)) : raw;
}
function unique(values) { return [...new Set((values || []).map(text).filter(Boolean))]; }
function nodeNameEntries(document) {
  return Object.entries(document?.nodeNames || {})
    .map(([nodeId, value]) => [normalizedNodeId(nodeId), text(value)])
    .filter(([nodeId, value]) => nodeId && value)
    .sort(([left], [right]) => compareNodeIds(left, right));
}
function nodeNameMap(document) { return new Map(nodeNameEntries(document)); }
function actionFor(before, expected) {
  if (!before && expected) return 'CREATE';
  if (before && !expected) return 'DELETE';
  return 'REPLACE';
}
function writerActionForBenchmark(action) { return action === 'REPLACE' ? 'COPY' : action; }
function countByAction(rows) {
  const counts = {};
  for (const row of rows || []) counts[row.action] = (counts[row.action] || 0) + 1;
  return deepFreeze(counts);
}

export function deriveCiiNodeNameBenchmarkDelta(beforeDocument, expectedDocument) {
  const before = nodeNameMap(beforeDocument); const expected = nodeNameMap(expectedDocument);
  const ids = unique([...before.keys(), ...expected.keys()]).sort(compareNodeIds);
  const rows = ids.flatMap((nodeId) => {
    const oldValue = text(before.get(nodeId)); const newValue = text(expected.get(nodeId));
    if (oldValue === newValue) return [];
    const action = actionFor(oldValue, newValue);
    return [deepFreeze({
      nodeId,
      action,
      writerAction: writerActionForBenchmark(action),
      oldValue,
      newValue,
    })];
  });
  return deepFreeze({
    schema: CII_NODE_NAME_BENCHMARK_SCHEMA,
    authority: 'SUPPLIED_TARGET_TO_PARTIAL_EXPECTED_POSITIVE_DELTA',
    lowerBoundOnly: true,
    before: deepFreeze({ fileName: text(beforeDocument?.fileName), contentSha256: text(beforeDocument?.contentSha256) }),
    expected: deepFreeze({ fileName: text(expectedDocument?.fileName), contentSha256: text(expectedDocument?.contentSha256) }),
    rows: deepFreeze(rows),
    summary: deepFreeze({ expectedCount: rows.length, byAction: countByAction(rows) }),
  });
}

export async function deriveCiiNodeNameBenchmarkDeltaFromCii(beforeRaw, expectedRaw, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto;
  const beforeDocument = options.beforeDocument || await intakeCiiWorkspaceDocument(
    beforeRaw,
    options.beforeFileName || 'T.CII',
    { ...options, cryptoRef, side: 'TARGET' },
  );
  const expectedDocument = await intakeCiiWorkspaceDocument(
    expectedRaw,
    options.expectedFileName || 'TEXPECTED.CII',
    { ...options, cryptoRef, side: 'TARGET' },
  );
  return deriveCiiNodeNameBenchmarkDelta(beforeDocument, expectedDocument);
}

function auditRowsForTarget(audit, targetNodeId) {
  const wanted = normalizedNodeId(targetNodeId);
  return (audit?.rows || []).filter((row) => normalizedNodeId(row?.targetNodeId) === wanted);
}
function expectedRecoveryRow(benchmarkRow, audit) {
  const candidates = auditRowsForTarget(audit, benchmarkRow.nodeId);
  const bound = candidates.filter((row) => row?.state === 'BOUND' && row?.identityBound === true);
  const mutation = bound.filter((row) => row?.qualifiedNodeNameChange === true
    && (row?.writerActions || []).includes(benchmarkRow.writerAction));
  let status = 'MISSING';
  if (mutation.length) status = 'RECOVERED';
  else if (bound.length) status = 'BOUND_NO_MUTATION';
  else if (candidates.length) status = 'CORRESPONDENCE_INCOMPLETE';
  return deepFreeze({
    ...benchmarkRow,
    status,
    correspondenceRecovered: bound.length > 0,
    mutationRecovered: mutation.length > 0,
    sourceRowKeys: deepFreeze(unique(candidates.map((row) => row?.rowKey))),
    boundSourceRowKeys: deepFreeze(unique(bound.map((row) => row?.rowKey))),
    mutationSourceRowKeys: deepFreeze(unique(mutation.map((row) => row?.rowKey))),
    corroborationCount: mutation.length,
  });
}
function additionalQualifiedRows(audit, expectedIds) {
  return deepFreeze((audit?.rows || []).filter((row) => row?.qualifiedNodeNameChange === true
    && row?.targetNodeId && !expectedIds.has(normalizedNodeId(row.targetNodeId)))
    .map((row) => deepFreeze({
      rowKey: text(row.rowKey), sourceId: text(row.sourceId), sourceNodeId: normalizedNodeId(row.sourceNodeId),
      targetNodeId: normalizedNodeId(row.targetNodeId), sourceNodeName: text(row.sourceNodeName), targetNodeName: text(row.targetNodeName),
      writerActions: deepFreeze(unique(row.writerActions)),
      status: 'ADDITIONAL_QUALIFIED_NOT_IN_PARTIAL_BENCHMARK',
    })));
}
function censusAnnotations(audit, expectedRows, additionalRows) {
  const expectedByTarget = new Map(expectedRows.map((row) => [normalizedNodeId(row.nodeId), row]));
  const additionalByKey = new Map(additionalRows.map((row) => [text(row.rowKey), row]));
  return deepFreeze((audit?.rows || []).map((row) => {
    const expected = expectedByTarget.get(normalizedNodeId(row?.targetNodeId));
    const additional = additionalByKey.get(text(row?.rowKey));
    let status = 'NOT_COVERED_BY_PARTIAL_BENCHMARK';
    if (expected) status = expected.status;
    else if (additional) status = additional.status;
    return deepFreeze({
      rowKey: text(row?.rowKey),
      status,
      benchmarkTargetNodeId: expected?.nodeId || null,
      benchmarkAction: expected?.action || null,
      benchmarkOldValue: expected?.oldValue || null,
      benchmarkNewValue: expected?.newValue || null,
    });
  }));
}

export function buildCiiSourceTargetBenchmarkOverlay(audit, benchmark) {
  if (!audit?.rows || !benchmark?.rows) return null;
  const expectedRows = benchmark.rows.map((row) => expectedRecoveryRow(row, audit));
  const expectedIds = new Set(expectedRows.map((row) => normalizedNodeId(row.nodeId)));
  const additionalRows = additionalQualifiedRows(audit, expectedIds);
  const correspondenceRecoveredCount = expectedRows.filter((row) => row.correspondenceRecovered).length;
  const mutationRecoveredCount = expectedRows.filter((row) => row.mutationRecovered).length;
  const missingRows = expectedRows.filter((row) => !row.mutationRecovered);
  return deepFreeze({
    schema: CII_SOURCE_TARGET_BENCHMARK_OVERLAY_SCHEMA,
    authority: benchmark.authority,
    lowerBoundOnly: true,
    benchmark: deepFreeze({ before: benchmark.before, expected: benchmark.expected }),
    rows: deepFreeze(expectedRows),
    additionalQualifiedRows: additionalRows,
    censusAnnotations: censusAnnotations(audit, expectedRows, additionalRows),
    summary: deepFreeze({
      expectedCount: expectedRows.length,
      correspondenceRecoveredCount,
      mutationRecoveredCount,
      missingCount: missingRows.length,
      additionalQualifiedCount: additionalRows.length,
      byAction: benchmark.summary?.byAction || countByAction(expectedRows),
    }),
  });
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
export function ciiSourceTargetBenchmarkOverlayToCsv(overlay) {
  const headers = ['kind', 'status', 'targetNodeId', 'benchmarkAction', 'oldValue', 'newValue', 'sourceRowKeys', 'correspondenceRecovered', 'mutationRecovered'];
  const expectedRows = (overlay?.rows || []).map((row) => ({
    kind: 'KNOWN_POSITIVE', status: row.status, targetNodeId: row.nodeId, benchmarkAction: row.action,
    oldValue: row.oldValue, newValue: row.newValue, sourceRowKeys: (row.sourceRowKeys || []).join('|'),
    correspondenceRecovered: row.correspondenceRecovered, mutationRecovered: row.mutationRecovered,
  }));
  const additionalRows = (overlay?.additionalQualifiedRows || []).map((row) => ({
    kind: 'ADDITIONAL_QUALIFIED', status: row.status, targetNodeId: row.targetNodeId, benchmarkAction: '',
    oldValue: row.targetNodeName, newValue: row.sourceNodeName, sourceRowKeys: row.rowKey,
    correspondenceRecovered: true, mutationRecovered: true,
  }));
  return [headers.join(','), ...[...expectedRows, ...additionalRows]
    .map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}
export function ciiSourceTargetBenchmarkOverlayToJson(overlay) { return stableStringify(overlay); }

export const _test = Object.freeze({
  normalizedNodeId, nodeNameEntries, actionFor, writerActionForBenchmark, expectedRecoveryRow, additionalQualifiedRows,
});
