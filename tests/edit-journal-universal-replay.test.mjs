import assert from 'node:assert/strict';

import { createCommandEnvelope } from '../contracts/command-envelope.js';
import { immutableJson } from '../contracts/contract-values.js';
import { createDomainReducerRegistry } from '../core/edit-journal/domain-reducer-registry.js';
import { replayEditJournal } from '../core/edit-journal/edit-journal-replay.js';

const NOW = '2026-07-25T08:00:00.000Z';
const TYPES = Object.freeze(['GEOMETRY_SHIFT', 'ATTRIBUTE_EDIT', 'REMARK_SET']);
const initialState = { total: 0, geometry: [], attributes: {}, remarks: {}, trace: [] };

function nextState(state, envelope, patch) {
  return immutableJson({ ...state, ...patch, trace: [...state.trace, envelope.commandId] }, 'Synthetic replay state');
}

const registry = createDomainReducerRegistry({
  GEOMETRY_SHIFT(state, envelope) {
    return nextState(state, envelope, {
      total: state.total + envelope.payload.delta,
      geometry: [...state.geometry, { id: envelope.payload.targetId, delta: envelope.payload.delta }],
    });
  },
  ATTRIBUTE_EDIT(state, envelope) {
    return nextState(state, envelope, {
      attributes: { ...state.attributes, [envelope.payload.key]: envelope.payload.value },
    });
  },
  REMARK_SET(state, envelope) {
    return nextState(state, envelope, {
      remarks: { ...state.remarks, [envelope.payload.targetId]: envelope.payload.value },
    });
  },
});

function envelope(sequence, commandType = TYPES[(sequence - 1) % TYPES.length]) {
  return createCommandEnvelope({
    commandId: `CJ-${String(sequence).padStart(6, '0')}`,
    sessionId: 'session:universal', documentId: 'document:universal', sequence, commandType,
    payload: commandType === 'GEOMETRY_SHIFT'
      ? { targetId: `P-${sequence}`, delta: sequence }
      : commandType === 'ATTRIBUTE_EDIT'
        ? { key: `K-${sequence % 4}`, value: `V-${sequence}` }
        : { targetId: `R-${sequence % 5}`, value: `remark-${sequence}` },
    basis: { documentHash: 'basis:universal', revision: 'Synthetic.v1' },
    origin: { kind: 'SYSTEM', actorId: 'EJOURNAL-TEST', issuedAt: NOW },
    transactionId: sequence % 6 === 0 ? `TX-${sequence}` : null,
    inverse: { operation: 'SYNTHETIC_INVERSE', sequence },
  });
}

const orderedEnvelopes = Object.freeze(Array.from({ length: 30 }, (_, index) => envelope(index + 1)));
const envelopes = Object.freeze([...orderedEnvelopes.slice(15), ...orderedEnvelopes.slice(0, 15)]);
const inactiveIds = Object.freeze([3, 7, 13, 19, 29].map((value) => `CJ-${String(value).padStart(6, '0')}`));
const redoIds = Object.freeze([5, 11, 17, 23, 30].map((value) => `CJ-${String(value).padStart(6, '0')}`));
const excluded = new Set([...inactiveIds, ...redoIds]);
const activeCommandIds = orderedEnvelopes.map((entry) => entry.commandId).filter((id) => !excluded.has(id));
const inputSnapshot = JSON.stringify({ initialState, envelopes, activeCommandIds });
const stateVariants = new Set(), orderVariants = new Set();

for (let replay = 0; replay < 100; replay += 1) {
  const result = replayEditJournal({ initialState, envelopes, activeCommandIds, registry });
  stateVariants.add(JSON.stringify(result.state));
  orderVariants.add(JSON.stringify(result.appliedCommandIds));
}

const inputMutations = JSON.stringify({ initialState, envelopes, activeCommandIds }) === inputSnapshot ? 0 : 1;
assert.equal(envelopes.length, 30);
assert.equal(inactiveIds.length, 5);
assert.equal(redoIds.length, 5);
assert.equal(stateVariants.size, 1);
assert.equal(orderVariants.size, 1);
assert.equal(inputMutations, 0);

const continuous = replayEditJournal({ initialState, envelopes, activeCommandIds, registry });
assert.deepEqual(continuous.appliedCommandIds, orderedEnvelopes.map((entry) => entry.commandId).filter((id) => !excluded.has(id)));
assert.equal(Object.isFrozen(continuous), true);
assert.equal(Object.isFrozen(continuous.state), true);
assert.equal(Object.isFrozen(continuous.appliedCommandIds), true);
assert.doesNotThrow(() => JSON.stringify(continuous));

const checkpoints = Object.freeze([10, 20, 30]);
let partitionState = initialState;
const partitionApplied = [];
let lower = 1;
for (const upper of checkpoints) {
  const partition = orderedEnvelopes.filter((entry) => entry.sequence >= lower && entry.sequence <= upper);
  const partitionActive = partition.map((entry) => entry.commandId).filter((id) => !excluded.has(id));
  const result = replayEditJournal({ initialState: partitionState, envelopes: partition, activeCommandIds: partitionActive, registry });
  partitionState = result.state;
  partitionApplied.push(...result.appliedCommandIds);
  lower = upper + 1;
}
assert.equal(JSON.stringify(partitionState), JSON.stringify(continuous.state));
assert.deepEqual(partitionApplied, continuous.appliedCommandIds);

const unknown = envelope(31, 'UNKNOWN_COMMAND');
assert.throws(() => replayEditJournal({ initialState, envelopes: [unknown], activeCommandIds: [unknown.commandId], registry }), RangeError);
assert.throws(() => replayEditJournal({ initialState, envelopes: [orderedEnvelopes[0]], activeCommandIds: ['CJ-999999'], registry }), /has no envelope/);
const duplicate = envelope(99, 'GEOMETRY_SHIFT');
const duplicateId = createCommandEnvelope({ ...duplicate, commandId: orderedEnvelopes[0].commandId });
assert.throws(() => replayEditJournal({ initialState, envelopes: [orderedEnvelopes[0], duplicateId], activeCommandIds: [orderedEnvelopes[0].commandId], registry }), /Duplicate envelope ID/);

const undefinedRegistry = createDomainReducerRegistry({ GEOMETRY_SHIFT: () => undefined });
assert.throws(() => replayEditJournal({ initialState, envelopes: [orderedEnvelopes[0]], activeCommandIds: [orderedEnvelopes[0].commandId], registry: undefinedRegistry }), /returned undefined/);
const mutableRegistry = createDomainReducerRegistry({ GEOMETRY_SHIFT: () => ({ mutable: true }) });
assert.throws(() => replayEditJournal({ initialState, envelopes: [orderedEnvelopes[0]], activeCommandIds: [orderedEnvelopes[0].commandId], registry: mutableRegistry }), /deeply immutable/);
const scalarRegistry = createDomainReducerRegistry({ GEOMETRY_SHIFT: () => 4 });
assert.throws(() => replayEditJournal({ initialState, envelopes: [orderedEnvelopes[0]], activeCommandIds: [orderedEnvelopes[0].commandId], registry: scalarRegistry }), /must be a JSON object/);

const throwingRegistry = createDomainReducerRegistry({ GEOMETRY_SHIFT: () => { throw new TypeError('synthetic reducer fault'); } });
assert.throws(
  () => replayEditJournal({ initialState, envelopes: [orderedEnvelopes[0]], activeCommandIds: [orderedEnvelopes[0].commandId], registry: throwingRegistry }),
  (error) => error instanceof TypeError && /CJ-000001 \(GEOMETRY_SHIFT\)/.test(error.message) && error.cause?.message === 'synthetic reducer fault',
);

console.log('[PASS] 30-envelope universal replay: 100 deterministic replays, zero mutations, zero partition delta.');
