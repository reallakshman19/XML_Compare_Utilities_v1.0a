import assert from 'assert';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';

function document(withSif) {
  const element = { index: 0, from: 10, to: 20, dx: 100, dy: 0, dz: 0, od: 60.3, wall: 3.9, P1: 10, T1: 100,
    length: 100, fromPos: { x: 0, y: 0, z: 0 }, toPos: { x: 100, y: 0, z: 0 }, hasBend: false };
  return {
    schema: 'CIIWorkspaceDocument.v1', side: withSif ? 'TARGET' : 'SOURCE', contentSha256: withSif ? 'target' : 'source',
    parsed: { elements: [element], nodes: { 10: { x: 0, y: 0, z: 0 }, 20: { x: 100, y: 0, z: 0 } } }, nodeNames: {},
    capabilities: { families: {
      rigidMass: { state: 'EMPTY', qualification: 'QUALIFIED', authority: 'tabs/cii-workspace/cii-workspace-auxiliary.js#RIGID_POINTER' },
      sifTee: { state: withSif ? 'PARSED' : 'EMPTY', qualification: 'PARTIAL', authority: 'tabs/cii-workspace/cii-workspace-auxiliary.js#SIF_TEE_POINTER' },
    } },
    auxiliaryEvidence: { elements: { 0: {
      pointers: { rigid: 0, sifTee: withSif ? 1 : 0 }, rigidRecord: null,
      sifTeeRecord: withSif ? { pointer: 1, node: '20', rawCode: 5, normalizedPayload: [[null, 5]] } : null,
    } } },
  };
}

const source = adaptCiiDocumentToTopologyGraph(document(false));
const target = adaptCiiDocumentToTopologyGraph(document(true));
assert.strictEqual(source.edges[0].componentKind, 'PIPE');
assert.strictEqual(target.edges[0].componentKind, 'PIPE');
assert.deepStrictEqual(source.edges[0].packetEvidence, target.edges[0].packetEvidence,
  'SIF/TEE property changes must not enter M2 packet identity evidence');
assert.deepStrictEqual(source.edges[0].fromContext.neighbourhoodLayers, target.edges[0].fromContext.neighbourhoodLayers,
  'SIF/TEE property changes must not alter structural neighbourhood identity');
assert.strictEqual(source.edges[0].sifTeeEvidence, null);
assert.strictEqual(target.edges[0].sifTeeEvidence.rawCode, 5, 'SIF/TEE remains available downstream as engineering evidence');
console.log('CII SIF/TEE identity-separation checks passed.');
