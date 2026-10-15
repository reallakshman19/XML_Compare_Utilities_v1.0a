import assert from 'node:assert/strict';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';

const branchId = '/GEOMETRY-FIRST/B1';
const records = [{
  name: branchId,
  type: 'BRANCH',
  attributes: {
    NAME: branchId,
    HPOS: { x: 0, y: 0, z: 0 },
    TPOS: { x: 30, y: 0, z: 0 },
  },
  children: [
    {
      name: 'PIPE-C-HIERARCHY-FIRST',
      type: 'PIPE',
      attributes: {
        NAME: 'PIPE-C-HIERARCHY-FIRST',
        APOS: { x: 20, y: 0, z: 0 },
        LPOS: { x: 30, y: 0, z: 0 },
        ABORE: '100mm', LBORE: '100mm',
      },
    },
    {
      name: 'PIPE-A-GEOMETRY-FIRST',
      type: 'PIPE',
      attributes: {
        NAME: 'PIPE-A-GEOMETRY-FIRST',
        APOS: { x: 0, y: 0, z: 0 },
        LPOS: { x: 10, y: 0, z: 0 },
        ABORE: '100mm', LBORE: '100mm',
      },
    },
    {
      name: 'PIPE-B-GEOMETRY-MIDDLE',
      type: 'PIPE',
      attributes: {
        NAME: 'PIPE-B-GEOMETRY-MIDDLE',
        APOS: { x: 10, y: 0, z: 0 },
        LPOS: { x: 20, y: 0, z: 0 },
        ABORE: '100mm', LBORE: '100mm',
      },
    },
    {
      name: 'CAP-END',
      type: 'CAP',
      attributes: {
        NAME: 'CAP-END',
        APOS: { x: 30, y: 0, z: 0 },
        ABORE: '100mm',
      },
    },
  ],
}];

const sourceSnapshot = JSON.stringify(records);
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const branch = indexes.branches.get(branchId);

assert.ok(branch);
assert.equal(branch.routeSequenceBasis, 'GEOMETRY_PORT_CONTINUITY');
assert.deepEqual(
  branch.components.map((component) => component.sourceComponentId),
  ['PIPE-A-GEOMETRY-FIRST', 'PIPE-B-GEOMETRY-MIDDLE', 'PIPE-C-HIERARCHY-FIRST', 'CAP-END'],
);
assert.deepEqual(branch.components.map((component) => component.routeIndex), [0, 1, 2, 3]);
assert.deepEqual(
  branch.components.map((component) => component.sourceIndex),
  [1, 2, 0, 3],
  'source hierarchy indices must remain immutable provenance',
);
assert.ok(branch.components.every((component) => component.routeSequenceBasis === 'GEOMETRY_PORT_CONTINUITY'));

const result = runConstructionUntilBlocked(
  createSequentialConstructionSession(branchId),
  evidence,
  indexes,
  { exactToleranceMm: 1, autoRepairToleranceMm: 25 },
);

assert.equal(result.session.state, 'ROUTE_COMPLETE');
assert.deepEqual(
  result.session.confirmedComponentIds.map((id) => indexes.components.get(id)?.sourceComponentId),
  ['PIPE-A-GEOMETRY-FIRST', 'PIPE-B-GEOMETRY-MIDDLE', 'PIPE-C-HIERARCHY-FIRST', 'CAP-END'],
);
assert.equal(result.session.repairLedger.length, 0);
assert.equal(result.session.currentDecisionRequest, null);
assert.equal(JSON.stringify(records), sourceSnapshot, 'geometry ordering must not mutate source records');
assert.ok(result.session.committedConnections.every((connection) => connection.gapMm === 0));

console.log('sequential geometry route-order tests passed');
