import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCommandEnvelope } from '../../contracts/command-envelope.js';
import { immutableJson } from '../../contracts/contract-values.js';
import { appendJournalCommand, undoCommandJournal } from '../../contracts/command-journal.js';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../../contracts/project-session-contracts.js';
import {
  TOPOLOGY_SCOPED_EDIT_REJECTION,
  createTopologyScopedEditAuthorityBasis,
} from '../../tabs/topology-trace-validator/topology-scoped-edit-authority-contracts.js';
import { TOPOLOGY_COMMAND_AUTHORITY_MODE } from '../../tabs/topology-trace-validator/topology-scoped-edit-command-scope.js';
import {
  TOPOLOGY_JOURNAL_COMMANDS,
  appendTopologyAttributeJournalCommand,
  appendTopologyNativeJournalCommand,
  appendTopologyRemarkJournalCommand,
  createTopologyCommandJournal,
  replayTopologyCommandJournal,
  topologyReplayStateHash,
} from '../../tabs/topology-trace-validator/topology-command-replay.js';
import { _test as readModelTest } from '../../tabs/topology-trace-validator/topology-scoped-edit-read-model.js';
import {
  createTopologyScopedEditEffectBoundary,
  _test as hostTest,
  STALE_TOPOLOGY_HOST_AUTHORITY,
  TOPOLOGY_READ_ONLY_HOST_REJECTION,
} from '../../tabs/topology-trace-validator/topology-scoped-edit-read-only-host.js';
import { TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION } from '../../tabs/topology-trace-validator/topology-scoped-edit-journal-projection.js';
import { semanticHash } from '../../tabs/topology-trace-validator/topology-validator-values.js';

export const NOW = '2026-07-26T02:00:00.000Z';
export const SOURCE_TEXT = '{"fixture":"topology-read-only"}';
const SOURCE_HASH = '8a625dc075123f96aa451ac99ea033c7e2b5dedd26c318e3be535965ea45d4a4';
const DOCUMENT_ID = `topology-document:${SOURCE_HASH.slice(0, 20)}`;
const SESSION_ID = `topology-session:${SOURCE_HASH.slice(0, 20)}`;
const BASE_HASH = 'canonical-base';
const later = (seconds) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();
const pathFor = (branch, index) => `$[${branch}].children[${index}]`;
const source = (branch, index, id) => ({ sourcePaths: [pathFor(branch, index)],
  sourceEntityIds: [`SRC-${id}`], branchIds: [`BR-${branch}`] });
const position = (index) => ({ x: index * 100, y: (index % 4) * 50, z: (index % 3) * 25 });
function node(id, index, branch) {
  return Object.freeze({ id, position: position(index), inputXmlNodeIds: [String(10000 + index * 10)],
    ...source(branch, index, id) });
}
function edge(id, fromNodeId, toNodeId, index, branch) {
  return Object.freeze({ id, fromNodeId, toNodeId, inputXmlElementIds: [`PE-${id}`],
    segmentRole: 'PIPE', sourceTypes: ['PIPE'], ...source(branch, index, id) });
}
function pointEntity(id, nodeId, index, branch, extra = {}) {
  return Object.freeze({ id, nodeId, position: position(index), ...source(branch, index, id), ...extra });
}
function canonical(version = 'A0') {
  const nodes = [node('N01', 1, 0), node('N02', 2, 0), node('N03', 3, 0), node('N04', 4, 0),
    node('N05', 5, 1), node('N06', 6, 1), node('N07', 7, 1), node('N08', 8, 1),
    node('N09', 9, 2), node('N10', 10, 2), node('N11', 11, 3), node('N12', 12, 3)];
  if (version === 'A1') nodes[1] = Object.freeze({ ...nodes[1], position: { x: 225, y: 100, z: 50 } });
  const edges = [edge('E01', 'N01', 'N02', 1, 0), edge('E02', 'N02', 'N03', 2, 0),
    edge('E03', 'N03', 'N01', 3, 0), edge('E04', 'N01', 'N03', 4, 0),
    edge('E05', 'N03', 'N05', 5, 0), edge('E06', 'N02', 'N05', 6, 0),
    edge('E07', 'N05', 'N06', 7, 1), edge('E08', 'N06', 'N07', 8, 1),
    edge('E09', 'N07', 'N08', 9, 1), edge('E10', 'N08', 'N05', 10, 1),
    edge('E11', 'N09', 'N10', 11, 2), edge('E12', 'N10', 'N11', 12, 2),
    edge('E13', 'N11', 'N12', 13, 3), edge('E14', 'N12', 'N09', 14, 3),
    edge('E15', 'N09', 'N11', 15, 2), edge('E16', 'N10', 'N12', 16, 3)];
  const supports = [pointEntity('S01', 'N02', 21, 0, { position: position(2), attachmentAuthority: 'SOURCE_PORT:P' }),
    pointEntity('S02', 'N03', 22, 0, { position: position(3), attachmentAuthority: 'SOURCE_PORT:P' }),
    pointEntity('S03', 'N06', 23, 1, { position: position(6), attachmentAuthority: 'SOURCE_PORT:P' }),
    pointEntity('S04', 'N07', 24, 1, { position: position(7), attachmentAuthority: 'SOURCE_PORT:P' }),
    pointEntity('S05', 'N09', 25, 2, { position: position(9), attachmentAuthority: 'SOURCE_PORT:P' }),
    pointEntity('S06', 'N10', 26, 2, { position: position(10), attachmentAuthority: 'SOURCE_PORT:P' })];
  const junctions = [pointEntity('J01', 'N01', 31, 0, { position: position(1), kind: 'TEE', participatingEdgeIds: ['E01', 'E03', 'E04'] }),
    pointEntity('J02', 'N06', 32, 1, { position: position(6), kind: 'TEE', participatingEdgeIds: ['E07', 'E08'] }),
    pointEntity('J03', 'N09', 33, 2, { position: position(9), kind: 'OLET', participatingEdgeIds: ['E11', 'E14', 'E15'] }),
    pointEntity('J04', 'N11', 34, 3, { position: position(11), kind: 'TEE', participatingEdgeIds: ['E12', 'E13', 'E15'] })];
  const boundaries = [pointEntity('BD01', 'N03', 41, 0, { position: position(3), relationship: 'HREF:EXTERNAL', participatingEdgeIds: ['E02', 'E03', 'E05'] }),
    pointEntity('BD02', 'N08', 42, 1, { position: position(8), relationship: 'TREF:EXTERNAL', participatingEdgeIds: ['E09', 'E10'] }),
    pointEntity('BD03', 'N10', 43, 2, { position: position(10), relationship: 'HREF:EXTERNAL', participatingEdgeIds: ['E11', 'E12', 'E16'] }),
    pointEntity('BD04', 'N12', 44, 3, { position: position(12), relationship: 'TREF:EXTERNAL', participatingEdgeIds: ['E13', 'E14', 'E16'] })];
  const bends = [pointEntity('BN01', 'N02', 51, 0, { position: position(2), edgeIds: ['E01', 'E02'] }),
    pointEntity('BN02', 'N09', 52, 2, { position: position(9), edgeIds: ['E11', 'E14'] }),
    pointEntity('BN03', 'N11', 53, 3, { position: position(11), edgeIds: ['E12', 'E13'] })];
  const points = [pointEntity('P01', 'N01', 61, 0), pointEntity('P02', 'N10', 62, 2),
    pointEntity('P03', 'N12', 63, 3)];
  if (version === 'A1') points.pop();
  return Object.freeze({ schema: 'CanonicalTopology.v1', sourceIdentity: Object.freeze({ sourceHash: SOURCE_HASH }),
    canonicalTopologyHash: `canonical-${version.toLowerCase()}`,
    coordinateFrame: Object.freeze({ schema: 'ManagedStage.XYZ.v1', unit: 'mm', axisFabrication: false }),
    nodes: Object.freeze(nodes), edges: Object.freeze(edges), supports: Object.freeze(supports),
    rigids: Object.freeze([]), junctions: Object.freeze(junctions), boundaries: Object.freeze(boundaries),
    bends: Object.freeze(bends), pointFeatures: Object.freeze(points), buildIssues: Object.freeze([]) });
}
function builtFor(draft) {
  const version = draft.commands.length > 1 ? 'A1' : 'A0';
  return Object.freeze({ editDraft: draft, canonicalTopology: canonical(version),
    editLedger: Object.freeze({ schema: 'TopologyEditLedger.v1', entries: Object.freeze([]) }),
    editValidation: Object.freeze({ schema: 'TopologyEditValidation.v1', findings: Object.freeze([]) }) });
}
export const topologyReadOnlyTestCore = Object.freeze({
  TOPOLOGY_BROWSER_CORE_CONTRACT: Object.freeze({ schema: 'TopologyBrowserCore.v1' }),
  appendTopologyEditCommand(draft, type, payload) {
    const commandType = String(type).toUpperCase();
    if (!['MOVE_NODE', 'TRANSACTION'].includes(commandType)) throw new RangeError(`Unsupported ${commandType}.`);
    const sequence = draft.nextCommandSequence;
    const command = Object.freeze({ schema: 'TopologyEditCommand.v1',
      id: `EC-${String(sequence).padStart(6, '0')}`, type: commandType, payload: structuredClone(payload) });
    const material = { ...draft, commands: Object.freeze([...draft.commands, command]),
      redoCommands: Object.freeze([]), nextCommandSequence: sequence + 1 };
    return Object.freeze({ ...material, topologyEditDraftHash: semanticHash(material) });
  },
  buildEditedComponentTopologyArtifacts(sourceText, draft) {
    if (sourceText !== SOURCE_TEXT) throw new TypeError('Unexpected fixture source text.');
    return builtFor(draft);
  },
});
function artifactsHash(built) {
  return semanticHash({ editDraft: built.editDraft, canonicalTopology: built.canonicalTopology,
    editLedger: built.editLedger, editValidation: built.editValidation });
}
function projectContext() {
  const document = createProjectDocument({ documentId: DOCUMENT_ID, slotId: 'baseline',
    fileName: 'topology.json', sourceHash: SOURCE_HASH, scopedHash: SOURCE_HASH,
    stagedSchema: 'TopologyEditSource.v1', rootShape: 'branches', unit: 'MM',
    verticalAxis: 'Y', coordinateFrame: 'UNKNOWN',
    stats: { branchCount: 4, componentCount: 48, scanned: 4, matched: 4, filtered: 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: NOW });
  const session = attachProjectDocument(createProjectSession({ sessionId: SESSION_ID, createdAt: NOW }),
    document, NOW);
  return Object.freeze({ document, session });
}
const baseDraft = Object.freeze({ schema: 'TopologyEditDraft.v1', baseCanonicalTopologyHash: BASE_HASH,
  commands: Object.freeze([]), redoCommands: Object.freeze([]), engineeringOverrides: Object.freeze({}),
  settings: Object.freeze({}), nextCommandSequence: 1, topologyEditDraftHash: 'draft-base' });
const origin = Object.freeze({ kind: 'USER', actorId: 'LOCAL_USER', issuedAt: later(1) });
function native(id, type, payload) {
  return Object.freeze({ schema: 'TopologyEditCommand.v1', id, type, payload: Object.freeze(payload) });
}
function acceptedJournal(context) {
  let journal = createTopologyCommandJournal(context, NOW);
  journal = appendTopologyNativeJournalCommand(journal, baseDraft,
    native('EC-000001', 'MOVE_NODE', { nodeId: 'N01', position: { x: 125, y: 50, z: 25 } }), origin, later(1));
  journal = appendTopologyAttributeJournalCommand(journal, baseDraft,
    { branchIndex: 0, childIndex: 0, sourcePath: pathFor(0, 0), field: 'STATUS',
      before: '', after: 'CHECKED', reason: 'fixture', fixCode: 'P31B' }, origin, later(2));
  journal = appendTopologyRemarkJournalCommand(journal, baseDraft, 'N01', 'accepted', '', origin, later(3));
  journal = appendTopologyNativeJournalCommand(journal, baseDraft,
    native('EC-000002', 'MOVE_NODE', { nodeId: 'N03', position: { x: 999, y: 0, z: 0 } }), origin, later(4));
  return undoCommandJournal(journal, later(5));
}
function authorityFor(context, journal, replay) {
  return createTopologyScopedEditAuthorityBasis({ documentId: context.document.documentId,
    sourceHash: context.document.sourceHash, baseCanonicalTopologyHash: baseDraft.baseCanonicalTopologyHash,
    currentDraftHash: replay.draft.topologyEditDraftHash, journalHash: semanticHash(journal),
    replayHash: topologyReplayStateHash(replay), activeCommandIds: journal.activeCommandIds,
    redoCommandIds: journal.redoCommandIds });
}
function exactEnvelope(journal, targetId, options = {}) {
  const nativeType = options.nativeType ?? 'MOVE_NODE';
  const payload = nativeType === 'TRANSACTION' ? { operations: options.operations }
    : { nodeId: targetId, position: options.position ?? { x: 225, y: 100, z: 50 } };
  return createCommandEnvelope({ commandId: `CJ-${String(journal.nextSequence).padStart(6, '0')}`,
    sessionId: journal.sessionId, documentId: journal.documentId, sequence: journal.nextSequence,
    commandType: options.commandType ?? TOPOLOGY_JOURNAL_COMMANDS.TOPOLOGY,
    payload: { nativeCommand: native('EC-000002', nativeType, payload) },
    basis: { documentHash: BASE_HASH, revision: 'TopologyEditDraft.v1' },
    origin: { ...origin, issuedAt: later(10) }, transactionId: null,
    inverse: { operation: 'REMOVE_NATIVE_COMMAND', nativeCommandId: 'EC-000002' } });
}
function appendAccepted(journal, envelope) {
  return appendJournalCommand(journal, { commandType: envelope.commandType, payload: envelope.payload,
    basis: envelope.basis, origin: envelope.origin, transactionId: envelope.transactionId,
    inverse: envelope.inverse }, envelope.origin.issuedAt);
}
function readModelInput(context, journal, canonicalTopology = null) {
  const replayState = replayTopologyCommandJournal(journal, baseDraft, topologyReadOnlyTestCore);
  const authority = authorityFor(context, journal, replayState), built = builtFor(replayState.draft);
  const canonicalValue = canonicalTopology ?? built.canonicalTopology;
  return immutableJson({ authority, projectDocument: context.document, sessionId: context.session.sessionId,
    sourceText: SOURCE_TEXT, producerOptions: {}, canonicalTopology: canonicalValue,
    canonicalAncestry: { authorityId: authority.authorityId, documentId: context.document.documentId,
      sourceHash: context.document.sourceHash, draftHash: replayState.draft.topologyEditDraftHash,
      canonicalTopologyHash: canonicalValue.canonicalTopologyHash, artifactsHash: artifactsHash(built) },
    coordinateSystemEvidence: { frame: 'ManagedStage.XYZ.v1', handedness: 'right',
      authority: 'CanonicalTopology.v1' }, baseDraft, editDraft: replayState.draft,
    commandJournal: journal, replayState, attributeLedger: replayState.attributeLedger,
    remarks: replayState.remarks, commandScopeInput: { authorityMode: TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED,
      editScope: { sourceBranchIndexes: [0] }, originKind: 'USER', modelWideGrant: null },
    selectionSnapshot: { authorityId: authority.authorityId, entityIds: ['N01', 'N02', 'E01', 'S01'] } },
  'Topology read-only fixture input');
}
function corruptions(projection) {
  const variants = [];
  const changed = structuredClone(projection); changed.envelopes[0].payload.nativeCommand.payload.position.x += 1; variants.push(changed);
  const removed = structuredClone(projection); removed.activeCommandIds.pop(); variants.push(removed);
  const redo = structuredClone(projection); redo.activeCommandIds.push('CJ-000004'); variants.push(redo);
  const initial = structuredClone(projection); initial.initialState.remarks = { forged: 'yes' }; variants.push(initial);
  const document = structuredClone(projection); document.envelopes[0].documentId = 'wrong-document'; variants.push(document);
  const session = structuredClone(projection); session.envelopes[0].sessionId = 'wrong-session'; variants.push(session);
  const sequence = structuredClone(projection); sequence.envelopes[0].sequence = 99; variants.push(sequence);
  return Object.freeze(variants.map(Object.freeze));
}
const PRODUCTION_FILES = Object.freeze([
  'topology-scoped-edit-read-model.js', 'topology-scoped-edit-scene-adapter.js',
  'topology-scoped-edit-scope-adapter.js', 'topology-scoped-edit-journal-projection.js',
  'topology-scoped-edit-read-only-host.js', 'topology-scoped-edit-host-conformance.js',
  'topology-scoped-edit-host-index.js',
]);
function sourceFiles() {
  return Object.freeze(Object.fromEntries(PRODUCTION_FILES.map((name) => [
    `tabs/topology-trace-validator/${name}`,
    readFileSync(new URL(`../../tabs/topology-trace-validator/${name}`, import.meta.url), 'utf8'),
  ])));
}
export async function createTopologyScopedEditReadOnlyHostFixture() {
  const context = projectContext(), journalA0 = acceptedJournal(context);
  const inputA0 = readModelInput(context, journalA0);
  const readModelA0 = await readModelTest.createWithCore(inputA0, topologyReadOnlyTestCore, { cryptoRef: webcrypto });
  const authorized = exactEnvelope(journalA0, 'N02'), journalA1 = appendAccepted(journalA0, authorized);
  const inputA1 = readModelInput(context, journalA1);
  const readModelA1 = await readModelTest.createWithCore(inputA1, topologyReadOnlyTestCore, { cryptoRef: webcrypto });
  let authorityId = readModelA0.authorityId;
  const performedEffects = { storageAccess: 0, recoveryAcceptance: 0, writerAcquisition: 0,
    controllerMutation: 0, rendererRefresh: 0, selectionPublication: 0, productionAcceptance: 0 };
  const deniedEffects = { ...performedEffects };
  let readOnlyOperations = 0;
  const effectBoundaryFactory = () => createTopologyScopedEditEffectBoundary(Object.freeze({
    readOnlyOperation: () => { readOnlyOperations += 1; },
    ...Object.fromEntries(Object.keys(deniedEffects).map((key) => [key, () => { deniedEffects[key] += 1; }])),
  }));
  const defectiveHostFactories = Object.freeze(['storageAccess', 'recoveryAcceptance', 'writerAcquisition',
    'controllerMutation', 'rendererRefresh', 'selectionPublication', 'productionAcceptance']
    .map((name) => async ({ effects }) => effects[name]()));
  return Object.freeze({ inputA0, inputA1, readModelA0, readModelA1, core: topologyReadOnlyTestCore,
    hostFactory: ({ readModel, core, authorityProvider, effects }) => hostTest.createWithCore({
      readModel, authorityProvider, effects }, core, { cryptoRef: webcrypto }),
    authorityGet: () => authorityId, authoritySet: (value) => { authorityId = value; },
    effectBoundaryFactory, defectiveHostFactories, sourceFiles: sourceFiles(), certificationDependencies: Object.freeze({ cryptoRef: webcrypto }),
    sentinelSnapshot: () => Object.freeze({ readOnlyOperation: readOnlyOperations, ...performedEffects }),
    denialSnapshot: () => Object.freeze({ ...deniedEffects }),
    selectionRequests: Object.freeze(['N01', 'N02', 'E01', 'S01'].map((id) => Object.freeze({
      schema: 'EngineeringScopeRequest.v1', kind: 'SELECTION', boundaryPolicy: 'FROZEN',
      elementBudget: 48, selection: { entityIds: [id], closureDepth: 1 } }))),
    structuralRequests: Object.freeze(['N01', 'N02', 'E01', 'S01'].map((id) => Object.freeze({
      schema: 'EngineeringScopeRequest.v1', kind: 'STRUCTURAL', boundaryPolicy: 'GHOSTED',
      elementBudget: 48, structural: { identifiers: [id] } }))),
    overflowRequest: Object.freeze({ schema: 'EngineeringScopeRequest.v1', kind: 'STRUCTURAL',
      boundaryPolicy: 'FROZEN', elementBudget: 10, structural: { identifiers: ['N01'] } }),
    sectionalRequest: Object.freeze({ schema: 'EngineeringScopeRequest.v1', kind: 'SECTIONAL',
      boundaryPolicy: 'FROZEN', elementBudget: 48,
      sectional: { kind: 'box', min: { x: 0, y: 0, z: 0 }, max: { x: 1000, y: 1000, z: 1000 } } }),
    geometryIds: Object.freeze(['N01', 'S01', 'J01', 'BD01', 'BN01', 'P01']),
    unknownGeometryId: 'MISSING-ENTITY', envelopes: Object.freeze({ authorized,
      boundary: exactEnvelope(journalA0, 'N05'), excluded: exactEnvelope(journalA0, 'N09'),
      mismatch: exactEnvelope(journalA0, 'N02', { commandType: 'ATTRIBUTE_EDIT' }),
      unsupported: exactEnvelope(journalA0, 'N02', { nativeType: 'UNSUPPORTED' }),
      mixedTransaction: exactEnvelope(journalA0, null, { nativeType: 'TRANSACTION', operations: [
        { type: 'MOVE_NODE', payload: { nodeId: 'N02', position: { x: 1, y: 2, z: 3 } } },
        { type: 'MOVE_NODE', payload: { nodeId: 'N05', position: { x: 4, y: 5, z: 6 } } },
      ] }) }), corruptedProjections: corruptions(readModelA0.journalProjection.projection),
    expectedCodes: Object.freeze({ unknownGeometry: TOPOLOGY_READ_ONLY_HOST_REJECTION.UNKNOWN_ENTITY,
      boundary: TOPOLOGY_SCOPED_EDIT_REJECTION.BOUNDARY_TARGET_NOT_EDITABLE,
      excluded: TOPOLOGY_SCOPED_EDIT_REJECTION.EXCLUDED_TARGET_NOT_EDITABLE,
      mismatch: TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.COMMAND_UNSUPPORTED,
      stale: STALE_TOPOLOGY_HOST_AUTHORITY,
      projectionCorruption: TOPOLOGY_SCOPED_EDIT_DRY_RUN_REJECTION.PROJECTION_MISMATCH,
      budget: 'TOPOLOGY_SCOPE_BUDGET_EXCEEDED',
      mixed: TOPOLOGY_SCOPED_EDIT_REJECTION.BOUNDARY_TARGET_NOT_EDITABLE,
      unsupported: TOPOLOGY_SCOPED_EDIT_REJECTION.UNSUPPORTED_COMMAND_TARGET_RESOLVER }),
  });
}
export const _test = Object.freeze({ canonical, builtFor, artifactsHash, readModelInput });
