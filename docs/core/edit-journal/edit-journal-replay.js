/** Pure deterministic replay over CommandEnvelope.v1 records and active IDs. */

import { validateCommandEnvelope } from '../../contracts/command-envelope.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';

function assertRegistry(registry) {
  if (!registry || typeof registry.getReducer !== 'function' || typeof registry.reduce !== 'function') {
    throw new TypeError('Edit journal replay requires a domain reducer registry.');
  }
}

function assertStateObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
}

function isDeeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isDeeplyFrozen(child, seen));
}

function immutableInitialState(initialState) {
  assertStateObject(initialState, 'Initial state');
  return immutableJson(initialState, 'Initial edit journal state');
}

function immutableReducerState(state, envelope) {
  if (state === undefined) throw new TypeError(`Reducer for ${envelope.commandId} returned undefined.`);
  assertStateObject(state, `Reducer output for ${envelope.commandId}`);
  immutableJson(state, `Reducer output for ${envelope.commandId}`);
  if (!isDeeplyFrozen(state)) throw new TypeError(`Reducer output for ${envelope.commandId} must be deeply immutable.`);
  return state;
}

function prepareEnvelope(envelope, index) {
  const errors = validateCommandEnvelope(envelope);
  if (errors.length) throw new TypeError(`Invalid envelope at index ${index}: ${errors.join('; ')}`);
  return immutableJson(envelope, `Edit journal envelope ${index}`);
}

function compareEnvelopes(left, right) {
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  if (left.commandId === right.commandId) return 0;
  return left.commandId < right.commandId ? -1 : 1;
}

function prepareEnvelopes(envelopes, registry) {
  if (!Array.isArray(envelopes)) throw new TypeError('Edit journal envelopes must be an array.');
  const prepared = envelopes.map(prepareEnvelope), ids = new Set();
  for (const envelope of prepared) {
    if (ids.has(envelope.commandId)) throw new TypeError(`Duplicate envelope ID ${envelope.commandId}.`);
    ids.add(envelope.commandId); registry.getReducer(envelope.commandType);
  }
  return Object.freeze([...prepared].sort(compareEnvelopes));
}

function prepareActiveIds(activeCommandIds, envelopeIds) {
  if (!Array.isArray(activeCommandIds)) throw new TypeError('activeCommandIds must be an array.');
  const ids = activeCommandIds.map((id) => requiredContractText(id, 'Active command ID'));
  if (new Set(ids).size !== ids.length) throw new TypeError('activeCommandIds must be unique.');
  for (const id of ids) if (!envelopeIds.has(id)) throw new RangeError(`Active command ID ${id} has no envelope.`);
  return new Set(ids);
}

/** Replay active commands in deterministic journal sequence order. */
export function replayEditJournal(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Edit journal replay input is required.');
  assertRegistry(input.registry);
  const envelopes = prepareEnvelopes(input.envelopes, input.registry);
  const envelopeIds = new Set(envelopes.map((envelope) => envelope.commandId));
  const active = prepareActiveIds(input.activeCommandIds, envelopeIds);
  const appliedCommandIds = [];
  let state = immutableInitialState(input.initialState);
  for (const envelope of envelopes) {
    if (!active.has(envelope.commandId)) continue;
    state = immutableReducerState(input.registry.reduce(state, envelope), envelope);
    appliedCommandIds.push(envelope.commandId);
  }
  return immutableJson({ state, appliedCommandIds }, 'Edit journal replay result');
}
