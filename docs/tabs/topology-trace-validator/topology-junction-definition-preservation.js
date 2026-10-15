/** Immutable preservation evidence for one Validator-owned explicit junction definition. */
import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateProjectDocument } from '../../contracts/project-session-contracts.js';
import { asArray, cleanText, objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_SCHEMA =
  'TopologyJunctionDefinitionPreservation.v1';
export const TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION = Object.freeze({
  AUTHORITY_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_AUTHORITY_INVALID',
  CANONICAL_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_CANONICAL_INVALID',
  DRAFT_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_DRAFT_INVALID',
  JUNCTION_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_JUNCTION_INVALID',
  COMMAND_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_COMMAND_INVALID',
  ANCESTRY_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_ANCESTRY_INVALID',
  EVIDENCE_INVALID: 'TOPOLOGY_JUNCTION_PRESERVATION_EVIDENCE_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
function requiredText(value, label, code) {
  const result = cleanText(value);
  if (!result) fail(code, `${label} is required.`, TypeError);
  return result;
}
function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.JUNCTION_INVALID,
    `${label} must be finite.`, TypeError);
  return number;
}
function finitePoint(value, label) {
  const source = objectRecord(value), point = {};
  for (const axis of ['x', 'y', 'z']) point[axis] = finiteNumber(source[axis], `${label}.${axis}`);
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
function sourcePaths(record) { return sortedUnique(record.sourcePaths); }
function sourceEntityIds(edges) {
  return sortedUnique(edges.flatMap((edge) => asArray(edge.sourceEntityIds)));
}
function inputXmlElementIds(record) {
  return sortedUnique([...asArray(record.inputXmlElementIds), record.inputXmlElementId]);
}
function routeInputXmlElementIds(edges) {
  return sortedUnique(edges.flatMap(inputXmlElementIds));
}
function canonicalEvidence(input) {
  const canonical = objectRecord(input.canonical);
  if (canonical.schema !== 'CanonicalTopology.v1') fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.CANONICAL_INVALID,
    'Junction preservation requires CanonicalTopology.v1.', TypeError);
  const hash = requiredText(canonical.canonicalTopologyHash, 'canonicalTopologyHash',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.CANONICAL_INVALID);
  return { canonical, hash };
}
function draftEvidence(input) {
  const draft = objectRecord(input.draft);
  if (draft.schema !== 'TopologyEditDraft.v1') fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.DRAFT_INVALID,
    'Junction preservation requires TopologyEditDraft.v1.', TypeError);
  const hash = requiredText(draft.topologyEditDraftHash, 'topologyEditDraftHash',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.DRAFT_INVALID);
  return { draft, hash };
}
function authorityEvidence(input) {
  const authorityId = requiredText(input.commandAuthority?.authorityId,
    'commandAuthority.authorityId',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.AUTHORITY_INVALID);
  const errors = validateProjectDocument(input.projectDocument);
  if (errors.length) fail(TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.AUTHORITY_INVALID,
    `Project document is invalid: ${errors.join('; ')}`, TypeError);
  return { authorityId, projectDocument: input.projectDocument };
}
function activeCommand(draft, junction) {
  const ancestry = asArray(junction.editAncestry).map(cleanText).filter(Boolean);
  if (ancestry.length !== 1) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.ANCESTRY_INVALID,
    'Explicit junction must identify exactly one creating command in editAncestry.');
  const command = asArray(draft.commands).map(objectRecord)
    .find((row) => cleanText(row.id) === ancestry[0]);
  if (!command) fail(TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    `Junction creating command is not active: ${ancestry[0]}`);
  if (asArray(draft.redoCommands).some((row) => cleanText(row?.id) === ancestry[0])) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    `Junction creating command is duplicated in redo history: ${ancestry[0]}`);
  if (command.schema !== 'TopologyEditCommand.v1'
    || command.type !== 'ADD_JUNCTION_DEFINITION') fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    'Junction ancestry must resolve to an active ADD_JUNCTION_DEFINITION command.', TypeError);
  return command;
}
function replayEvidence(draft, command) {
  const activeCommandIds = asArray(draft.commands).map((row) => cleanText(row?.id)).filter(Boolean);
  const redoCommandIds = asArray(draft.redoCommands).map((row) => cleanText(row?.id)).filter(Boolean);
  return { activeCommandIds, redoCommandIds, creatingCommandIndex: activeCommandIds.indexOf(command.id),
    creatingCommandState: 'ACTIVE' };
}
function commandPayload(command) {
  const payload = objectRecord(command.payload), edgeIds = sortedUnique(payload.edgeIds);
  if (edgeIds.length < 3 || edgeIds.length !== asArray(payload.edgeIds).length) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID,
    'ADD_JUNCTION_DEFINITION must name at least three distinct route arms.');
  return { nodeId: requiredText(payload.nodeId, 'nodeId',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.COMMAND_INVALID), edgeIds };
}
function routeArmEvidence(canonical, payload) {
  const edges = payload.edgeIds.map((id) => exactRecord(canonical.edges, id, 'junction arm',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.JUNCTION_INVALID));
  const incident = asArray(canonical.edges).map(objectRecord).filter((edge) =>
    cleanText(edge.fromNodeId) === payload.nodeId || cleanText(edge.toNodeId) === payload.nodeId);
  if (incident.length < 3 || edges.some((edge) =>
    cleanText(edge.fromNodeId) !== payload.nodeId && cleanText(edge.toNodeId) !== payload.nodeId)
    || semanticStringify(sortedUnique(incident.map((edge) => edge.id)))
      !== semanticStringify(payload.edgeIds)) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.JUNCTION_INVALID,
    'Junction command does not match the complete current incident route-arm set.');
  return edges;
}
function targetEvidence(node, edges) {
  const records = [node, ...edges], paths = sortedUnique(records.flatMap(sourcePaths));
  const indexes = [...new Set(paths.map(branchIndex).filter((value) => value !== null))]
    .sort((left, right) => left - right);
  return { entityIds: sortedUnique(records.map((row) => row.id)), sourcePaths: paths,
    sourceBranchIndexes: indexes, sourceEntityIds: sourceEntityIds(edges),
    inputXmlElementIds: routeInputXmlElementIds(edges) };
}
function routeArmInvariant(payload, node, edges) {
  return cleanText(node.id) === payload.nodeId && edges.length >= 3
    && semanticStringify(edges.map((edge) => cleanText(edge.id)).sort())
      === semanticStringify(payload.edgeIds)
    && edges.every((edge) => cleanText(edge.fromNodeId) === payload.nodeId
      || cleanText(edge.toNodeId) === payload.nodeId);
}
function junctionInvariant(junction, command, payload, node, edges) {
  const expectedSources = sourceEntityIds(edges), expectedInputXml = routeInputXmlElementIds(edges);
  return routeArmInvariant(payload, node, edges)
    && cleanText(junction.id) === `EDIT-JUNCTION-${safeIdPart(command.id)}`
    && cleanText(junction.nodeId) === payload.nodeId
    && semanticStringify(sortedUnique(junction.edgeIds)) === semanticStringify(payload.edgeIds)
    && semanticStringify(finitePoint(junction.position, 'junction.position'))
      === semanticStringify(finitePoint(node.position, 'node.position'))
    && semanticStringify(asArray(junction.editAncestry).map(cleanText))
      === semanticStringify([command.id])
    && expectedSources.length > 0
    && semanticStringify(sortedUnique(junction.sourceEntityIds))
      === semanticStringify(expectedSources)
    && expectedInputXml.length > 0
    && semanticStringify(inputXmlElementIds(junction)) === semanticStringify(expectedInputXml);
}
function material(input, canonical, draft, authority, junction, command, payload, node, edges) {
  return { schema: TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_SCHEMA, createdAt: input.createdAt,
    validatorAuthority: { canonicalTopologyHash: canonical.hash,
      topologyEditDraftHash: draft.hash, commandAuthorityId: authority.authorityId,
      projectDocumentId: authority.projectDocument.documentId,
      sourceHash: authority.projectDocument.sourceHash,
      scopedHash: authority.projectDocument.scopedHash,
      fileName: authority.projectDocument.fileName },
    activeCommand: { commandId: command.id, canonicalRecord: command, payload },
    draftReplayEvidence: replayEvidence(draft.draft, command),
    junctionDefinition: { junctionId: junction.id, canonicalRecord: junction },
    junctionNode: { nodeId: node.id, position: finitePoint(node.position, 'node.position'),
      canonicalRecord: node },
    routeArms: edges.map((edge, index) => ({ order: index, edgeId: edge.id,
      canonicalRecord: edge })),
    targetEvidence: targetEvidence(node, edges),
    preservation: { commandType: 'ADD_JUNCTION_DEFINITION', authorityOwner: 'TOPOLOGY_VALIDATOR',
      disposition: 'VALIDATOR_ONLY_OPERATION', coverage: 'PRESERVED_SEPARATELY',
      completedGate: 'SSK-TTV-CONV-9', replayState: 'ACTIVE_DRAFT_COMMAND',
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
    const payload = commandPayload(command);
    const junction = objectRecord(value.junctionDefinition?.canonicalRecord);
    const node = objectRecord(value.junctionNode?.canonicalRecord);
    const edges = asArray(value.routeArms).map((row) => objectRecord(row?.canonicalRecord));
    return authorityInvariant(value) && replayInvariant(value, command)
      && value.activeCommand?.commandId === command.id
      && semanticStringify(value.activeCommand?.payload) === semanticStringify(payload)
      && value.junctionDefinition?.junctionId === junction.id
      && value.junctionNode?.nodeId === node.id
      && semanticStringify(value.junctionNode?.position)
        === semanticStringify(finitePoint(node.position, 'node.position'))
      && edges.length === payload.edgeIds.length
      && edges.every((edge, index) => value.routeArms[index]?.edgeId === edge.id
        && value.routeArms[index]?.order === index)
      && junctionInvariant(junction, command, payload, node, edges)
      && semanticStringify(value.targetEvidence) === semanticStringify(targetEvidence(node, edges));
  } catch { return false; }
}
function preservationInvariant(value) {
  const state = value.preservation;
  return state?.commandType === 'ADD_JUNCTION_DEFINITION'
    && state?.authorityOwner === 'TOPOLOGY_VALIDATOR'
    && state?.disposition === 'VALIDATOR_ONLY_OPERATION'
    && state?.coverage === 'PRESERVED_SEPARATELY'
    && state?.completedGate === 'SSK-TTV-CONV-9'
    && state?.replayState === 'ACTIVE_DRAFT_COMMAND'
    && state?.exportDisposition === 'DEDICATED_IMMUTABLE_EVIDENCE'
    && state?.candidateSequentialOperation === null
    && state?.sequentialPublicationState === 'NOT_APPLICABLE';
}
export function createTopologyJunctionDefinitionPreservation(input = {}) {
  if (!isIsoTimestamp(input.createdAt)) throw new TypeError('createdAt must be an exact ISO timestamp.');
  const canonical = canonicalEvidence(input), draft = draftEvidence(input), authority = authorityEvidence(input);
  const junctionId = requiredText(input.junctionId, 'junctionId',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.JUNCTION_INVALID);
  const junction = exactRecord(canonical.canonical.junctions, junctionId, 'junction',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.JUNCTION_INVALID);
  const command = activeCommand(draft.draft, junction), payload = commandPayload(command);
  const node = exactRecord(canonical.canonical.nodes, payload.nodeId, 'junction node',
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.JUNCTION_INVALID);
  const edges = routeArmEvidence(canonical.canonical, payload);
  if (!junctionInvariant(junction, command, payload, node, edges)) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.ANCESTRY_INVALID,
    'Canonical junction differs from its active command, route arms or source ancestry.');
  const base = material(input, canonical, draft, authority, junction, command, payload, node, edges);
  return immutableJson({ ...base, preservationFingerprint: semanticHash(base) },
    'Topology junction definition preservation evidence');
}
export function assertTopologyJunctionDefinitionPreservation(value) {
  if (value?.schema !== TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_SCHEMA) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.EVIDENCE_INVALID,
    `Junction preservation must use ${TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_SCHEMA}.`, TypeError);
  const materialValue = { ...value }; delete materialValue.preservationFingerprint;
  immutableJson(value, 'Junction preservation evidence');
  if (!isIsoTimestamp(value.createdAt) || value.preservationFingerprint !== semanticHash(materialValue)
    || !evidenceInvariant(value) || !preservationInvariant(value)) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.EVIDENCE_INVALID,
    'Junction preservation differs from immutable Validator authority evidence.');
  return value;
}
export function validateTopologyJunctionDefinitionPreservation(value, input = {}) {
  const evidence = assertTopologyJunctionDefinitionPreservation(value);
  const rebuilt = createTopologyJunctionDefinitionPreservation(input);
  if (semanticStringify(evidence) !== semanticStringify(rebuilt)) fail(
    TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_REJECTION.EVIDENCE_INVALID,
    'Junction preservation differs from current canonical regeneration.');
  return rebuilt;
}
export function topologyJunctionDefinitionPreservationFileName(value, sourceStem = 'topology') {
  const evidence = assertTopologyJunctionDefinitionPreservation(value);
  const stem = cleanText(sourceStem).replace(/\.[^.]+$/, '') || 'topology';
  const junction = cleanText(evidence.junctionDefinition.junctionId).replace(/[^a-z0-9_-]+/gi, '-');
  return `${stem}.${junction}.topology-junction-definition-preservation.v1.json`;
}
