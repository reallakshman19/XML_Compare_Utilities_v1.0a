/** Deterministic consumer-neutral fixture for synthetic scoped-edit integration. */
import { createCommandEnvelope } from '../../contracts/command-envelope.js';
import { immutableJson } from '../../contracts/contract-values.js';
import { EDIT_3D_CONSTRAINT_KIND, EDIT_3D_DRAG_REQUEST_V1 } from '../../core/edit-3d/index.js';
import { createDomainReducerRegistry } from '../../core/edit-journal/index.js';
import { createEngineeringRevisionToken } from '../../core/engineering-scene/engineering-revision-contracts.js';
import { createEngineeringScene } from '../../core/engineering-scene/engineering-scene-contracts.js';
import { resolveEngineeringScope } from '../../core/engineering-scope/index.js';
import {
  SCOPED_EDIT_ENTITY_GEOMETRY_V1,
  SCOPED_EDIT_JOURNAL_PROJECTION_V1,
  validateScopedEditJournalProjection,
} from '../../core/scoped-edit-runtime/index.js';

export const SCOPED_EDIT_FIXTURE_COUNTS = Object.freeze({
  entities: 20, editable: 8, boundary: 4, excluded: 8,
  structuralIdentifiers: 3, selectionSeeds: 3, sectionalRegions: 3,
  reducerBindings: 3,
});

const EDITABLE_IDS = Object.freeze(Array.from({ length: 8 }, (_, index) => `E-${String(index + 1).padStart(2, '0')}`));
const BOUNDARY_IDS = Object.freeze(Array.from({ length: 4 }, (_, index) => `B-${String(index + 1).padStart(2, '0')}`));
const EXCLUDED_IDS = Object.freeze(Array.from({ length: 8 }, (_, index) => `X-${String(index + 1).padStart(2, '0')}`));
const STRUCTURAL_IDENTIFIERS = Object.freeze(['structure:alpha', 'structure:beta', 'structure:gamma']);
const SELECTION_SEEDS = Object.freeze([
  Object.freeze(['E-01', 'E-02']), Object.freeze(['E-03', 'E-04']), Object.freeze(['E-05', 'E-06', 'E-07', 'E-08']),
]);
const SECTIONAL_REGIONS = Object.freeze([
  Object.freeze({ kind: 'box', min: { x: -1, y: -1, z: -1 }, max: { x: 80, y: 5, z: 5 } }),
  Object.freeze({ kind: 'slab', axis: 'X', min: 0, max: 80 }),
  Object.freeze({ kind: 'radius', center: { x: 35, y: 0, z: 0 }, radius: 50 }),
]);

function anchorFor(id) {
  const index = Number(id.slice(2)) || 0;
  return Object.freeze([index * 10, id.startsWith('B-') ? 20 : id.startsWith('X-') ? 40 : 0, 0]);
}

function sceneEntity(id, renderOrder) {
  const anchor = anchorFor(id);
  return {
    id, kind: 'synthetic-entity', domainRef: { stableId: id }, renderOrder,
    editCapabilities: id.startsWith('E-') ? ['POSITION', 'ATTRIBUTE', 'REMARK'] : [],
    metadata: { anchor },
  };
}

function createScene() {
  const ids = [...EDITABLE_IDS, ...BOUNDARY_IDS, ...EXCLUDED_IDS];
  return createEngineeringScene({
    sceneId: 'scene:scoped-edit-synthetic', revision: createEngineeringRevisionToken('fixture-r1'),
    coordinateSystem: { unit: 'mm', frame: 'GLOBAL', verticalAxis: 'Z', handedness: 'right' },
    entities: ids.map(sceneEntity), metadata: { fixture: 'TWO-SURFACE-P1' },
  });
}

const SYNTHETIC_SCENE = createScene();

function referencesOf(entity) {
  if (!entity.id.startsWith('E-')) return [];
  return [BOUNDARY_IDS[(Number(entity.id.slice(2)) - 1) % BOUNDARY_IDS.length]];
}

function boundsOf(entity) {
  const [x, y, z] = entity.metadata.anchor;
  return { min: { x: x - 1, y: y - 1, z: z - 1 }, max: { x: x + 1, y: y + 1, z: z + 1 } };
}

function resolveStructural(_scene, material) {
  const identifiers = material.identifiers;
  if (identifiers.some((id) => STRUCTURAL_IDENTIFIERS.includes(id))) return EDITABLE_IDS;
  return [];
}

export function createScopedEditScopeRequest(boundaryPolicy = 'FROZEN') {
  return immutableJson({
    schema: 'EngineeringScopeRequest.v1', kind: 'STRUCTURAL', boundaryPolicy, elementBudget: 12,
    structural: { identifiers: ['structure:alpha'] },
  }, 'Synthetic scope request');
}

export function createScopedEditJournalProjection(envelopes = [], activeCommandIds = []) {
  return validateScopedEditJournalProjection({
    schema: SCOPED_EDIT_JOURNAL_PROJECTION_V1,
    initialState: { positions: {}, attributes: {}, remarks: {}, trace: [] },
    envelopes, activeCommandIds,
  });
}

function nextState(state, envelope, patch) {
  return immutableJson({ ...state, ...patch, trace: [...state.trace, envelope.commandId] }, 'Synthetic scoped-edit replay state');
}

function reducerRegistry(evidence, failCommandType) {
  const reducer = (commandType, apply) => (state, envelope) => {
    evidence.reducerCalls += 1; evidence.callOrder.push(`replay:${envelope.commandId}`);
    if (commandType === failCommandType) throw new TypeError('synthetic reducer fault');
    return nextState(state, envelope, apply(state, envelope));
  };
  return createDomainReducerRegistry({
    ENTITY_POSITION_SET: reducer('ENTITY_POSITION_SET', (state, envelope) => ({
      positions: { ...state.positions, [envelope.payload.targetId]: envelope.payload.position },
    })),
    ENTITY_ATTRIBUTE_SET: reducer('ENTITY_ATTRIBUTE_SET', (state, envelope) => ({
      attributes: { ...state.attributes, [envelope.payload.targetId]: envelope.payload.value },
    })),
    ENTITY_REMARK_SET: reducer('ENTITY_REMARK_SET', (state, envelope) => ({
      remarks: { ...state.remarks, [envelope.payload.targetId]: envelope.payload.value },
    })),
  });
}

function changedEnvelope(envelope) {
  return immutableJson({ ...envelope, payload: { ...envelope.payload, syntheticCorruption: true } }, 'Changed envelope');
}

function appendedProjection(current, envelope, corruption) {
  if (corruption === 'OMIT_APPENDED') return current;
  let envelopes = [...current.envelopes, envelope];
  if (corruption === 'DROP_EXISTING') envelopes = [envelope];
  if (corruption === 'CHANGE_EXISTING' && current.envelopes.length) envelopes[0] = changedEnvelope(envelopes[0]);
  const next = {
    schema: SCOPED_EDIT_JOURNAL_PROJECTION_V1, initialState: current.initialState,
    envelopes, activeCommandIds: [...current.activeCommandIds, envelope.commandId],
  };
  return corruption === 'MUTABLE' ? next : validateScopedEditJournalProjection(next);
}

export function scopedEditEnvelope(sequence, commandType = 'ENTITY_POSITION_SET', targetId = 'E-01', value = null) {
  const payload = commandType === 'ENTITY_POSITION_SET'
    ? { targetId, position: value ?? [10 + sequence, 0, 0] }
    : { targetId, value: value ?? `${commandType.toLowerCase()}:${sequence}` };
  return createCommandEnvelope({
    commandId: `SER-${String(sequence).padStart(6, '0')}`, sessionId: 'session:synthetic',
    documentId: 'document:synthetic', sequence, commandType, payload,
    basis: { documentHash: 'basis:synthetic', revision: 'ScopedEditFixture.v1' },
    origin: { kind: 'SYSTEM', actorId: 'TWO-SURFACE-P1', issuedAt: '2026-07-25T10:00:00.000Z' },
    transactionId: null, inverse: null,
  });
}

export function scopedEditDragRequest(entityId = 'E-01') {
  return immutableJson({
    schema: EDIT_3D_DRAG_REQUEST_V1, start: anchorFor(entityId), maxDistance: 1000,
    constraint: { kind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE, planeNormal: [0, 0, 1] },
  }, 'Synthetic drag request');
}

export function scopedEditValidRay(entityId = 'E-01') {
  const [x, y, z] = anchorFor(entityId);
  return Object.freeze({ origin: Object.freeze([x, y, z + 100]), direction: Object.freeze([1, 0, -1]) });
}

export function scopedEditInvalidRay(entityId = 'E-01') {
  const [x, y, z] = anchorFor(entityId);
  return Object.freeze({ origin: Object.freeze([x, y, z + 100]), direction: Object.freeze([1, 0, 0]) });
}

export function createScopedEditRuntimeFixture(options = {}) {
  const scene = SYNTHETIC_SCENE, scopeRequest = createScopedEditScopeRequest(options.boundaryPolicy);
  const evidence = { sceneCalls: 0, scopeCalls: 0, geometryCalls: 0, appendCalls: 0, reducerCalls: 0, callOrder: [] };
  const host = Object.freeze({
    scene() { evidence.sceneCalls += 1; return scene; },
    resolveScope(request) {
      evidence.scopeCalls += 1;
      return resolveEngineeringScope(scene, request, { resolveStructural, referencesOf, boundsOf });
    },
    entityGeometry(entityId) {
      evidence.geometryCalls += 1;
      return immutableJson({ schema: SCOPED_EDIT_ENTITY_GEOMETRY_V1, entityId, anchor: anchorFor(entityId) }, 'Fixture geometry');
    },
    appendEditCommand(current, envelope) {
      evidence.appendCalls += 1; evidence.callOrder.push(`append:${envelope.commandId}`);
      return appendedProjection(current, envelope, options.corruption);
    },
  });
  const fixture = {
    synthetic: true, scene, scopeRequest, host, reducerRegistry: reducerRegistry(evidence, options.failCommandType),
    journalProjection: options.journalProjection ?? createScopedEditJournalProjection(),
    editableIds: EDITABLE_IDS, boundaryIds: BOUNDARY_IDS, excludedIds: EXCLUDED_IDS,
    structuralIdentifiers: STRUCTURAL_IDENTIFIERS, selectionSeeds: SELECTION_SEEDS, sectionalRegions: SECTIONAL_REGIONS,
    referencesOf, boundsOf, resolveStructural, dragRequest: scopedEditDragRequest, validRay: scopedEditValidRay,
    invalidRay: scopedEditInvalidRay, envelope: scopedEditEnvelope,
    readEvidence: () => immutableJson(evidence, 'Synthetic fixture evidence'),
    createFixture: (nextOptions = {}) => createScopedEditRuntimeFixture(nextOptions),
  };
  return Object.freeze(fixture);
}
