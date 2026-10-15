import assert from 'node:assert/strict';

import { createDomainReducerRegistry } from '../core/edit-journal/domain-reducer-registry.js';

const topologyReducer = (state) => state;
const attributeReducer = (state) => state;
const remarkReducer = (state) => state;
const registry = createDomainReducerRegistry({
  REMARK_SET: remarkReducer,
  TOPOLOGY_COMMAND: topologyReducer,
  ATTRIBUTE_EDIT: attributeReducer,
});

assert(Object.isFrozen(registry));
assert(Object.isFrozen(registry.commandTypes));
assert.deepEqual(registry.commandTypes, ['ATTRIBUTE_EDIT', 'REMARK_SET', 'TOPOLOGY_COMMAND']);
assert.equal(registry.getReducer(' topology_command '), topologyReducer);
assert.equal(registry.getReducer('attribute_edit'), attributeReducer);
assert.equal(registry.has('remark_set'), true);
assert.equal(registry.has('missing'), false);
assert.throws(() => registry.getReducer('UNKNOWN_COMMAND'), RangeError);
assert.throws(() => createDomainReducerRegistry({ ATTRIBUTE_EDIT: null }), /must be a function/);
assert.throws(() => createDomainReducerRegistry({ '   ': topologyReducer }), /non-empty string/);
assert.throws(() => createDomainReducerRegistry({ ' remark_set ': remarkReducer, REMARK_SET: topologyReducer }), /Duplicate command type REMARK_SET/);
assert.equal(registry.set, undefined);
assert.equal(registry.register, undefined);
assert.equal(registry.delete, undefined);
assert.equal(Object.values(registry).some((value) => value instanceof Map), false);

const reordered = createDomainReducerRegistry({
  ATTRIBUTE_EDIT: attributeReducer,
  REMARK_SET: remarkReducer,
  TOPOLOGY_COMMAND: topologyReducer,
});
assert.deepEqual(reordered.commandTypes, registry.commandTypes);

console.log('[PASS] immutable domain reducer registry matrix passed.');
