import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBranchInventory } from '../tabs/sequential-sketcher/sequential-sketcher-source.js';
import {
  appendSupportDiagnostics,
  buildSequentialSketcherSupportProjection,
  decorateTopologyWithSupportProjection,
} from '../tabs/sequential-sketcher/sequential-sketcher-support.js';
import { buildBranchTopology } from '../tabs/sequential-sketcher/sequential-sketcher-topology.js';
import { planSequentialTraversal } from '../tabs/sequential-sketcher/sequential-sketcher-traversal.js';

const branchId = '/ASIM-TEST-6"-S0001-CLASS/B2';
const branch = {
  name: branchId,
  type: 'BRANCH',
  attributes: {
    NAME: branchId,
    HPOS: { x: 0, y: 0, z: 0 },
    HREF: '/UPSTREAM/B1',
    TPOS: { x: 1000, y: 0, z: 0 },
    TREF: '/DOWNSTREAM/B3',
  },
  children: [
    {
      name: 'PIPE-1',
      type: 'PIPE',
      attributes: {
        NAME: 'PIPE-1',
        APOS: { x: 0, y: 0, z: 0 },
        LPOS: { x: 1000, y: 0, z: 0 },
      },
    },
    {
      name: 'SUPPORT PS-1',
      type: 'SUPPORT',
      attributes: {
        NAME: '/PS-1/DATUM',
        TYPE: 'ATTA',
        OWNER: branchId,
        POS: { x: 250, y: 0, z: 0 },
        CMPSUPTYPE: 'REST',
      },
    },
    {
      name: 'SUPPORT PS-1',
      type: 'SUPPORT',
      attributes: {
        NAME: '/PS-1.1',
        TYPE: 'ATTA',
        OWNER: branchId,
        POS: { x: 250, y: 0, z: 0 },
        CMPSUPTYPE: 'SH-150',
        DTXR: 'PIPE SHOE',
      },
    },
  ],
};

function topologyAuthoritySnapshot(topology) {
  return {
    nodes: topology.nodes,
    segments: topology.segments,
    boundaries: topology.boundaries,
    source: topology.source,
  };
}

test('support projection consumes validated traversal but cannot modify piping graph or pen commands', () => {
  const inventory = buildBranchInventory(branch);
  assert.equal(inventory.routeComponents.length, 1);
  assert.equal(inventory.supportRecords.length, 2);

  const pipingTopology = buildBranchTopology(inventory, { toleranceMm: 0.001 });
  const pipingTraversal = planSequentialTraversal(pipingTopology);
  const graphBefore = structuredClone(topologyAuthoritySnapshot(pipingTopology));
  const commandsBefore = structuredClone(pipingTraversal.commands);

  const bundle = buildSequentialSketcherSupportProjection(inventory, pipingTopology, pipingTraversal, {
    projectionToleranceMm: 50,
    onCenterlineToleranceMm: 0.001,
    ambiguityToleranceMm: 1,
  });
  const decorated = decorateTopologyWithSupportProjection(pipingTopology, bundle);
  const finalTraversal = appendSupportDiagnostics(pipingTraversal, decorated);

  assert.deepEqual(topologyAuthoritySnapshot(decorated), graphBefore);
  assert.deepEqual(finalTraversal.commands, commandsBefore);
  assert.equal(bundle.schema, 'PipeSupportProjectionBundle.v1');
  assert.equal(bundle.supportGlyphs.length, 1);
  assert.equal(bundle.supportGlyphs[0].carrierId, 'PIPE-1');
  assert.equal(bundle.supportGlyphs[0].carrierStationMm, 250);
  assert.equal(decorated.components[0].supports.length, 1);
  assert.deepEqual(decorated.components[0].supports[0].members.map((member) => member.semanticRole), [
    'DATUM', 'PIPE_SHOE',
  ]);
  assert.equal(decorated.supportSummary.familyCount, 1);
  assert.equal(decorated.supportSummary.unresolvedCount, 0);
});
