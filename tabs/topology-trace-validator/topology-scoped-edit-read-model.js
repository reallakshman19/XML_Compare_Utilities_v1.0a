/** Immutable accepted-authority read model with independent producer regeneration. */
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { validateCommandJournal } from '../../contracts/command-journal.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import { sha256Text } from '../revision-compare/revision-hash.js';
import {
  TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1,
  createTopologyScopedEditAuthorityBasis,
} from './topology-scoped-edit-authority-contracts.js';
import { createTopologyScopedEditCommandScope } from './topology-scoped-edit-command-scope.js';
import {
  createTopologyReplayState,
  replayTopologyCommandJournal,
  topologyReplayStateHash,
} from './topology-command-replay.js';
import { loadTopologyProducerCore } from './topology-producer-loader.js';
import { semanticHash, semanticStringify } from './topology-validator-values.js';
import { createTopologyScopedEditJournalProjection } from './topology-scoped-edit-journal-projection.js';

export const TOPOLOGY_SCOPED_EDIT_READ_MODEL_V1 = 'TopologyScopedEditReadModel.v1';
export const TOPOLOGY_SCOPED_EDIT_SELECTION_SNAPSHOT_V1 = 'TopologyScopedEditSelectionSnapshot.v1';
export const TOPOLOGY_SCOPED_EDIT_REGENERATION_CERTIFICATION_V1 =
  'TopologyScopedEditRegenerationCertification.v1';
export const TOPOLOGY_SCOPED_EDIT_PRODUCER_PROFILE_V1 = 'TopologyReadOnlyProducerProfile.v1';
export const TOPOLOGY_SCOPED_EDIT_PRODUCER_PROFILE_ID = 'topology-read-only-default-v1';
export const TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION = Object.freeze({
  AUTHORITY_MISMATCH: 'READ_MODEL_AUTHORITY_MISMATCH',
  DOCUMENT_MISMATCH: 'READ_MODEL_DOCUMENT_MISMATCH',
  JOURNAL_MISMATCH: 'READ_MODEL_JOURNAL_MISMATCH',
  REPLAY_MISMATCH: 'READ_MODEL_REPLAY_MISMATCH',
  DRAFT_MISMATCH: 'READ_MODEL_DRAFT_MISMATCH',
  CANONICAL_MISMATCH: 'READ_MODEL_CANONICAL_MISMATCH',
  SOURCE_BASIS_MISMATCH: 'READ_MODEL_SOURCE_BASIS_MISMATCH',
  COORDINATE_MISMATCH: 'READ_MODEL_COORDINATE_MISMATCH',
  COMMAND_SCOPE_MISMATCH: 'READ_MODEL_COMMAND_SCOPE_MISMATCH',
  REGENERATION_MISMATCH: 'READ_MODEL_REGENERATION_MISMATCH',
  PRODUCER_PROFILE_MISMATCH: 'READ_MODEL_PRODUCER_PROFILE_MISMATCH',
});

function fail(code, message, Constructor = TypeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function record(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, `${label} must be an object.`);
  return value;
}
function same(left, right) { return semanticStringify(left) === semanticStringify(right); }
function normalizedUnit(value) {
  const unit = requiredContractText(value, 'Topology project unit').toLowerCase();
  if (unit !== 'mm') fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COORDINATE_MISMATCH,
    `Unsupported Topology project unit ${value}.`, RangeError);
  return 'mm';
}
function requiredProducer(core) {
  if (typeof core?.appendTopologyEditCommand !== 'function'
    || typeof core?.buildEditedComponentTopologyArtifacts !== 'function') {
    fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH,
      'Read-model certification requires the pinned pure Topology producer.');
  }
  return core;
}
async function sourceHashOf(sourceText, dependencies) {
  try { return await sha256Text(sourceText, dependencies.cryptoRef ?? globalThis.crypto); }
  catch (error) { fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.SOURCE_BASIS_MISMATCH, error.message); }
}
function fileStem(value) { return requiredContractText(value, 'project fileName').replace(/\.json$/i, ''); }
function closedProducerProfile(input, document) {
  const sourceName = requiredContractText(document.fileName, 'project fileName');
  const options = immutableJson({ sourceName, jobName: `${fileStem(sourceName)}-EDIT-DRAFT`,
    toleranceMm: 0.1, supportProjectionToleranceMm: 50, enrichmentConfig: {} },
  'Topology closed producer options');
  const profile = immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_PRODUCER_PROFILE_V1,
    profileId: TOPOLOGY_SCOPED_EDIT_PRODUCER_PROFILE_ID, optionsHash: semanticHash(options), options },
  'Topology closed producer profile');
  const hasOptions = input.producerOptions && Object.keys(input.producerOptions).length;
  const hasProfile = input.producerProfile && Object.keys(input.producerProfile).length;
  if (hasOptions && !same(input.producerOptions, options)
    || hasProfile && !same(input.producerProfile, profile)) {
    fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.PRODUCER_PROFILE_MISMATCH,
      'Caller-supplied producer options do not match the closed P3.1B producer profile.');
  }
  return profile;
}
function coordinateSystem(input, projectDocument, canonical) {
  const evidence = record(input, 'coordinateSystemEvidence',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COORDINATE_MISMATCH);
  const frame = requiredContractText(evidence.frame, 'coordinate frame');
  const authority = requiredContractText(evidence.authority, 'coordinate authority');
  const canonicalFrame = requiredContractText(canonical.coordinateFrame?.schema, 'canonical coordinate frame');
  const projectFrame = requiredContractText(projectDocument.coordinateFrame, 'project coordinate frame');
  if (frame !== canonicalFrame || (projectFrame !== 'UNKNOWN' && projectFrame !== frame)) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COORDINATE_MISMATCH,
    'Project, canonical and supplied coordinate-frame evidence disagree.');
  if (projectFrame === 'UNKNOWN' && authority !== 'CanonicalTopology.v1') fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COORDINATE_MISMATCH,
    'UNKNOWN project coordinate frame requires explicit CanonicalTopology.v1 evidence.');
  const verticalAxis = requiredContractText(projectDocument.verticalAxis, 'vertical axis').toUpperCase();
  if (!['X', 'Y', 'Z'].includes(verticalAxis) || !['left', 'right'].includes(evidence.handedness)) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COORDINATE_MISMATCH,
    'Topology vertical axis or handedness is unsupported.');
  const unit = normalizedUnit(projectDocument.unit);
  if (normalizedUnit(canonical.coordinateFrame?.unit) !== unit) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COORDINATE_MISMATCH,
    'Project and canonical coordinate units disagree.');
  return immutableJson({ unit, frame, verticalAxis, handedness: evidence.handedness, authority },
    'Topology coordinate-system evidence');
}
function validateDocument(input, journal, authority) {
  const document = record(input.projectDocument, 'projectDocument',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DOCUMENT_MISMATCH);
  const errors = validateProjectDocument(document);
  if (errors.length) fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DOCUMENT_MISMATCH,
    `Invalid ProjectDocument: ${errors.join('; ')}`);
  const documentId = requiredContractText(document.documentId, 'project documentId');
  const sourceHash = requiredContractText(document.sourceHash, 'project sourceHash');
  const sessionId = requiredContractText(input.sessionId, 'project sessionId');
  if (journal.documentId !== documentId || journal.sessionId !== sessionId
    || authority.documentId !== documentId || authority.sourceHash !== sourceHash) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DOCUMENT_MISMATCH,
    'Project, journal and Topology authority document identities disagree.');
  return { document, documentId, sourceHash, sessionId };
}
function replayEvidence(input, core, journal) {
  const baseDraft = record(input.baseDraft, 'baseDraft',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DRAFT_MISMATCH);
  const replay = replayTopologyCommandJournal(journal, baseDraft, core);
  const supplied = record(input.replayState, 'replayState',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REPLAY_MISMATCH);
  if (!same(replay, supplied)) fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REPLAY_MISMATCH,
    'Supplied replay state does not match active CommandJournal replay.');
  return { baseDraft, replay };
}
function validateDraft(input, baseDraft, replay, authority) {
  const draft = record(input.editDraft, 'editDraft', TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DRAFT_MISMATCH);
  if (draft.schema !== 'TopologyEditDraft.v1' || baseDraft.schema !== 'TopologyEditDraft.v1'
    || !same(draft, replay.draft) || draft.topologyEditDraftHash !== authority.currentDraftHash
    || baseDraft.baseCanonicalTopologyHash !== authority.baseCanonicalTopologyHash) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.DRAFT_MISMATCH,
    'Base, replayed, supplied draft and authority hashes disagree.');
  if (!same(input.attributeLedger, replay.attributeLedger) || !same(input.remarks, replay.remarks)) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REPLAY_MISMATCH,
    'Attribute ledger or remarks do not match accepted journal replay.');
  return draft;
}
function validateAuthority(input, journal, replay) {
  const supplied = record(input.authority, 'authority',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH);
  if (supplied.schema !== TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH, 'Topology authority schema is invalid.');
  const derived = createTopologyScopedEditAuthorityBasis({ documentId: supplied.documentId,
    sourceHash: supplied.sourceHash, baseCanonicalTopologyHash: supplied.baseCanonicalTopologyHash,
    currentDraftHash: replay.draft.topologyEditDraftHash, journalHash: semanticHash(journal),
    replayHash: topologyReplayStateHash(replay), activeCommandIds: journal.activeCommandIds,
    redoCommandIds: journal.redoCommandIds });
  if (!same(derived, supplied)) fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH,
    'Supplied Topology authority does not match journal and replay evidence.');
  return supplied;
}
function canonicalBasics(input, authority, documentId, sourceHash, draft) {
  const canonical = record(input.canonicalTopology, 'canonicalTopology',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.CANONICAL_MISMATCH);
  const ancestry = record(input.canonicalAncestry, 'canonicalAncestry',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.CANONICAL_MISMATCH);
  const canonicalHash = requiredContractText(canonical.canonicalTopologyHash, 'canonicalTopologyHash');
  const artifactsHash = requiredContractText(ancestry.artifactsHash, 'accepted artifactsHash');
  if (canonical.schema !== 'CanonicalTopology.v1' || ancestry.authorityId !== authority.authorityId
    || ancestry.documentId !== documentId || ancestry.sourceHash !== sourceHash
    || ancestry.draftHash !== draft.topologyEditDraftHash || ancestry.canonicalTopologyHash !== canonicalHash
    || (canonical.topologyEditDraftHash && canonical.topologyEditDraftHash !== draft.topologyEditDraftHash)) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.CANONICAL_MISMATCH,
    'Canonical topology does not match accepted authority ancestry.');
  if (canonical.sourceIdentity?.sourceHash && canonical.sourceIdentity.sourceHash !== sourceHash) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.SOURCE_BASIS_MISMATCH,
    'Canonical source identity does not match the project source hash.');
  return { canonical, ancestry, canonicalHash, artifactsHash };
}
async function certifyRegeneration(input, dependencies, core, replay, document, canonicalEvidence) {
  const sourceText = requiredContractText(input.sourceText, 'accepted Topology sourceText');
  const sourceHash = await sourceHashOf(sourceText, dependencies);
  if (sourceHash !== document.sourceHash) fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.SOURCE_BASIS_MISMATCH,
    'Exact source bytes do not match the accepted project source hash.');
  const profile = closedProducerProfile(input, document);
  let built;
  try { built = await core.buildEditedComponentTopologyArtifacts(sourceText, replay.draft, profile.options); }
  catch (error) { fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH,
    `Pinned producer regeneration failed: ${error.message}`); }
  const regenerated = record(built, 'regenerated artifacts',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
  const artifactsHash = semanticHash({ editDraft: regenerated.editDraft,
    canonicalTopology: regenerated.canonicalTopology, editLedger: regenerated.editLedger,
    editValidation: regenerated.editValidation });
  if (!same(regenerated.editDraft, replay.draft)
    || !same(regenerated.canonicalTopology, canonicalEvidence.canonical)
    || artifactsHash !== canonicalEvidence.artifactsHash) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH,
    'Accepted canonical or artifact ancestry differs from independent pinned-producer regeneration.');
  const canonicalContentHash = semanticHash(regenerated.canonicalTopology);
  if (canonicalEvidence.ancestry.canonicalContentHash
    && canonicalEvidence.ancestry.canonicalContentHash !== canonicalContentHash) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.CANONICAL_MISMATCH,
    'Declared canonical content hash differs from regenerated canonical contents.');
  const certification = immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_REGENERATION_CERTIFICATION_V1,
    sourceHash, draftHash: replay.draft.topologyEditDraftHash, canonicalTopologyHash: canonicalEvidence.canonicalHash,
    canonicalContentHash, artifactsHash, producerProfileId: profile.profileId,
    producerProfileHash: semanticHash(profile), producerOptionsHash: profile.optionsHash },
  'Topology independent regeneration certification');
  return { sourceText, producerProfile: profile, certification };
}
function commandScope(input, canonical) {
  const scopeInput = record(input.commandScopeInput, 'commandScopeInput',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COMMAND_SCOPE_MISMATCH);
  const derived = createTopologyScopedEditCommandScope({ canonical, ...scopeInput });
  if (input.commandScopeBasis && !same(input.commandScopeBasis, derived)) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.COMMAND_SCOPE_MISMATCH,
    'Supplied command scope does not recompute from current canonical authority.');
  return { basis: derived, input: scopeInput };
}
function selectionSnapshot(input, authorityId, canonical) {
  const supplied = input.selectionSnapshot ?? { authorityId, entityIds: [] };
  const ids = [...new Set((supplied.entityIds ?? []).map((value) => requiredContractText(value,
    'selection entityId')))].sort();
  const candidates = new Set(['nodes', 'edges', 'supports', 'junctions', 'boundaries', 'bends', 'pointFeatures']
    .flatMap((collection) => (canonical[collection] ?? []).map((row) => row.id)));
  if (ids.some((id) => !candidates.has(id)) || supplied.authorityId !== authorityId) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH,
    'Selection snapshot is stale or outside the accepted canonical population.');
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_SELECTION_SNAPSHOT_V1,
    authorityId, entityIds: ids }, 'Topology selection snapshot');
}
async function createWithCore(input = {}, coreInput, dependencies = {}) {
  const core = requiredProducer(coreInput);
  const journal = record(input.commandJournal, 'commandJournal',
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.JOURNAL_MISMATCH);
  const errors = validateCommandJournal(journal);
  if (errors.length) fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.JOURNAL_MISMATCH,
    `Invalid accepted CommandJournal: ${errors.join('; ')}`);
  const { baseDraft, replay } = replayEvidence(input, core, journal);
  const authority = validateAuthority(input, journal, replay);
  const identity = validateDocument(input, journal, authority);
  const draft = validateDraft(input, baseDraft, replay, authority);
  const canonical = canonicalBasics(input, authority, identity.documentId, identity.sourceHash, draft);
  const regenerated = await certifyRegeneration(input, dependencies, core, replay, identity.document, canonical);
  const coordinates = coordinateSystem(input.coordinateSystemEvidence, identity.document, canonical.canonical);
  const scope = commandScope(input, canonical.canonical);
  const journalProjection = createTopologyScopedEditJournalProjection({ authorityId: authority.authorityId,
    journal, initialState: createTopologyReplayState(baseDraft) });
  const canonicalAncestry = immutableJson({ authorityId: authority.authorityId,
    documentId: identity.documentId, sourceHash: identity.sourceHash, draftHash: draft.topologyEditDraftHash,
    canonicalTopologyHash: canonical.canonicalHash,
    canonicalContentHash: regenerated.certification.canonicalContentHash,
    artifactsHash: regenerated.certification.artifactsHash,
    producerProfileId: regenerated.producerProfile.profileId,
    producerProfileHash: regenerated.certification.producerProfileHash, producerOptionsHash: regenerated.certification.producerOptionsHash }, 'Topology canonical ancestry');
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_READ_MODEL_V1,
    authorityId: authority.authorityId, documentId: identity.documentId, sessionId: identity.sessionId,
    sourceHash: identity.sourceHash, sourceText: regenerated.sourceText,
    producerProfile: regenerated.producerProfile, producerOptions: regenerated.producerProfile.options,
    producerProfileHash: regenerated.certification.producerProfileHash, producerOptionsHash: regenerated.certification.producerOptionsHash,
    canonicalTopologyHash: canonical.canonicalHash,
    canonicalContentHash: regenerated.certification.canonicalContentHash,
    artifactsHash: regenerated.certification.artifactsHash, draftHash: draft.topologyEditDraftHash,
    journalHash: semanticHash(journal), replayHash: topologyReplayStateHash(replay),
    projectDocument: identity.document, coordinateSystem: coordinates,
    canonicalTopology: canonical.canonical, canonicalAncestry, regenerationCertification: regenerated.certification,
    baseDraft, editDraft: draft, commandJournal: journal, journalProjection, replayState: replay,
    attributeLedger: replay.attributeLedger, remarks: replay.remarks,
    commandScopeBasis: scope.basis, commandScopeInput: scope.input,
    selectionSnapshot: selectionSnapshot(input, authority.authorityId, canonical.canonical), authority,
  }, 'Topology scoped-edit read model');
}
function inputFromReadModel(readModel) {
  return { authority: readModel.authority, projectDocument: readModel.projectDocument,
    sessionId: readModel.sessionId, sourceText: readModel.sourceText,
    producerProfile: readModel.producerProfile, producerOptions: readModel.producerOptions,
    canonicalTopology: readModel.canonicalTopology, canonicalAncestry: readModel.canonicalAncestry,
    coordinateSystemEvidence: { frame: readModel.coordinateSystem.frame,
      handedness: readModel.coordinateSystem.handedness, authority: readModel.coordinateSystem.authority },
    baseDraft: readModel.baseDraft, editDraft: readModel.editDraft,
    commandJournal: readModel.commandJournal, replayState: readModel.replayState,
    attributeLedger: readModel.attributeLedger, remarks: readModel.remarks,
    commandScopeInput: readModel.commandScopeInput, commandScopeBasis: readModel.commandScopeBasis,
    selectionSnapshot: readModel.selectionSnapshot };
}
async function assertWithCore(readModel, core, dependencies = {}) {
  if (readModel?.schema !== TOPOLOGY_SCOPED_EDIT_READ_MODEL_V1) fail(
    TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH,
    `Expected ${TOPOLOGY_SCOPED_EDIT_READ_MODEL_V1}.`);
  const rebuilt = await createWithCore(inputFromReadModel(readModel), core, dependencies);
  if (!same(rebuilt, readModel)) fail(TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.AUTHORITY_MISMATCH,
    'Schema-labelled read model does not recertify to identical accepted evidence.');
  return rebuilt;
}
export async function createTopologyScopedEditReadModel(input = {}, dependencies = {}) {
  return createWithCore(input, await loadTopologyProducerCore(), dependencies);
}
export async function assertTopologyScopedEditReadModel(readModel, dependencies = {}) {
  return assertWithCore(readModel, await loadTopologyProducerCore(), dependencies);
}
export const _test = Object.freeze({ createWithCore, assertWithCore, inputFromReadModel, closedProducerProfile });
