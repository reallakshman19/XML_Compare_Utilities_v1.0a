import {
  PIPELINE_GRE_CAESAR_BEND_TOPOLOGY_MAPPING_SCHEMA,
  PIPELINE_GRE_CAESAR_COMPATIBILITY,
  PIPELINE_GRE_CAESAR_TOPOLOGY_MODES,
  clonePipelineGreCaesarQualificationValue as clone,
  createPipelineGreCaesarBendTopologyMappingRecord,
  createPipelineGreCaesarDiagnostic as diagnostic,
  safePipelineGreCaesarQualificationInput as safe,
} from './pipeline-3d-model-gre-caesar-qualification-contracts.js';

export { PIPELINE_GRE_CAESAR_BEND_TOPOLOGY_MAPPING_SCHEMA };

const text = (value) => typeof value === 'string' ? value.trim() : '';
const requiredRoles = Object.freeze(['enteringElementFromRole', 'enteringElementToRole',
  'leavingElementFromRole', 'leavingElementToRole', 'nearPointRole', 'farPointRole',
  'sharedLogicalNodeRole', 'inactiveCornerDisposition', 'incomingTangencyDisposition',
  'outgoingTangencyDisposition', 'continuityRequirement']);
const sessionFields = Object.freeze(['caesarVersion', 'caesarBuild', 'unitFileId', 'unitFileSha256',
  'sourceCommitSha', 'pipingCodeId', 'pipingCodeName', 'pipingCodeEdition', 'laminateClassification']);
const roleProfiles = Object.freeze({
  TANGENCY_SEPARATED_BRIDGE: Object.freeze({ enteringElementFromRole: 'UPSTREAM_ROUTE_NODE',
    enteringElementToRole: 'INCOMING_TANGENCY', leavingElementFromRole: 'OUTGOING_TANGENCY',
    leavingElementToRole: 'DOWNSTREAM_ROUTE_NODE', nearPointRole: 'INCOMING_TANGENCY',
    farPointRole: 'OUTGOING_TANGENCY', sharedLogicalNodeRole: 'NONE',
    inactiveCornerDisposition: 'NOT_SERIALIZED', incomingTangencyDisposition: 'ENTERING_ELEMENT_TO',
    outgoingTangencyDisposition: 'LEAVING_ELEMENT_FROM',
    continuityRequirement: 'BEND_BRIDGES_DISTINCT_TANGENCIES' }),
  CONSECUTIVE_SHARED_LOGICAL_NODE: Object.freeze({ enteringElementFromRole: 'UPSTREAM_ROUTE_NODE',
    enteringElementToRole: 'CAESAR_LOGICAL_BEND_NODE', leavingElementFromRole: 'CAESAR_LOGICAL_BEND_NODE',
    leavingElementToRole: 'DOWNSTREAM_ROUTE_NODE', nearPointRole: 'CAESAR_DERIVED_NEAR_POINT',
    farPointRole: 'CAESAR_LOGICAL_BEND_NODE', sharedLogicalNodeRole: 'ENTERING_TO_AND_LEAVING_FROM',
    inactiveCornerDisposition: 'NOT_SERIALIZED', incomingTangencyDisposition: 'CAESAR_DERIVED_NEAR_POINT',
    outgoingTangencyDisposition: 'CAESAR_FAR_POINT', continuityRequirement: 'ENTERING_TO_EQUALS_LEAVING_FROM' }),
  CAESAR_FAR_POINT_SHARED_NODE: Object.freeze({ enteringElementFromRole: 'UPSTREAM_ROUTE_NODE',
    enteringElementToRole: 'CAESAR_FAR_POINT', leavingElementFromRole: 'CAESAR_FAR_POINT',
    leavingElementToRole: 'DOWNSTREAM_ROUTE_NODE', nearPointRole: 'CAESAR_DERIVED_NEAR_POINT',
    farPointRole: 'CAESAR_FAR_POINT', sharedLogicalNodeRole: 'ENTERING_TO_AND_LEAVING_FROM',
    inactiveCornerDisposition: 'NOT_SERIALIZED', incomingTangencyDisposition: 'CAESAR_DERIVED_NEAR_POINT',
    outgoingTangencyDisposition: 'CAESAR_FAR_POINT', continuityRequirement: 'ENTERING_TO_EQUALS_LEAVING_FROM' }),
});

function acceptedRoundTrip(fixture) {
  return fixture?.ready === true && fixture.importEvidence?.result === 'ACCEPTED'
    && fixture.importEvidence?.cleanImport === true
    && fixture.roundTripEvidence?.semanticEquivalent === true;
}

function selectedFixtures(source, errors) {
  const fixtures = Array.isArray(source.fixtures) ? source.fixtures : [];
  const ids = Array.isArray(source.fixtureIds) ? source.fixtureIds.map(text).filter(Boolean) : [];
  const unique = [...new Set(ids)], byId = Object.fromEntries(fixtures.map((item) => [item.fixtureId, item]));
  const selected = unique.map((id) => byId[id]).filter(Boolean), mode = text(source.caesarTopologyMode);
  const expectedCase = mode === 'TANGENCY_SEPARATED_BRIDGE' ? 'F6'
    : ['CONSECUTIVE_SHARED_LOGICAL_NODE', 'CAESAR_FAR_POINT_SHARED_NODE'].includes(mode) ? 'F7' : '';
  if (!unique.length || unique.length !== ids.length) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_REQUIRED', { topologyMappingId: text(source.topologyMappingId) }));
  if (selected.length !== unique.length || selected.some((item) => !acceptedRoundTrip(item)
    || item.fixtureCaseId !== expectedCase)) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED', { topologyMappingId: text(source.topologyMappingId) }));
  return selected;
}

function fixtureSession(fixtures, errors, topologyMappingId) {
  const observed = Object.fromEntries(sessionFields.map((field) => [field,
    [...new Set(fixtures.map((fixture) => text(fixture?.[field])).filter(Boolean))].sort()]));
  const consistent = fixtures.length > 0
    && sessionFields.every((field) => observed[field].length === 1);
  if (!consistent) errors.push(diagnostic('PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED', {
    topologyMappingId, reason: 'FIXTURE_SESSION_CONFLICT', observed }));
  return Object.freeze(Object.fromEntries(sessionFields.map((field) => [field,
    consistent ? observed[field].at(0) : ''])));
}

function observedModeMatches(mode, fixtures) {
  const records = fixtures.flatMap((fixture) => fixture.continuityRecords || []);
  if (!records.length) return false;
  return records.every((record) => record.observedTopologyMode === mode
    && record.bendOwnerElementId === record.enteringElementId
    && record.inactiveCornerSerialized === false
    && (mode === 'TANGENCY_SEPARATED_BRIDGE'
      ? record.sharedLogicalNode === false && record.enteringToNode !== record.leavingFromNode
        && record.enteringToNode === record.incomingTangencyNode
        && record.leavingFromNode === record.outgoingTangencyNode
      : record.sharedLogicalNode === true && record.enteringToNode === record.leavingFromNode));
}

function rolesMatch(mode, source) {
  const profile = roleProfiles[mode];
  return Boolean(profile && requiredRoles.every((field) => text(source[field]) === profile[field]));
}

function compatibilityFor(mode, authenticated) {
  if (!authenticated) return 'UNRESOLVED';
  if (mode === 'TANGENCY_SEPARATED_BRIDGE') return 'DIRECTLY_WRITER_COMPATIBLE';
  if (['CONSECUTIVE_SHARED_LOGICAL_NODE', 'CAESAR_FAR_POINT_SHARED_NODE'].includes(mode)) {
    return 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION';
  }
  return 'INCOMPATIBLE';
}

export function createPipelineGreCaesarBendTopologyMapping(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.diagnostics];
  const mode = text(source.caesarTopologyMode), fixtures = selectedFixtures(source, errors);
  const session = fixtureSession(fixtures, errors, text(source.topologyMappingId));
  if (!text(source.topologyMappingId) || !PIPELINE_GRE_CAESAR_TOPOLOGY_MODES.includes(mode)
    || !text(source.sourceAuthority) || !Array.isArray(source.sourceReferences)
    || source.sourceReferences.some((item) => !text(item))) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED', {
      topologyMappingId: text(source.topologyMappingId), reason: 'CONTRACT_FIELDS' }));
  if (mode === 'CAESAR_SPECIFIC_REPROJECTED_TOPOLOGY') errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_SUCCESSOR_NOT_AUTHORIZED', { topologyMappingId: text(source.topologyMappingId) }));
  if (!rolesMatch(mode, source)) errors.push(diagnostic('PIPELINE_GRE_CAESAR_ROLE_SEMANTICS_UNRESOLVED', {
    topologyMappingId: text(source.topologyMappingId), mode }));
  if (!observedModeMatches(mode, fixtures)) errors.push(diagnostic('PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED', {
    topologyMappingId: text(source.topologyMappingId), reason: 'FIXTURE_RELATIONSHIP_CONFLICT' }));
  const authenticated = errors.length === 0, compatibility = compatibilityFor(mode, authenticated);
  if (!PIPELINE_GRE_CAESAR_COMPATIBILITY.includes(compatibility)) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED', { topologyMappingId: text(source.topologyMappingId) }));
  return createPipelineGreCaesarBendTopologyMappingRecord({
    topologyMappingId: text(source.topologyMappingId), caesarTopologyMode: mode,
    caesarVersion: session.caesarVersion, caesarBuild: session.caesarBuild,
    unitFileId: session.unitFileId, unitFileSha256: session.unitFileSha256,
    enteringElementFromRole: text(source.enteringElementFromRole),
    enteringElementToRole: text(source.enteringElementToRole),
    leavingElementFromRole: text(source.leavingElementFromRole),
    leavingElementToRole: text(source.leavingElementToRole), nearPointRole: text(source.nearPointRole),
    farPointRole: text(source.farPointRole), sharedLogicalNodeRole: text(source.sharedLogicalNodeRole),
    inactiveCornerDisposition: text(source.inactiveCornerDisposition),
    incomingTangencyDisposition: text(source.incomingTangencyDisposition),
    outgoingTangencyDisposition: text(source.outgoingTangencyDisposition),
    continuityRequirement: text(source.continuityRequirement), currentP3dGre055Compatibility: compatibility,
    currentP3dGre055Questions: clone({ incomingTangencyCanRemainEnteringTo:
      compatibility === 'DIRECTLY_WRITER_COMPATIBLE', outgoingTangencyCanRemainLeavingFrom:
      compatibility === 'DIRECTLY_WRITER_COMPATIBLE', distinctTangencyNodeNumbersAllowed:
      compatibility === 'DIRECTLY_WRITER_COMPATIBLE', sharedLogicalNodeRequired:
      ['CONSECUTIVE_SHARED_LOGICAL_NODE', 'CAESAR_FAR_POINT_SHARED_NODE'].includes(mode),
      syntheticCaesarBendNodeRequired: compatibility === 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION',
      originalConstructionCornerMayRemainInactive: source.inactiveCornerDisposition === 'NOT_SERIALIZED',
      caesarDerivesNearFarPoints: ['CONSECUTIVE_SHARED_LOGICAL_NODE',
        'CAESAR_FAR_POINT_SHARED_NODE'].includes(mode) }),
    sourceAuthority: text(source.sourceAuthority), sourceReferences: clone(source.sourceReferences || []),
    fixtureIds: clone(source.fixtureIds || []),
  }, errors);
}

export function buildPipelineGreCaesarTopologyMatrixTsv(mappings) {
  const header = ['TopologyMappingId', 'Mode', 'EnteringToRole', 'LeavingFromRole',
    'SharedLogicalNodeRole', 'InactiveCornerDisposition', 'P3DGre055Compatibility', 'Ready', 'Blockers'];
  const rows = [...mappings].sort((a, b) => a.topologyMappingId < b.topologyMappingId ? -1
    : a.topologyMappingId > b.topologyMappingId ? 1 : 0).map((item) => [item.topologyMappingId,
    item.caesarTopologyMode, item.enteringElementToRole, item.leavingElementFromRole,
    item.sharedLogicalNodeRole, item.inactiveCornerDisposition,
    item.currentP3dGre055Compatibility, item.ready, (item.blockerCodes || []).join('|')]);
  return [header, ...rows].map((row) => row.map((value) => value ?? '').join('\t')).join('\n');
}
