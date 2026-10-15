import assert from 'assert';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { groupObjectBlocks } from '../workbench3d/adapters/block-grouper.js';
import { resolvePacketMarkerPlacement } from '../workbench3d/adapters/packet-marker-placement.js';
import { buildVisualModel } from '../workbench3d/adapters/visual-model-builder.js';

function record(index, fromNode, toNode, deltaMm, packets = []) {
  return {
    index,
    fromNode,
    toNode,
    deltaMm,
    lengthMm: Math.hypot(...deltaMm),
    diameterMm: index === 0 ? 100 : Number.NaN,
    wallThickMm: Number.NaN,
    name: `E${index + 1}`,
    lineId: 'L1',
    packets,
    properties: {},
    blocks: null,
  };
}

const records = [
  record(0, '10', '20', [1000, 0, 0]),
  record(1, '20', '21', [0, 0, 0], [{ kind: 'BEND', attrs: { RADIUS: '200' } }]),
  record(2, '21', '30', [0, 1000, 0]),
];
const graph = buildCanonicalGraph('source', records, {});
assert.strictEqual(graph.consumedRows.length, 1);
assert.strictEqual(graph.objects.length, 2);

const host = graph.objects.find((object) => object.packets.some((packet) => packet.kind === 'BEND'));
const packet = host.packets.find((item) => item.kind === 'BEND');
assert.strictEqual(packet.sourceAncestry.contract, 'SourcePacketAncestry.v1');
assert.strictEqual(packet.sourceAncestry.resolvedToNode, '20');

const visual = buildVisualModel(graph);
assert.deepStrictEqual(visual.bendSummary, { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 });
assert.strictEqual(visual.geometryDiagnostics.length, 0);
assert.strictEqual(visual.segments.length, 14);
const arc = visual.segments.find((segment) => segment.attrs?.bendPacketSource === 'CONSUMED_SHORT_ELEMENT');
assert.ok(arc, 'consumed bend arc is visible');
assert.strictEqual(arc.attrs.bendDirectionEvidence, 'CONSUMED_PACKET_ANCESTRY_V1');
assert.strictEqual(arc.attrs.bendIncomingObjectId, 'source:E1');
assert.strictEqual(arc.attrs.bendOutgoingObjectId, 'source:E2');

const marker = visual.markers.find((item) => item.kind === 'BEND');
assert.strictEqual(marker.objectId, host.objectId, 'marker keeps canonical host selection authority');
assert.strictEqual(marker.nodeId, '20', 'marker pick carries the ancestry corner');
assert.deepStrictEqual(marker.position, [1000, 0, 0]);
assert.strictEqual(marker.placementEvidence, 'CONSUMED_PACKET_ANCESTRY_V1');
assert.strictEqual(marker.fallback, false);
assert.strictEqual(marker.consumedFrom, 'E2');

const bendBlock = groupObjectBlocks(host).find((group) => group.blockName === 'Bend');
const entries = new Map(bendBlock.instances[0].entries);
assert.strictEqual(entries.get('(source FROM→TO)'), '20->21');
assert.strictEqual(entries.get('(resolved corner)'), '20');
assert.strictEqual(entries.get('(source index)'), 1);
assert.strictEqual(entries.get('(from consumed)'), 'E2');

const nodeCoord = new Map(graph.nodes.map((node) => [node.nodeId, node.coordMm]));
nodeCoord.delete('20');
const missingCorner = resolvePacketMarkerPlacement(packet, host, nodeCoord, 'mid');
assert.strictEqual(missingCorner.resolvedNodeId, '20');
assert.strictEqual(missingCorner.fallback, true);
assert.strictEqual(missingCorner.placementEvidence, 'BEND_PACKET_CORNER_MISSING');

const ambiguous = buildCanonicalGraph('source', [
  ...records,
  record(3, '21', '40', [0, 0, 1000]),
], {});
const ambiguousVisual = buildVisualModel(ambiguous);
assert.strictEqual(ambiguousVisual.bendSummary.blocked, 1);
assert.strictEqual(ambiguousVisual.geometryDiagnostics[0].code, 'BEND_CONSUMED_LEGS_AMBIGUOUS');

const duplicatePackets = buildCanonicalGraph('source', [
  record(0, '10', '20', [1000, 0, 0]),
  record(1, '20', '21', [0, 0, 0], [{ kind: 'BEND', attrs: { RADIUS: '200' } }]),
  record(2, '21', '22', [0, 0, 0], [{ kind: 'BEND', attrs: { RADIUS: '200' } }]),
  record(3, '22', '30', [0, 1000, 0]),
], {});
const duplicateVisual = buildVisualModel(duplicatePackets);
assert.strictEqual(duplicateVisual.bendSummary.resolved, 0);
assert.strictEqual(duplicateVisual.bendSummary.blocked, 2);
assert.ok(duplicateVisual.geometryDiagnostics.every(
  (diagnostic) => diagnostic.code === 'BEND_CONSUMED_PACKET_AMBIGUOUS',
));

console.log('workbench3d-consumed-bend-ancestry.test.js passed');
