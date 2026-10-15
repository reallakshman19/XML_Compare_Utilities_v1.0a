import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  selectPhysicalCandidatePairs,
  uniqueIncidentComponentLengthPairs,
  _test as physicalTest,
} from '../tabs/cii-workspace/cii-workspace-anchor-physical-candidates.js';
import { _test as suggestionTest } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions.js';
import {
  setCiiMultiSourceMethodAPhysicalCandidateLimit,
  _test as sourceSetTest,
} from '../tabs/cii-workspace/cii-workspace-source-set.js';

function edge(id, from, to, lengthMm) {
  return { id, from: String(from), to: String(to), componentKind: 'PIPE', lengthMm, diameter: 100 };
}
function fanGraph(count = 12, offset = { x: 0, y: 0, z: 0 }) {
  const edges = []; const coordinates = new Map([['0', { x: 0, y: 0, z: 0 }]]);
  for (let index = 1; index <= count; index += 1) {
    edges.push(edge(`e${index}`, '0', String(index), 100 + index * 17));
    coordinates.set(String(index), { x: index * 80, y: (index % 4) * 130, z: (index % 5) * 170 });
  }
  const adjacency = new Map([...coordinates.keys()].map((id) => [id, []]));
  for (const item of edges) { adjacency.get(item.from).push(item); adjacency.get(item.to).push(item); }
  const nodes = [...coordinates].map(([id, position]) => ({
    id, degree: adjacency.get(id).length, neighbourhoodLayers: [],
    position: { x: position.x + offset.x, y: position.y + offset.y, z: position.z + offset.z },
  }));
  return { nodes, edges, adjacency };
}
function pointGraph(points, od = 100) {
  const entries = Object.entries(points); const adjacency = new Map();
  const nodes = entries.map(([id, position]) => ({ id: String(id), degree: 1, neighbourhoodLayers: [], position }));
  for (const [id] of entries) adjacency.set(String(id), [{
    from: String(id), to: `stub-${id}`, componentKind: 'PIPE', diameter: od, lengthMm: 100,
  }]);
  return { nodes, edges: [], adjacency };
}
function candidate(sourceNodeId, targetNodeId, extra = {}) {
  return {
    sourceNodeId: String(sourceNodeId), targetNodeId: String(targetNodeId),
    score: 100, winnerGap: 0, sourceRank: 1, targetRank: 1, mutualBest: true, ...extra,
  };
}
function positionMapForTest(graph) {
  return new Map((graph?.nodes || []).map((node) => [String(node.id), node.position]));
}
function neighbourGraph(size, edges) {
  const neighbours = Array.from({ length: size }, () => new Set());
  for (const [left, right] of edges) { neighbours[left].add(right); neighbours[right].add(left); }
  return neighbours;
}

assert.equal(physicalTest.boundedPhysicalLimit(undefined), 10, 'physical Method-A search must default to 10 pairs');
assert.equal(physicalTest.boundedPhysicalLimit(1), 3, 'physical Method-A search must retain the three-anchor minimum');
assert.equal(physicalTest.boundedPhysicalLimit(999), 24, 'physical Method-A search must retain a hard safety ceiling');
assert.equal(physicalTest.boundedDiscoveryLimit(undefined, 10), 10);
assert.equal(physicalTest.boundedDiscoveryLimit(64, 10), 10, 'seed/expansion limits must not exceed the selected physical pool');

const source = fanGraph(); const target = fanGraph(12, { x: 1200, y: -700, z: 350 });
const candidates = uniqueIncidentComponentLengthPairs(source, target);
assert.equal(candidates.length, 13, 'fixture must exceed the default 10-pair search budget');
const selected = selectPhysicalCandidatePairs(source, target, candidates, 10);
assert.equal(selected.length, 10);
assert.equal(`${selected[0].sourceNodeId}=>${selected[0].targetNodeId}`, '0=>0', 'highest-connectivity unique fingerprint should seed deterministic selection');
assert.equal(new Set(selected.map((row) => row.sourceNodeId)).size, 10);
assert.deepEqual(
  selected.map((row) => `${row.sourceNodeId}=>${row.targetNodeId}`),
  selectPhysicalCandidatePairs(source, target, candidates, 10).map((row) => `${row.sourceNodeId}=>${row.targetNodeId}`),
  'bounded candidate selection must be deterministic',
);

const exactSource = pointGraph({
  1: { x: 0, y: 0, z: 0 },
  2: { x: 1000, y: 0, z: 0 },
});
const exactTarget = pointGraph({
  101: { x: 500, y: -200, z: 30 },
  102: { x: 1500, y: -200, z: 30 },
});
assert.equal(
  physicalTest.pairDistanceCompatible(exactSource, positionMapForTest(exactSource), positionMapForTest(exactTarget),
    candidate(1, 101), candidate(2, 102)),
  true,
  'exact rigid pair distance must be compatible',
);

const longSpanSource = pointGraph({ 1: { x: 0, y: 0, z: 0 }, 2: { x: 100000, y: 0, z: 0 } }, 100);
const longSpanTarget = pointGraph({ 101: { x: 0, y: 0, z: 0 }, 102: { x: 100050, y: 0, z: 0 } }, 100);
assert.equal(
  physicalTest.pairDistanceCompatible(longSpanSource, positionMapForTest(longSpanSource), positionMapForTest(longSpanTarget),
    candidate(1, 101), candidate(2, 102)),
  false,
  'long-span relation that passes relative tolerance must still fail the 0.1-OD gate',
);

const shortSpanSource = pointGraph({ 1: { x: 0, y: 0, z: 0 }, 2: { x: 100, y: 0, z: 0 } }, 100);
const shortSpanTarget = pointGraph({ 101: { x: 0, y: 0, z: 0 }, 102: { x: 105, y: 0, z: 0 } }, 100);
assert.equal(
  physicalTest.pairDistanceCompatible(shortSpanSource, positionMapForTest(shortSpanSource), positionMapForTest(shortSpanTarget),
    candidate(1, 101), candidate(2, 102)),
  false,
  'short-span relation that passes the 0.1-OD gate must still fail the 0.1-percent relative gate',
);

const missingOdSource = pointGraph({ 1: { x: 0, y: 0, z: 0 }, 2: { x: 100, y: 0, z: 0 } }, 0);
assert.equal(
  physicalTest.pairDistanceCompatible(missingOdSource, positionMapForTest(missingOdSource), positionMapForTest(exactTarget),
    candidate(1, 101), candidate(2, 102)),
  false,
  'missing positive SOURCE OD must fail closed',
);

const missingCoordinateSource = pointGraph({ 1: null, 2: { x: 100, y: 0, z: 0 } }, 100);
assert.equal(
  physicalTest.pairDistanceCompatible(missingCoordinateSource, positionMapForTest(missingCoordinateSource), positionMapForTest(exactTarget),
    candidate(1, 101), candidate(2, 102)),
  false,
  'missing coordinates must fail closed',
);

assert.equal(
  physicalTest.pairDistanceCompatible(exactSource, positionMapForTest(exactSource), positionMapForTest(exactTarget),
    candidate(1, 101), candidate(1, 102)),
  false,
  'duplicate SOURCE claim must not count as independent pairwise coherence',
);
assert.equal(
  physicalTest.pairDistanceCompatible(exactSource, positionMapForTest(exactSource), positionMapForTest(exactTarget),
    candidate(1, 101), candidate(2, 101)),
  false,
  'duplicate TARGET claim must not count as independent pairwise coherence',
);

const noisyLeft = candidate(1, 101, { nodeName: 'LEAK', expectedTarget: 'EXPECTED', userLocked: true, confidence: 'HIGH' });
const noisyRight = candidate(2, 102, { nodeName: 'LEAK2', expectedTarget: 'EXPECTED2', userLocked: true, confidence: 'HIGH' });
assert.equal(
  physicalTest.pairDistanceCompatible(exactSource, positionMapForTest(exactSource), positionMapForTest(exactTarget), noisyLeft, noisyRight),
  true,
  'NodeName/manual/benchmark/confidence-shaped metadata must not affect pairwise physical compatibility',
);

const triangleSource = pointGraph({
  1: { x: 0, y: 0, z: 0 },
  2: { x: 100, y: 0, z: 0 },
  3: { x: 0, y: 100, z: 0 },
}, 100);
const triangleTarget = pointGraph({
  101: { x: 500, y: 200, z: 0 },
  102: { x: 600, y: 200, z: 0 },
  103: { x: 500, y: 300, z: 0 },
}, 100);
const triangleCandidates = [candidate(1, 101), candidate(2, 102), candidate(3, 103)];
assert.deepEqual(
  physicalTest.coherenceGraph(triangleSource, triangleTarget, triangleCandidates).map((items) => items.size),
  [2, 2, 2],
  'exact rigid triangle must form a complete compatibility graph',
);
assert.deepEqual(
  physicalTest.completeCoherentComponents(triangleSource, triangleTarget, triangleCandidates),
  [[0, 1, 2]],
  'minimum three-member complete component must be retained',
);
assert.deepEqual(
  physicalTest.completeCoherentComponents(triangleSource, triangleTarget, triangleCandidates.slice(0, 2)),
  [],
  'two-member component is below the Method-A coherent-pool minimum',
);

const bridgedCliques = neighbourGraph(6, [
  [0, 1], [0, 2], [1, 2],
  [3, 4], [3, 5], [4, 5],
  [2, 3],
]);
assert.deepEqual([...physicalTest.bridgeEdgeKeys(bridgedCliques)], ['2:3'],
  'single bridge joining two complete regions must be detected');
const prunedCliques = physicalTest.withoutBridgeEdges(bridgedCliques);
assert.deepEqual(
  physicalTest.connectedComponents([0, 1, 2, 3, 4, 5], prunedCliques),
  [[0, 1, 2], [3, 4, 5]],
  'bridge removal must keep the dense regions independent',
);
assert.equal(physicalTest.componentIsComplete([0, 1, 2], prunedCliques), true);
assert.equal(physicalTest.componentIsComplete([3, 4, 5], prunedCliques), true);

const sparseChain = neighbourGraph(4, [[0, 1], [1, 2], [2, 3]]);
assert.equal(physicalTest.componentIsComplete([0, 1, 2, 3], sparseChain), false,
  'sparse chain must not qualify as a complete coherent component');

const fourCycle = neighbourGraph(4, [[0, 1], [1, 2], [2, 3], [3, 0]]);
assert.equal(physicalTest.componentIsComplete([0, 1, 2, 3], fourCycle), false,
  'non-complete cycle must not qualify as a coherent component');

assert.deepEqual(
  physicalTest.connectedComponents([5, 4, 3, 2, 1, 0], prunedCliques).sort((left, right) => left[0] - right[0]),
  [[0, 1, 2], [3, 4, 5]],
  'component membership must not depend on input index ordering',
);

const regionSource = pointGraph({
  1: { x: 0, y: 0, z: 0 }, 2: { x: 100, y: 0, z: 0 },
  3: { x: 0, y: 100, z: 0 }, 4: { x: 100, y: 100, z: 0 },
  5: { x: 1000, y: 1000, z: 0 },
}, 100);
const regionTarget = pointGraph({
  101: { x: 500, y: 200, z: 0 }, 102: { x: 600, y: 200, z: 0 },
  103: { x: 500, y: 300, z: 0 }, 104: { x: 600, y: 300, z: 0 },
  105: { x: 5000, y: 5000, z: 0 },
}, 100);
const regionPairs = [1, 2, 3, 4, 5].map((id) => candidate(id, id + 100, { tag: `R${id}` }));
const regionEvents = [];
const regionSelected = selectPhysicalCandidatePairs(regionSource, regionTarget, regionPairs, 5, {
  instrumentation: { record: (name, value) => regionEvents.push([name, value]) },
});
assert.deepEqual(regionSelected.map((row) => row.tag).sort(), ['R1', 'R2', 'R3', 'R4'],
  'unique coherent region must not be refilled from an outside candidate even when budget has spare capacity');
assert.deepEqual(regionEvents, [
  ['ANCHOR_PHYSICAL_COHERENT_COMPONENT_COUNT', 1],
  ['ANCHOR_PHYSICAL_PRESELECTION_AMBIGUOUS', 0],
  ['ANCHOR_PHYSICAL_COHERENT_CLUSTER_SIZE', 4],
]);

const sixSource = pointGraph({
  1: { x: 0, y: 0, z: 0 }, 2: { x: 100, y: 0, z: 0 }, 3: { x: 0, y: 100, z: 0 },
  4: { x: 100, y: 100, z: 0 }, 5: { x: 50, y: 50, z: 80 }, 6: { x: 150, y: 50, z: 25 },
}, 100);
const sixTarget = pointGraph({
  101: { x: 700, y: -300, z: 20 }, 102: { x: 800, y: -300, z: 20 }, 103: { x: 700, y: -200, z: 20 },
  104: { x: 800, y: -200, z: 20 }, 105: { x: 750, y: -250, z: 100 }, 106: { x: 850, y: -250, z: 45 },
}, 100);
const sixPairs = [1, 2, 3, 4, 5, 6].map((id) => candidate(id, id + 100, { tag: `C${id}` }));
const sixSelected = selectPhysicalCandidatePairs(sixSource, sixTarget, sixPairs, 4);
assert.equal(sixSelected.length, 4, 'winning coherent component must still obey the configured hard budget');
assert.equal(sixSelected.every((row) => row.tag.startsWith('C')), true);

const tiedSource = pointGraph({
  1: { x: 0, y: 0, z: 0 }, 2: { x: 100, y: 0, z: 0 }, 3: { x: 0, y: 100, z: 0 },
  4: { x: 10000, y: 0, z: 0 }, 5: { x: 10100, y: 0, z: 0 }, 6: { x: 10000, y: 100, z: 0 },
}, 100);
const tiedTarget = pointGraph({
  101: { x: 500, y: 500, z: 0 }, 102: { x: 600, y: 500, z: 0 }, 103: { x: 500, y: 600, z: 0 },
  104: { x: 50000, y: 0, z: 0 }, 105: { x: 50100, y: 0, z: 0 }, 106: { x: 50000, y: 100, z: 0 },
}, 100);
const tiedPairs = [1, 2, 3, 4, 5, 6].map((id) => candidate(id, id + 100, { tag: `T${id}` }));
const tiedEvents = [];
assert.deepEqual(
  selectPhysicalCandidatePairs(tiedSource, tiedTarget, tiedPairs, 10, {
    instrumentation: { record: (name, value) => tiedEvents.push([name, value]) },
  }),
  [],
  'equal strongest complete regions must fail closed instead of using a stable ID as semantic authority',
);
assert(tiedEvents.some(([name, value]) => name === 'ANCHOR_PHYSICAL_PRESELECTION_AMBIGUOUS' && value === 1));

const noneSource = pointGraph(Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
  String(index + 1), { x: index * 100, y: (index % 2) * 60, z: 0 },
])), 100);
const noneTarget = pointGraph(Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
  String(index + 101), { x: index * 250, y: (index % 2) * 170, z: 0 },
])), 100);
const nonePairs = [1, 2, 3, 4, 5, 6].map((id) => candidate(id, id + 100, { tag: `N${id}` }));
assert.deepEqual(
  selectPhysicalCandidatePairs(noneSource, noneTarget, nonePairs, 4).map((row) => row.tag),
  physicalTest.selectByGlobalSpread(noneSource, noneTarget, nonePairs, 4).map((row) => row.tag),
  'NONE coherent state must preserve exact #1234 bounded global-spread fallback',
);

assert.equal(suggestionTest.displayLimit({ baseAnchorSuggestionLimit: 12, baseAnchorDisplayLimit: 5 }), 5,
  'display limit must be independent from the discovery suggestion limit');
assert.equal(suggestionTest.displayLimit({ baseAnchorSuggestionLimit: 12 }), 12,
  'legacy callers without a display limit must retain their existing suggestion limit');

setCiiMultiSourceMethodAPhysicalCandidateLimit(14);
assert.equal(sourceSetTest.sourceSetInspectionOptions({}).methodAPhysicalCandidateLimit, 14, 'UI preference must feed the next multi-source Inspect');
assert.equal(sourceSetTest.sourceSetInspectionOptions({}).baseAnchorDisplayLimit, 5, 'multi-source Inspect must list top five suggestions by default');
assert.equal(sourceSetTest.sourceSetInspectionOptions({ methodAPhysicalCandidateLimit: 7 }).methodAPhysicalCandidateLimit, 7, 'explicit API options must override the UI preference');
setCiiMultiSourceMethodAPhysicalCandidateLimit(10);

const ui = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only-filter-shell.js', import.meta.url), 'utf8');
assert(ui.includes('data-ciiw-method-a-search-limit'), 'multi-source UI must expose the Method-A physical search budget');
assert(ui.includes('min="3" max="24"'), 'UI search budget must show the same bounded range as the backend');
assert(ui.includes('10 recommended'), 'UI must communicate the approved default search budget');

console.log('CII bounded Method-A physical search budget checks passed.');
