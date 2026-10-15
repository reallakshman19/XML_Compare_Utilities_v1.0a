import assert from 'node:assert/strict';
import {
  STAGED_POSITION_IDENTITY_TOLERANCE_MM,
  buildStagedExport,
} from '../tabs/topology-trace-validator/topology-staged-export.js';

const point = (x, y = 0, z = 0) => ({ x, y, z });
const hierarchy = [{
  name: '/IDENTITY/B1',
  type: 'BRANCH',
  attributes: { HPOS: point(0), BPOS: point(0.421), TPOS: point(10) },
  children: [{ name: 'PIPE-1', type: 'PIPE', attributes: { APOS: point(0), LPOS: point(10) } }],
}];
const common = {
  baseCanonical: {
    schema: 'CanonicalTopology.v1',
    nodes: [{ id: 'CN-1', position: point(0) }, { id: 'CN-2', position: point(10) }],
  },
  draft: {
    schema: 'TopologyEditDraft.v1',
    baseCanonicalTopologyHash: 'fnv1a64:base',
    topologyEditDraftHash: 'fnv1a64:draft',
    commands: [{ id: 'EC-000001', type: 'MOVE_NODE', payload: { nodeId: 'CN-1', position: point(1) } }],
  },
  editedCanonicalHash: 'fnv1a64:edited',
  attributeLedger: { schema: 'AttributeEditLedger.v1', edits: [], redoEdits: [], nextSequence: 1 },
  commandJournal: { schema: 'CommandJournal.v1', activeCommandIds: ['EC-000001'] },
  exportedAt: '2026-07-28T09:45:00.000Z',
  ledgerRows: [],
};

const bare = buildStagedExport({ ...common, baseStagedJson: hierarchy });
const bareJson = JSON.parse(bare.text);
assert.equal(Array.isArray(bareJson), true);
assert.equal(bare.summary.rootShape, 'array');
assert.equal(Object.hasOwn(bareJson, 'provenance'), false);
assert.deepEqual(bareJson[0].attributes.HPOS, point(1));
assert.deepEqual(bareJson[0].children[0].attributes.APOS, point(1));
assert.deepEqual(bareJson[0].attributes.BPOS, point(0.421));
assert.equal(bare.summary.coordinatesTouched, 2);
assert.equal(bare.provenance.positionIdentityToleranceMm, STAGED_POSITION_IDENTITY_TOLERANCE_MM);
assert.equal(JSON.parse(bare.provenanceText).schema, 'StagedEditProvenance.v1');

const enveloped = buildStagedExport({
  ...common,
  baseStagedJson: { schema: 'inputxml-managed-stage/v1', hierarchy, producer: 'fixture' },
});
const envelopedJson = JSON.parse(enveloped.text);
assert.equal(envelopedJson.schema, 'inputxml-managed-stage/v1');
assert.equal(envelopedJson.producer, 'fixture');
assert.equal(Array.isArray(envelopedJson.hierarchy), true);
assert.equal(Object.hasOwn(envelopedJson, 'provenance'), false);
assert.equal(enveloped.summary.rootShape, 'hierarchy');

assert.throws(
  () => buildStagedExport({ ...common, baseStagedJson: hierarchy, positionIdentityToleranceMm: 0.5 }),
  /must not exceed 0\.0001 mm/,
);

console.log('staged export interchange contract passed');
