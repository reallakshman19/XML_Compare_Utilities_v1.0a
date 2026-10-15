import {
  supportReportColumns,
  supportReportColumnHeader,
  supportReportColumnValue,
} from './support-report-contract.js?v=20260910-support-report-typicality-columns-1';

const DEFAULT_SHEET_NAME = 'Support Report';
const DEFAULT_AUDIT_SHEET_NAME = 'Typicality Audit';
const XLSX_MODULE_URL = 'https://esm.sh/xlsx@0.18.5';

export function supportReportSpreadsheetMatrix(bundle, options = {}) {
  const columns = supportReportColumns(bundle, options);
  const includeOrdinalRow = options.includeOrdinalRow !== false;
  const header = columns.map((column) => supportReportColumnHeader(column, {
    ...options,
    ownerWorkbookFidelity: options.ownerWorkbookFidelity !== false,
  }));
  const rows = (bundle?.rows || []).map((row) => columns.map((column) => {
    const value = supportReportColumnValue(row, column);
    if (value == null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value : '';
    return String(value);
  }));
  const matrix = [];
  if (includeOrdinalRow) matrix.push(columns.map((_, index) => index + 1));
  matrix.push(header, ...rows);
  return matrix;
}

export function typicalityAuditSpreadsheetMatrix(audit) {
  const header = [
    'Audit ID', 'Parent Audit ID', 'Left PS', 'Right PS', 'Left Location ID', 'Right Location ID',
    'Signal / Rule', 'Left Raw', 'Right Raw', 'Left Normalized', 'Right Normalized', 'Residual', 'Threshold',
    'Result', 'Reason Code', 'Source Evidence IDs', 'Profile Version',
    'Matching Mode', 'Correspondence Status',
    'Assignment Cost 3D/Global', 'Assignment Cost 2D', 'Assignment Cost 1D',
    'First Passing Dimension', '3D Lattice Residual', '2D Lattice Residual', '1D Station Residual',
    'Member Ordinal Pattern', 'Member Pattern Similarity',
    'PREV NAME Class', 'PREV NAME Mask', 'PREV NAME Similarity',
    'Effective Profile JSON',
  ];
  const rows = [];
  const profileJson = auditCell(audit?.profileSnapshot);
  for (const comparison of audit?.familyComparisons || []) {
    for (const signal of comparison.signals || []) {
      rows.push([
        comparison.auditId, '', comparison.leftFamilyId, comparison.rightFamilyId, '', '',
        signal.reasonCode || 'STRUCTURAL_SIGNAL', auditCell(signal.left), auditCell(signal.right), '', '',
        auditCell(signal.residual), auditCell(signal.threshold), signal.result || '', signal.reasonCode || '', '',
        audit?.profileId || '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', profileJson,
      ]);
    }
  }
  for (const assignment of audit?.locationAssignments || []) {
    const selectedById = new Map((assignment.selectedAssignments || [])
      .map((item) => [item.candidateId, item]));
    for (const candidate of assignment.candidatePairs || []) {
      const sequence = candidate.signals?.structuredSequence;
      rows.push([
        selectedById.get(candidate.candidateId)?.auditId || candidate.candidateId,
        assignment.parentAuditId || '', assignment.leftFamilyId, assignment.rightFamilyId,
        candidate.leftLocationId, candidate.rightLocationId, 'LOCATION_CANDIDATE',
        auditCell(candidate.supportTypeComparison?.leftRaw), auditCell(candidate.supportTypeComparison?.rightRaw),
        auditCell(candidate.supportTypeComparison?.leftCanonical), auditCell(candidate.supportTypeComparison?.rightCanonical),
        candidate.assignmentCost, '',
        candidate.eligible ? (selectedById.has(candidate.candidateId) ? 'SELECTED' : 'ELIGIBLE') : 'INELIGIBLE',
        candidateReasonCodes(candidate).join(', '),
        auditCell([...(candidate.sourceEvidence?.leftClashIds || []), ...(candidate.sourceEvidence?.rightClashIds || [])]),
        audit?.profileId || '', assignment.matchingMode || '', assignment.correspondenceStatus || '',
        auditCell(candidate.assignmentCost), auditCell(candidate.assignmentCost2d), auditCell(candidate.assignmentCost1d),
        sequence?.firstPassingDimension || '',
        auditCell(sequenceStage(sequence, '3D')?.residual),
        auditCell(sequenceStage(sequence, '2D')?.residual),
        auditCell(sequenceStage(sequence, '1D')?.residual),
        auditCell(candidate.signals?.memberOrdinalPattern?.result),
        auditCell(candidate.signals?.memberOrdinalPattern?.similarity),
        candidate.signals?.previousNamePattern?.class || '',
        candidate.signals?.previousNamePattern?.wildcardMask || '',
        auditCell(candidate.signals?.previousNamePattern?.similarity),
        profileJson,
      ]);
    }
    for (const pair of assignment.selectedAssignments || []) {
      const sequence = pair.signals?.structuredSequence;
      rows.push([
        pair.auditId || '', assignment.parentAuditId || '', assignment.leftFamilyId, assignment.rightFamilyId,
        pair.leftLocationId, pair.rightLocationId, 'PIPING_SUPPORT_ARRANGEMENT',
        auditCell(pair.supportTypeComparison?.leftRaw), auditCell(pair.supportTypeComparison?.rightRaw),
        auditCell(pair.supportTypeComparison?.leftCanonical), auditCell(pair.supportTypeComparison?.rightCanonical),
        auditCell(pair.signals?.geometry?.residual), auditCell(pair.signals?.geometry?.thresholdMm),
        pair.arrangementResult || '', arrangementReasonCodes(pair).join(', '),
        auditCell([...(pair.sourceEvidence?.leftClashIds || []), ...(pair.sourceEvidence?.rightClashIds || [])]),
        audit?.profileId || '', assignment.matchingMode || '', assignment.correspondenceStatus || '',
        auditCell(pair.assignmentCost), auditCell(pair.assignmentCost2d), auditCell(pair.assignmentCost1d),
        sequence?.firstPassingDimension || '',
        auditCell(sequenceStage(sequence, '3D')?.residual),
        auditCell(sequenceStage(sequence, '2D')?.residual),
        auditCell(sequenceStage(sequence, '1D')?.residual),
        auditCell(pair.signals?.memberOrdinalPattern?.result),
        auditCell(pair.signals?.memberOrdinalPattern?.similarity),
        pair.signals?.previousNamePattern?.class || '',
        pair.signals?.previousNamePattern?.wildcardMask || '',
        auditCell(pair.signals?.previousNamePattern?.similarity),
        profileJson,
      ]);
    }
  }
  return [header, ...rows];
}

export function createSupportReportWorkbook(bundle, XLSX, options = {}) {
  assertXlsx(XLSX);
  const columns = supportReportColumns(bundle, options);
  const matrix = supportReportSpreadsheetMatrix(bundle, options);
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet['!cols'] = columns.map((column) => ({ wch: columnWidth(column.key) }));
  if ((bundle?.rows || []).length > 0) {
    const headerRow = options.includeOrdinalRow === false ? 1 : 2;
    worksheet['!autofilter'] = {
      ref: `A${headerRow}:${columnLetter(columns.length - 1)}${matrix.length}`,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || DEFAULT_SHEET_NAME);
  const auditMatrix = typicalityAuditSpreadsheetMatrix(bundle?.typicalityAudit);
  if (bundle?.typicalityAudit && auditMatrix.length > 1) {
    const auditWorksheet = XLSX.utils.aoa_to_sheet(auditMatrix);
    auditWorksheet['!cols'] = auditMatrix[0].map((_, index) => ({ wch: auditColumnWidth(index) }));
    auditWorksheet['!autofilter'] = {
      ref: `A1:${columnLetter(auditMatrix[0].length - 1)}${auditMatrix.length}`,
    };
    XLSX.utils.book_append_sheet(workbook, auditWorksheet,
      options.auditSheetName || DEFAULT_AUDIT_SHEET_NAME);
  }
  return workbook;
}

export async function supportReportToXlsxBytes(bundle, options = {}) {
  const XLSX = options.XLSX || await loadXlsx(options.importModule);
  const workbook = createSupportReportWorkbook(bundle, XLSX, options);
  const output = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  });
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

async function loadXlsx(importModule = (url) => import(url)) {
  const module = await importModule(XLSX_MODULE_URL);
  return module?.default || module;
}

function assertXlsx(XLSX) {
  const missing = [];
  if (typeof XLSX?.utils?.aoa_to_sheet !== 'function') missing.push('utils.aoa_to_sheet');
  if (typeof XLSX?.utils?.book_new !== 'function') missing.push('utils.book_new');
  if (typeof XLSX?.utils?.book_append_sheet !== 'function') missing.push('utils.book_append_sheet');
  if (typeof XLSX?.write !== 'function') missing.push('write');
  if (missing.length) throw new Error(`SheetJS XLSX writer is unavailable: ${missing.join(', ')}`);
}

function arrangementReasonCodes(pair) {
  return [...new Set([
    ...(pair?.supportTypeComparison?.reasonCodes || []),
    pair?.signals?.pipeClass?.reasonCode,
    pair?.signals?.memberMultiplicity?.reasonCode,
    pair?.signals?.geometry?.reasonCode,
    ...(pair?.signals?.structuredSequence?.stages || []).map((stage) => stage?.reasonCode),
    pair?.signals?.memberOrdinalPattern?.reasonCode,
    pair?.signals?.previousNamePattern?.reasonCode,
  ].filter(Boolean))];
}
function candidateReasonCodes(candidate) {
  return [...new Set([
    candidate?.signals?.pipeClass?.reasonCode,
    candidate?.signals?.memberMultiplicity?.reasonCode,
    candidate?.signals?.geometry?.reasonCode,
    ...(candidate?.signals?.structuredSequence?.stages || []).map((stage) => stage?.reasonCode),
    candidate?.signals?.memberOrdinalPattern?.reasonCode,
    candidate?.signals?.previousNamePattern?.reasonCode,
    ...(candidate?.supportTypeComparison?.reasonCodes || []),
  ].filter(Boolean))];
}
function sequenceStage(sequence, dimension) {
  return (sequence?.stages || []).find((stage) => stage?.dimension === dimension) || null;
}
function auditCell(value) {
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
function columnLetter(index) {
  let value = index + 1;
  let output = '';
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}
function auditColumnWidth(index) {
  if ([0, 1, 6, 14, 15, 31].includes(index)) return 34;
  if ([7, 8, 9, 10, 23, 24, 25].includes(index)) return 38;
  if ([17, 18, 22, 26, 28, 29].includes(index)) return 26;
  return 20;
}
function columnWidth(key) {
  if (['pipe', 'primarySupportDescription', 'remarks', 'pipingSupportArrangementMatch'].includes(key)) return 42;
  if (['pipingPrimarySupport', 'supportType', 'pipingPrimarySupportReference'].includes(key)) return 34;
  if (['civilSecondarySupport', 'primarySupportZone', 'primarySupportSite', 'typicalStructure', 'typicalityAuditId'].includes(key)) return 28;
  if (['pipeInsulationThickness', 'pipeInsulationType', 'stressSystemNumber'].includes(key)) return 24;
  return 18;
}

export const _test = Object.freeze({ columnWidth, columnLetter, XLSX_MODULE_URL, sequenceStage });
