import assert from 'assert';
import { buildCiiEngineeringDeltas } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';

function hangerCapability(state, count, nodes, qualified = true) {
  return {
    state, count, qualification: qualified ? 'PARTIAL' : 'NONE',
    authority: qualified ? 'tabs/cii-workspace/cii-workspace-hanger.js#CONTROL_NOHGRS_IHGRNODE' : 'tabs/cii-workspace/cii-workspace-hanger.js',
    details: { nodePresenceQualified: qualified, nodes, nodeCount: nodes.length },
    limitations: qualified ? ['Hanger node presence only'] : ['blocked'],
  };
}
function document(side, node, present) {
  const records = present ? [{ recordIndex: 1, node: String(node), authority: 'CONTROL_NOHGRS_PLUS_IHGRNODE' }] : [];
  return {
    side, nodeNames: {}, parsed: { restraints: [] },
    hangerEvidence: {
      status: 'QUALIFIED', count: records.length, nodes: records.map((item) => item.node),
      byNode: present ? { [String(node)]: records } : {}, conflicts: [],
    },
    capabilities: { families: {
      hangers: hangerCapability(present ? 'PARSED' : 'EMPTY', records.length, records.map((item) => item.node)),
      nodeNames: { state: 'EMPTY', qualification: 'QUALIFIED', limitations: [] },
      restraints: { state: 'EMPTY', qualification: 'PARTIAL', limitations: [] },
      sifTee: { state: 'EMPTY', qualification: 'PARTIAL', limitations: [] },
      process: { state: 'EMPTY', qualification: 'PARTIAL', limitations: [] },
    } },
  };
}
function graph(id, position) { return { nodes: [{ id: String(id), position }], edges: [] }; }

const source = document('SOURCE', 205, true);
const target = document('TARGET', 20205, false);
const correspondence = {
  nodeRows: [{ correspondenceId: 'node:205:20205', kind: 'NODE', sourceNodeId: '205', targetNodeId: '20205', status: 'HIGH' }],
  elementRows: [], componentRows: [],
};
const deltas = buildCiiEngineeringDeltas(
  source, target,
  graph(205, { x: 0, y: 0, z: 0 }), graph(20205, { x: 200, y: 0, z: 0 }),
  correspondence,
);
const presence = deltas.changedRows.find((item) => item.category === 'HANGER' && item.property === 'Hanger presence');
assert(presence);
assert.strictEqual(presence.sourceValue, true);
assert.strictEqual(presence.targetValue, false);
assert.strictEqual(presence.semanticChange, 'REMOVED_IN_TARGET');
assert.strictEqual(presence.identityConfidence, 'HIGH', 'property deletion must not reduce correspondence identity');
const count = deltas.changedRows.find((item) => item.category === 'HANGER' && item.property === 'Hanger record count at node');
assert(count);
assert.strictEqual(count.sourceValue, 1);
assert.strictEqual(count.targetValue, 0);
assert.strictEqual(count.delta, -1);
assert.strictEqual(deltas.limitations.find((item) => item.family === 'hangers').comparisonState, 'PARTIAL');
assert.strictEqual(deltas.summary.identityMutationAuthority, 'NONE_READ_ONLY_DOWNSTREAM');

const blockedTarget = {
  ...target,
  capabilities: { families: { ...target.capabilities.families, hangers: hangerCapability('PARSE_ERROR', null, [], false) } },
};
const blocked = buildCiiEngineeringDeltas(
  source, blockedTarget,
  graph(205, { x: 0, y: 0, z: 0 }), graph(20205, { x: 200, y: 0, z: 0 }),
  correspondence,
);
assert(!blocked.rows.some((item) => item.category === 'HANGER'), 'hanger PARSE_ERROR must suppress downstream hanger assertions');
assert.strictEqual(blocked.limitations.find((item) => item.family === 'hangers').comparisonState, 'BLOCKED');

console.log('CII qualified hanger deletion downstream-delta checks passed.');
