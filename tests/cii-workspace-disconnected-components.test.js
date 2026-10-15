import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { buildCiiPathCandidateAudit } from '../tabs/cii-workspace/cii-workspace-path-candidates.js';

function edge(index, from, to, length) {
  return { index, from, to, dx: length, dy: 0, dz: 0, length, od: 273, wall: 8, P1: 10, T1: 100, hasBend: false };
}
function graph(side, rows) {
  const nodes = {};
  for (const item of rows) {
    nodes[item.from] = { x: item.from * 10, y: 0, z: 0 };
    nodes[item.to] = { x: item.to * 10, y: 0, z: 0 };
    item.fromPos = nodes[item.from]; item.toPos = nodes[item.to];
  }
  return adaptCiiDocumentToTopologyGraph({
    schema: 'CIIWorkspaceDocument.v1', side, contentSha256: `${side}-sha`, nodeNames: {}, parsed: { elements: rows, nodes, rigids: [] },
  });
}

const source = graph('SOURCE', [edge(0, 100, 110, 400), edge(1, 900, 910, 900)]);
const target = graph('TARGET', [edge(0, 5000, 5010, 900), edge(1, 7000, 7010, 400)]);
const audit = buildCiiPathCandidateAudit(source, target);
assert.strictEqual(audit.summary.referencePathCount, 2);
assert.strictEqual(audit.summary.targetPathCount, 2);
assert.strictEqual(audit.summary.matchedPathCount, 2);
assert.strictEqual(audit.summary.ambiguousPathCount, 0);
assert.strictEqual(audit.pathMappings.length, 2);
assert(audit.pathMappings.every((row) => row.scoreGap >= 12));
const lengths = audit.pathMappings.map((row) => [row.referenceLengthMm, row.targetLengthMm]).sort((a, b) => a[0] - b[0]);
assert.deepStrictEqual(lengths, [[400, 400], [900, 900]]);
console.log('CII Workspace disconnected-component path matching checks passed.');
