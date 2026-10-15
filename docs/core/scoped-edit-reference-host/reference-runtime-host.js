/** Pure reference implementation of the existing scoped-edit host seam. */
import { validateCommandEnvelope } from '../../contracts/command-envelope.js';
import { appendJournalCommand } from '../../contracts/command-journal.js';
import { resolveEngineeringScope } from '../engineering-scope/index.js';
import {
  SCOPED_EDIT_ENTITY_GEOMETRY_V1,
  validateScopedEditEntityGeometry,
  validateScopedEditJournalProjection,
} from '../scoped-edit-runtime/index.js';
import {
  certifyScopedEditReferenceSnapshot,
  projectReferenceJournal,
} from './reference-journal-adapter.js';

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function structuralResolver(scene, material) {
  const identifiers = new Set(material.identifiers);
  return scene.entities
    .filter((entity) => entity.domainRef.structuralIds.some((id) => identifiers.has(id)))
    .map((entity) => entity.id);
}

function referencesOf(entity) {
  return entity.domainRef.referenceIds;
}

function boundsOf(entity) {
  const [x, y, z] = entity.metadata.authoritativeGeometry.anchor;
  const half = 0.5;
  return {
    min: { x: x - half, y: y - half, z: z - half },
    max: { x: x + half, y: y + half, z: z + half },
  };
}

function assertProjection(snapshot, input) {
  const projection = validateScopedEditJournalProjection(input);
  if (!sameJson(projection, snapshot.journalProjection)) {
    throw new TypeError('Current projection does not match the reference host snapshot.');
  }
  return projection;
}

function assertEnvelopeIdentity(snapshot, envelope) {
  const errors = validateCommandEnvelope(envelope);
  if (errors.length) throw new TypeError(`Invalid reference command envelope: ${errors.join('; ')}`);
  const journal = snapshot.commandJournal;
  const expectedId = `CJ-${String(journal.nextSequence).padStart(6, '0')}`;
  if (envelope.commandId !== expectedId) throw new TypeError(`Reference commandId must be ${expectedId}.`);
  if (envelope.sequence !== journal.nextSequence) throw new TypeError('Reference command sequence is not canonical.');
  if (envelope.sessionId !== journal.sessionId) throw new TypeError('Reference command sessionId is invalid.');
  if (envelope.documentId !== journal.documentId) throw new TypeError('Reference command documentId is invalid.');
  return envelope;
}

export function createReferenceScopeAdapters() {
  return Object.freeze({ resolveStructural: structuralResolver, referencesOf, boundsOf });
}

export function createScopedEditReferenceRuntimeHost(snapshotInput, options = {}) {
  const snapshot = certifyScopedEditReferenceSnapshot(snapshotInput, options);
  const entityMap = new Map(snapshot.document.entities.map((entity) => [entity.entityId, entity]));
  const scopeAdapters = createReferenceScopeAdapters();

  function scene() {
    return snapshot.engineeringScene;
  }

  function resolveScope(request) {
    return resolveEngineeringScope(snapshot.engineeringScene, request, scopeAdapters);
  }

  function entityGeometry(entityId) {
    const entity = entityMap.get(entityId);
    if (!entity) throw new RangeError(`Reference entity ${entityId} does not exist.`);
    return validateScopedEditEntityGeometry({
      schema: SCOPED_EDIT_ENTITY_GEOMETRY_V1,
      entityId,
      anchor: entity.anchor,
    });
  }

  function appendEditCommand(currentProjection, envelopeInput) {
    assertProjection(snapshot, currentProjection);
    const envelope = assertEnvelopeIdentity(snapshot, envelopeInput);
    const candidateJournal = appendJournalCommand(
      snapshot.commandJournal,
      envelope,
      envelope.origin.issuedAt,
    );
    return projectReferenceJournal({
      initialState: snapshot.journalProjection.initialState,
      commandJournal: candidateJournal,
    });
  }

  return Object.freeze({ scene, resolveScope, entityGeometry, appendEditCommand });
}
