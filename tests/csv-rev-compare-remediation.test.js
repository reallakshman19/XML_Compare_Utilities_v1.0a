import assert from 'node:assert/strict';

import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { convertSupportRevisionPair } from '../tabs/csv-rev-compare/support-revision-pipeline.js';
import { buildSupportRevisionModel, componentByReference } from '../tabs/csv-rev-compare/support-revision-model.js';
import { buildSupportRevisionLineage } from '../tabs/csv-rev-compare/support-revision-lineage.js';
import { runSupportRevisionCompare } from '../tabs/csv-rev-compare/support-revision-engine.js';
import { _test as reviewTest } from '../tabs/csv-rev-compare/support-revision-review.js';

const H = [
  'PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE',
  'PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE',
  'EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY',
  'REMARKS (IF ANY)','PRIMARY SUPPORT DESCRIPTION','PRIMARY SUPPORT ZONE','PRIMARY SUPPORT SITE',
  'PIPE SCHEDULE','INSULATION','STRESS SYSTEM NUMBER','NODE NO','REVISION',
];

function row(overrides = {}) {
  const values = {
    'PREV NAME': 'PS02012', SCOPE: 'PL', CIVILSECONDARYSUPPORT: 'SL-212',
    PIPE: 'ASIM-1885-PL-4"-M8810130-02', SIZE: '4',
    'PIPING PRIMARY SUPPORT': '/SL-212.1', 'SUPPORT TYPE': 'SHOE-250',
    'PIPING PRIMARY SUPPORT REFERENCE': '=100/1',
    'EAST/WEST': 'E 1000', 'NORTH/SOUTH': 'N 2000', 'BOP ELEVATION': 'U 3000',
    'TOTAL SUPPORT POINTS ON SECONDARY': '1', 'REMARKS (IF ANY)': '',
    'PRIMARY SUPPORT DESCRIPTION': '', 'PRIMARY SUPPORT ZONE': '', 'PRIMARY SUPPORT SITE': '',
    'PIPE SCHEDULE': 'SCH40', INSULATION: '', 'STRESS SYSTEM NUMBER': 'SYS-1',
    'NODE NO': '10', REVISION: '1', ...overrides,
  };
  return H.map((header) => values[header] ?? '');
}

function csv(rows) {
  return [H, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function lineage(rows1, rows2) {
  const pair = convertSupportRevisionPair(csv(rows1), csv(rows2));
  assert.equal(pair.ok, true, JSON.stringify(pair.diagnostics, null, 2));
  const source = buildSupportRevisionModel(pair.rev1);
  const target = buildSupportRevisionModel(pair.rev2);
  return { source, target, result: buildSupportRevisionLineage(source, target) };
}

// Literal engineering inch marks in TSV cells are data, not multiline-CSV quote delimiters.
{
  const tsv = [
    ['CIVILSECONDARYSUPPORT', 'PIPE', 'REVISION'].join('\t'),
    ['SL-1', 'ASIM-1885-PL-4"-M8810130-02', '1'].join('\t'),
    ['SL-2', 'ASIM-1885-PL-6"-M8810131-01', '1'].join('\t'),
  ].join('\n');
  const parsed = parseTableSource(tsv, { sourceId: 'R1' });
  assert.equal(parsed.delimiter, 'tab');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].rawByHeader.PIPE, 'ASIM-1885-PL-4"-M8810130-02');
  assert.equal(parsed.rows[1].rawByHeader.PIPE, 'ASIM-1885-PL-6"-M8810131-01');
}

// Unresolved ambiguity is an audit/review state, never a provisional removal/addition/output state.
{
  const source = row({ 'PREV NAME': 'PS-AMB', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=AMB/1' });
  const target = row({ REVISION: '2', 'PREV NAME': 'PS-AMB', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=AMB/1' });
  const result = runSupportRevisionCompare(csv([source]), csv([target, target]));
  assert.equal(result.stage, 'REVIEW_REQUIRED');
  assert.equal(result.output, null);
  assert.equal(result.ledger.events.some((event) => ['SUPPORT_LOCATION_REMOVED', 'SUPPORT_LOCATION_ADDED'].includes(event.type)), false);
  assert.deepEqual(result.remarks.sourceRemarks, {});
  assert.deepEqual(result.remarks.targetRemarks, {});
}

// Candidate pair identity comes from the existing XML Compare candidate-pair authority.
{
  const { result } = lineage([row()], [row({ REVISION: '2' })]);
  assert.equal(result.candidatePairSchema, 'xml-compare-candidate-pair-model/v1');
  assert.ok(result.candidates.length > 0);
  assert.ok(result.candidates.every((candidate) => candidate.candidateId.startsWith('candidate:')));
  assert.equal(Object.hasOwn(result, 'xmlCandidateHints'), false);
}

// Equal-cardinality many-to-many common-support redesign remains explicit and review-required.
{
  const sourceA = row({ 'PREV NAME': 'PS-CS', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT': '/SL-A.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=A/1', 'EAST/WEST': 'E 1000' });
  const sourceB = row({ 'PREV NAME': 'PS-CS', CIVILSECONDARYSUPPORT: 'SL-B', 'PIPING PRIMARY SUPPORT': '/SL-B.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=B/1', 'EAST/WEST': 'E 2000' });
  const targetC = row({ REVISION: '2', 'PREV NAME': 'PS-CS', CIVILSECONDARYSUPPORT: 'SL-C', 'PIPING PRIMARY SUPPORT': '/SL-C.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=C/1', 'EAST/WEST': 'E 1100' });
  const targetD = row({ REVISION: '2', 'PREV NAME': 'PS-CS', CIVILSECONDARYSUPPORT: 'SL-D', 'PIPING PRIMARY SUPPORT': '/SL-D.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=D/1', 'EAST/WEST': 'E 2100' });
  const { result } = lineage([sourceA, sourceB], [targetC, targetD]);
  const edge = result.edges.find((item) => item.cardinality === 'N->M');
  assert.ok(edge);
  assert.equal(edge.outcome, 'AMBIGUOUS');
}

// A common-support cluster requires a shared support-type arrangement, not only shared legacy/pipe text.
{
  const a = row({ 'PREV NAME': 'PS-CS', CIVILSECONDARYSUPPORT: 'SL-A', 'PIPING PRIMARY SUPPORT REFERENCE': '=A/1', 'SUPPORT TYPE': 'SHOE-250', 'EAST/WEST': 'E 1000' });
  const b = row({ 'PREV NAME': 'PS-CS', CIVILSECONDARYSUPPORT: 'SL-B', 'PIPING PRIMARY SUPPORT': '/SL-B.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=B/1', 'SUPPORT TYPE': 'REST-250', 'EAST/WEST': 'E 2000' });
  const { result } = lineage([], [a, b].map((item) => item.map((value, index) => H[index] === 'REVISION' ? '2' : value)));
  assert.equal(result.targetClusters.length, 0);
}

// In 1->N replication, the persistent-reference continuation is the anchor; only new targets are replicas.
{
  const source = row({ 'PREV NAME': 'PS02382', CIVILSECONDARYSUPPORT: 'SL-161', 'PIPING PRIMARY SUPPORT': '/SL-161.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=CS/1', 'EAST/WEST': 'E 1000' });
  const anchor = row({ REVISION: '2', 'PREV NAME': 'PS02382', CIVILSECONDARYSUPPORT: 'SL-161', 'PIPING PRIMARY SUPPORT': '/SL-161.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=CS/1', 'EAST/WEST': 'E 1000' });
  const replica = row({ REVISION: '2', 'PREV NAME': 'PS02382', CIVILSECONDARYSUPPORT: 'SL-162', 'PIPING PRIMARY SUPPORT': '/SL-162.1', 'PIPING PRIMARY SUPPORT REFERENCE': '=CS/2', 'EAST/WEST': 'E 1500' });
  const result = runSupportRevisionCompare(csv([source]), csv([anchor, replica]));
  assert.equal(result.exportReady, true);
  const targetRows = result.output.rows.filter((item) => item.disposition === 'REV2');
  const remarksIndex = result.output.headers.indexOf('REMARKS (IF ANY)');
  assert.doesNotMatch(targetRows[0].values[remarksIndex], /Replicated due to Common support/);
  assert.match(targetRows[1].values[remarksIndex], /Replicated due to Common support/);
}

// Review approval is one-to-one in both directions; a target cannot be silently double-approved.
{
  const lineageState = {
    candidates: [
      { candidateId: 'candidate:S1=>T1', sourceNodeId: 'S1', targetNodeId: 'T1', outcome: 'AMBIGUOUS' },
      { candidateId: 'candidate:S2=>T1', sourceNodeId: 'S2', targetNodeId: 'T1', outcome: 'AMBIGUOUS' },
    ],
    edges: [],
  };
  const decisions = [
    { decisionId: 'r1', kind: 'candidate', sourceNodeId: 'S1', targetNodeId: 'T1', action: 'approve' },
    { decisionId: 'r2', kind: 'candidate', sourceNodeId: 'S2', targetNodeId: 'T1', action: 'approve' },
  ];
  const diagnostics = reviewTest.validateReviewDecisions(lineageState, decisions);
  assert.ok(diagnostics.some((item) => item.decisionId === 'r2' && item.code === 'multiple_sources_approved_for_target'));
}

// Duplicate persistent references retain multiplicity instead of overwriting an earlier component.
{
  const grouped = componentByReference({ components: [
    { nodeId: 'C1', reference: '=DUP/1' },
    { nodeId: 'C2', reference: '=DUP/1' },
  ] });
  assert.equal(grouped.get('=DUP/1').length, 2);
}

// Persistent-reference continuations can establish the revision coordinate frame even when PIPE changes.
{
  const make = (family, ref, x, pipe, revision) => row({
    REVISION: revision, 'PREV NAME': family, CIVILSECONDARYSUPPORT: family,
    PIPE: pipe, 'PIPING PRIMARY SUPPORT': `/${family}.1`,
    'PIPING PRIMARY SUPPORT REFERENCE': ref, 'EAST/WEST': `E ${x}`,
    'NORTH/SOUTH': `N ${x + 1000}`, 'BOP ELEVATION': `U ${x + 2000}`,
  });
  const source = [
    make('SL-1', '=F/1', 1000, 'ASIM-1885-PL-4"-M8810101-01', '1'),
    make('SL-2', '=F/2', 2000, 'ASIM-1885-PL-4"-M8810102-01', '1'),
    make('SL-3', '=F/3', 3000, 'ASIM-1885-PL-4"-M8810103-01', '1'),
  ];
  const target = [
    make('SL-1', '=F/1', 1100, 'ASIM-1885-PL-4"-M8811101-01', '2'),
    make('SL-2', '=F/2', 2100, 'ASIM-1885-PL-4"-M8811102-01', '2'),
    make('SL-3', '=F/3', 3100, 'ASIM-1885-PL-4"-M8811103-01', '2'),
  ];
  const { result } = lineage(source, target);
  assert.ok(result.coordinateFrame.anchorCount >= 3);
  assert.equal(result.coordinateFrame.scoreFrameUsable, true);
  assert.match(result.coordinateFrame.anchorBasis, /PERSISTENT_REFERENCE/);
}

console.log('csv-rev-compare remediation regression tests passed');
