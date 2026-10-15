import assert from 'assert';
import { discoverCiiMethodABases, projectCiiMethodAEvidence } from '../tabs/cii-workspace/cii-workspace-anchor-method-a.js';
import { suggestCiiBaseAnchorPairs } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions.js';

function point(x, y, z = 0) { return { x, y, z }; }
function add(a, b) { return point(a.x + b.x, a.y + b.y, a.z + b.z); }
function edge(id, nodeId, helperId, vector, od = 100) {
  return { elementId: id, from: String(nodeId), to: String(helperId), dx: vector.x, dy: vector.y, dz: vector.z,
    lengthMm: Math.hypot(vector.x, vector.y, vector.z), diameter: od, componentKind: 'PIPE' };
}
function graph(nodeSpecs) {
  const nodes = []; const edges = []; const adjacency = new Map();
  const addEdge = (nodeId, item) => {
    if (!adjacency.has(String(nodeId))) adjacency.set(String(nodeId), []);
    adjacency.get(String(nodeId)).push(item);
  };
  for (const spec of nodeSpecs) {
    nodes.push({ id: String(spec.id), degree: spec.vectors.length, position: spec.position, nodeName: spec.name || null,
      neighbourhoodLayers: spec.layers || [] });
    spec.vectors.forEach((vector, index) => {
      const helper = `${spec.id}H${index + 1}`; const item = edge(`E${spec.id}_${index + 1}`, spec.id, helper, vector, spec.od || 100);
      edges.push(item); addEdge(spec.id, item); addEdge(helper, item);
    });
  }
  return { nodes, edges, adjacency };
}
function pairRows(ids, targetPrefix, score = 100, winnerGap = 25) {
  return ids.map((id) => ({ sourceNodeId: String(id), targetNodeId: `${targetPrefix}${id}`, score, winnerGap }));
}
function baseContainsExactly(base, sourceIds) {
  const actual = base.anchorPairs.map((pair) => pair.sourceNodeId).sort();
  const expected = sourceIds.map(String).sort();
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

// Automatic Method A discovery: four rigidly related pairs form a validated local base.
{
  const source = graph([
    { id: 1, position: point(0, 0, 0), vectors: [point(500, 0, 0)] },
    { id: 2, position: point(1000, 0, 0), vectors: [point(500, 0, 0)] },
    { id: 3, position: point(0, 1000, 0), vectors: [point(500, 0, 0)] },
    { id: 4, position: point(0, 0, 1000), vectors: [point(500, 0, 0)] },
  ]);
  const shift = point(5000, 3000, 200);
  const target = graph(source.nodes.map((node) => ({ id: `1${node.id}`, position: add(node.position, shift), vectors: [point(500, 0, 0)] })));
  const discovery = discoverCiiMethodABases(source, target, pairRows([1, 2, 3, 4], '1'));
  assert.strictEqual(discovery.status, 'READY');
  const validated = discovery.bases.find((base) => baseContainsExactly(base, [1, 2, 3, 4]));
  assert(validated, 'four compatible pairs must expand into one validated Method A base');
  assert.strictEqual(validated.validationAnchorCount, 1);
  assert.strictEqual(validated.confidence, 'HIGH');
  assert(Math.abs(validated.translation[0] - 5000) < 1e-9);
  assert(Math.abs(validated.translation[1] - 3000) < 1e-9);
  assert(Math.abs(validated.translation[2] - 200) < 1e-9);
  const evidence = projectCiiMethodAEvidence(discovery, '2', '12');
  assert.strictEqual(evidence.status, 'READY');
  assert.strictEqual(evidence.confidence, 'HIGH');
}

// Seed selection remains bounded while a qualified transform may expand across a larger compatible candidate pool.
{
  const positions = [
    point(0, 0, 0), point(1000, 0, 0), point(0, 1000, 0), point(0, 0, 1000),
    point(1000, 1000, 0), point(1000, 0, 1000), point(0, 1000, 1000), point(1000, 1000, 1000),
  ];
  const source = graph(positions.map((position, index) => ({
    id: index + 1, position, vectors: [point(100, 0, 0)],
  })));
  const shift = point(2500, -750, 125);
  const target = graph(positions.map((position, index) => ({
    id: `1${index + 1}`, position: add(position, shift), vectors: [point(100, 0, 0)],
  })));
  const discovery = discoverCiiMethodABases(source, target, pairRows([1, 2, 3, 4, 5, 6, 7, 8], '1'), {
    methodASeedPairLimit: 4,
    methodAExpansionPairLimit: 8,
  });
  const expanded = discovery.bases.find((base) => base.anchorCount === 8);
  assert(expanded, 'Method A must expand a seed-qualified rigid transform across compatible candidates without hard-coded route anchors');
  assert.strictEqual(discovery.eligiblePairCount, 4);
  assert.strictEqual(discovery.expansionPairCount, 8);
}

// Three points still define the rigid transform mathematically, but automatic discovery caps confidence at REVIEW until another pair validates it.
{
  const source = graph([
    { id: 1, position: point(0, 0), vectors: [point(100, 0)] },
    { id: 2, position: point(1000, 0), vectors: [point(100, 0)] },
    { id: 3, position: point(0, 1000), vectors: [point(100, 0)] },
  ]);
  const target = graph([
    { id: 11, position: point(5000, 0), vectors: [point(100, 0)] },
    { id: 12, position: point(6000, 0), vectors: [point(100, 0)] },
    { id: 13, position: point(5000, 1000), vectors: [point(100, 0)] },
  ]);
  const discovery = discoverCiiMethodABases(source, target, pairRows([1, 2, 3], '1'));
  assert.strictEqual(discovery.status, 'READY');
  assert.strictEqual(discovery.bases[0].anchorCount, 3);
  assert.strictEqual(discovery.bases[0].automaticConfidenceCap, 'REVIEW');
  assert.strictEqual(discovery.bases[0].confidence, 'REVIEW');
}

// Two stable local regions are allowed to retain different Method A translations. No HIGH base may mix the regions.
{
  const sourceSpecs = [
    { id: 1, position: point(0, 0, 0) }, { id: 2, position: point(1000, 0, 0) },
    { id: 3, position: point(0, 1000, 0) }, { id: 4, position: point(0, 0, 1000) },
    { id: 5, position: point(20000, 0, 0) }, { id: 6, position: point(21000, 0, 0) },
    { id: 7, position: point(20000, 1000, 0) }, { id: 8, position: point(20000, 0, 1000) },
  ].map((spec) => ({ ...spec, vectors: [point(100, 0, 0)] }));
  const source = graph(sourceSpecs);
  const t1 = point(0, 100, 0); const t2 = point(0, -1200, 0);
  const target = graph(sourceSpecs.map((spec) => ({ id: `1${spec.id}`, position: add(spec.position, Number(spec.id) <= 4 ? t1 : t2), vectors: [point(100, 0, 0)] })));
  const discovery = discoverCiiMethodABases(source, target, pairRows([1, 2, 3, 4, 5, 6, 7, 8], '1'));
  const high = discovery.bases.filter((base) => base.confidence === 'HIGH');
  assert(high.some((base) => baseContainsExactly(base, [1, 2, 3, 4])), 'first local transform must remain independently qualified');
  assert(high.some((base) => baseContainsExactly(base, [5, 6, 7, 8])), 'second local transform must remain independently qualified');
  assert(!high.some((base) => base.anchorPairs.some((pair) => Number(pair.sourceNodeId) <= 4)
    && base.anchorPairs.some((pair) => Number(pair.sourceNodeId) >= 5)), 'HIGH Method A discovery must not invent one global mixed base');
}

// Public suggestion contract: A-only, A+B, B-only and LANDMARK_ONLY are evidence-derived, not hard-coded.
{
  const sourceShift = point(0, 0, 0); const targetShift = point(5000, 3000, 200);
  const sourceSpecs = [
    { id: 1, position: add(point(0, 0, 0), sourceShift), name: 'A1', layers: [['L1'], ['L1a'], ['L1b']], vectors: [point(400, 0, 0)] },
    { id: 2, position: add(point(1000, 0, 0), sourceShift), name: 'A2', layers: [['L2'], ['L2a'], ['L2b']], vectors: [point(400, 0, 0), point(0, 600, 0)] },
    { id: 3, position: add(point(0, 1000, 0), sourceShift), name: 'A3', layers: [['L3'], ['L3a'], ['L3b']], vectors: [point(400, 0, 0), point(0, 600, 0), point(0, 0, 700)] },
    { id: 4, position: add(point(0, 0, 1000), sourceShift), name: 'A4', layers: [['L4'], ['L4a'], ['L4b']], vectors: [point(400, 0, 0), point(0, 600, 0), point(0, 0, 700), point(-300, 0, 0)] },
    { id: 5, position: point(10000, 0, 0), name: 'BONLY', layers: [['L5'], ['L5a'], ['L5b']], vectors: [point(500, 0, 0), point(0, 800, 0)] },
    { id: 6, position: point(20000, 0, 0), name: 'LANDMARK', layers: [['L6'], ['L6a'], ['L6b']], vectors: [point(500, 0, 0), point(-500, 0, 0)] },
  ];
  const targetSpecs = sourceSpecs.map((spec) => {
    const id = `1${spec.id}`;
    const position = Number(spec.id) <= 4 ? add(spec.position, targetShift)
      : (spec.id === 5 ? point(30000, 9000, 4000) : point(-12000, 25000, -8000));
    return { ...spec, id, position };
  });
  const source = graph(sourceSpecs); const target = graph(targetSpecs);
  const suggestions = suggestCiiBaseAnchorPairs(source, target, { baseAnchorSuggestionLimit: 10, baseAnchorCandidatePool: 12 });
  const bySource = new Map(suggestions.map((row) => [row.sourceNodeId, row]));
  assert.strictEqual(bySource.get('1')?.basisMethod, 'METHOD_A_SPATIAL');
  assert.strictEqual(bySource.get('2')?.basisMethod, 'METHOD_A_AND_B');
  assert.strictEqual(bySource.get('5')?.basisMethod, 'METHOD_B_NETWORK');
  assert.strictEqual(bySource.get('6')?.basisMethod, 'LANDMARK_ONLY');
  assert.strictEqual(bySource.get('1')?.methodA?.confidence, 'HIGH');
  assert.strictEqual(bySource.get('2')?.methodB?.status, 'READY');
  assert.strictEqual(bySource.get('6')?.methodB?.source?.independentAxisRunCount, 1);
  assert(suggestions.every((row) => row.candidateGeneration?.authorityRole === 'CANDIDATE_GENERATION_ONLY'));
  assert(suggestions.every((row) => row.identityExclusions.includes('NODE_NUMBER_OFFSET_NOT_USED')));
}

// Method A must be able to rescue a structural runner-up without granting Method B authority to that non-mutual candidate.
{
  const shift = point(7000, -2500, 300);
  const sourceSpecs = [
    { id: 1, position: point(0, 0, 0), name: 'S1', layers: [['A'], ['B'], ['C']], vectors: [point(300, 0, 0)] },
    { id: 2, position: point(1000, 0, 0), name: 'S2', layers: [['D'], ['E'], ['F']], vectors: [point(300, 0, 0), point(0, 400, 0)] },
    { id: 3, position: point(0, 1000, 0), name: 'S3', layers: [['G'], ['H'], ['I']], vectors: [point(300, 0, 0), point(0, 400, 0), point(0, 0, 500)] },
    { id: 4, position: point(0, 0, 1000), name: 'S4', layers: [['J'], ['K'], ['L']], vectors: [point(300, 0, 0), point(0, 400, 0), point(0, 0, 500), point(-250, 0, 0)] },
  ];
  const trueTargets = sourceSpecs.map((spec) => ({ ...spec, id: `1${spec.id}`, position: add(spec.position, shift),
    layers: spec.id === 1 ? [['X'], ['Y'], ['Z']] : spec.layers }));
  const decoy = { id: 19, position: point(-20000, 50000, 9000), name: 'DECOY', layers: [['A'], ['B'], ['C']], vectors: [point(300, 0, 0)] };
  const source = graph(sourceSpecs); const target = graph([...trueTargets, decoy]);
  const suggestions = suggestCiiBaseAnchorPairs(source, target, {
    baseAnchorSuggestionLimit: 10, baseAnchorCandidatePool: 10, methodACandidatesPerSource: 3, methodAReverseCandidateRankLimit: 3,
  });
  const truePair = suggestions.find((row) => row.sourceNodeId === '1' && row.targetNodeId === '11');
  const decoyPair = suggestions.find((row) => row.sourceNodeId === '1' && row.targetNodeId === '19');
  assert(truePair, 'spatially validated SOURCE 1 -> TARGET 11 runner-up must be surfaced');
  assert(decoyPair, 'structural mutual-best decoy remains visible for engineering review');
  assert.strictEqual(truePair.candidateGeneration.mutualBest, false);
  assert.strictEqual(truePair.candidateGeneration.sourceRank, 2);
  assert.strictEqual(truePair.basisMethod, 'METHOD_A_SPATIAL');
  assert.strictEqual(truePair.methodA.status, 'READY');
  assert.strictEqual(truePair.methodA.confidence, 'HIGH');
  assert.strictEqual(truePair.confidence, 'HIGH');
  assert.notStrictEqual(truePair.basisMethod, 'METHOD_A_AND_B', 'non-mutual structural runner-up must not inherit Method B authority');
  assert.strictEqual(decoyPair.candidateGeneration.mutualBest, true);
  assert.strictEqual(decoyPair.methodA.status, 'UNAVAILABLE');
}

console.log('CII Base Anchor Method A/B discovery and fusion checks passed.');
