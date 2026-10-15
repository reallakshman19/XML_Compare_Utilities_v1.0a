import assert from 'node:assert/strict';
import { buildStableXmlIdentity, buildStableXmlIdentitySummary } from '../xml-compare/input/build-stable-xml-identity.js';

const guid = buildStableXmlIdentity({ uid: 'a', componentGuid: 'G-1' }, { sourceId: 'A' });
assert.equal(guid.identityBasis, 'guid');
assert.equal(guid.identityConfidence, 1);

const pair = buildStableXmlIdentity({ uid: 'p', lineNo: 'L1', fromNode: '10', toNode: '20', componentType: 'PIPE' }, { sourceId: 'A' });
assert.equal(pair.identityBasis, 'line-node-pair');
assert.equal(pair.stableKey, 'lnp:L1|10|20|PIPE');

const node = buildStableXmlIdentity({ lineNo: 'L1', elementKey: 'E1', nodeNumber: '10', role: 'FROM' }, { sourceId: 'A' });
assert.equal(node.identityBasis, 'line-element-node-role');

const geom = buildStableXmlIdentity({ lineNo: 'L1', componentType: 'PIPE', position: { x: 10, y: 0, z: 0 } }, { sourceId: 'A' });
assert.equal(geom.identityBasis, 'geometry-hash');

const synth = buildStableXmlIdentity({ uid: 's' }, { sourceId: 'A', index: 2 });
assert.equal(synth.identityBasis, 'synthetic-index');
assert.equal(synth.identityConfidence < 0.5, true);

const summary = buildStableXmlIdentitySummary([{ uid: 'x' }, { componentGuid: 'G-2' }], { sourceId: 'A' });
assert.equal(summary.syntheticFallbackCount, 1);
assert.equal(summary.stableCount, 1);
console.log('XML stable identity tests passed');
