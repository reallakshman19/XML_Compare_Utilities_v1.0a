/** Immutable preservation evidence for one Validator-owned explicit bend definition. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import { asArray, cleanText, objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_BEND_DEFINITION_PRESERVATION_SCHEMA =
  'TopologyBendDefinitionPreservation.v1';
export const TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_BEND_PRESERVATION_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_BEND_PRESERVATION_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_BEND_PRESERVATION_DRAFT_INVALID',
  BEND_INVALID: 'TOPOLOGY_BEND_PRESERVATION_BEND_INVALID',
  COMMAND_INVALID: 'TOPOLOGY_BEND_PRESERVATION_COMMAND_INVALID',
  ANCESTRY_INVALID: 'TOPOLOGY_BEND_PRESERVATION_ANCESTRY_INVALID',
  EVIDENCE_INVALID: 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredText(value, label, code) {
  const result = cleanText(value);
  if (!result) fail(code, `${label} is required.`, TypeError);
  return result;
}
function finiteNumber(value, label, code) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(code, `${label} must be finite.`, TypeError);
  return number;
}
function finitePoint(value, label) {
  const source = objectRecord(value), point = {};
  for (const axis of ['x', 'y', 'z']) point[axis] = finiteNumber(source[axis], `${label}.${axis}`,
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.BEND_INVALID);
  return point;
}
function sortedUnique(values) {
  return [...new Set(asArray(values).map(cleanText).filter(Boolean))].sort();
}
function safeIdPart(value) {
  return cleanText(value).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'COMMAND';
}
function exactRecord(rows, id, label, code) {
  const record = asArray(rows).map(objectRecord).find((row) => cleanText(row.id) === id);
  if (!record) fail(code, `Canonical ${label} is unavailable: ${id}`);
  return record;
}
function branchIndex(path) {
  const match = cleanText(path).match(/^\$(?:\.(?:objects|hierarchy|branches))?\[(\d+)\]/);
  return match ? Number(match[1]) : null;
}
function sourcePaths(record) {
  return sortedUnique(record.sourcePaths);
}
function sourceEntityIds(edges) {
  return [...new Set(edges.flatMap((edge) => asArray(edge.sourceEntityIds).map(cleanText))
    .filter(Boolean))];
}
function canonicalEvidence(input) {
  const canonical = objectRecord(input.canonical);
  if (canonical.schema !== 'CanonicalTopology.v1') fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.CANONICAL_INVALID,
    'Bend preservation requires CanonicalTopology.v1.', TypeError);
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}
function draftEvidence(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.DRAFT_INVALID,
    'Bend preservation requires TopologyEditDraft.v1.', TypeError);
  const hash = requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.DRAFT_INVALID);
  return { draft, hash };
}
function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}
function activeCommand(draft, bend) {
  const ancestry = asArray(bend.editAncestry).map(cleanText).filter(Boolean);
  if (ancestry.length !== 1) fail(TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.ANCESTRY_INVALID,
    'Explicit bend must identify exactly one creating command in editAncestry.');
  const command = asArray(draft.commands).map(objectRecord)
    .find((row) => cleanText(row.id) === ancestry[0]);
  if (!command) fail(TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    `Bend creating command is not active: ${ancestry[0]}`);
  if (asArray(draft.redoCommands).some((row) => cleanText(row?.id) === ancestry[0])) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    `Bend creating command is duplicated in redo history: ${ancestry[0]}`);
  if (command.schema !== 'TopologyEditCommand.v1' || command.type !== 'ADD_BEND_DEFINITION') fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    'Bend ancestry must resolve to an active ADD_BEND_DEFINITION command.', TypeError);
  return command;
}
function replayEvidence(draft, command) {
  const activeCommandIds = asArray(draft.commands).map((row) => cleanText(row?.id)).filter(Boolean);
  const redoCommandIds = asArray(draft.redoCommands).map((row) => cleanText(row?.id)).filter(Boolean);
  return { activeCommandIds, redoCommandIds, creatingCommandIndex: activeCommandIds.indexOf(command.id),
    creatingCommandState: 'ACTIVE' };
}
function commandPayload(command) {
  const payload = objectRecord(command.payload), edgeIds = asArray(payload.edgeIds)
    .map(cleanText).filter(Boolean);
  if (edgeIds.length !== 2 || new Set(edgeIds).size !== 2) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    'ADD_BEND_DEFINITION must name exactly two distinct route arms.');
  const radiusMm = finiteNumber(payload.radiusMm, 'radiusMm',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID);
  if (!(radiusMm > 0)) fail(TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    'Bend radius must be greater than zero.');
  return { nodeId: requiredText(payload.nodeId, 'nodeId',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID),
  edgeIds, radiusMm, angleDeg: finiteNumber(payload.angleDeg, 'angleDeg',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID),
  radiusAuthority: requiredText(payload.radiusAuthority, 'radiusAuthority',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID) };
}
function routeArmEvidence(canonical, payload) {
  const edges = payload.edgeIds.map((id) => exactRecord(canonical.edges, id, 'bend arm',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.BEND_INVALID));
  const incident = asArray(canonical.edges).map(objectRecord).filter((edge) =>
    cleanText(edge.fromNodeId) === payload.nodeId || cleanText(edge.toNodeId) === payload.nodeId);
  if (incident.length !== 2 || edges.some((edge) =>
    cleanText(edge.fromNodeId) !== payload.nodeId && cleanText(edge.toNodeId) !== payload.nodeId)
    || semanticStringify(sortedUnique(incident.map((edge) => edge.id)))
      !== semanticStringify(sortedUnique(payload.edgeIds))) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.BEND_INVALID,
    'Bend command does not match exactly two current incident route arms.');
  return edges;
}
function targetEvidence(node, edges) {
  const records = [node, ...edges], paths = sortedUnique(records.flatMap(sourcePaths));
  const indexes = [...new Set(paths.map(branchIndex).filter((value) => value !== null))]
    .sort((left, right) => left - right);
  return { entityIds: sortedUnique(records.map((row) => row.id)), sourcePaths: paths,
    sourceBranchIndexes: indexes };
}
function routeArmInvariant(payload, node, edges) {
  return cleanText(node.id) === payload.nodeId && edges.length === 2
    && semanticStringify(edges.map((edge) => cleanText(edge.id)))
      === semanticStringify(payload.edgeIds)
    && edges.every((edge) => cleanText(edge.fromNodeId) === payload.nodeId
      || cleanText(edge.toNodeId) === payload.nodeId);
}
function bendInvariant(bend, command, payload, node, edges) {
  const expectedSources = sourceEntityIds(edges);
  const expectedInputXml = cleanText(edges[0].inputXmlElementIds?.[0]);
  return routeArmInvariant(payload, node, edges)
    && cleanText(bend.id) === `EDIT-BEND-${safeIdPart(command.id)}`
    && cleanText(bend.nodeId) === payload.nodeId
    && semanticStringify(sortedUnique(bend.edgeIds)) === semanticStringify(sortedUnique(payload.edgeIds))
    && semanticStringify(finitePoint(bend.position, 'bend.position'))
      === semanticStringify(finitePoint(node.position, 'node.position'))
    && Number(bend.radiusMm) === payload.radiusMm && Number(bend.angleDeg) === payload.angleDeg
    && cleanText(bend.radiusAuthority) === payload.radiusAuthority
    && semanticStringify(asArray(bend.editAncestry).map(cleanText)) === semanticStringify([command.id])
    && expectedSources.length > 0
    && semanticStringify(asArray(bend.sourceEntityIds).map(cleanText))
      === semanticStringify(expectedSources)
    && expectedInputXml && cleanText(bend.inputXmlElementId) === expectedInputXml;
}
function material(input, canonical, draft, authority, bend, command, payload, node, edges) {
  return { schema: TOPOLOGY_BEND_DEFINITION_PRESERVATION_SCHEMA, createdAt: input.createdAt,
    validatorAuthority: { canonicalTopologyHash: canonical.hash,
      topologyEditDraftHash: draft.hash, commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName },
    activeCommand: { commandId: command.id, canonicalRecord: command, payload },
    draftReplayEvidence: replayEvidence(draft.draft, command),
    bendDefinition: { bendId: bend.id, canonicalRecord: bend },
    bendNode: { nodeId: node.id, position: finitePoint(node.position, 'node.position'),
      canonicalRecord: node },
    routeArms: edges.map((edge, index) => ({ order: index, edgeId: edge.id,
      canonicalRecord: edge })),
    targetEvidence: targetEvidence(node, edges),
    preservation: { commandType: 'ADD_BEND_DEFINITION', authorityOwner: 'TOPOLOGY_VALIDATOR',
      disposition: 'VALIDATOR_ONLY_OPERATION', coverage: 'PRESERVED_SEPARATELY',
      completedGate: 'SSK-TTV-CONV-8', replayState: 'ACTIVE_DRAFT_COMMAND',
      exportDisposition: 'DEDICATED_IMMUTABLE_EVIDENCE', candidateSequentialOperation: null,
      sequentialPublicationState: 'NOT_APPLICABLE' } };
}
function authorityInvariant(value) {
  const authority = objectRecord(value.validatorAuthority);
  return ['canonicalTopologyHash', 'topologyEditDraftHash', 'commandAuthorityId',
    'projectDocumentId', 'fileName'].every((key) => Boolean(cleanText(authority[key])))
    && /^[a-f0-9]{64}$/i.test(cleanText(authority.sourceHash))
    && /^[a-f0-9]{64}$/i.test(cleanText(authority.scopedHash));
}
function replayInvariant(value, command) {
  const replay = objectRecord(value.draftReplayEvidence);
  const active = asArray(replay.activeCommandIds).map(cleanText).filter(Boolean);
  const redo = asArray(replay.redoCommandIds).map(cleanText).filter(Boolean);
  return active.filter((id) => id === command.id).length === 1 && !redo.includes(command.id)
    && replay.creatingCommandIndex === active.indexOf(command.id)
    && replay.creatingCommandState === 'ACTIVE';
}
function evidenceInvariant(value) {
  try {
    const command = objectRecord(value.activeCommand?.canonicalRecord);
    const payload = commandPayload(command), bend = objectRecord(value.bendDefinition?.canonicalRecord);
    const node = objectRecord(value.bendNode?.canonicalRecord);
    const edges = asArray(value.routeArms).map((row) => objectRecord(row?.canonicalRecord));
    const target = targetEvidence(node, edges);
    return authorityInvariant(value) && replayInvariant(value, command)
      && value.activeCommand?.commandId === command.id
      && semanticStringify(value.activeCommand?.payload) === semanticStringify(payload)
      && value.bendDefinition?.bendId === bend.id && value.bendNode?.nodeId === node.id
      && semanticStringify(value.bendNode?.position) === semanticStringify(finitePoint(node.position, 'node.position'))
      && edges.length === 2 && edges.every((edge, index) => value.routeArms[index]?.edgeId === edge.id
        && value.routeArms[index]?.order === index)
      && bendInvariant(bend, command, payload, node, edges)
      && semanticStringify(value.targetEvidence) === semanticStringify(target);
  } catch { return false; }
}
function preservationInvariant(value) {
  const state = value.preservation;
  return state?.commandType === 'ADD_BEND_DEFINITION'
    && state?.authorityOwner === 'TOPOLOGY_VALIDATOR'
    && state?.disposition === 'VALIDATOR_ONLY_OPERATION'
    && state?.coverage === 'PRESERVED_SEPARATELY'
    && state?.completedGate === 'SSK-TTV-CONV-8'
    && state?.replayState === 'ACTIVE_DRAFT_COMMAND'
    && state?.exportDisposition === 'DEDICATED_IMMUTABLE_EVIDENCE'
    && state?.candidateSequentialOperation === null
    && state?.sequentialPublicationState === 'NOT_APPLICABLE';
}
export function createTopologyBendDefinitionPreservation(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input), draft = draftEvidence(input), authority = authorityEvidence(input);
  const bendId = requiredText(input.bendId, 'bendId',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.BEND_INVALID);
  const bend = exactRecord(canonical.canonical.bends, bendId, 'bend',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.BEND_INVALID);
  const command = activeCommand(draft.draft, bend), payload = commandPayload(command);
  const node = exactRecord(canonical.canonical.nodes, payload.nodeId, 'bend node',
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.BEND_INVALID);
  const edges = routeArmEvidence(canonical.canonical, payload);
  if (!bendInvariant(bend, command, payload, node, edges)) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.ANCESTRY_INVALID,
    'Canonical bend differs from its active command, route arms or source ancestry.');
  const base = material(input, canonical, draft, authority, bend, command, payload, node, edges);
  return immutableJson({ ...base, preservationFingerprint: semanticHash(base) },
    'Topology bend definition preservation evidence');
}
export function assertTopologyBendDefinitionPreservation(value) {
  if (value?.schema !== TOPOLOGY_BEND_DEFINITION_PRESERVATION_SCHEMA) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.EVIDENCE_INVALID,
    `Bend preservation must use ${TOPOLOGY_BEND_DEFINITION_PRESERVATION_SCHEMA}.`, TypeError);
  const materialValue = { ...value }; delete materialValue.preservationFingerprint;
  immutableJson(value, 'Bend preservation evidence');
  if (!isIsoTimestamp(value.createdAt) || value.preservationFingerprint !== semanticHash(materialValue)
    || !evidenceInvariant(value) || !preservationInvariant(value)) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.EVIDENCE_INVALID,
    'Bend preservation differs from immutable Validator authority evidence.');
  return value;
}
export function validateTopologyBendDefinitionPreservation(value, input = {}) {
  const evidence = assertTopologyBendDefinitionPreservation(value);
  const rebuilt = createTopologyBendDefinitionPreservation(input);
  if (semanticStringify(evidence) !== semanticStringify(rebuilt)) fail(
    TOPOLOGY_BEND_DEFINITION_PRESERVATION_REJECTION.EVIDENCE_INVALID,
    'Bend preservation differs from current canonical regeneration.');
  return rebuilt;
}
export function topologyBendDefinitionPreservationFileName(value, sourceStem = 'topology') {
  const evidence = assertTopologyBendDefinitionPreservation(value);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const bend = cleanText(evidence.bendDefinition.bendId).replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${bend}.topology-bend-definition-preservation.v1.json`;
}
