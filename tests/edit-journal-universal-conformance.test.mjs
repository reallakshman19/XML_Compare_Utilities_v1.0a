import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createCommandEnvelope } from '../contracts/command-envelope.js';
import { immutableJson } from '../contracts/contract-values.js';
import { createDomainReducerRegistry } from '../core/edit-journal/domain-reducer-registry.js';
import { runEditJournalConformance } from '../core/edit-journal/edit-journal-conformance.js';

const NOW = '2026-07-25T09:00:00.000Z';
function command(commandId, sequence, commandType, payload) {
  return createCommandEnvelope({
    commandId, sessionId: 'session:conformance', documentId: 'document:conformance', sequence,
    commandType, payload, basis: { documentHash: 'basis:conformance', revision: 'Conformance.v1' },
    origin: { kind: 'SYSTEM', actorId: 'CONFORMANCE', issuedAt: NOW }, transactionId: null, inverse: null,
  });
}

const geometryRegistry = createDomainReducerRegistry({
  POINT_ADD(state, envelope) {
    return immutableJson({ ...state, points: [...state.points, envelope.payload.point] }, 'Geometry state');
  },
  SCALE_SET(state, envelope) {
    return immutableJson({ ...state, scale: envelope.payload.scale }, 'Geometry state');
  },
});
const geometryEnvelopes = Object.freeze([
  command('G-2', 2, 'SCALE_SET', { scale: 2 }),
  command('G-1', 1, 'POINT_ADD', { point: { x: 1, y: 2 } }),
  command('G-3', 3, 'POINT_ADD', { point: { x: 3, y: 4 } }),
]);
const geometryReport = runEditJournalConformance({
  initialState: { points: [], scale: 1 }, geometry: 'opaque',
  envelopes: geometryEnvelopes, registry: geometryRegistry,
  unsupportedEnvelope: command('G-X', 4, 'MESH_DELETE', { targetId: 'mesh:1' }),
});

const metadataRegistry = createDomainReducerRegistry({
  FIELD_SET(state, envelope) {
    return immutableJson({ ...state, fields: { ...state.fields, [envelope.payload.key]: envelope.payload.value } }, 'Metadata state');
  },
  TAG_ADD(state, envelope) {
    return immutableJson({ ...state, tags: [...state.tags, envelope.payload.tag] }, 'Metadata state');
  },
});
const metadataEnvelopes = Object.freeze([
  command('M-3', 3, 'FIELD_SET', { key: 'owner', value: 'team-a' }),
  command('M-1', 1, 'TAG_ADD', { tag: 'reviewed' }),
  command('M-2', 2, 'FIELD_SET', { key: 'status', value: 'ready' }),
]);
const metadataReport = runEditJournalConformance({
  initialState: { fields: {}, tags: [] }, envelopes: metadataEnvelopes, registry: metadataRegistry,
  unsupportedEnvelope: command('M-X', 4, 'POINT_ADD', { point: { x: 0, y: 0 } }),
});

for (const report of [geometryReport, metadataReport]) {
  assert.equal(report.passed, true);
  assert(Object.values(report.checks).every(Boolean));
  assert(Object.isFrozen(report));
  assert(Object.isFrozen(report.checks));
}

const source = readFileSync(fileURLToPath(new URL('../core/edit-journal/edit-journal-conformance.js', import.meta.url)), 'utf8');
assert.doesNotMatch(source, /topology/i);
assert.doesNotMatch(source, /export\s+default/);

console.log('[PASS] geometry-like and metadata-like bindings passed the same neutral conformance runner.');
