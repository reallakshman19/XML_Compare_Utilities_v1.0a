/** Headless shadow composition of the certified Topology host and shared scoped-edit runtime. */
import { appendJournalCommand } from '../../contracts/command-journal.js';
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import { EDIT_3D_CONSTRAINT_KIND, EDIT_3D_DRAG_REQUEST_V1 } from '../../core/edit-3d/index.js';
import { createDomainReducerRegistry } from '../../core/edit-journal/index.js';
import { createScopedEditRuntime } from '../../core/scoped-edit-runtime/scoped-edit-runtime.js';
import { readScopedEditEntityGeometry, readScopedEditHostContext } from '../../core/scoped-edit-runtime/scoped-edit-host.js';
import { appendAttributeEdit } from './topology-attribute-edit-ledger.js';
import { loadTopologyProducerCore } from './topology-producer-loader.js';
import {
  TOPOLOGY_JOURNAL_COMMANDS,
  replayTopologyCommandJournal,
  topologyReplayStateHash,
} from './topology-command-replay.js';
import {
  assertTopologyScopedEditReadModel,
  _test as readModelTest,
} from './topology-scoped-edit-read-model.js';
import {
  createTopologyScopedEditEffectBoundary,
  createTopologyScopedEditReadOnlyHost,
  _test as hostTest,
} from './topology-scoped-edit-read-only-host.js';
import { cleanText, objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';
import {
  TOPOLOGY_SHADOW_PARITY_MODE,
  TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH,
  assertTopologyShadowPositiveParity,
  createTopologyShadowCompatibilityEvidence,
  createTopologyShadowSideEffectEvidence,
} from './topology-scoped-edit-shadow-comparison.js';

export const TOPOLOGY_SCOPED_EDIT_SHADOW_RUNTIME_V1 = 'TopologyScopedEditShadowRuntime.v1';

function fail(code, message) {
  const error = new Error(message); error.code = code; throw error;
}

function topologyReducer(core, state, envelope) {
  const payload = objectRecord(envelope.payload);
  if (envelope.commandType === TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY) {
    const command = objectRecord(payload.nativeCommand);
    const draft = core.appendTopologyEditCommand(state.draft,
      cleanText(command.type), objectRecord(command.payload));
    const actual = objectRecord(draft.commands.at(-1));
    if (cleanText(actual.id) !== cleanText(command.id)) {
      throw new Error(`Topology replay identity mismatch: expected ${command.id}, received ${actual.id}.`);
    }
    return Object.freeze({ ...state, draft });
  }
  if (envelope.commandType === TOPOLOGY_JOURNAL_COMMANDS.ATTRIBUTE) {
    return Object.freeze({ ...state,
      attributeLedger: appendAttributeEdit(state.attributeLedger, objectRecord(payload.edit)) });
  }
  const targetId = cleanText(payload.targetId);
  if (!targetId) throw new TypeError('Remark replay requires targetId.');
  return Object.freeze({ ...state,
    remarks: Object.freeze({ ...state.remarks, [targetId]: cleanText(payload.value) }) });
}

export function createTopologyShadowReducerRegistry(core) {
  if (typeof core?.appendTopologyEditCommand !== 'function') {
    throw new TypeError('Topology shadow runtime requires the pinned pure producer core.');
  }
  const reduce = (state, envelope) => topologyReducer(core, state, envelope);
  return createDomainReducerRegistry({
    [TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY]: reduce,
    [TOPOLOGY_JOURNAL_COMMANDS.ATTRIBUTE]: reduce,
    [TOPOLOGY_JOURNAL_COMMANDS.REMARK]: reduce,
  });
}

function effectLedger(source) {
  const counts = { recoveryPersistence: 0, writerAcquisitions: 0,
    productionAcceptance: 0, controllerMutations: 0, rendererRefreshes: 0,
    selectionPublications: 0, domMounts: 0, gestureRegistrations: 0 };
  const before = semanticStringify(source);
  const increment = (name) => { counts[name] += 1; };
  const probes = Object.freeze({
    storageAccess: () => increment('recoveryPersistence'),
    recoveryAcceptance: () => increment('recoveryPersistence'),
    writerAcquisition: () => increment('writerAcquisitions'),
    productionAcceptance: () => increment('productionAcceptance'),
    controllerMutation: () => increment('controllerMutations'),
    rendererRefresh: () => increment('rendererRefreshes'),
    selectionPublication: () => increment('selectionPublications'),
  });
  return Object.freeze({ boundary: () => createTopologyScopedEditEffectBoundary(probes),
    snapshot: () => createTopologyShadowSideEffectEvidence({ ...counts,
      sourceMutations: before === semanticStringify(source) ? 0 : 1 }) });
}

function runtimeFactory(host, scopeRequest, reducerRegistry, projection) {
  return createScopedEditRuntime({ host, scopeRequest, reducerRegistry,
    journalProjection: projection });
}

async function completeComposition(input, certifiedReadModel, core, hostFactory) {
  const ledger = effectLedger(certifiedReadModel);
  const authorityProvider = input.authorityProvider ?? (() => certifiedReadModel.authorityId);
  const hostInput = { readModel: certifiedReadModel, authorityProvider };
  const directHost = await hostFactory({ ...hostInput, effects: ledger.boundary() });
  const runtimeHost = await hostFactory({ ...hostInput, effects: ledger.boundary() });
  const reducerRegistry = createTopologyShadowReducerRegistry(core);
  const scopeRequest = input.scopeRequest;
  const projection = input.journalProjection ?? certifiedReadModel.journalProjection.projection;
  const createRuntime = (nextProjection = projection, nextRequest = scopeRequest) =>
    runtimeFactory(runtimeHost, nextRequest, reducerRegistry, nextProjection);
  const context = readScopedEditHostContext(runtimeHost, scopeRequest);
  const runtime = createRuntime();
  const remount = () => completeComposition(input, certifiedReadModel, core, hostFactory);
  return Object.freeze({ schema: TOPOLOGY_SCOPED_EDIT_SHADOW_RUNTIME_V1,
    authorityId: certifiedReadModel.authorityId, readModel: certifiedReadModel,
    directHost, runtimeHost, runtime, context, reducerRegistry, scopeRequest, projection,
    createRuntime, readRuntimeGeometry: (entityId) => readScopedEditEntityGeometry(runtimeHost, entityId),
    replayCandidateJournal: (journal) => replayTopologyCommandJournal(journal, certifiedReadModel.baseDraft, core),
    sideEffects: ledger.snapshot, remount });
}

async function createPublic(input, dependencies) {
  const core = await loadTopologyProducerCore();
  const readModel = await assertTopologyScopedEditReadModel(input.readModel, dependencies);
  const factory = (hostInput) => createTopologyScopedEditReadOnlyHost(hostInput, dependencies);
  return completeComposition(input, readModel, core, factory);
}

async function createWithCore(input, core, dependencies) {
  const readModel = await readModelTest.assertWithCore(input.readModel, core, dependencies);
  const factory = (hostInput) => hostTest.createWithCore(hostInput, core, dependencies);
  return completeComposition(input, readModel, core, factory);
}

export async function createTopologyScopedEditShadowRuntime(input = {}, dependencies = {}) {
  return createPublic(input, dependencies);
}

export function createTopologyShadowDragRequest(geometry) {
  return immutableJson({ schema: EDIT_3D_DRAG_REQUEST_V1, start: geometry.anchor,
    maxDistance: 1000,
    constraint: { kind: EDIT_3D_CONSTRAINT_KIND.CAMERA_PLANE, planeNormal: [0, 0, 1] } },
  'Topology shadow drag request');
}

export function createTopologyShadowValidRay(geometry) {
  const [x, y, z] = geometry.anchor;
  return Object.freeze({ origin: Object.freeze([x, y, z + 100]),
    direction: Object.freeze([0.25, 0, -1]) });
}

function appendCandidateJournal(readModel, envelope) {
  return appendJournalCommand(readModel.commandJournal, { commandType: envelope.commandType,
    payload: envelope.payload, basis: envelope.basis, origin: envelope.origin,
    transactionId: envelope.transactionId, inverse: envelope.inverse }, envelope.origin.issuedAt);
}

function exactProjectionEvidence(projection, replay, candidateJournal, envelope, appliedCommandIds) {
  return immutableJson({ initialState: projection.initialState,
    historicalEnvelopes: projection.envelopes.slice(0, -1), newEnvelope: projection.envelopes.at(-1),
    commandId: envelope.commandId, sequence: envelope.sequence, documentId: envelope.documentId,
    sessionId: envelope.sessionId, activeCommandIds: projection.activeCommandIds,
    redoCommandIds: candidateJournal.redoCommandIds, candidateProjection: projection,
    candidateReplay: replay, appliedCommandIds: appliedCommandIds ?? candidateJournal.activeCommandIds,
    projectionHash: semanticHash(projection), candidateReplayHash: topologyReplayStateHash(replay) },
  'Topology shadow exact projection evidence');
}

function committed(result) {
  if (result?.status !== 'COMMITTED') fail(TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH,
    `Shared runtime did not commit: ${result?.rejectionCode ?? 'unknown result'}.`);
  return result;
}

export function runTopologyShadowPositiveParity(composition, input = {}) {
  const current = input.currentProjection ?? composition.projection;
  const envelope = input.envelope;
  const directDryRun = composition.directHost.dryRun(current, envelope);
  const runtime = composition.createRuntime(current, input.scopeRequest ?? composition.scopeRequest);
  const entityId = requiredContractText(input.dragEntityId, 'shadow dragEntityId');
  const geometry = composition.readRuntimeGeometry(entityId);
  runtime.beginDrag({ entityId, dragRequest: input.dragRequest ?? createTopologyShadowDragRequest(geometry) });
  runtime.solveDrag(input.ray ?? createTopologyShadowValidRay(geometry));
  const proposal = runtime.prepareCommit({ commandName: input.commandName ?? envelope.commandType,
    targetIds: input.targetIds ?? [entityId], envelope });
  const result = committed(proposal.status === 'REJECTED' ? proposal : runtime.commitPrepared());
  const candidateJournal = appendCandidateJournal(composition.readModel, envelope);
  const directReplay = composition.replayCandidateJournal(candidateJournal);
  const direct = exactProjectionEvidence(directDryRun.candidateProjection, directReplay,
    candidateJournal, envelope);
  const runtimeEvidence = exactProjectionEvidence(result.journalProjection,
    result.replayState.state, candidateJournal, envelope, result.appliedCommandIds);
  assertTopologyShadowPositiveParity(direct, runtimeEvidence);
  const compatibility = createTopologyShadowCompatibilityEvidence({
    authorityId: composition.authorityId, mode: TOPOLOGY_SHADOW_PARITY_MODE.EXACT,
    direct: { accepted: true, projectionHash: direct.projectionHash, evidence: direct },
    runtime: { accepted: true, projectionHash: runtimeEvidence.projectionHash, evidence: runtimeEvidence },
    sideEffects: composition.sideEffects(),
  });
  if (!compatibility.parity.valid) fail(TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH,
    'Authorized shadow parity produced side effects or non-identical evidence.');
  return immutableJson({ compatibility, direct: { dryRun: directDryRun, evidence: direct },
    runtime: { proposal, result, evidence: runtimeEvidence } }, 'Topology shadow positive parity result');
}

export function captureTopologyShadowOperation(action, fallbackCode = 'TOPOLOGY_SHADOW_OPERATION_REJECTED') {
  try { return immutableJson({ accepted: true, rejectionCode: null, evidence: action() },
    'Topology shadow accepted operation'); }
  catch (error) { return immutableJson({ accepted: false,
    rejectionCode: cleanText(error?.code) || fallbackCode,
    evidence: { name: error?.name ?? 'Error', message: error?.message ?? String(error) } },
  'Topology shadow rejected operation'); }
}

export function captureTopologyShadowRuntimeOperation(action, fallbackCode) {
  const captured = captureTopologyShadowOperation(action, fallbackCode);
  if (!captured.accepted || captured.evidence?.status !== 'REJECTED') return captured;
  return immutableJson({ accepted: false, rejectionCode: captured.evidence.rejectionCode,
    evidence: captured.evidence }, 'Topology shadow runtime rejection');
}

export function compareTopologyShadowRejectedOperations(composition, input = {}) {
  const direct = input.direct, runtime = input.runtime;
  const compatibility = createTopologyShadowCompatibilityEvidence({
    authorityId: composition.authorityId, mode: TOPOLOGY_SHADOW_PARITY_MODE.SEMANTIC_SAFETY,
    direct, runtime, targetClassification: input.targetClassification,
    sideEffects: composition.sideEffects(),
  });
  if (!compatibility.parity.valid) fail('TOPOLOGY_SHADOW_SEMANTIC_PARITY_MISMATCH',
    `Unsafe rejection mapping ${direct.rejectionCode} / ${runtime.rejectionCode}.`);
  return immutableJson({ compatibility, direct, runtime }, 'Topology shadow semantic rejection result');
}

export async function runTopologyShadowLifecycleParity(composition) {
  const beforeDirect = composition.directHost.scene();
  const beforeRuntime = composition.context.scene;
  const directDestroy = composition.directHost.destroy();
  const runtimeDestroy = composition.runtime.destroy();
  const runtimeHostDestroy = composition.runtimeHost.destroy();
  const remounted = await composition.remount();
  const direct = immutableJson({ authorityId: composition.authorityId,
    beforeSceneHash: semanticHash(beforeDirect), destroyed: directDestroy.destroyed,
    remountSceneHash: semanticHash(remounted.directHost.scene()),
    remountScopeHash: semanticHash(remounted.directHost.resolveScope(composition.scopeRequest)) },
  'Topology direct lifecycle evidence');
  const runtime = immutableJson({ authorityId: composition.authorityId,
    beforeSceneHash: semanticHash(beforeRuntime),
    destroyed: runtimeDestroy.status === 'DESTROYED' && runtimeHostDestroy.destroyed,
    remountSceneHash: semanticHash(remounted.context.scene),
    remountScopeHash: semanticHash(remounted.runtime.getState().scope) },
  'Topology runtime lifecycle evidence');
  assertTopologyShadowPositiveParity(direct, runtime);
  const compatibility = createTopologyShadowCompatibilityEvidence({
    authorityId: composition.authorityId, mode: TOPOLOGY_SHADOW_PARITY_MODE.EXACT,
    direct: { accepted: true, evidence: direct }, runtime: { accepted: true, evidence: runtime },
    sideEffects: composition.sideEffects() });
  if (!compatibility.parity.valid) fail(TOPOLOGY_SHADOW_POSITIVE_PARITY_MISMATCH,
    'Lifecycle shadow parity produced side effects or non-identical evidence.');
  return immutableJson({ compatibility, direct: { normalized: direct, original: directDestroy },
    runtime: { normalized: runtime, original: runtimeDestroy, host: runtimeHostDestroy } },
  'Topology shadow lifecycle parity result');
}

export const _test = Object.freeze({ createWithCore, topologyReducer, appendCandidateJournal });
