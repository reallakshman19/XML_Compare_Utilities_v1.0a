import assert from 'assert';
import { stableStringify } from '../tabs/cii-workspace/cii-workspace-contracts.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { qualifyCiiGeometryTransform } from '../tabs/cii-workspace/cii-workspace-geometry.js';
import { compareLockedCiiAnchorSpan } from '../tabs/cii-workspace/cii-workspace-topology.js';

function document(side, ids, points) {
  const elements = [
    { index: 0, from: ids[0], to: ids[1], dx: points[1].x - points[0].x, dy: points[1].y - points[0].y, dz: points[1].z - points[0].z, length: 100, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false, fromPos: points[0], toPos: points[1] },
    { index: 1, from: ids[1], to: ids[2], dx: points[2].x - points[1].x, dy: points[2].y - points[1].y, dz: points[2].z - points[1].z, length: 100, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false, fromPos: points[1], toPos: points[2] },
  ];
  const nodes = Object.fromEntries(ids.map((id, index) => [id, points[index]]));
  return { schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements, nodes, rigids: [] } };
}

const sourcePoints = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, { x: 100, y: 100, z: 0 }];
const targetPoints = [{ x: 1000, y: -500, z: 200 }, { x: 1000, y: -400, z: 200 }, { x: 900, y: -400, z: 200 }];
const source = adaptCiiDocumentToTopologyGraph(document('SOURCE', [100, 110, 120], sourcePoints));
const target = adaptCiiDocumentToTopologyGraph(document('TARGET', [5000, 5010, 5020], targetPoints));
const anchors = [
  { sourceNodeId: '100', targetNodeId: '5000' },
  { sourceNodeId: '110', targetNodeId: '5010' },
  { sourceNodeId: '120', targetNodeId: '5020' },
];
const transform = qualifyCiiGeometryTransform(anchors.map((pair, index) => ({ source: sourcePoints[index], target: targetPoints[index], sourceOdMm: 273 })));
assert.strictEqual(transform.status, 'READY');
assert.strictEqual(transform.tolerancePolicy.basisAgreementToleranceMm, 546);

const noGeometry = compareLockedCiiAnchorSpan(source, target, anchors);
const registered = compareLockedCiiAnchorSpan(source, target, anchors, { geometryTransform: transform });
const projection = (result) => ({
  status: result.status,
  nodes: result.nodeRows.map((row) => [row.sourceNodeId, row.targetNodeId, row.status]),
  elements: result.elementRows.map((row) => [row.sourceElementId || row.sourceElementIds?.join('|'), row.targetElementIds?.join('|'), row.status]),
});
assert.strictEqual(stableStringify(projection(registered)), stableStringify(projection(noGeometry)), 'registered XYZ may support evidence but must not change topology authority');
console.log('CII Workspace OD-scaled coordinate-transform correspondence invariance passed.');
