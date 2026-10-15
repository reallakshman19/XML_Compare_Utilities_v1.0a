/** Reusable domain-neutral conformance certification for reducer bindings. */

import { immutableJson } from '../../contracts/contract-values.js';
import { replayEditJournal } from './edit-journal-replay.js';

function deepFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => deepFrozen(child, seen));
}

function orderedIds(envelopes, activeIds) {
  const active = new Set(activeIds);
  return [...envelopes]
    .sort((left, right) => left.sequence - right.sequence || (left.commandId < right.commandId ? -1 : 1))
    .filter((envelope) => active.has(envelope.commandId))
    .map((envelope) => envelope.commandId);
}

function unsupportedRejected(input) {
  try {
    replayEditJournal({
      initialState: input.initialState, envelopes: [input.unsupportedEnvelope],
      activeCommandIds: [input.unsupportedEnvelope.commandId], registry: input.registry,
    });
    return false;
  } catch (error) { return error instanceof RangeError; }
}

function certify(checks) {
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failures.length) throw new Error(`Edit journal conformance failed: ${failures.join(', ')}.`);
  return checks;
}

/** Certify one reducer registry against shared replay invariants. */
export function runEditJournalConformance(input) {
  if (!input || !Array.isArray(input.envelopes) || input.envelopes.length < 2) {
    throw new TypeError('Conformance requires at least two supported envelopes.');
  }
  const allIds = input.envelopes.map((envelope) => envelope.commandId);
  const stateBefore = JSON.stringify(input.initialState), envelopesBefore = JSON.stringify(input.envelopes);
  const first = replayEditJournal({ initialState: input.initialState, envelopes: input.envelopes, activeCommandIds: allIds, registry: input.registry });
  const second = replayEditJournal({ initialState: input.initialState, envelopes: input.envelopes, activeCommandIds: allIds, registry: input.registry });
  const inactiveId = allIds.at(-1), activeWithoutLast = allIds.slice(0, -1);
  const inactiveReplay = replayEditJournal({ initialState: input.initialState, envelopes: input.envelopes, activeCommandIds: activeWithoutLast, registry: input.registry });
  const checks = certify({
    supportedCommandAccepted: first.appliedCommandIds.length === allIds.length,
    unsupportedCommandRejected: unsupportedRejected(input),
    inputStateUnchanged: JSON.stringify(input.initialState) === stateBefore,
    envelopeUnchanged: JSON.stringify(input.envelopes) === envelopesBefore,
    outputImmutable: deepFrozen(first),
    repeatedReplayDeterministic: JSON.stringify(first) === JSON.stringify(second),
    commandOrderingPreserved: JSON.stringify(first.appliedCommandIds) === JSON.stringify(orderedIds(input.envelopes, allIds)),
    inactiveCommandsExcluded: !inactiveReplay.appliedCommandIds.includes(inactiveId),
  });
  return immutableJson({ schema: 'EditJournalConformance.v1', passed: true, checks }, 'Edit journal conformance result');
}
