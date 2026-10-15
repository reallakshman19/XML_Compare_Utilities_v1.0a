import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import * as pinnedCore from '../vendor/3d-converters/topology-browser-core.mjs';
import { immutableJson } from '../contracts/contract-values.js';
import { attachProjectDocument, createProjectDocument,
  createProjectSession } from '../contracts/project-session-contracts.js';
import { assertScopedEditHostContract } from '../core/scoped-edit-runtime/scoped-edit-host.js';
import { createTopologyScopedEditAuthorityBasis } from '../tabs/topology-trace-validator/topology-scoped-edit-authority-contracts.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE } from '../tabs/topology-trace-validator/topology-scoped-edit-command-scope.js';
import { createTopologyCommandJournal, replayTopologyCommandJournal,
  topologyReplayStateHash } from '../tabs/topology-trace-validator/topology-command-replay.js';
import { createTopologyScopedEditReadModel,
  TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION } from '../tabs/topology-trace-validator/topology-scoped-edit-read-model.js';
import { createTopologyScopedEditEffectBoundary,
  createTopologyScopedEditReadOnlyHost } from '../tabs/topology-trace-validator/topology-scoped-edit-read-only-host.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { createTopologyScopedEditReadOnlyHostFixture } from './fixtures/topology-scoped-edit-read-only-host-fixture.js';

const f = await createTopologyScopedEditReadOnlyHostFixture();
const host = await f.hostFactory({ readModel: f.readModelA0, core: f.core,
  authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
assert.equal(assertScopedEditHostContract(host).valid, true);
assert.strictEqual(host.scene(), host.scene());
assert(host.resolveScope(f.selectionRequests[0]).entityIds.includes('N01'));
assert.deepEqual(host.entityGeometry('N01').anchor, [125, 50, 25]);
assert.throws(() => host.entityGeometry('E01'),
  (error) => error.code === 'TOPOLOGY_HOST_GEOMETRY_UNSUPPORTED');
const before = f.sentinelSnapshot();
const candidate = host.appendEditCommand(f.readModelA0.journalProjection.projection,
  f.envelopes.authorized);
assert.equal(candidate.envelopes.at(-1).commandId, 'CJ-000005');
assert.deepEqual(f.sentinelSnapshot(), before);
const mutableFixtureModel = structuredClone(f.readModelA0);
const mutationProofHost = await f.hostFactory({ readModel: mutableFixtureModel, core: f.core,
  authorityProvider: f.authorityGet, effects: f.effectBoundaryFactory() });
const mutationProofScene = JSON.stringify(mutationProofHost.scene());
mutableFixtureModel.commandScopeBasis.editableEntityIds.length = 0;
mutableFixtureModel.commandJournal.activeCommandIds.length = 0;
mutableFixtureModel.canonicalTopology.nodes[0].position.x += 500;
assert.equal(JSON.stringify(mutationProofHost.scene()), mutationProofScene);
assert(mutationProofHost.resolveScope(f.selectionRequests[0]).entityIds.includes('N01'));
assert.equal(mutationProofHost.appendEditCommand(f.readModelA0.journalProjection.projection,
  f.envelopes.authorized).envelopes.at(-1).commandId, 'CJ-000005');

const NOW = '2026-07-26T02:00:00.000Z';
const point = (x, y, z) => ({ x, y, z });
const source = [{ name: '/PUBLIC/B1', type: 'BRANCH', attributes: { TYPE: 'BRANCH',
  NAME: '/PUBLIC/B1', OWNER: '/PUBLIC', HPOS: point(0, 0, 0), TPOS: point(2000, 0, 0) },
children: [
  { name: 'PIPE-1', type: 'PIPE', attributes: { TYPE: 'PIPE', NAME: 'PIPE-1',
    REF: '=PIPE/1', OWNER: '/PUBLIC/B1', APOS: point(0, 0, 0), LPOS: point(1000, 0, 0),
    ABORE: '50mm', LBORE: '50mm', WTHK: '3mm', ITEMTEMP1: '100', ITEMPRES1: '2',
    MTXX: 'A106 B', DTXR: 'PIPE' } },
  { name: 'PIPE-2', type: 'PIPE', attributes: { TYPE: 'PIPE', NAME: 'PIPE-2',
    REF: '=PIPE/2', OWNER: '/PUBLIC/B1', APOS: point(1000, 0, 0), LPOS: point(2000, 0, 0),
    ABORE: '50mm', LBORE: '50mm', WTHK: '3mm', ITEMTEMP1: '100', ITEMPRES1: '2',
    MTXX: 'A106 B', DTXR: 'PIPE' } },
] }];
const sourceText = JSON.stringify(source);
const producerOptions = Object.freeze({ sourceName: 'public-host-fixture.json',
  jobName: 'public-host-fixture-EDIT-DRAFT', toleranceMm: 0.1, supportProjectionToleranceMm: 50,
  enrichmentConfig: Object.freeze({}) });
const baseArtifacts = await pinnedCore.buildComponentTopologyArtifacts(sourceText, producerOptions);
const baseDraft = pinnedCore.createTopologyEditDraft(baseArtifacts.canonicalTopology,
  { projection: 'XY', snapToleranceMm: 0.1, showOriginal: true });
const sourceHash = await sha256Text(sourceText, webcrypto);
const document = createProjectDocument({ documentId: `topology-document:${sourceHash.slice(0, 20)}`,
  slotId: 'baseline', fileName: producerOptions.sourceName, sourceHash, scopedHash: sourceHash,
  stagedSchema: 'TopologyEditSource.v1', rootShape: 'branches', unit: 'MM', verticalAxis: 'Y',
  coordinateFrame: 'UNKNOWN', stats: { branchCount: 1, componentCount: 2, scanned: 1,
    matched: 1, filtered: 0 }, scope: { wildcard: '', selectedIds: [] }, createdAt: NOW });
const session = attachProjectDocument(createProjectSession({
  sessionId: `topology-session:${sourceHash.slice(0, 20)}`, createdAt: NOW }), document, NOW);
const context = Object.freeze({ document, session });
const commandJournal = createTopologyCommandJournal(context, NOW);
const replayState = replayTopologyCommandJournal(commandJournal, baseDraft, pinnedCore);
const authority = createTopologyScopedEditAuthorityBasis({ documentId: document.documentId,
  sourceHash, baseCanonicalTopologyHash: baseDraft.baseCanonicalTopologyHash,
  currentDraftHash: replayState.draft.topologyEditDraftHash,
  journalHash: semanticHash(commandJournal), replayHash: topologyReplayStateHash(replayState),
  activeCommandIds: commandJournal.activeCommandIds, redoCommandIds: commandJournal.redoCommandIds });
const regenerated = await pinnedCore.buildEditedComponentTopologyArtifacts(sourceText,
  replayState.draft, producerOptions);
const artifactsHash = semanticHash({ editDraft: regenerated.editDraft,
  canonicalTopology: regenerated.canonicalTopology, editLedger: regenerated.editLedger,
  editValidation: regenerated.editValidation });
const readModel = await createTopologyScopedEditReadModel({ authority, projectDocument: document,
  sessionId: session.sessionId, sourceText, producerOptions,
  canonicalTopology: regenerated.canonicalTopology,
  canonicalAncestry: { authorityId: authority.authorityId, documentId: document.documentId,
    sourceHash, draftHash: replayState.draft.topologyEditDraftHash,
    canonicalTopologyHash: regenerated.canonicalTopology.canonicalTopologyHash, artifactsHash },
  coordinateSystemEvidence: { frame: regenerated.canonicalTopology.coordinateFrame.schema,
    handedness: 'right', authority: 'CanonicalTopology.v1' }, baseDraft,
  editDraft: replayState.draft, commandJournal, replayState,
  attributeLedger: replayState.attributeLedger, remarks: replayState.remarks,
  commandScopeInput: { authorityMode: TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL,
    editScope: null, originKind: 'USER', modelWideGrant: null },
  selectionSnapshot: { authorityId: authority.authorityId, entityIds: [] },
}, { cryptoRef: webcrypto });
const mutablePublicModel = structuredClone(readModel);
const publicHost = await createTopologyScopedEditReadOnlyHost({ readModel: mutablePublicModel,
  authorityProvider: () => readModel.authorityId,
  effects: createTopologyScopedEditEffectBoundary() }, { cryptoRef: webcrypto });
assert.equal(assertScopedEditHostContract(publicHost).valid, true);
assert(publicHost.scene().entities.length > 0);
assert.equal(publicHost.scene().metadata.authorityId, readModel.authorityId);
assert.equal(publicHost.scene().metadata.producerOptionsHash, readModel.producerOptionsHash);
const publicSceneBefore = JSON.stringify(publicHost.scene());
mutablePublicModel.canonicalTopology.nodes[0].position.x += 1000;
mutablePublicModel.commandScopeBasis.editableEntityIds.length = 0;
assert.equal(JSON.stringify(publicHost.scene()), publicSceneBefore);
const forged = structuredClone(readModel);
forged.canonicalTopology.nodes[0].position.x += 20;
await assert.rejects(() => createTopologyScopedEditReadOnlyHost({
  readModel: immutableJson(forged, 'schema-labelled forged read model'),
  authorityProvider: () => readModel.authorityId,
  effects: createTopologyScopedEditEffectBoundary(),
}, { cryptoRef: webcrypto }),
(error) => error.code === TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.REGENERATION_MISMATCH);
const alternateProducerOptions = Object.freeze({ ...producerOptions, toleranceMm: 0.25 });
const alternateRegenerated = await pinnedCore.buildEditedComponentTopologyArtifacts(sourceText,
  replayState.draft, alternateProducerOptions);
const matchingAlternate = structuredClone(readModel);
matchingAlternate.producerOptions = structuredClone(alternateProducerOptions);
matchingAlternate.canonicalTopology = structuredClone(alternateRegenerated.canonicalTopology);
matchingAlternate.canonicalAncestry.canonicalTopologyHash = alternateRegenerated.canonicalTopology.canonicalTopologyHash;
matchingAlternate.canonicalAncestry.artifactsHash = semanticHash({ editDraft: alternateRegenerated.editDraft,
  canonicalTopology: alternateRegenerated.canonicalTopology, editLedger: alternateRegenerated.editLedger,
  editValidation: alternateRegenerated.editValidation });
await assert.rejects(() => createTopologyScopedEditReadOnlyHost({
  readModel: matchingAlternate, authorityProvider: () => readModel.authorityId,
  effects: createTopologyScopedEditEffectBoundary(),
}, { cryptoRef: webcrypto }),
(error) => error.code === TOPOLOGY_SCOPED_EDIT_READ_MODEL_REJECTION.PRODUCER_PROFILE_MISMATCH);
console.log('[PASS] public host retains immutable certified authority and closed producer profile');
