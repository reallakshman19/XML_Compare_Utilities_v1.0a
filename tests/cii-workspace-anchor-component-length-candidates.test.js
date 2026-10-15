import assert from 'node:assert/strict';
import { suggestCiiBaseAnchorPairs } from '../tabs/cii-workspace/cii-workspace-anchor-suggestions.js';
import { suggestCiiPhysicalMethodAAnchors, uniqueIncidentComponentLengthPairs } from '../tabs/cii-workspace/cii-workspace-anchor-physical-candidates.js';

function edge(id, from, to, lengthMm) {
  return { id, from: String(from), to: String(to), componentKind: 'PIPE', lengthMm, diameter: 100 };
}
function graph(offset = { x: 0, y: 0, z: 0 }, duplicateLength = false) {
  const coordinates = new Map([
    ['1', { x: 0, y: 0, z: 0 }],
    ['2', { x: 100, y: 0, z: 0 }],
    ['3', { x: 0, y: 200, z: 0 }],
    ['4', { x: 0, y: 0, z: 300 }],
  ]);
  const edges = [
    edge('e12', '1', '2', 100),
    edge('e13', '1', '3', duplicateLength ? 100 : 200),
    edge('e14', '1', '4', 300),
  ];
  const adjacency = new Map([['1', []], ['2', []], ['3', []], ['4', []]]);
  for (const item of edges) {
    adjacency.get(item.from).push(item);
    adjacency.get(item.to).push(item);
  }
  const nodes = [...coordinates].map(([id, position]) => ({
    id,
    degree: adjacency.get(id).length,
    neighbourhoodLayers: [],
    position: {
      x: position.x + offset.x,
      y: position.y + offset.y,
      z: position.z + offset.z,
    },
  }));
  return { nodes, edges, adjacency };
}

const source = graph();
const target = graph({ x: 1000, y: -500, z: 250 });
const physical = uniqueIncidentComponentLengthPairs(source, target);
assert.equal(physical.length, 4, 'each unique incident component/length fingerprint should produce one candidate-generation pair');
assert(physical.every((row) => row.physicalFingerprint?.authority === 'CANDIDATE_GENERATION_ONLY'));
assert(physical.every((row) => row.winnerGap === 0), 'physical fingerprint uniqueness must not fabricate a Method-B winner gap');
assert.deepEqual(physical.map((row) => `${row.sourceNodeId}=>${row.targetNodeId}`).sort(), ['1=>1', '2=>2', '3=>3', '4=>4']);

const physicalSuggestions = suggestCiiPhysicalMethodAAnchors(source, target, { methodASeedPairLimit: 12 });
assert(physicalSuggestions.length >= 3, 'unique physical candidates should be admitted to the existing Method-A geometry solver');
assert(physicalSuggestions.every((row) => row.basisMethod === 'METHOD_A_SPATIAL'));
assert(physicalSuggestions.every((row) => row.methodA?.status === 'READY'));
assert(physicalSuggestions.every((row) => row.winnerGap === 0), 'Method-A candidate generation must not become independent Method-B authority');
assert(physicalSuggestions.every((row) => row.candidateGeneration.authorityRole === 'CANDIDATE_GENERATION_ONLY'));
const suggestions = suggestCiiBaseAnchorPairs(source, target, {
  baseAnchorSuggestionLimit: 12,
  baseAnchorCandidatePool: 12,
  methodASeedPairLimit: 12,
});
assert(suggestions.some((row) => row.methodA?.status === 'READY'), 'public suggestion wrapper must retain qualified Method-A evidence');

const duplicateSource = graph({ x: 0, y: 0, z: 0 }, true);
const duplicateTarget = graph({ x: 1000, y: -500, z: 250 }, true);
const duplicateRows = uniqueIncidentComponentLengthPairs(duplicateSource, duplicateTarget);
assert(!duplicateRows.some((row) => row.sourceNodeId === '2' || row.sourceNodeId === '3'),
  'a fingerprint repeated on either graph must not identify one of the repeated physical nodes');

console.log('CII unique incident component/length candidate-generation checks passed.');
