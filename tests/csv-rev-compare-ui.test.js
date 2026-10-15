import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  artifactDescriptor,
  buildWorkflowState,
  unresolvedReviewRows,
} from '../tabs/csv-rev-compare/csv-rev-compare-ui-model.js';
import {
  resolveReviewedLineage,
  unresolvedLineageReviews,
} from '../tabs/csv-rev-compare/support-revision-review.js';
import { buildSupportRevisionEventLedger } from '../tabs/csv-rev-compare/support-revision-events.js';

function location(nodeId, rowId) {
  return Object.freeze({
    nodeId,
    sourceRowId: rowId,
    family: nodeId.toUpperCase(),
    legacyIdentity: 'PS-COMMON',
    persistentReferences: Object.freeze([]),
    pipe: Object.freeze({ raw: 'ASIM-1885-PL-4"-M8810130-01' }),
    position: Object.freeze({
      x: Object.freeze({ raw: 'E 100', directedMm: 100 }),
      y: Object.freeze({ raw: 'N 200', directedMm: 200 }),
      z: Object.freeze({ raw: '300', directedMm: 300 }),
    }),
    components: Object.freeze([]),
    loads: Object.freeze([]),
    provenance: Object.freeze({ cells: Object.freeze({}) }),
  });
}

function model(revision, ids) {
  const locations = Object.freeze(ids.map((id, index) => location(id, `${revision}:${index + 1}`)));
  return Object.freeze({
    revision,
    profileId: 'support-revision-csv-xml/v1',
    locations,
    locationByNodeId: new Map(locations.map((item) => [item.nodeId, item])),
  });
}

function structuralAmbiguity() {
  const candidates = Object.freeze([
    Object.freeze({ candidateId: 'c1', sourceNodeId: 's1', targetNodeId: 't1', outcome: 'AMBIGUOUS', reasonCodes: Object.freeze(['STRUCTURAL']), persistentReferences: Object.freeze([]), reviewRequired: true }),
    Object.freeze({ candidateId: 'c2', sourceNodeId: 's2', targetNodeId: 't2', outcome: 'AMBIGUOUS', reasonCodes: Object.freeze(['STRUCTURAL']), persistentReferences: Object.freeze([]), reviewRequired: true }),
  ]);
  const edge = Object.freeze({
    edgeId: 'lineage:struct:0001',
    cardinality: 'N->M',
    sourceNodeIds: Object.freeze(['s1', 's2']),
    targetNodeIds: Object.freeze(['t1', 't2']),
    outcome: 'AMBIGUOUS',
    matchingMethod: 'common-support-graph',
    reasonCodes: Object.freeze(['COMMON_SUPPORT_REDESIGN']),
    persistentReferences: Object.freeze([]),
    candidateIds: Object.freeze(['c1', 'c2']),
  });
  return Object.freeze({ candidates, edges: Object.freeze([edge]), removed: Object.freeze([]), added: Object.freeze([]), ambiguous: candidates, sourceClusters: Object.freeze([]), targetClusters: Object.freeze([]) });
}

test('workflow exposes all 17 issue stages and blocks downstream work at review', () => {
  const result = {
    stage: 'REVIEW_REQUIRED',
    pair: { ok: true },
    unresolvedReviews: { count: 2 },
    exportReady: false,
  };
  const stages = buildWorkflowState({ rev1Loaded: true, rev2Loaded: true, result });
  assert.equal(stages.length, 17);
  assert.equal(stages[0].label, 'Load Revision 1');
  assert.equal(stages[7].label, 'Review ambiguous lineage');
  assert.equal(stages[7].status, 'ACTION_REQUIRED');
  assert.equal(stages[8].status, 'BLOCKED');
  assert.equal(stages[16].status, 'BLOCKED');
});

test('workflow marks final export ready only after review is resolved', () => {
  const result = {
    stage: 'READY_TO_EXPORT',
    pair: { ok: true },
    unresolvedReviews: { count: 0 },
    exportReady: true,
  };
  const stages = buildWorkflowState({ rev1Loaded: true, rev2Loaded: true, result });
  assert.equal(stages[7].status, 'COMPLETE');
  assert.equal(stages[15].status, 'COMPLETE');
  assert.equal(stages[16].status, 'READY');
});

test('audit/XML artifacts can remain available while primary CSV is gated', () => {
  const result = {
    artifacts: {
      outputCsv: null,
      comparisonAuditJson: '{"audit":true}',
      rev1Xml: '<SupportRevision/>',
    },
  };
  assert.equal(artifactDescriptor(result, 'csv'), null);
  assert.equal(artifactDescriptor(result, 'audit')?.name, 'support-revision-comparison-audit.json');
  assert.equal(artifactDescriptor(result, 'rev1xml')?.type, 'application/xml');
});

test('structural N-to-M ambiguity is one structural review item, not duplicate candidate work', () => {
  const lineage = structuralAmbiguity();
  const rows = unresolvedReviewRows({ lineage });
  assert.equal(unresolvedLineageReviews(lineage).count, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'structural');
  assert.equal(rows[0].cardinality, 'N->M');
});

test('explicit structural acceptance resolves N-to-M review without pretending it was deterministic', () => {
  const source = model('R1', ['s1', 's2']);
  const target = model('R2', ['t1', 't2']);
  const lineage = resolveReviewedLineage(structuralAmbiguity(), source, target, [
    { kind: 'structural', edgeId: 'lineage:struct:0001', action: 'accept', reason: 'Engineer accepted redesign lineage.' },
  ]);
  assert.equal(unresolvedLineageReviews(lineage).count, 0);
  assert.equal(lineage.edges[0].outcome, 'LIKELY');
  assert.equal(lineage.edges[0].reviewDecision, 'ACCEPTED');
  assert.equal(lineage.candidates.every((item) => item.outcome !== 'AMBIGUOUS'), true);
  const ledger = buildSupportRevisionEventLedger(source, target, lineage);
  const structuralEvent = ledger.events.find((event) => event.lineageEdgeId === 'lineage:struct:0001');
  assert.equal(structuralEvent.type, 'AMBIGUOUS_LINEAGE');
  assert.equal(structuralEvent.auditStatus, 'REVIEWED_ACCEPTED');
});

test('explicit structural rejection removes the edge and rejects its candidate evidence', () => {
  const source = model('R1', ['s1', 's2']);
  const target = model('R2', ['t1', 't2']);
  const lineage = resolveReviewedLineage(structuralAmbiguity(), source, target, [
    { kind: 'structural', edgeId: 'lineage:struct:0001', action: 'reject' },
  ]);
  assert.equal(unresolvedLineageReviews(lineage).count, 0);
  assert.equal(lineage.edges.length, 0);
  assert.equal(lineage.candidates.every((item) => item.outcome === 'NO_MATCH'), true);
  assert.deepEqual(lineage.removed, ['s1', 's2']);
  assert.deepEqual(lineage.added, ['t1', 't2']);
});

test('Utilities installer keeps generic Revision Compare and adds the separate XML-based CSV tile', async () => {
  const installer = await readFile(new URL('../tabs/psnm-utility-tab.js', import.meta.url), 'utf8');
  assert.match(installer, /\['Revision compare', '\.\/revision-compare\/revision-compare-tab\.js', 'installRevisionCompareTile'/);
  assert.match(installer, /\['CSV Rev Compare \(XML Based\)', '\.\/csv-rev-compare\/csv-rev-compare-tab\.js', 'installCsvRevCompareTile'/);
});

test('Utilities UI delegates engineering comparison to the XML-domain engine', async () => {
  const source = await readFile(new URL('../tabs/csv-rev-compare/csv-rev-compare-tab.js', import.meta.url), 'utf8');
  assert.match(source, /runSupportRevisionCompare/);
  assert.match(source, /supportRevisionToXlsxBytes/);
  assert.doesNotMatch(source, /parseTableSource/);
  assert.doesNotMatch(source, /SUPPORT_COMPONENT_SET_CHANGED/);
  assert.doesNotMatch(source, /LOAD_SIGNATURE_CHANGED/);
  assert.match(source, /CSV Rev Compare \(XML Based\)/);
});
