import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_REPORT_COLUMNS,
  SUPPORT_REPORT_TYPICALITY_COLUMNS,
  supportReportColumns,
} from '../tabs/support-steel-relationship-builder/support-report-contract.js';
import { supportReportToCsv } from '../tabs/support-steel-relationship-builder/support-report-export.js';
import {
  createSupportReportWorkbook,
  supportReportSpreadsheetMatrix,
  typicalityAuditSpreadsheetMatrix,
} from '../tabs/support-steel-relationship-builder/support-report-xlsx.js';

const row = Object.freeze({
  scope: 'ASIM', civilSecondarySupport: 'PS-11168', pipe: 'ASIM-1835-2"-P8810320-31441C4-HT-01',
  size: '50', pipeSchedule: '', pipeInsulationThickness: '', pipeInsulationType: '',
  pipingPrimarySupport: '/PS-11168.1', supportType: 'REST-50, BP-50, GUIDE-50',
  pipingPrimarySupportReference: '', eastWest: '', northSouth: '', bopElevation: '',
  stressSystemNumber: '', nodeNumber: '', totalSupportPointsOnSecondary: 5,
  previousName: '', primarySupportDescription: '', primarySupportZone: '', primarySupportSite: '', remarks: '',
  typicalStructure: 'PS-14168', pipingSupportArrangementMatch: 'EXACT',
  typicalityAuditId: 'TYP-PS-11168--PS-14168-L01',
});

const structuredSignals = Object.freeze({
  pipeClass: Object.freeze({ reasonCode: 'PIPE_CLASS_EXACT' }),
  memberMultiplicity: Object.freeze({ reasonCode: 'PRIMARY_MEMBER_MULTIPLICITY_EXACT', delta: 0 }),
  geometry: Object.freeze({ reasonCode: 'LOCAL_POSITION_WITHIN_TOLERANCE', residual: { median: 0, max: 0 }, thresholdMm: 50 }),
  structuredSequence: Object.freeze({
    firstPassingDimension: '3D',
    stages: Object.freeze([
      Object.freeze({ dimension: '3D', result: 'PASS', reasonCode: '3D_LATTICE_WITHIN_TOLERANCE', residual: { median: 0, max: 0 } }),
      Object.freeze({ dimension: '1D', result: 'PASS', reasonCode: '1D_LATTICE_WITHIN_TOLERANCE', residual: { median: 0, max: 0 } }),
    ]),
  }),
  memberOrdinalPattern: Object.freeze({ result: 'EXACT', similarity: 1, reasonCode: 'MEMBER_ORDINAL_PATTERN_EXACT' }),
  previousNamePattern: Object.freeze({ class: 'ONE_POSITION_DIFFERENT', wildcardMask: 'PS020?5', similarity: 0.9, reasonCode: 'PREV_NAME_ONE_POSITION_DIFFERENT' }),
});

const supportTypeComparison = Object.freeze({
  result: 'EXACT',
  reasonCodes: Object.freeze(['SUPPORT_TYPE_MULTISET_EXACT']),
  leftRaw: Object.freeze(['REST-50', 'BP-50', 'GUIDE-50']),
  rightRaw: Object.freeze(['GUIDE-50', 'REST-50', 'BP-50']),
  leftCanonical: Object.freeze({ 'BP-50': 1, 'GUIDE-50': 1, 'REST-50': 1 }),
  rightCanonical: Object.freeze({ 'BP-50': 1, 'GUIDE-50': 1, 'REST-50': 1 }),
});

const candidate = Object.freeze({
  candidateId: 'PAIR-L--R', leftLocationId: 'L', rightLocationId: 'R', eligible: true,
  arrangementResult: 'EXACT', assignmentCost: 10, assignmentCost2d: 11, assignmentCost1d: 12,
  signals: structuredSignals, supportTypeComparison,
  sourceEvidence: Object.freeze({ leftClashIds: Object.freeze(['A']), rightClashIds: Object.freeze(['B']) }),
});

const typicalityAudit = Object.freeze({
  schema: 'SupportReportTypicalityAudit.v1', profileId: 'PS_TYPICAL_V1_PROVISIONAL',
  profileSnapshot: Object.freeze({ profileId: 'PS_TYPICAL_V1_PROVISIONAL', pipingLocation: Object.freeze({ ambiguityCostTolerance: 0.001 }) }),
  familyComparisons: Object.freeze([Object.freeze({
    auditId: 'TYP-PS-11168--PS-14168', leftFamilyId: 'PS-11168', rightFamilyId: 'PS-14168',
    signals: Object.freeze([Object.freeze({ reasonCode: 'STRUCT_LOCATION_COUNT_EQUAL', left: 5, right: 5, residual: null, threshold: 'EXACT', result: 'PASS' })]),
  })]),
  locationAssignments: Object.freeze([Object.freeze({
    parentAuditId: 'TYP-PS-11168--PS-14168', leftFamilyId: 'PS-11168', rightFamilyId: 'PS-14168',
    matchingMode: '1D_SEQUENCE_REVERSE', correspondenceStatus: 'AMBIGUOUS_EQUIVALENT',
    candidatePairs: Object.freeze([candidate]),
    selectedAssignments: Object.freeze([Object.freeze({ ...candidate, auditId: 'TYP-PS-11168--PS-14168-L01' })]),
  })]),
});

const comparisonBundle = Object.freeze({ rows: Object.freeze([row]), typicalityAudit });

test('legacy Support Report remains 21 columns while comparison mode adds 22-24', () => {
  assert.equal(SUPPORT_REPORT_COLUMNS.length, 21);
  assert.equal(SUPPORT_REPORT_TYPICALITY_COLUMNS.length, 3);
  assert.equal(supportReportColumns({ rows: [row] }).length, 21);
  const columns = supportReportColumns(comparisonBundle);
  assert.equal(columns.length, 24);
  assert.deepEqual(columns.slice(-3).map((column) => column.key), [
    'typicalStructure', 'pipingSupportArrangementMatch', 'typicalityAuditId',
  ]);
});

test('comparison CSV and matrix serialize columns 22-24 deterministically', () => {
  const matrix = supportReportSpreadsheetMatrix(comparisonBundle);
  assert.equal(matrix[0].length, 24);
  assert.equal(matrix[2][21], 'PS-14168');
  assert.equal(matrix[2][22], 'EXACT');
  assert.equal(matrix[2][23], 'TYP-PS-11168--PS-14168-L01');

  const [ordinal, header, data] = supportReportToCsv(comparisonBundle, { includeOrdinalRow: true }).split('\n');
  assert.ok(ordinal.endsWith('"24"'));
  assert.match(header, /"TYPICAL STRUCTURE \(PS NO\.\)"/);
  assert.match(header, /"PIPING SUPPORT ARRANGEMENT MATCH"/);
  assert.match(data, /"PS-14168","EXACT","TYP-PS-11168--PS-14168-L01"$/);
});

test('comparison XLSX uses dynamic A:X report filter and exports reconstructable structured-sequence audit', () => {
  const captured = [];
  const fakeXlsx = {
    utils: {
      aoa_to_sheet(matrix) { const sheet = { matrix }; captured.push(sheet); return sheet; },
      book_new() { return { sheets: [] }; },
      book_append_sheet(workbook, worksheet, name) { workbook.sheets.push({ worksheet, name }); },
    },
    write() { return new Uint8Array(); },
  };
  const workbook = createSupportReportWorkbook(comparisonBundle, fakeXlsx);
  assert.equal(workbook.sheets.length, 2);
  assert.equal(workbook.sheets[0].name, 'Support Report');
  assert.equal(workbook.sheets[0].worksheet['!autofilter'].ref, 'A2:X3');
  assert.equal(workbook.sheets[1].name, 'Typicality Audit');
  assert.match(workbook.sheets[1].worksheet['!autofilter'].ref, /^A1:AF\d+$/);

  const auditMatrix = typicalityAuditSpreadsheetMatrix(typicalityAudit);
  const header = auditMatrix[0];
  assert.equal(header.length, 32);
  assert.deepEqual(header.slice(0, 7), [
    'Audit ID', 'Parent Audit ID', 'Left PS', 'Right PS', 'Left Location ID', 'Right Location ID', 'Signal / Rule',
  ]);
  for (const required of [
    'Matching Mode', 'Correspondence Status', 'Assignment Cost 3D/Global', 'Assignment Cost 2D', 'Assignment Cost 1D',
    'First Passing Dimension', '3D Lattice Residual', '2D Lattice Residual', '1D Station Residual',
    'Member Ordinal Pattern', 'Member Pattern Similarity', 'PREV NAME Class', 'PREV NAME Mask', 'PREV NAME Similarity',
    'Effective Profile JSON',
  ]) assert.ok(header.includes(required), required);

  const candidateRow = auditMatrix.find((auditRow) => auditRow.includes('LOCATION_CANDIDATE'));
  assert.ok(candidateRow);
  assert.equal(candidateRow[header.indexOf('Matching Mode')], '1D_SEQUENCE_REVERSE');
  assert.equal(candidateRow[header.indexOf('Correspondence Status')], 'AMBIGUOUS_EQUIVALENT');
  assert.equal(candidateRow[header.indexOf('Member Ordinal Pattern')], 'EXACT');
  assert.equal(candidateRow[header.indexOf('PREV NAME Class')], 'ONE_POSITION_DIFFERENT');
  assert.equal(candidateRow[header.indexOf('PREV NAME Mask')], 'PS020?5');
  assert.match(candidateRow[header.indexOf('Effective Profile JSON')], /ambiguityCostTolerance/);
  assert.ok(auditMatrix.some((auditRow) => auditRow.includes('PIPING_SUPPORT_ARRANGEMENT')));
});
