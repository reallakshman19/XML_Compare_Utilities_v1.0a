import assert from 'node:assert/strict';
import {
  STAGED_POSITION_IDENTITY_TOLERANCE_MM,
  TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD,
  TOPOLOGY_SOURCE_POSITION_FIELD,
  buildStagedExport,
} from '../tabs/topology-trace-validator/topology-staged-export.js';

const point = (x, y = 0, z = 0) => ({ x, y, z });
const supportPath = '$[0].children[1]';
const carrierPath = '$[0].children[0]';
const baseStagedJson = [{
  name: '/IDENTITY/B1',
  type: 'BRANCH',
  attributes: {
    HPOS: point(0),
    BPOS: point(0.421),
    TPOS: point(10),
  },
  children: [
    {
      name: 'PIPE-1',
      type: 'PIPE',
      attributes: { APOS: point(0), LPOS: point(10) },
    },
    {
      name: 'SUPPORT-1',
      type: 'SUPPORT',
      attributes: { TYPE: 'ATTA', APOS: point(0), POS: point(0), LPOS: point(0) },
    },
  ],
}];
const baseCanonical = {
  schema: 'CanonicalTopology.v1',
  nodes: [
    { id: 'CN-1', position: point(0) },
    { id: 'CN-2', position: point(10) },
  ],
  supports: [{
    id: 'SA-1', tag: 'PS-IDENTITY', nodeId: 'CN-1',
    position: point(0), sourcePosition: point(0), attachmentPosition: point(0),
    attachmentEdgeSourcePath: carrierPath, sourcePaths: [supportPath],
  }],
};
const draft = {
  schema: 'TopologyEditDraft.v1',
  baseCanonicalTopologyHash: 'fnv1a64:base',
  topologyEditDraftHash: 'fnv1a64:draft',
  commands: [{ id: 'EC-000001', type: 'MOVE_NODE', payload: { nodeId: 'CN-1', position: point(1) } }],
};
const common = {
  baseStagedJson,
  baseCanonical,
  draft,
  editedCanonicalHash: 'fnv1a64:edited',
  attributeLedger: { schema: 'AttributeEditLedger.v1', edits: [], redoEdits: [], nextSequence: 1 },
  commandJournal: { schema: 'CommandJournal.v1', activeCommandIds: [] },
  exportedAt: '2026-07-28T07:30:00.000Z',
  ledgerRows: [],
};

const result = buildStagedExport({ ...common, toleranceMm: 0.5 });
const exported = JSON.parse(result.text);
const support = exported[0].children[1];
assert.equal(Array.isArray(exported), true, 'a bare-array staged source must remain a bare array');
assert.equal(result.summary.rootShape, 'array');
assert.equal(result.provenance.positionIdentityToleranceMm, STAGED_POSITION_IDENTITY_TOLERANCE_MM);
assert.equal(JSON.parse(result.provenanceText).schema, 'StagedEditProvenance.v1');
assert.equal(result.summary.positionIdentityToleranceMm, STAGED_POSITION_IDENTITY_TOLERANCE_MM);
assert.equal(result.summary.remaps, 1);
assert.equal(result.summary.coordinatesTouched, 5);
assert.equal(result.summary.supportProjectionEvidencePreserved, 1);
assert.equal(result.provenance.supportSourcePositionField, TOPOLOGY_SOURCE_POSITION_FIELD);
assert.equal(result.provenance.supportCarrierAuthorityField, TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD);
assert.equal(result.provenance.supportProjectionEvidencePreserved, 1);
assert.deepEqual(exported[0].attributes.HPOS, point(1), 'exact branch port follows the moved node');
assert.deepEqual(exported[0].children[0].attributes.APOS, point(1), 'exact component port follows the moved node');
assert.equal(Object.hasOwn(exported[0].children[0].attributes, TOPOLOGY_SOURCE_POSITION_FIELD), false);
assert.equal(Object.hasOwn(exported[0].children[0].attributes, TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD), false);
assert.deepEqual(support.attributes.APOS, point(1));
assert.deepEqual(support.attributes.POS, point(1));
assert.deepEqual(support.attributes.LPOS, point(1));
assert.deepEqual(support.attributes[TOPOLOGY_SOURCE_POSITION_FIELD], point(0), 'support source evidence must remain immutable');
assert.equal(support.attributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD], carrierPath, 'support carrier authority must remain exact');
assert.deepEqual(exported[0].attributes.BPOS, point(0.421), 'nearby but distinct coordinate must not be remapped');
assert.deepEqual(exported[0].attributes.TPOS, point(10));
assert.deepEqual(exported[0].children[0].attributes.LPOS, point(10));
assert.throws(() => buildStagedExport({ ...common, positionIdentityToleranceMm: 0.5 }), /must not exceed 0\.0001 mm/);

const retainedSource = structuredClone(baseStagedJson);
retainedSource[0].children[1].attributes[TOPOLOGY_SOURCE_POSITION_FIELD] = point(0);
retainedSource[0].children[1].attributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD] = carrierPath;
const retained = buildStagedExport({ ...common, baseStagedJson: retainedSource });
const retainedAttributes = JSON.parse(retained.text)[0].children[1].attributes;
assert.deepEqual(retainedAttributes[TOPOLOGY_SOURCE_POSITION_FIELD], point(0));
assert.equal(retainedAttributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD], carrierPath);
assert.equal(retained.summary.supportProjectionEvidencePreserved, 0, 'existing valid paired evidence must not be replaced');

const partialSource = structuredClone(baseStagedJson);
partialSource[0].children[1].attributes[TOPOLOGY_SOURCE_POSITION_FIELD] = point(0);
assert.throws(
  () => buildStagedExport({ ...common, baseStagedJson: partialSource }),
  /requires both TOPOLOGY_SOURCE_POSITION and TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH/,
);

const invalidSource = structuredClone(baseStagedJson);
invalidSource[0].children[1].attributes[TOPOLOGY_SOURCE_POSITION_FIELD] = { x: 'invalid', y: 0, z: 0 };
invalidSource[0].children[1].attributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD] = carrierPath;
assert.throws(
  () => buildStagedExport({ ...common, baseStagedJson: invalidSource }),
  /invalid or conflicting TOPOLOGY_SOURCE_POSITION evidence/,
);

const invalidCarrier = structuredClone(baseStagedJson);
invalidCarrier[0].children[1].attributes[TOPOLOGY_SOURCE_POSITION_FIELD] = point(0);
invalidCarrier[0].children[1].attributes[TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH_FIELD] = '$[0].children[99]';
assert.throws(
  () => buildStagedExport({ ...common, baseStagedJson: invalidCarrier }),
  /invalid or conflicting TOPOLOGY_ATTACHMENT_EDGE_SOURCE_PATH evidence/,
);

assert.throws(
  () => buildStagedExport({ ...common, baseCanonical: { ...baseCanonical, supports: [] } }),
  /has no canonical carrier evidence/,
);

const enveloped = buildStagedExport({ ...common, baseStagedJson: {
  schema: 'inputxml-managed-stage/v1', hierarchy: baseStagedJson, producer: 'fixture',
} });
const envelopedJson = JSON.parse(enveloped.text);
assert.equal(envelopedJson.schema, 'inputxml-managed-stage/v1');
assert.equal(envelopedJson.producer, 'fixture');
assert.equal(Array.isArray(envelopedJson.hierarchy), true);
assert.equal(Object.hasOwn(envelopedJson, 'provenance'), false, 'provenance must not alter the interchange document');

console.log('topology staged-export identity passed: root shape, exact remaps, and paired support projection evidence preserved.');
