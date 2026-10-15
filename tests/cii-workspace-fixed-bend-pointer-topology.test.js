import assert from 'node:assert/strict';
import { CII_WORKSPACE_SCHEMAS } from '../tabs/cii-workspace/cii-workspace-contracts.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';

function element(index, from, to, hasBend) {
  return { index, from, to, dx: 100, dy: 0, dz: 0, length: 100, od: 100, wall: 5, hasBend };
}
function document(elements, auxiliaryElements = {}) {
  return {
    schema: CII_WORKSPACE_SCHEMAS.document, side: 'SOURCE', contentSha256: 'synthetic',
    parsed: { elements, nodes: {} }, nodeNames: {}, auxiliaryEvidence: { elements: auxiliaryElements },
    capabilities: { families: {} },
  };
}

{
  const graph = adaptCiiDocumentToTopologyGraph(document(
    [element(0, 10, 20, false), element(1, 30, 40, true), element(2, 50, 60, true)],
    {
      0: { pointers: { bend: 2 }, rigidRecord: null },
      1: { pointers: { bend: 0 }, rigidRecord: null },
      // Element 2 intentionally lacks fixed pointer custody to exercise legacy fallback.
    },
  ));
  const byEnds = new Map(graph.edges.map((edge) => [`${edge.from}->${edge.to}`, edge]));
  assert.equal(byEnds.get('10->20').componentKind, 'BEND', 'positive fixed ELEMENT bend pointer must classify BEND even when legacy flag is false');
  assert.equal(byEnds.get('10->20').bendEvidence.authority, 'ELEMENT_FIXED_BEND_POINTER');
  assert.equal(byEnds.get('30->40').componentKind, 'PIPE', 'fixed zero bend pointer must suppress false legacy bend attachment');
  assert.equal(byEnds.get('30->40').bendEvidence.legacyFlagIgnored, true);
  assert.equal(byEnds.get('50->60').componentKind, 'BEND', 'legacy flag remains a fallback only when fixed pointer custody is unavailable');
  assert.equal(byEnds.get('50->60').bendEvidence.authority, 'LEGACY_PARSED_BEND_FLAG_FALLBACK');
}

console.log('CII topology fixed ELEMENT bend pointer authority: PASS');
