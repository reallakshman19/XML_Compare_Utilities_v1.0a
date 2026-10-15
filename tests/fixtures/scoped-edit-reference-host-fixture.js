/** Deterministic consumer-neutral fixture for the reference transaction host. */
import { createCommandJournal } from '../../contracts/command-journal.js';
import { immutableJson } from '../../contracts/contract-values.js';
import { EDIT_3D_CONSTRAINT_KIND, EDIT_3D_DRAG_REQUEST_V1 } from '../../core/edit-3d/index.js';
import { createScopedEditRuntime } from '../../core/scoped-edit-runtime/index.js';
import {
  REFERENCE_ATTRIBUTE_SET,
  REFERENCE_POSITION_SET,
  REFERENCE_REMARK_SET,
  SCOPED_EDIT_REFERENCE_DOCUMENT_V1,
  createReferenceReducerRegistry,
  createReferenceScopedEditEnvelope,
  createScopedEditReferenceDocument,
  createScopedEditReferenceStore,
} from '../../core/scoped-edit-reference-host/index.js';

export const SCOPED_EDIT_REFERENCE_FIXTURE_COUNTS = Object.freeze({
  entities: 32,
  editable: 12,
  boundary: 8,
  excluded: 12,
  structuralGroups: 4,
  selectionSeedSets: 4,
  sectionalRegions: 4,
  reducerBindings: 3,
});

const EDITABLE_IDS = Object.freeze(Array.from({ length: 12 }, (_, index) => `R-E-${String(index + 1).padStart(2, '0')}`));
const BOUNDARY_IDS = Object.freeze(Array.from({ length: 8 }, (_, index) => `R-B-${String(index + 1).padStart(2, '0')}`));
const EXCLUDED_IDS = Object.freeze(Array.from({ length: 12 }, (_, index) => `R-X-${String(index + 1).padStart(2, '0')}`));
const STRUCTURAL_GROUPS = Object.freeze(['group:01', 'group:02', 'group:03', 'group:04']);
const SELECTION_SEED_SETS = Object.freeze([
  Object.freeze(EDITABLE_IDS.slice(0, 3)),
  Object.freeze(EDITABLE_IDS.slice(3, 6)),
  Object.freeze(EDITABLE_IDS.slice(6, 9)),
  Object.freeze(EDITABLE_IDS.slice(9, 12)),
]);
const SECTIONAL_REGIONS = Object.freeze([
  Object.freeze({ kind: 'box', min: { x: 9, y: -1, z: -1 }, max: { x: 31, y: 1, z: 1 } }),
  Object.freeze({ kind: 'box', min: { x: 39, y: -1, z: -1 }, max: { x: 61, y: 1, z: 1 } }),
  Object.freeze({ kind: 'box', min: { x: 69, y: -1, z: -1 }, max: { x: 91, y: 1, z: 1 } }),
  Object.freeze({ kind: 'box', min: { x: 100, y: -1, z: -1 }, max: { x: 110, y: 1, z: 1 } }),
]);

function editableAnchor(index) {
  if (index === 9) return [99.5, 0, 0];
  if (index === 10) return [110, 0, 0];
  if (index === 11) return [120, 20, 0];
  return [(index + 1) * 10, 0, 0];
}

function editableReferences(index) {
  if (index === 11) return [];
  return [BOUNDARY_IDS[index % BOUNDARY_IDS.length]];
}

function editableEntity(id, index) {
  return {
    entityId: id,
    anchor: editableAnchor(index),
    attributes: { class: 'editable', ordinal: index + 1 },
    remark: null,
    structuralIds: [STRUCTURAL_GROUPS[Math.floor(index / 3)]],
    referenceIds: editableReferences(index),
  };
}

function boundaryReferences(index) {
  if (index === 0) return [BOUNDARY_IDS[1]];
  if (index === 1) return [BOUNDARY_IDS[2]];
  if (index === 3) return [BOUNDARY_IDS[4]];
  return [];
}

function boundaryEntity(id, index) {
  return {
    entityId: id,
    anchor: [(index + 1) * 10, 10, 0],
    attributes: { class: 'boundary', ordinal: index + 1 },
    remark: null,
    structuralIds: [],
    referenceIds: boundaryReferences(index),
  };
}

function excludedEntity(id, index) {
  return {
    entityId: id,
    anchor: [(index + 1) * 10, 50, 0],
    attributes: { class: 'excluded', ordinal: index + 1 },
    remark: null,
    structuralIds: [],
    referenceIds: [],
  };
}

function createDocument() {
  return createScopedEditReferenceDocument({
    schema: SCOPED_EDIT_REFERENCE_DOCUMENT_V1,
    documentId: 'reference-document:fixture',
    revision: 0,
    entities: [
      ...EDITABLE_IDS.map(editableEntity),
      ...BOUNDARY_IDS.map(boundaryEntity),
      ...EXCLUDED_IDS.map(excludedEntity),
    ],
  });
}

const INITIAL_DOCUMENT = createDocument();
const COMMAND_JOURNAL = createCommandJournal({
  journalId: 'reference-journal:fixture',
  sessionId: 'reference-session:fixture',
  documentId: INITIAL_DOCUMENT.documentId,
  createdAt: '2026-07-25T11:00:00.000Z',
});
const REDUCER_REGISTRY = createReferenceReducerRegistry();

function structuralRequest(index, boundaryPolicy) {
  return {
    schema: 'EngineeringScopeRequest.v1',
    kind: 'STRUCTURAL',
    boundaryPolicy,
    elementBudget: 16,
    structural: { identifiers: [STRUCTURAL_GROUPS[index]] },
  };
}

function selectionRequest(index, boundaryPolicy) {
  return {
    schema: 'EngineeringScopeRequest.v1',
    kind: 'SELECTION',
    boundaryPolicy,
    elementBudget: 16,
    selection: { entityIds: SELECTION_SEED_SETS[index], closureDepth: 0 },
  };
}

function sectionalRequest(index, boundaryPolicy) {
  return {
    schema: 'EngineeringScopeRequest.v1',
    kind: 'SECTIONAL',
    boundaryPolicy,
    elementBudget: 16,
    sectional: SECTIONAL_REGIONS[index],
  };
}

export function createReferenceScopeRequest(kind = 'STRUCTURAL', boundaryPolicy = 'FROZEN', index = 0) {
  const cursor = index % 4;
  const request = kind === 'STRUCTURAL'
    ? structuralRequest(cursor, boundaryPolicy)
    : kind === 'SELECTION'
      ? selectionRequest(cursor, boundaryPolicy)
      : sectionalRequest(cursor, boundaryPolicy);
  return immutableJson(request, 'Reference scope request');
}

export function referenceDragRequest(entityId, document = INITIAL_DOCUMENT) {
  const entity = document.entities.find((entry) => entry.entityId === entityId);
  return immutableJson({
    schema: EDIT_3D_DRAG_REQUEST_V1,
    start: entity.anchor,
    maxDistance: 1000,
    constraint: { kind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE, planeNormal: [0, 0, 1] },
  }, 'Reference drag request');
}

export function referenceValidRay(entityId, document = INITIAL_DOCUMENT) {
  const [x, y, z] = document.entities.find((entry) => entry.entityId === entityId).anchor;
  return Object.freeze({ origin: Object.freeze([x, y, z + 100]), direction: Object.freeze([0.25, 0, -1]) });
}

export function createReferenceEnvelope(snapshot, commandType, payload, issuedAt, overrides = {}) {
  return createReferenceScopedEditEnvelope(snapshot, {
    commandType,
    payload,
    origin: {
      kind: overrides.originKind ?? 'SYSTEM',
      actorId: overrides.actorId ?? 'TWO-SURFACE-P2',
      issuedAt,
    },
    transactionId: overrides.transactionId ?? null,
    inverse: overrides.inverse ?? null,
  });
}


export function createReferenceRuntimeCandidate(fixture, store, options = {}) {
  const kind = options.kind ?? 'STRUCTURAL';
  const index = options.index ?? 0;
  const boundaryPolicy = options.boundaryPolicy ?? 'FROZEN';
  const issuedAt = options.issuedAt ?? '2026-07-25T13:00:00.000Z';
  const snapshot = store.getSnapshot();
  const host = store.createRuntimeHost();
  const runtime = createScopedEditRuntime({
    host,
    scopeRequest: fixture.scopeRequest(kind, boundaryPolicy, index),
    reducerRegistry: fixture.reducerRegistry,
    journalProjection: snapshot.journalProjection,
  });
  const entityId = options.entityId ?? fixture.scopeEntityId(kind, index);
  runtime.beginDrag({ entityId, dragRequest: fixture.dragRequest(entityId, snapshot.document) });
  const dragResult = runtime.solveDrag(fixture.validRay(entityId, snapshot.document));
  const commandType = options.commandType ?? REFERENCE_POSITION_SET;
  const payload = options.payload ?? { targetId: entityId, position: dragResult.point };
  const envelope = fixture.createEnvelope(snapshot, commandType, payload, issuedAt, options.envelopeOverrides);
  const targetIds = options.targetIds ?? [entityId];
  const proposal = runtime.prepareCommit({ commandName: commandType, targetIds, envelope });
  const result = proposal.status === 'REJECTED' ? proposal : runtime.commitPrepared();
  return Object.freeze({ snapshot, host, runtime, entityId, dragResult, envelope, proposal, result, issuedAt });
}

export function createScopedEditReferenceHostFixture(options = {}) {
  const initialDocument = options.initialDocument ?? INITIAL_DOCUMENT;
  const commandJournal = options.commandJournal ?? COMMAND_JOURNAL;
  const reducerRegistry = options.reducerRegistry ?? REDUCER_REGISTRY;
  const fixture = {
    referenceHostOnly: true,
    productionConsumer: false,
    initialDocument,
    commandJournal,
    reducerRegistry,
    editableIds: EDITABLE_IDS,
    boundaryIds: BOUNDARY_IDS,
    excludedIds: EXCLUDED_IDS,
    structuralGroups: STRUCTURAL_GROUPS,
    selectionSeedSets: SELECTION_SEED_SETS,
    sectionalRegions: SECTIONAL_REGIONS,
    commandTypes: Object.freeze([REFERENCE_POSITION_SET, REFERENCE_ATTRIBUTE_SET, REFERENCE_REMARK_SET]),
    createStore: () => createScopedEditReferenceStore({ initialDocument, commandJournal, reducerRegistry }),
    scopeRequest: createReferenceScopeRequest,
    scopeEntityId: (kind, index = 0) => SELECTION_SEED_SETS[index % 4][0],
    dragRequest: referenceDragRequest,
    validRay: referenceValidRay,
    createEnvelope: createReferenceEnvelope,
    createRuntimeCandidate: (store, nextOptions = {}) => createReferenceRuntimeCandidate(fixture, store, nextOptions),
  };
  return Object.freeze(fixture);
}
