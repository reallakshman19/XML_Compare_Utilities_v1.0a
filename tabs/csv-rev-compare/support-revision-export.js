const XLSX_MODULE_URL = 'https://esm.sh/xlsx@0.18.5';
const REMARKS_HEADER = 'REMARKS (IF ANY)';
const OUTPUT_SHEET = 'Rev Compare';

export function buildRevisionOutputMatrix(rev1Source, rev2Source, remarks) {
  const headers = [...(rev2Source?.headers || [])];
  let remarksIndex = headers.findIndex((header) => header === REMARKS_HEADER);
  if (remarksIndex < 0) {
    headers.push(REMARKS_HEADER);
    remarksIndex = headers.length - 1;
  }
  const rows = [
    ...targetOutputRows(rev2Source, headers, remarksIndex, remarks),
    ...tombstoneOutputRows(rev1Source, headers, remarksIndex, remarks),
  ];
  return Object.freeze({ headers: Object.freeze(headers), rows: Object.freeze(rows) });
}

export function revisionOutputToCsv(output) {
  return [output.headers, ...output.rows.map((row) => row.values)]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n') + '\r\n';
}

export function buildComparisonAudit(result) {
  return Object.freeze({
    schema: 'support-revision-comparison-audit/v1',
    invariant: 'TABLE->CATEGORIZED_XML->XML_LINEAGE->EVENT_LEDGER->REVISION_OUTPUT',
    profileId: result.pair.profileId,
    comparisonPolicyId: result.lineage.policyId,
    remarkPolicyId: result.remarks?.policyId || result.remarkPolicyId || '',
    exportReady: Boolean(result.exportReady),
    unresolvedReviews: result.unresolvedReviews,
    pairValidation: result.pair.pairValidation,
    source: conversionReceipt(result.pair.rev1),
    target: conversionReceipt(result.pair.rev2),
    coordinateFrame: result.lineage.coordinateFrame,
    candidatePairSchema: result.lineage.candidatePairSchema || '',
    candidatePairAuthority: result.lineage.candidatePairAuthority || null,
    candidatePairs: result.lineage.candidates,
    locationLineage: result.lineage.edges,
    commonSupportClusters: Object.freeze({
      source: result.lineage.sourceClusters,
      target: result.lineage.targetClusters,
    }),
    eventLedger: result.ledger,
    remarkTrace: result.remarks?.trace || Object.freeze([]),
    outputRows: Object.freeze([...(result.output?.rows || [])]),
  });
}

export function buildSupportRevisionArtifacts(result) {
  const audit = buildComparisonAudit(result);
  return Object.freeze({
    outputCsv: result.exportReady ? revisionOutputToCsv(result.output) : null,
    comparisonAuditJson: JSON.stringify(audit, jsonReplacer, 2),
    rev1Xml: result.pair.rev1.exportResult.xmlText || '',
    rev2Xml: result.pair.rev2.exportResult.xmlText || '',
    rev1GraphJson: exportedGraph(result.pair.rev1),
    rev2GraphJson: exportedGraph(result.pair.rev2),
    profileJson: result.pair.rev2.exportResult.profileJson || JSON.stringify(result.pair.rev2.profile, jsonReplacer, 2),
  });
}

export function createSupportRevisionWorkbook(result, XLSX, options = {}) {
  assertExportReady(result);
  assertXlsx(XLSX);
  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, XLSX, outputMatrix(result.output), options.outputSheet || OUTPUT_SHEET);
  appendSheet(workbook, XLSX, auditEventMatrix(result.ledger), 'Rev Compare Audit');
  appendSheet(workbook, XLSX, lineageMatrix(result.lineage), 'Lineage');
  appendSheet(workbook, XLSX, remarkTraceMatrix(result.remarks), 'Remark Trace');
  return workbook;
}

export async function supportRevisionToXlsxBytes(result, options = {}) {
  const XLSX = options.XLSX || await loadXlsx(options.importModule);
  const workbook = createSupportRevisionWorkbook(result, XLSX, options);
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

function targetOutputRows(source, headers, remarksIndex, remarks) {
  return (source?.rows || []).map((row) => {
    const values = projectRowToHeaders(source, row, headers);
    values[remarksIndex] = remarks?.targetRemarks?.[row.rowId]?.remark || '';
    return Object.freeze({ disposition: 'REV2', sourceRowId: row.rowId, values: Object.freeze(values) });
  });
}

function tombstoneOutputRows(source, headers, remarksIndex, remarks) {
  return (source?.rows || []).flatMap((row) => {
    const remark = remarks?.sourceRemarks?.[row.rowId]?.remark;
    if (!remark) return [];
    const values = projectRowToHeaders(source, row, headers);
    values[remarksIndex] = remark;
    return [Object.freeze({ disposition: 'TOMBSTONE', sourceRowId: row.rowId, values: Object.freeze(values) })];
  });
}

function projectRowToHeaders(source, row, targetHeaders) {
  const sourceIndexes = new Map();
  (source?.headers || []).forEach((header, index) => {
    if (!sourceIndexes.has(header)) sourceIndexes.set(header, []);
    sourceIndexes.get(header).push(index);
  });
  const seen = new Map();
  return targetHeaders.map((header) => {
    const ordinal = seen.get(header) || 0;
    seen.set(header, ordinal + 1);
    const index = sourceIndexes.get(header)?.[ordinal];
    return index == null ? '' : row.rawCells?.[index] ?? '';
  });
}

function conversionReceipt(conversion) {
  return Object.freeze({
    revision: conversion.revision,
    ok: conversion.ok,
    sourceId: conversion.source?.sourceId || '',
    delimiter: conversion.source?.delimiter || '',
    delimiterMode: conversion.source?.delimiterMode || '',
    headers: Object.freeze([...(conversion.source?.headers || [])]),
    columnIds: Object.freeze([...(conversion.source?.columnIds || [])]),
    rowCount: conversion.source?.rows?.length || 0,
    profileId: conversion.profile?.profileId || '',
    graphNodeCount: conversion.graph?.nodes?.length || 0,
    diagnostics: Object.freeze([...(conversion.validationResults || []), ...(conversion.graph?.diagnostics || [])]),
  });
}

function auditEventMatrix(ledger) {
  const header = [
    'eventId','type','sourceXmlNode','targetXmlNode','sourceCsvRowId','targetCsvRowId',
    'beforeRawState','afterRawState','normalizedState','matchingMethod','reasonCodes',
    'persistentReferences','coordinateResidualMm','loadDeltas','policyVersion','auditStatus',
    'remarkEligible','lineageEdgeId','candidateIds','trace',
  ];
  return [header, ...(ledger?.events || []).map((event) => [
    event.eventId, event.type, event.sourceXmlNode || '', event.targetXmlNode || '',
    event.sourceCsvRowId || '', event.targetCsvRowId || '', auditCell(event.beforeRawState),
    auditCell(event.afterRawState), auditCell(event.normalizedState), event.matchingMethod,
    (event.reasonCodes || []).join('|'), (event.persistentReferences || []).join('|'),
    event.coordinateResidual?.residualMm ?? '', auditCell(event.loadDeltas), event.policyVersion,
    event.auditStatus, event.remarkEligible ? 'true' : 'false', event.lineageEdgeId || '',
    (event.candidateIds || []).join('|'), auditCell(event.trace),
  ])];
}

function lineageMatrix(lineage) {
  const header = [
    'edgeId','cardinality','outcome','matchingMethod','sourceNodeIds','targetNodeIds',
    'reasonCodes','persistentReferences','candidateIds','candidateEvidence',
  ];
  const candidates = new Map((lineage?.candidates || []).map((candidate) => [candidate.candidateId, candidate]));
  return [header, ...(lineage?.edges || []).map((edge) => [
    edge.edgeId, edge.cardinality, edge.outcome, edge.matchingMethod,
    (edge.sourceNodeIds || []).join('|'), (edge.targetNodeIds || []).join('|'),
    (edge.reasonCodes || []).join('|'), (edge.persistentReferences || []).join('|'),
    (edge.candidateIds || []).join('|'),
    auditCell((edge.candidateIds || []).map((id) => candidates.get(id)).filter(Boolean)),
  ])];
}

function remarkTraceMatrix(remarks) {
  const header = ['eventId','side','rowId','tokenKey','token','sourceXmlNode','targetXmlNode','lineageEdgeId','candidateIds','eventTrace'];
  return [header, ...(remarks?.trace || []).map((row) => [
    row.eventId, row.side, row.rowId, row.tokenKey, row.token,
    row.sourceXmlNode || '', row.targetXmlNode || '', row.lineageEdgeId || '',
    (row.candidateIds || []).join('|'), auditCell(row.eventTrace),
  ])];
}

function outputMatrix(output) { return [output.headers, ...output.rows.map((row) => row.values)]; }
function appendSheet(workbook, XLSX, matrix, name) {
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet['!cols'] = (matrix[0] || []).map((header) => ({ wch: columnWidth(header) }));
  if (matrix.length > 1 && matrix[0]?.length) sheet['!autofilter'] = { ref: `A1:${columnLetter(matrix[0].length - 1)}${matrix.length}` };
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}
function columnWidth(header) { return String(header).length > 28 ? 38 : Math.max(16, String(header).length + 2); }
function columnLetter(index) { let value = index + 1, out = ''; while (value > 0) { value -= 1; out = String.fromCharCode(65 + (value % 26)) + out; value = Math.floor(value / 26); } return out; }
function exportedGraph(conversion) { return conversion.exportResult.graphJson || JSON.stringify(conversion.graph, jsonReplacer, 2); }
function auditCell(value) { return value == null ? '' : typeof value === 'object' ? JSON.stringify(value, jsonReplacer) : String(value); }
function csvCell(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function jsonReplacer(_key, value) { if (value instanceof Map) return Object.fromEntries(value); if (value instanceof Set) return [...value]; return value; }
function assertExportReady(result) { if (!result?.exportReady) throw new Error('Support revision export is blocked until ambiguous lineage reviews are resolved.'); }
async function loadXlsx(importModule = (url) => import(url)) { const module = await importModule(XLSX_MODULE_URL); return module?.default || module; }
function assertXlsx(XLSX) { if (!XLSX?.utils?.aoa_to_sheet || !XLSX?.utils?.book_new || !XLSX?.utils?.book_append_sheet || !XLSX?.write) throw new Error('SheetJS XLSX writer is unavailable.'); }

export const _test = Object.freeze({ projectRowToHeaders, csvCell, conversionReceipt, auditEventMatrix, lineageMatrix, remarkTraceMatrix, columnLetter, XLSX_MODULE_URL });
