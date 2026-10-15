import {
  PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PLAN_SCHEMA,
  PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PROFILE_SCHEMA,
  PIPELINE_GRE_CAESAR_FIELD_CASES,
  clonePipelineGreCaesarQualificationValue as clone,
  createPipelineGreCaesarBendQualificationPlanRecord,
  createPipelineGreCaesarBendQualificationProfileRecord,
  createPipelineGreCaesarDiagnostic as diagnostic,
  safePipelineGreCaesarQualificationInput as safe,
} from './pipeline-3d-model-gre-caesar-qualification-contracts.js';
import {
  buildPipelineGreCaesarFixtureInventoryJson,
  createRepositoryGreInputXmlFixtureEvidence,
} from './pipeline-3d-model-gre-caesar-fixture-evidence.js';
import {
  buildPipelineGreCaesarBendFieldMatrixTsv,
  createPipelineGreCaesarBendFieldMapping,
} from './pipeline-3d-model-gre-caesar-bend-field-mapping.js';
import {
  buildPipelineGreCaesarTopologyMatrixTsv,
  createPipelineGreCaesarBendTopologyMapping,
} from './pipeline-3d-model-gre-caesar-bend-topology-mapping.js';

export { PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PLAN_SCHEMA,
  PIPELINE_GRE_CAESAR_BEND_QUALIFICATION_PROFILE_SCHEMA };

const text = (value) => typeof value === 'string' ? value.trim() : '';
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const exactlyOne = (values) => values.length === 1 ? values.at(0) : null;

function indexed(values, key, errors) {
  const map = Object.create(null);
  values.forEach((item) => {
    const id = text(item?.[key]);
    if (!id || map[id]) errors.push(diagnostic('PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT', { key, id }));
    else map[id] = item;
  });
  return map;
}

function identityMatches(source, field) {
  return ['caesarVersion', 'caesarBuild', 'unitFileId', 'unitFileSha256', 'pipingCodeId',
    'pipingCodeName', 'pipingCodeEdition', 'laminateClassification']
    .every((key) => text(source[key]) && text(source[key]) === text(field?.[key]));
}

export function createPipelineGreCaesarBendQualificationProfile(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.diagnostics];
  const field = source.fieldMapping, topology = source.topologyMapping;
  if (!text(source.profileId) || !field || !topology) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_QUALIFICATION_INCOMPLETE', { profileId: text(source.profileId) }));
  if (field?.ready !== true) errors.push(...(field?.diagnostics || [diagnostic(
    'PIPELINE_GRE_CAESAR_BEND_TYPE_UNRESOLVED', { profileId: text(source.profileId) })]));
  if (topology?.ready !== true) errors.push(...(topology?.diagnostics || [diagnostic(
    'PIPELINE_GRE_CAESAR_TOPOLOGY_UNRESOLVED', { profileId: text(source.profileId) })]));
  if (field && !identityMatches(source, field)) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT', { profileId: text(source.profileId), field: 'IDENTITY' }));
  if (field && topology && ['caesarVersion', 'caesarBuild', 'unitFileId', 'unitFileSha256']
    .some((key) => text(field[key]) !== text(topology[key]))) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT', { profileId: text(source.profileId), field: 'TOPOLOGY_IDENTITY' }));
  const compatibility = topology?.currentP3dGre055Compatibility || 'UNRESOLVED';
  const writerEligible = compatibility === 'DIRECTLY_WRITER_COMPATIBLE'
    && field?.ready === true && topology?.ready === true;
  const successorCandidate = compatibility === 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION'
    && field?.ready === true && topology?.ready === true;
  if (!writerEligible && !successorCandidate) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_QUALIFICATION_INCOMPLETE', { profileId: text(source.profileId), compatibility }));
  return createPipelineGreCaesarBendQualificationProfileRecord({ profileId: text(source.profileId),
    caesarVersion: text(source.caesarVersion), caesarBuild: text(source.caesarBuild),
    unitFileId: text(source.unitFileId), unitFileSha256: text(source.unitFileSha256),
    pipingCodeId: text(source.pipingCodeId), pipingCodeName: text(source.pipingCodeName),
    pipingCodeEdition: text(source.pipingCodeEdition), laminateClassification: text(source.laminateClassification),
    fieldMappingId: text(field?.mappingId), topologyMappingId: text(topology?.topologyMappingId),
    fixtureIds: clone(source.fixtureIds || []), currentP3dGre055Compatibility: compatibility,
    writerEligible, successorCandidate, sourceAuthority: text(source.sourceAuthority),
    sourceReferences: clone(source.sourceReferences || []),
  }, errors);
}

function caseIndex(fixtures) {
  const result = Object.create(null);
  fixtures.forEach((fixture) => ((result[fixture.fixtureCaseId] ||= []).push(fixture)));
  return result;
}

function accepted(fixture) {
  return fixture?.ready === true && fixture.importEvidence?.result === 'ACCEPTED'
    && fixture.importEvidence?.cleanImport === true
    && fixture.roundTripEvidence?.semanticEquivalent === true;
}

function fieldCoverage(cases, fields) {
  return Object.fromEntries(PIPELINE_GRE_CAESAR_FIELD_CASES.map((caseId) => {
    const fixtures = (cases[caseId] || []).filter(accepted);
    const covered = fixtures.some((fixture) => fields.some((field) => field.ready === true
      && field.fixtureIds.includes(fixture.fixtureId)));
    return [caseId, covered];
  }));
}

function topologyDecision(cases, topologies) {
  const f6 = cases.F6 || [], f7 = cases.F7 || [];
  const f6Accepted = f6.filter(accepted), f6Rejected = f6.filter((fixture) => fixture.ready === true
    && fixture.importEvidence?.result === 'REJECTED');
  const acceptedF6 = exactlyOne(f6Accepted);
  const direct = Boolean(acceptedF6) && f6Rejected.length === 0
    && topologies.some((item) => item.ready === true
      && item.currentP3dGre055Compatibility === 'DIRECTLY_WRITER_COMPATIBLE'
      && item.fixtureIds.includes(acceptedF6.fixtureId));
  const f7Accepted = f7.filter(accepted), acceptedF7 = exactlyOne(f7Accepted);
  const reconciliation = f6Rejected.length === 1 && f6Accepted.length === 0 && Boolean(acceptedF7)
    && topologies.some((item) => item.ready === true
      && item.currentP3dGre055Compatibility === 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION'
      && item.fixtureIds.includes(acceptedF7.fixtureId));
  return direct ? 'F6_ACCEPTED_DIRECT' : reconciliation ? 'F6_REJECTED_F7_ACCEPTED' : 'UNRESOLVED';
}

export function buildPipelineGreCaesarBendQualificationPlan(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.diagnostics];
  const fixtures = [...(source.fixtures || [])].sort((a, b) => compare(a.fixtureId, b.fixtureId));
  const fields = [...(source.fieldMappings || [])].sort((a, b) => compare(a.mappingId, b.mappingId));
  const topologies = [...(source.topologyMappings || [])]
    .sort((a, b) => compare(a.topologyMappingId, b.topologyMappingId));
  const fixtureById = indexed(fixtures, 'fixtureId', errors);
  const fieldById = indexed(fields, 'mappingId', errors);
  const topologyById = indexed(topologies, 'topologyMappingId', errors);
  const profileInputs = [...(source.qualificationProfiles || [])]
    .sort((a, b) => compare(a.profileId, b.profileId));
  const profiles = profileInputs.map((profile) => {
    const fixtureIds = [...new Set((profile.fixtureIds || []).map(text).filter(Boolean))];
    if (!fixtureIds.length || fixtureIds.some((id) => !fixtureById[id])) errors.push(diagnostic(
      'PIPELINE_GRE_CAESAR_FIXTURE_REQUIRED', { profileId: text(profile.profileId) }));
    return createPipelineGreCaesarBendQualificationProfile({ ...profile, fixtureIds,
      fieldMapping: fieldById[profile.fieldMappingId], topologyMapping: topologyById[profile.topologyMappingId] });
  });
  errors.push(...fixtures.flatMap((item) => item.diagnostics || []),
    ...fields.flatMap((item) => item.diagnostics || []), ...topologies.flatMap((item) => item.diagnostics || []),
    ...profiles.flatMap((item) => item.diagnostics || []));
  const cases = caseIndex(fixtures), coverage = fieldCoverage(cases, fields);
  if (Object.values(coverage).some((value) => value !== true)) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_MATRIX_INCOMPLETE', { coverage }));
  const decision = topologyDecision(cases, topologies);
  if (decision === 'UNRESOLVED') errors.push(diagnostic('PIPELINE_GRE_CAESAR_F6_F7_DECISION_UNRESOLVED'));
  const allFieldProfilesReady = fields.filter((item) => item.ready === true).every((field) => profiles.some(
    (profile) => profile.ready === true && profile.fieldMappingId === field.mappingId));
  const fieldReady = Object.values(coverage).every(Boolean) && allFieldProfilesReady;
  const direct = decision === 'F6_ACCEPTED_DIRECT' && fieldReady
    && profiles.some((item) => item.ready === true && item.writerEligible === true);
  const reconciliation = decision === 'F6_REJECTED_F7_ACCEPTED' && fieldReady
    && profiles.some((item) => item.ready === true && item.successorCandidate === true);
  const outcome = direct ? 'QUALIFIED' : reconciliation ? 'TOPOLOGY_RECONCILIATION_REQUIRED' : 'STILL_BLOCKED';
  if (outcome === 'STILL_BLOCKED') errors.push(diagnostic('PIPELINE_GRE_CAESAR_QUALIFICATION_INCOMPLETE', { outcome }));
  return createPipelineGreCaesarBendQualificationPlanRecord({
    governingBaseline: text(source.governingBaseline), fixtures, fieldMappings: fields,
    topologyMappings: topologies, qualificationProfiles: profiles, fixtureCaseCoverage: coverage,
    topologyDecision: decision, currentP3dGre055Compatibility: direct ? 'DIRECTLY_WRITER_COMPATIBLE'
      : reconciliation ? 'REQUIRES_CAESAR_TOPOLOGY_REPROJECTION' : 'UNRESOLVED',
    derivedTopologyAssessment: outcome === 'STILL_BLOCKED'
      ? 'INFERENCE_ONLY: authenticated F6/F7 successor evidence is incomplete.' : '',
    qualificationOutcome: outcome,
  }, errors);
}

export function createRepositoryGreCaesarQualificationPlan() {
  const fixture = createRepositoryGreInputXmlFixtureEvidence();
  const field = createPipelineGreCaesarBendFieldMapping({ mappingId: 'candidate:repo-gre-v14-code36',
    caesarVersion: '14.00', caesarBuild: '', unitFileId: '', unitFileSha256: '',
    pipingCodeId: '36', pipingCodeName: '', pipingCodeEdition: '', laminateClassification: '',
    bendTypeDisposition: 'EMIT_NUMERIC', bendTypeValue: 3, bendTypeLexicalValue: '3',
    bendTypeMeaning: 'UNQUALIFIED_REPOSITORY_OBSERVATION',
    numMiterDisposition: 'PRESERVE_QUALIFIED_SENTINEL', numMiterValue: -1.0101,
    numMiterLexicalValue: '-1.0101', numMiterMeaning: 'UNQUALIFIED_REPOSITORY_OBSERVATION',
    curvatureNodeDisposition: 'EXACT_CURVATURE_ROLES_REQUIRED', curvatureNodeRoles: ['OTHER_AUTHENTICATED',
      'OTHER_AUTHENTICATED'], overallTurnAngleDisposition: 'OVERALL_ANGLE_EVIDENCE_ONLY',
    fittingThicknessDisposition: 'EMIT_AUTHENTICATED_VALUE', radiusDisposition: 'EMIT_AUTHENTICATED_VALUE',
    sourceAuthority: 'REPOSITORY_EXPORT_OBSERVATION', sourceReferences: ['docs/GREInputxml.xml'],
    fixtureIds: [fixture.fixtureId], fixtures: [fixture] });
  const topology = createPipelineGreCaesarBendTopologyMapping({
    topologyMappingId: 'candidate:repo-gre-shared-node', caesarTopologyMode: 'CONSECUTIVE_SHARED_LOGICAL_NODE',
    enteringElementFromRole: 'UPSTREAM_ROUTE_NODE', enteringElementToRole: 'CAESAR_LOGICAL_BEND_NODE',
    leavingElementFromRole: 'CAESAR_LOGICAL_BEND_NODE', leavingElementToRole: 'DOWNSTREAM_ROUTE_NODE',
    nearPointRole: 'CAESAR_DERIVED_NEAR_POINT', farPointRole: 'CAESAR_LOGICAL_BEND_NODE',
    sharedLogicalNodeRole: 'ENTERING_TO_AND_LEAVING_FROM', inactiveCornerDisposition: 'NOT_SERIALIZED',
    incomingTangencyDisposition: 'CAESAR_DERIVED_NEAR_POINT', outgoingTangencyDisposition: 'CAESAR_FAR_POINT',
    continuityRequirement: 'ENTERING_TO_EQUALS_LEAVING_FROM', sourceAuthority: 'REPOSITORY_EXPORT_OBSERVATION',
    sourceReferences: ['docs/GREInputxml.xml'], fixtureIds: [fixture.fixtureId], fixtures: [fixture] });
  return buildPipelineGreCaesarBendQualificationPlan({ governingBaseline: '7256f81b3cd029282fe4cce697aa54da6c4693bf',
    fixtures: [fixture], fieldMappings: [field], topologyMappings: [topology], qualificationProfiles: [] });
}

export function buildPipelineGreCaesarFixtureRequestMarkdown() {
  return `# CAESAR GRE bend qualification fixture request\n\n`
    + `Create every fixture in one documented CAESAR II version/build and unit file. Preserve and SHA-256 hash the native job, original InputXML, imported job, re-exported InputXML, unit file, screenshots, and operator log. Bind the package to the generating repository commit.\n\n`
    + `| ID | Required case |\n|---|---|\n`
    + `| F1 | ISO 14692-2005, 90-degree bend, no user curvature nodes |\n`
    + `| F2 | ISO 14692-2017, 90-degree bend, no user curvature nodes |\n`
    + `| F3 | Project GRE code and edition, non-90-degree bend |\n`
    + `| F4 | Project GRE code and edition, explicit midpoint curvature node |\n`
    + `| F5 | Project GRE code and edition, fitting thickness different from pipe |\n`
    + `| F6 | P3D tangency-separated topology import attempt |\n`
    + `| F7 | CAESAR-native consecutive entering/leaving-element control |\n\n`
    + `Record every import warning and error verbatim. An accepted import must be warning-free. Re-export comparisons must contain structured evidence for bend ownership, connectivity, semantic node roles, radius, fitting thickness, TYPE numeric and lexical values, NUM_MITER numeric and lexical values, curvature-node roles, NUMELT, NUMBEND, units, code/edition, and laminate. Do not edit or normalize XML between steps.\n`;
}

export { buildPipelineGreCaesarFixtureInventoryJson,
  buildPipelineGreCaesarBendFieldMatrixTsv, buildPipelineGreCaesarTopologyMatrixTsv };
