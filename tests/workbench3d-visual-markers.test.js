// Marker placement modes, packet filtering, node markers, block grouping,
// node info, and explicit-radius InputXML bend visual geometry.
import assert from 'assert';
import { parseInputXmlRecords } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { buildVisualModel, resolvePacketPosition } from '../workbench3d/adapters/visual-model-builder.js';
import { effectiveDiameterByObject, resolveInputXmlBends } from '../workbench3d/adapters/inputxml-bend-geometry.js';
import { SOURCE_ELEMENT_ORIENTATION_CONTRACT } from '../workbench3d/adapters/source-element-orientation.js';
import { resolvePacketNode, buildNodeInfoIndex } from '../workbench3d/adapters/node-resolver.js';
import { groupObjectBlocks } from '../workbench3d/adapters/block-grouper.js';
import './workbench3d-inputxml-bend-samples.test.js';
import './workbench3d-consumed-bend-ancestry.test.js';

const xml = `<CAESARII XML_TYPE="Input"><PIPINGMODEL>
  <PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DELTA_X="1000.000000" DIAMETER="114.3" NAME="E1">
    <RESTRAINT NUM="1" NODE="30.000000" TYPE="2.000000" YCOSINE="1.000000"/>
  </PIPINGELEMENT>
  <PIPINGELEMENT FROM_NODE="20.000000" TO_NODE="30.000000" DELTA_Z="800.000000" DIAMETER="114.3" NAME="E2">
    <RIGID WEIGHT="55.000000" TYPE="Valve"/>
  </PIPINGELEMENT>
</PIPINGMODEL></CAESARII>`;

const graph = buildCanonicalGraph('source', parseInputXmlRecords(xml).records, {});
const nodeCoord = new Map(graph.nodes.map((n) => [n.nodeId, n.coordMm]));
const host = graph.objects.find((o) => o.packets.some((p) => p.kind === 'RESTRAINT'));
const restraint = host.packets.find((p) => p.kind === 'RESTRAINT');

const fromPos = resolvePacketPosition(restraint, host, nodeCoord, 'from');
assert.deepStrictEqual(fromPos.position, nodeCoord.get(host.fromNode));
assert.strictEqual(fromPos.fallback, false);
const toPos = resolvePacketPosition(restraint, host, nodeCoord, 'to');
assert.deepStrictEqual(toPos.position, nodeCoord.get(host.toNode));
const midPos = resolvePacketPosition(restraint, host, nodeCoord, 'mid');
const expectedMid = nodeCoord.get(host.fromNode).map((v, i) => (v + nodeCoord.get(host.toNode)[i]) / 2);
assert.deepStrictEqual(midPos.position, expectedMid);

const textPos = resolvePacketPosition(restraint, host, nodeCoord, 'text');
assert.strictEqual(textPos.resolvedNodeId, '30');
assert.deepStrictEqual(textPos.position, nodeCoord.get('30'), 'global lookup places at node 30');
assert.strictEqual(textPos.fallback, false);

const ghostPacket = { kind: 'RESTRAINT', attrs: { NODE: '9999.000000' } };
const ghostPos = resolvePacketPosition(ghostPacket, host, nodeCoord, 'text');
assert.strictEqual(ghostPos.fallback, true);
assert.deepStrictEqual(ghostPos.position, expectedMid);

const visualText = buildVisualModel(graph, { markerPlacement: 'text' });
const restraintMarker = visualText.markers.find((m) => m.kind === 'RESTRAINT');
assert.deepStrictEqual(restraintMarker.position, nodeCoord.get('30'), 'marker at text-resolved node');

const filtered = buildVisualModel(graph, { packetMarkerKinds: ['RIGID'] });
assert.ok(!filtered.markers.some((m) => m.kind === 'RESTRAINT'), 'RESTRAINT filtered out');
assert.ok(filtered.markers.some((m) => m.kind === 'RIGID'), 'RIGID kept');

const withNodes = buildVisualModel(graph, { showAllNodes: true, nodeMarkerSizeMm: 12 });
const nodeMarkers = withNodes.markers.filter((m) => m.kind === 'NODE');
assert.ok(nodeMarkers.length > 0, 'node markers emitted');
assert.ok(nodeMarkers.every((m) => m.nodeId), 'node markers carry nodeId');

const pointGraph = {
  modelId: 'target',
  objects: [{ objectId: 'target:N1', kind: 'NODE', fromNode: 'PS-01', toNode: 'PS-01', lengthMm: 0, diameterMm: null, packets: [], properties: {} }],
  nodes: [{ nodeId: 'PS-01', coordMm: [5000, 6000, 7000], degree: 0, anchorType: 'NODE', componentId: 'C1' }],
  anchors: [],
};
const pointVisual = buildVisualModel(pointGraph, {});
assert.strictEqual(pointVisual.segments.length, 0);
const objMarker = pointVisual.markers.find((m) => m.objectId === 'target:N1');
assert.ok(objMarker?.isObjectMarker, 'zero-length object rendered as object marker');
assert.deepStrictEqual(pointVisual.bounds.max, [5000, 6000, 7000], 'bounds include markers');

const known = new Set(graph.nodes.map((n) => n.nodeId));
assert.deepStrictEqual(resolvePacketNode(restraint, host, known), { nodeId: '30', resolvedBy: 'NODE' });
const rigidHost = graph.objects.find((o) => o.packets.some((p) => p.kind === 'RIGID'));
assert.deepStrictEqual(resolvePacketNode(rigidHost.packets[0], rigidHost, known), { nodeId: rigidHost.fromNode, resolvedBy: 'FROM' });

const index = buildNodeInfoIndex(graph);
assert.strictEqual(index.get('20').degree, 2);
assert.strictEqual(index.get('20').connectedObjectIds.length, 2, 'node 20 touches both elements');
assert.ok(index.get('30').packets.some((p) => p.kind === 'RESTRAINT' && p.resolvedBy === 'NODE'), 'restraint resolved to node 30');

const rawGroups = groupObjectBlocks(graph.objects[0]);
const names = rawGroups.map((g) => g.blockName);
assert.ok(names.includes('Name') && names.includes('Geometry') && names.includes('Section'), `pseudo-blocks present (${names})`);
assert.ok(names.includes('Restraint'), 'packet block present');

const categorizedObject = {
  name: '1210->1220', lineId: 'L1', canonicalFromTo: '1210->1220', lengthMm: 100, pathId: 'p', stationMm: 0,
  properties: {}, packets: [],
  blocks: [
    { name: 'NameBlock', entries: [['NAME', '1210->1220']], instances: [] },
    { name: 'RestraintsBlock', entries: [], instances: [
      { name: 'RESTRAINT', attrs: { NUM: '1', NODE: '1220.000000', TYPE: '10.000000', STIFFNESS: '-1.010100' } },
      { name: 'RESTRAINT', attrs: { NUM: '2', NODE: '1220.000000', TYPE: '2.000000' } },
    ] },
  ],
};
const catGroups = groupObjectBlocks(categorizedObject);
const nameBlock = catGroups.find((g) => g.blockName === 'Name');
assert.deepStrictEqual(nameBlock.instances[0].entries, [['NAME', '1210->1220']]);
const restraintBlock = catGroups.find((g) => g.blockName === 'Restraint');
assert.strictEqual(restraintBlock.instances.length, 2, 'two restraint instances');
assert.strictEqual(restraintBlock.instances[0].label, '[1]');
assert.ok(!restraintBlock.instances[0].entries.some(([k]) => k === 'STIFFNESS'), 'sentinel attr hidden');

function orientation(fromNode, toNode, rawIndex) {
  return {
    contract: SOURCE_ELEMENT_ORIENTATION_CONTRACT,
    fromNode,
    toNode,
    resolvedFromNode: fromNode,
    resolvedToNode: toNode,
    deltaMm: [0, 0, 0],
    rawIndex,
    canonicalDirection: 'SOURCE_REVERSED',
  };
}

function bendGraph({ radius = '200', branch = false, orientationMode = 'valid' } = {}) {
  const bendOrientation = orientationMode === 'missing' ? undefined
    : orientationMode === 'conflict' ? orientation('10', '30', 0)
      : orientation('10', '20', 0);
  const objects = [
    { objectId: 'source:B1', kind: 'BEND', fromNode: '20', toNode: '10', sourceOrientation: bendOrientation, lengthMm: 1000, diameterMm: 100, rawIndex: 0, lineId: '', pathId: 'source:P1', packets: [{ kind: 'BEND', attrs: { RADIUS: radius, ANGLE1: '-2.020200' } }] },
    { objectId: 'source:P2', kind: 'PIPE', fromNode: '30', toNode: '20', sourceOrientation: orientation('20', '30', 1), lengthMm: 1000, diameterMm: null, rawIndex: 1, lineId: '', pathId: 'source:P1', packets: [] },
  ];
  if (branch) objects.push({ objectId: 'source:P3', kind: 'PIPE', fromNode: '20', toNode: '40', sourceOrientation: orientation('20', '40', 2), lengthMm: 600, diameterMm: null, rawIndex: 2, lineId: '', pathId: 'source:P2', packets: [] });
  return {
    modelId: 'source', objects, anchors: [],
    nodes: [
      { nodeId: '10', coordMm: [0, 0, 0] }, { nodeId: '20', coordMm: [1000, 0, 0] },
      { nodeId: '30', coordMm: [1000, 1000, 0] }, { nodeId: '40', coordMm: [1000, 0, 600] },
    ],
  };
}

const bendModel = bendGraph();
const inherited = effectiveDiameterByObject(bendModel.objects);
assert.deepStrictEqual(inherited.get('source:P2'), { diameterMm: 100, source: 'INHERITED' });
const bendPlan = resolveInputXmlBends(bendModel);
assert.deepStrictEqual(bendPlan.summary, { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 });
assert.deepStrictEqual(bendPlan.arcs[0].points[0], [800, 0, 0]);
assert.deepStrictEqual(bendPlan.arcs[0].points.at(-1), [1000, 200, 0]);
assert.strictEqual(bendPlan.arcs[0].angleDeg, 90, 'ANGLE1 control value is ignored; angle derives from topology');
assert.strictEqual(bendPlan.arcs[0].directionEvidence, 'SOURCE_ORIENTATION_V1');

const reordered = bendGraph();
reordered.objects.reverse();
reordered.objects[0].rawIndex = 800;
reordered.objects[1].rawIndex = -99;
assert.deepStrictEqual(resolveInputXmlBends(reordered).arcs, bendPlan.arcs, 'object order and rawIndex do not control bend direction');

const bendVisual = buildVisualModel(bendModel);
assert.strictEqual(bendVisual.segments.length, 14, 'trimmed legs plus deterministic arc chords');
assert.strictEqual(bendVisual.geometryDiagnostics.length, 0);
assert.strictEqual(bendVisual.segments.find((segment) => segment.objectId === 'source:P2').radiusMm, 50);

const missingRadius = resolveInputXmlBends(bendGraph({ radius: '-1.010100' }));
assert.strictEqual(missingRadius.diagnostics[0].code, 'BEND_RADIUS_MISSING');
const ambiguousBend = resolveInputXmlBends(bendGraph({ branch: true }));
assert.strictEqual(ambiguousBend.diagnostics[0].code, 'BEND_ADJACENCY_AMBIGUOUS');
const missingOrientation = resolveInputXmlBends(bendGraph({ orientationMode: 'missing' }));
assert.strictEqual(missingOrientation.diagnostics[0].code, 'BEND_SOURCE_ORIENTATION_MISSING');
const conflictingOrientation = resolveInputXmlBends(bendGraph({ orientationMode: 'conflict' }));
assert.strictEqual(conflictingOrientation.diagnostics[0].code, 'BEND_SOURCE_ORIENTATION_CONFLICT');

const reversedXml = `<CAESARII XML_TYPE="Input"><PIPINGMODEL>
  <PIPINGELEMENT FROM_NODE="20" TO_NODE="30" DELTA_Y="1000" DIAMETER="100"/>
  <PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="1000" DIAMETER="100"><BEND RADIUS="200"/></PIPINGELEMENT>
</PIPINGMODEL></CAESARII>`;
const reversedGraph = buildCanonicalGraph('source', parseInputXmlRecords(reversedXml).records, {});
const reversedBend = reversedGraph.objects.find((object) => object.kind === 'BEND');
assert.strictEqual(reversedBend.canonicalFromTo, '20->10');
assert.deepStrictEqual(reversedBend.sourceOrientation, {
  contract: SOURCE_ELEMENT_ORIENTATION_CONTRACT,
  fromNode: '10',
  toNode: '20',
  resolvedFromNode: '10',
  resolvedToNode: '20',
  deltaMm: [1000, 0, 0],
  rawIndex: 1,
  canonicalDirection: 'SOURCE_REVERSED',
});
assert.strictEqual(resolveInputXmlBends(reversedGraph).summary.resolved, 1);

console.log('workbench3d-visual-markers.test.js passed');
