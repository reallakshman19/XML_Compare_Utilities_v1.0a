/** Immutable, consumer-neutral reference document and snapshot contracts. */
import { validateCommandJournal } from '../../contracts/command-journal.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { validateEngineeringScene } from '../engineering-scene/engineering-contract-validation.js';
import { validateScopedEditJournalProjection } from '../scoped-edit-runtime/index.js';

export const SCOPED_EDIT_REFERENCE_DOCUMENT_V1 = 'ScopedEditReferenceDocument.v1';
export const SCOPED_EDIT_REFERENCE_SNAPSHOT_V1 = 'ScopedEditReferenceSnapshot.v1';
export const SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1 = 'ScopedEditReferenceReplayState.v1';
export const SCOPED_EDIT_REFERENCE_ACCEPTANCE_V1 = 'ScopedEditReferenceAcceptance.v1';

const DOCUMENT_KEYS = Object.freeze(['schema', 'documentId', 'revision', 'entities']);
const ENTITY_KEYS = Object.freeze([
  'entityId', 'anchor', 'attributes', 'remark', 'structuralIds', 'referenceIds',
]);
const SNAPSHOT_KEYS = Object.freeze([
  'schema', 'snapshotId', 'version', 'document', 'commandJournal', 'journalProjection',
  'replayState', 'engineeringScene', 'documentHash', 'replayHash',
]);

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  const keys = Object.keys(value).sort();
  const required = [...expected].sort();
  if (!sameJson(keys, required)) throw new TypeError(`${label} contains unsupported fields.`);
}

function safeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function finiteAnchor(value) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError('Reference entity anchor must contain exactly three finite values.');
  }
  return Object.freeze([...value]);
}

function sortedUniqueTexts(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const result = values.map((value, index) => requiredContractText(value, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return Object.freeze([...result].sort());
}

function referenceEntity(input) {
  exactKeys(input, ENTITY_KEYS, 'Reference entity');
  if (!input.attributes || typeof input.attributes !== 'object' || Array.isArray(input.attributes)) {
    throw new TypeError('Reference entity attributes must be a JSON object.');
  }
  if (input.remark !== null && typeof input.remark !== 'string') {
    throw new TypeError('Reference entity remark must be null or text.');
  }
  return immutableJson({
    entityId: requiredContractText(input.entityId, 'Reference entityId'),
    anchor: finiteAnchor(input.anchor),
    attributes: input.attributes,
    remark: input.remark,
    structuralIds: sortedUniqueTexts(input.structuralIds, 'structuralIds'),
    referenceIds: sortedUniqueTexts(input.referenceIds, 'referenceIds'),
  }, 'Reference entity');
}

function validateEntityReferences(entities) {
  const ids = new Set(entities.map((entity) => entity.entityId));
  if (ids.size !== entities.length) throw new TypeError('Reference entity IDs must be unique.');
  for (const entity of entities) {
    for (const referenceId of entity.referenceIds) {
      if (!ids.has(referenceId)) throw new RangeError(`Reference ${referenceId} does not exist.`);
    }
  }
}

export function createScopedEditReferenceDocument(input = {}) {
  exactKeys(input, DOCUMENT_KEYS, 'Reference document');
  if (input.schema !== SCOPED_EDIT_REFERENCE_DOCUMENT_V1) {
    throw new TypeError(`Reference document schema must be ${SCOPED_EDIT_REFERENCE_DOCUMENT_V1}.`);
  }
  if (!Array.isArray(input.entities)) throw new TypeError('Reference document entities must be an array.');
  const entities = input.entities.map(referenceEntity)
    .sort((left, right) => left.entityId.localeCompare(right.entityId));
  validateEntityReferences(entities);
  return immutableJson({
    schema: SCOPED_EDIT_REFERENCE_DOCUMENT_V1,
    documentId: requiredContractText(input.documentId, 'Reference documentId'),
    revision: safeInteger(input.revision, 'Reference revision'),
    entities,
  }, 'Reference document');
}

export function assertScopedEditReferenceDocument(value) {
  const canonical = createScopedEditReferenceDocument(value);
  if (!sameJson(canonical, value)) throw new TypeError('Reference document must be canonical and deterministically sorted.');
  if (!isReferenceDeeplyFrozen(value)) throw new TypeError('Reference document must be deeply immutable.');
  return value;
}

export function createReferenceInitialState(documentInput) {
  const document = assertScopedEditReferenceDocument(documentInput);
  return immutableJson({
    schema: SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1,
    documentId: document.documentId,
    revision: document.revision,
    entities: document.entities,
  }, 'Reference replay initial state');
}

export function deriveReferenceDocument(replayState) {
  if (replayState?.schema !== SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1) {
    throw new TypeError(`Replay state schema must be ${SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1}.`);
  }
  return createScopedEditReferenceDocument({
    schema: SCOPED_EDIT_REFERENCE_DOCUMENT_V1,
    documentId: replayState.documentId,
    revision: replayState.revision,
    entities: replayState.entities,
  });
}

export function canonicalReferenceJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalReferenceJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalReferenceJson(value[key])}`).join(',')}}`;
}

export function hashReferenceValue(value) {
  const text = canonicalReferenceJson(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right ^ (code + index), 0x85ebca6b) >>> 0;
  }
  const hex = (value32) => value32.toString(16).padStart(8, '0');
  return `RH1-${hex(left)}${hex(right)}`;
}

export function createReferenceSnapshotId(input) {
  return `SRS-${String(input.version).padStart(6, '0')}-${hashReferenceValue({
    version: input.version,
    documentHash: input.documentHash,
    replayHash: input.replayHash,
    journal: input.commandJournal,
  }).slice(4)}`;
}

export function isReferenceDeeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((child) => isReferenceDeeplyFrozen(child, seen));
}


function assertReplayEvidence(snapshot) {
  const replay = snapshot.replayState;
  exactKeys(replay, ['state', 'appliedCommandIds'], 'Reference replay evidence');
  if (replay.state?.schema !== SCOPED_EDIT_REFERENCE_REPLAY_STATE_V1) {
    throw new TypeError('Reference replay state schema is invalid.');
  }
  const expectedApplied = snapshot.commandJournal.entries
    .filter((entry) => snapshot.commandJournal.activeCommandIds.includes(entry.commandId))
    .map((entry) => entry.commandId);
  if (!sameJson(replay.appliedCommandIds, expectedApplied)) {
    throw new TypeError('Reference replay appliedCommandIds are inconsistent.');
  }
  if (!sameJson(deriveReferenceDocument(replay.state), snapshot.document)) {
    throw new TypeError('Reference replay state does not reconstruct the snapshot document.');
  }
}

function assertSceneEvidence(snapshot) {
  const scene = snapshot.engineeringScene;
  const hash = hashReferenceValue(snapshot.document);
  if (scene.sceneId !== `reference-scene:${hash}`) throw new TypeError('Reference sceneId is inconsistent.');
  if (scene.metadata?.sourceDocumentHash !== hash
    || scene.metadata?.sourceDocumentId !== snapshot.document.documentId
    || scene.metadata?.sourceRevision !== snapshot.document.revision) {
    throw new TypeError('Reference scene source evidence is inconsistent.');
  }
  const expected = snapshot.document.entities.map((entity, renderOrder) => ({
    id: entity.entityId,
    renderOrder,
    anchor: entity.anchor,
    attributes: entity.attributes,
    remark: entity.remark,
    structuralIds: entity.structuralIds,
    referenceIds: entity.referenceIds,
  }));
  const actual = scene.entities.map((entity) => ({
    id: entity.id,
    renderOrder: entity.renderOrder,
    anchor: entity.metadata?.authoritativeGeometry?.anchor,
    attributes: entity.metadata?.presentation?.attributes,
    remark: entity.metadata?.presentation?.remark,
    structuralIds: entity.domainRef?.structuralIds,
    referenceIds: entity.domainRef?.referenceIds,
  }));
  if (!sameJson(actual, expected)) throw new TypeError('Reference scene does not represent the snapshot document.');
}

export function assertScopedEditReferenceSnapshot(value) {
  exactKeys(value, SNAPSHOT_KEYS, 'Reference snapshot');
  if (value.schema !== SCOPED_EDIT_REFERENCE_SNAPSHOT_V1) throw new TypeError('Reference snapshot schema is invalid.');
  safeInteger(value.version, 'Reference snapshot version');
  assertScopedEditReferenceDocument(value.document);
  const journalErrors = validateCommandJournal(value.commandJournal);
  if (journalErrors.length) throw new TypeError(`Reference snapshot journal is invalid: ${journalErrors.join('; ')}`);
  const projection = validateScopedEditJournalProjection(value.journalProjection);
  if (!sameJson(projection.envelopes, value.commandJournal.entries)
    || !sameJson(projection.activeCommandIds, value.commandJournal.activeCommandIds)) {
    throw new TypeError('Reference snapshot journal projection does not represent its command journal.');
  }
  validateEngineeringScene(value.engineeringScene);
  assertReplayEvidence(value);
  assertSceneEvidence(value);
  if (value.documentHash !== hashReferenceValue(value.document)) throw new TypeError('Reference documentHash is inconsistent.');
  if (value.replayHash !== hashReferenceValue(value.replayState)) throw new TypeError('Reference replayHash is inconsistent.');
  const expectedId = createReferenceSnapshotId(value);
  if (value.snapshotId !== expectedId) throw new TypeError('Reference snapshotId is inconsistent.');
  if (!isReferenceDeeplyFrozen(value)) throw new TypeError('Reference snapshot must be deeply immutable.');
  return value;
}
