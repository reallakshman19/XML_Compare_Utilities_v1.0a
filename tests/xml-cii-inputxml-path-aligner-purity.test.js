import assert from 'node:assert/strict';
import {
  alignElementPaths,
  buildElementPaths,
} from '../tabs/model-converters/xml-cii-inputxml-path-aligner.js';

function frozenEdge(elementId, from, to, dx, options = {}) {
  return Object.freeze({
    elementId,
    from: String(from),
    to: String(to),
    canonicalFrom: String(from),
    canonicalTo: String(to),
    normalizedFromTo: `${from}->${to}`,
    dx,
    dy: 0,
    dz: 0,
    lengthMm: Math.abs(dx),
    componentKind: 'PIPE',
    packetEvidence: Object.freeze([]),
    flags: Object.freeze([]),
    isAnchorElement: Boolean(options.isAnchorElement),
  });
}

function frozenGraph(prefix = 'E') {
  const edges = Object.freeze([
    frozenEdge(`${prefix}1`, '1', '2', 100),
    frozenEdge(`${prefix}2`, '2', '3', 200),
  ]);
  return Object.freeze({ edges });
}

const graph = frozenGraph('S');
const originalSnapshot = JSON.stringify(graph.edges);

const first = buildElementPaths(graph, { lengthToleranceMm: 6 });
const second = buildElementPaths(graph, { lengthToleranceMm: 6 });

assert.equal(JSON.stringify(graph.edges), originalSnapshot, 'caller-owned frozen graph must remain unchanged');
assert.equal(Object.hasOwn(graph.edges[0], 'pathId'), false);
assert.equal(Object.hasOwn(graph.edges[0], 'pathStationStartMm'), false);
assert.deepEqual(first.pathRows, second.pathRows, 'repeated path construction must be deterministic');
assert.equal(first.paths.length, 1);
assert.equal(first.paths[0].elements.length, 2);

const [firstEdge, secondEdge] = first.paths[0].elements;
assert.notStrictEqual(firstEdge, graph.edges[0], 'path must annotate a local edge copy');
assert.notStrictEqual(secondEdge, graph.edges[1], 'path must annotate a local edge copy');
assert.equal(firstEdge.pathId, 'P1');
assert.equal(firstEdge.pathIndex, 1);
assert.equal(firstEdge.pathStationStartMm, 0);
assert.equal(firstEdge.pathStationEndMm, 100);
assert.equal(firstEdge.pathStationMidMm, 50);
assert.equal(secondEdge.pathId, 'P1');
assert.equal(secondEdge.pathIndex, 2);
assert.equal(secondEdge.pathStationStartMm, 100);
assert.equal(secondEdge.pathStationEndMm, 300);
assert.equal(secondEdge.pathStationMidMm, 200);
assert.equal(firstEdge.pathTotalVectorLengthMm, 300);
assert.equal(secondEdge.pathTotalVectorLengthMm, 300);

// The higher-level alignment path must also accept independently frozen input graphs.
const target = frozenGraph('T');
const aligned = alignElementPaths(graph, target, {
  lengthToleranceMm: 6,
  minPathScore: 0,
  scoreElementMatch: () => 100,
});
assert.equal(aligned.summary.referencePathCount, 1);
assert.equal(aligned.summary.targetPathCount, 1);
assert.equal(aligned.summary.matchedPathCount, 1);
assert.equal(JSON.stringify(graph.edges), originalSnapshot, 'alignment must not mutate reference graph');

console.log('CII pure element-path construction over immutable topology checks: PASS');
