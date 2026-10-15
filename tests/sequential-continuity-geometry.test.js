import assert from 'node:assert/strict';
import {
  buildSequentialContinuationDraft,
  continuationOverride,
} from '../tabs/sequential-sketcher/continuity/sequential-continuation-model.js';
import {
  constructSequentialGeometry,
  serializeSequentialConstructedSource,
  serializeSequentialSourceRecords,
} from '../tabs/sequential-sketcher/continuity/sequential-network-constructor.js';

const point = (x, y, z = 0) => ({ x, y, z });
const pipe = (name, from, to) => ({ name, type: 'PIPE', attributes: { APOS: from, LPOS: to, LBORE: '100mm' } });
const records = [
  {
    name: '/A', type: 'BRANCH', bore: '100mm',
    attributes: { NAME: '/A', HPOS: point(0, 0), TPOS: point(100, 0), TREF: '/B', HBOR: '100mm', TBOR: '100mm' },
    children: [pipe('PIPE A', point(0, 0), point(100, 0))],
  },
  {
    name: '/B', type: 'BRANCH', bore: '100mm',
    attributes: { NAME: '/B', HPOS: point(100, 0), TPOS: point(200, 0), HREF: '/A', TREF: '/OUTSIDE' },
    children: [pipe('PIPE B', point(100, 0), point(200, 0))],
  },
  {
    name: '/C', type: 'BRANCH', bore: '100mm',
    attributes: { NAME: '/C', HPOS: point(120, 0), TPOS: point(220, 0) },
    children: [pipe('PIPE C', point(120, 0), point(220, 0))],
  },
];
const queue = Object.freeze({
  schema: 'SequentialBlockedBranchReviewQueue.v1',
  generatedAt: '2026-07-17T17:10:00.000Z',
  rows: Object.freeze(records.map((record) => Object.freeze({
    branchId: record.attributes.NAME,
    reviewStatus: 'UNRESOLVED',
  }))),
});

const sourceBefore = JSON.stringify(records);
const draft = buildSequentialContinuationDraft(records, queue);
assert.equal(draft.branchIds.length, 3);
assert.equal(draft.connectors.length, 6);
assert.equal(draft.summary.internalCount, 2);
assert.equal(draft.summary.externalCount, 4);
assert.equal(draft.connectors.find((row) => row.branchId === '/A' && row.role === 'TAIL').gapMm, 0);

const aTail = draft.connectors.find((row) => row.branchId === '/A' && row.role === 'TAIL');
const bTail = draft.connectors.find((row) => row.branchId === '/B' && row.role === 'TAIL');
const overrides = {
  [aTail.connectorId]: continuationOverride(aTail, {
    targetBranchId: '/C', targetEndpoint: 'HEAD', reason: 'Approved queue reroute to continuation sheet C',
  }),
  [bTail.connectorId]: continuationOverride(bTail, {
    targetBranchId: '__EXTERNAL__', targetEndpoint: 'HEAD',
    externalReference: '/NEXT-SHEET-B8', reason: 'Corrected external continuation sheet',
  }),
};
const editedDraft = buildSequentialContinuationDraft(records, queue, overrides);
assert.equal(editedDraft.summary.editedCount, 2);
const geometry = constructSequentialGeometry(records, editedDraft, queue, { exactToleranceMm: 1 });
assert.equal(geometry.schema, 'SequentialConstructedGeometry.v1');
assert.equal(geometry.records[0].attributes.TREF, '/C');
assert.equal(geometry.records[1].attributes.TREF, '/NEXT-SHEET-B8');
assert.equal(geometry.metrics.generatedPipeCount, 1);
const generated = geometry.records[0].children.find((child) => child.attributes?.ROUTE_TIER === 'BUILD_QUEUE_CONTINUITY');
assert.ok(generated);
assert.deepEqual(generated.attributes.APOS, point(100, 0));
assert.deepEqual(generated.attributes.LPOS, point(120, 0));
assert.equal(JSON.stringify(records), sourceBefore, 'construction must not mutate imported source evidence');

const sourceJson = serializeSequentialSourceRecords(records);
const constructedJson = serializeSequentialConstructedSource(geometry);
assert.ok(Array.isArray(JSON.parse(sourceJson)));
assert.ok(Array.isArray(JSON.parse(constructedJson)));
assert.equal(JSON.parse(sourceJson)[0].attributes.TREF, '/B');
assert.equal(JSON.parse(constructedJson)[0].attributes.TREF, '/C');
assert.equal(buildSequentialContinuationDraft(JSON.parse(constructedJson), queue).branchIds.length, 3);

const missingReason = buildSequentialContinuationDraft(records, queue, {
  [aTail.connectorId]: continuationOverride(aTail, { targetBranchId: '/C', targetEndpoint: 'HEAD' }),
});
assert.throws(
  () => constructSequentialGeometry(records, missingReason, queue),
  /requires an engineering reason/,
);

console.log('sequential continuity geometry tests passed');
