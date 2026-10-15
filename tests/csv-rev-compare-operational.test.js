import assert from 'node:assert/strict';

import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import {
  createSupportRevisionWorkbook,
  revisionOutputToCsv,
  supportRevisionToXlsxBytes,
} from '../tabs/csv-rev-compare/support-revision-export.js';

const HEADERS = [
  'PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE',
  'PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY',
  'REMARKS (IF ANY)','PRIMARY SUPPORT DESCRIPTION','PRIMARY SUPPORT ZONE','PRIMARY SUPPORT SITE',
  'PIPE SCHEDULE','INSULATION','STRESS SYSTEM NUMBER','NODE NO','REVISION',
  'Fx','Fy','Fz','Fx','Fy','Fz',
];

function row(overrides = {}) {
  const values = {
    'PREV NAME': 'PS02012', SCOPE: 'PL', CIVILSECONDARYSUPPORT: 'SL-212',
    PIPE: 'ASIM-1885-PL-4"-M8810130-02', SIZE: '4',
    'PIPING PRIMARY SUPPORT': '/SL-212.3, /SL-212.1',
    'SUPPORT TYPE': 'SHOE-250, REST-250',
    'PIPING PRIMARY SUPPORT REFERENCE': '=100/3641, =100/896',
    'EAST/WEST': 'E 1000', 'NORTH/SOUTH': 'N 2000', 'BOP ELEVATION': 'U 3000',
    'TOTAL SUPPORT POINTS ON SECONDARY': '2', 'REMARKS (IF ANY)': '',
    'PRIMARY SUPPORT DESCRIPTION': '', 'PRIMARY SUPPORT ZONE': '', 'PRIMARY SUPPORT SITE': '',
    'PIPE SCHEDULE': 'SCH40', INSULATION: 'NONE', 'STRESS SYSTEM NUMBER': 'SYS-1',
    'NODE NO': '10', REVISION: '1',
    'Fx#1': '100', 'Fy#1': '-13623', 'Fz#1': '50', 'Fx#2': '5', 'Fy#2': '-11594', 'Fz#2': '8',
    ...overrides,
  };
  const seen = new Map();
  return HEADERS.map((header) => {
    const ordinal = (seen.get(header) || 0) + 1;
    seen.set(header, ordinal);
    return values[`${header}#${ordinal}`] ?? values[header] ?? '';
  });
}

function csv(rows) {
  return [HEADERS, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function remarkIndex(output) { return output.headers.indexOf('REMARKS (IF ANY)'); }
function rowsByDisposition(output, disposition) { return output.rows.filter((item) => item.disposition === disposition); }

// Ready-to-export result keeps REV2 layout, duplicate load headings and XML/audit artifacts.
{
  const rev1 = csv([row()]);
  const rev2 = csv([row({ REVISION: '2', 'PIPING PRIMARY SUPPORT': '/SL-212.2, /SL-212.1', 'Fy#1': '-14000' })]);
  const result = runSupportRevisionCompare(rev1, rev2);
  assert.equal(result.stage, 'READY_TO_EXPORT');
  assert.equal(result.exportReady, true);
  assert.equal(result.output.headers.filter((header) => header === 'Fy').length, 2);
  assert.equal(rowsByDisposition(result.output, 'REV2').length, 1);
  assert.equal(result.output.rows[0].values[remarkIndex(result.output)], 'Minor Load change');
  assert.ok(result.ledger.events.some((event) => event.type === 'PRIMARY_MEMBER_RENUMBERED'));
  assert.ok(result.ledger.events.some((event) => event.type === 'LOAD_SIGNATURE_CHANGED'));
  assert.match(result.artifacts.rev1Xml, /SupportRevision/);
  assert.match(result.artifacts.rev2Xml, /SupportRevision/);
  assert.match(result.artifacts.rev1GraphJson, /categorized-xml-graph/);
  assert.match(result.artifacts.profileJson, /support-revision-csv-xml\/v1/);
  assert.match(result.artifacts.comparisonAuditJson, /TABLE->CATEGORIZED_XML->XML_LINEAGE->EVENT_LEDGER->REVISION_OUTPUT/);
  assert.match(result.artifacts.comparisonAuditJson, /pairValidation/);
  assert.match(result.artifacts.comparisonAuditJson, /sourceCellRef|sourceCells/);
  assert.equal(result.artifacts.outputCsv, revisionOutputToCsv(result.output));
}

// A source row with no successor is emitted as a tombstone after later-revision rows and traces to candidate exhaustion.
{
  const rev1 = csv([row({ 'PREV NAME': 'PS-OLD', CIVILSECONDARYSUPPORT: 'SL-OLD', 'PIPING PRIMARY SUPPORT REFERENCE': '=OLD/1' })]);
  const rev2 = csv([row({ REVISION: '2', 'PREV NAME': 'PS-NEW', CIVILSECONDARYSUPPORT: 'SL-NEW', PIPE: 'ASIM-1885-PL-2"-Q100-01', 'PIPING PRIMARY SUPPORT REFERENCE': '=NEW/1', 'EAST/WEST': 'E 9000' })]);
  const result = runSupportRevisionCompare(rev1, rev2);
  assert.equal(result.exportReady, true);
  assert.equal(rowsByDisposition(result.output, 'REV2').length, 1);
  const tombstones = rowsByDisposition(result.output, 'TOMBSTONE');
  assert.equal(tombstones.length, 1);
  assert.equal(tombstones[0].values[remarkIndex(result.output)], 'Invalid Support?, This pipe no longer reported in latest report');
  const removal = result.ledger.events.find((item) => item.type === 'SUPPORT_LOCATION_REMOVED');
  assert.equal(removal.matchingMethod, 'candidate-exhaustion');
  assert.ok(removal.candidateIds.length > 0);
  const trace = result.remarks.trace.find((item) => item.eventId === removal.eventId);
  assert.deepEqual(trace.candidateIds, removal.candidateIds);
  assert.ok(trace.eventTrace.sourceCells.PIPE.length > 0);
}

// Proven family replacement creates both the old invalid row and successor history remark.
{
  const rev1 = csv([row({ 'PREV NAME': 'PS-X', CIVILSECONDARYSUPPORT: 'SL-10', 'PIPING PRIMARY SUPPORT REFERENCE': '=REF/1' })]);
  const rev2 = csv([row({ REVISION: '2', 'PREV NAME': 'PS-X', CIVILSECONDARYSUPPORT: 'PS-20', 'PIPING PRIMARY SUPPORT': '/PS-20.1, /PS-20.2', 'PIPING PRIMARY SUPPORT REFERENCE': '=REF/1, =100/896' })]);
  const result = runSupportRevisionCompare(rev1, rev2);
  assert.equal(result.exportReady, true);
  const targetRemark = rowsByDisposition(result.output, 'REV2')[0].values[remarkIndex(result.output)];
  const sourceRemark = rowsByDisposition(result.output, 'TOMBSTONE')[0].values[remarkIndex(result.output)];
  assert.match(sourceRemark, /Invalid Support, replaced by PS-20/);
  assert.match(targetRemark, /PS No\.\/Line No\. Change Earlier:SL-10\(=REF\/1\)/);
}

// Ambiguous candidates block operational CSV/XLSX until an explicit candidate review is approved.
{
  const rev1 = csv([row({ 'PREV NAME': 'PS-A', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=SHARED/1' })]);
  const target = row({ REVISION: '2', 'PREV NAME': 'PS-A', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=SHARED/1' });
  const rev2 = csv([target, target]);
  const blocked = runSupportRevisionCompare(rev1, rev2);
  assert.equal(blocked.stage, 'REVIEW_REQUIRED');
  assert.equal(blocked.exportReady, false);
  assert.equal(blocked.artifacts.outputCsv, null);
  assert.ok(blocked.unresolvedReviews.count > 0);
  assert.throws(() => createSupportRevisionWorkbook(blocked, fakeXlsx()), /blocked until ambiguous lineage reviews are resolved/);

  const candidate = blocked.lineage.candidates.find((item) => item.outcome === 'AMBIGUOUS');
  assert.ok(candidate);
  const reviewed = runSupportRevisionCompare(rev1, rev2, {
    reviewDecisions: [{ sourceNodeId: candidate.sourceNodeId, targetNodeId: candidate.targetNodeId, action: 'approve', reason: 'Engineer reviewed persistent-reference duplicate.' }],
  });
  assert.equal(reviewed.stage, 'READY_TO_EXPORT');
  assert.equal(reviewed.unresolvedReviews.count, 0);
  assert.equal(reviewed.lineage.edges.some((edge) => edge.matchingMethod === 'manual-review'), true);
  assert.ok(reviewed.artifacts.outputCsv);
}

// Invalid review actions fail closed and remain review-blocking.
{
  const rev1 = csv([row({ 'PREV NAME': 'PS-A', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=SHARED/2' })]);
  const target = row({ REVISION: '2', 'PREV NAME': 'PS-A', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=SHARED/2' });
  const initial = runSupportRevisionCompare(rev1, csv([target, target]));
  const candidate = initial.lineage.candidates.find((item) => item.outcome === 'AMBIGUOUS');
  const invalid = runSupportRevisionCompare(rev1, csv([target, target]), {
    reviewDecisions: [{ sourceNodeId: candidate.sourceNodeId, targetNodeId: candidate.targetNodeId, action: 'auto-pick' }],
  });
  assert.equal(invalid.exportReady, false);
  assert.ok(invalid.diagnostics.some((item) => item.code === 'review_action_invalid'));
}

// XLSX adapter uses the established four-sheet audit layout without requiring network in tests.
{
  const result = runSupportRevisionCompare(csv([row()]), csv([row({ REVISION: '2' })]));
  const XLSX = fakeXlsx();
  const workbook = createSupportRevisionWorkbook(result, XLSX);
  assert.deepEqual(workbook.SheetNames, ['Rev Compare', 'Rev Compare Audit', 'Lineage', 'Remark Trace']);
  assert.deepEqual(workbook.Sheets['Rev Compare'].matrix[0], result.output.headers);
  const bytes = await supportRevisionToXlsxBytes(result, { XLSX });
  assert.deepEqual([...bytes], [80, 75, 3, 4]);
}

function fakeXlsx() {
  return {
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      aoa_to_sheet: (matrix) => ({ matrix }),
      book_append_sheet: (workbook, sheet, name) => {
        workbook.SheetNames.push(name);
        workbook.Sheets[name] = sheet;
      },
    },
    write: () => new Uint8Array([80, 75, 3, 4]),
  };
}

console.log('csv-rev-compare operational export tests passed');
