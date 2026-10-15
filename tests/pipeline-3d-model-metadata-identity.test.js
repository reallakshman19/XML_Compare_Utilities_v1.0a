import assert from 'node:assert/strict';
import { resolvePipelineMetadataIdentity, samePipelineMetadataValue } from '../tabs/pipeline-3d-model/pipeline-3d-model-metadata-identity.js';
const first = resolvePipelineMetadataIdentity({ configuration: { revision: 'R1', enabled: true },
  ancestry: { source: 'PLAN-1', values: [1, undefined, 3] } });
assert.equal(Object.isFrozen(first), true);
assert.equal(Object.isFrozen(first.configuration), true);
assert.equal(Object.isFrozen(first.ancestry.values), true);
const reordered = { ancestry: { values: [1, null, 3], source: 'PLAN-1' },
  configuration: { enabled: true, revision: 'R1' } };
assert.equal(samePipelineMetadataValue(first, reordered), true);
assert.equal(resolvePipelineMetadataIdentity(reordered, first), first);
assert.notEqual(resolvePipelineMetadataIdentity({ ...reordered,
  configuration: { enabled: true, revision: 'R2' } }, first), first);
assert.equal(samePipelineMetadataValue(first, { ...reordered,
  ancestry: { values: [3, null, 1], source: 'PLAN-1' } }), false);
assert.throws(() => resolvePipelineMetadataIdentity({ invalid: new Map() }, first), /JSON-safe/);
console.log('metadata identity: PASS');
