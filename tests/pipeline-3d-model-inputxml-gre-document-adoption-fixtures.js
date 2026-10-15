import {
  PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA,
  PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA,
  PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA,
  createPipelineInputXmlGreProjectionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-gre-projection-contracts.js';

const GRE_BLOCKER = 'PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED';
const props = (diameter = 500) => ({ diameter, wallThickness: 10, insulationThickness: 0,
  corrosionAllowance: 0, temperatures: Array(9).fill(null), pressures: Array(9).fill(null),
  hydroPressure: null, insulationDensity: 0, fluidDensity: 0, materialNumber: 1 });
const emptyProps = () => ({ diameter: null, wallThickness: null, insulationThickness: null,
  corrosionAllowance: null, temperatures: Array(9).fill(null), pressures: Array(9).fill(null),
  hydroPressure: null, insulationDensity: null, fluidDensity: null, materialNumber: null });
const greDiagnostic = (candidateId) => ({ severity: 'BLOCKING', code: GRE_BLOCKER,
  message: GRE_BLOCKER, details: { candidateId } });
const clone = (value) => structuredClone(value);

function authority(index, section, profile, candidateId = '', radius = null, thickness = null) {
  const diagnostics = candidateId && profile === 'gre' ? [greDiagnostic(candidateId)] : [];
  return { schema: 'PipelineInputXmlProfileElementAuthority.v1', elementIndex: index,
    elementId: `E${index + 1}`, analysisSectionId: section, profileId: profile,
    resolvedMode: profile === 'gre' ? 'GRE' : profile === 'asme-b31.4' ? 'ASME_B31_4' : 'NORMAL',
    caesarDiameterMm: 500, diameterSourceKind: profile === 'gre' ? 'GRE_VENDOR_NOMINAL_BORE' : 'OUTSIDE_DIAMETER',
    propertySectionId: `S${index + 1}`, propertyDisposition: 'SECTION_START',
    fittingCandidateId: candidateId, fittingAuthorityKind: candidateId
      ? profile === 'gre' ? 'GRE_VENDOR_SERIES' : profile === 'asme-b31.4' ? 'B314_RADIUS' : 'NORMAL_FITTING' : '',
    fittingPolicyId: candidateId ? `${profile}:policy` : '', governingRadiusMm: radius,
    fittingThicknessMm: thickness, geometryDisposition: candidateId && profile === 'gre'
      ? 'GRE_GEOMETRY_NOT_ADOPTED' : candidateId ? 'MATCHES_AUTHORITY' : 'NOT_A_TURN',
    writerDisposition: diagnostics.length ? 'BLOCKED' : 'READY', diagnostics,
    blockerCodes: diagnostics.map((item) => item.code), ready: diagnostics.length === 0 };
}

function sourceElement(index, from, to, section, profile, profileAuthority, bend = null, emit = true) {
  return { schema: 'PipelineInputXmlElementPlan.v1', id: `E${index + 1}`, index,
    fromNode: from.node, toNode: to.node, deltaX: to.x - from.x, deltaY: to.y - from.y,
    deltaZ: to.z - from.z, fromX: from.x, fromY: from.y, fromZ: from.z,
    toX: to.x, toY: to.y, toZ: to.z, fromName: '', toName: '', line: 'PL-GRE-055',
    propertySectionId: `S${index + 1}`, propertyDisposition: 'SECTION_START',
    properties: props(), emittedProperties: emit ? props() : emptyProps(), bend,
    analysisSectionId: section, profileId: profile, resolvedMode: profileAuthority.resolvedMode,
    caesarDiameterMm: 500, diameterSourceKind: profileAuthority.diameterSourceKind,
    fittingCandidateId: profileAuthority.fittingCandidateId,
    fittingAuthorityKind: profileAuthority.fittingAuthorityKind,
    fittingPolicyId: profileAuthority.fittingPolicyId,
    governingRadiusMm: profileAuthority.governingRadiusMm,
    fittingThicknessMm: profileAuthority.fittingThicknessMm,
    geometryDisposition: profileAuthority.geometryDisposition,
    writerDisposition: profileAuthority.writerDisposition,
    profileAuthority, diagnostics: clone(profileAuthority.diagnostics) };
}

function sourcePlan(elements, sections) {
  const diagnostics = elements.flatMap((item) => item.diagnostics);
  const blockerCodes = [...new Set(diagnostics.map((item) => item.code))];
  const sectionAuthorities = sections.map((section) => ({ schema: 'PipelineInputXmlProfileSectionAuthority.v1',
    analysisSectionId: section.id, startElementIndex: section.start, profileId: section.profile,
    resolvedMode: section.profile === 'gre' ? 'GRE' : section.profile === 'asme-b31.4' ? 'ASME_B31_4' : 'NORMAL',
    caesarDiameterMm: 500, diameterSourceKind: 'TEST', greVendorSeriesAuthority: section.profile === 'gre'
      ? { vendorId: 'VENDOR-A', seriesId: 'SERIES-A', qualificationEvidenceId: 'QUAL-A',
        requirementReference: 'REQ-A', bendRadiusMm: 300, bendLocalThicknessMm: 12 } : null,
    diagnostics: [], blockerCodes: [], ready: true }));
  const profileAuthorityPlan = { schema: 'PipelineInputXmlProfileAuthorityPlan.v1',
    analysisSectionPlanSchema: 'PipelineAnalysisSectionPlan.v1',
    analysisDiameterPlanSchema: 'PipelineAnalysisDiameterPlan.v1',
    normalFittingPlanSchema: 'PipelineNormalFittingPlan.v1', b314RadiusPlanSchema: 'PipelineB314RadiusPlan.v1',
    greVendorSeriesPlanSchema: 'PipelineGreVendorSeriesPlan.v1', bendResolutionSchema: 'PipelineBendResolution.v3',
    propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1', sectionAuthorities,
    elementAuthorities: elements.map((item) => clone(item.profileAuthority)), fittingAuthorities: [],
    diagnostics: clone(diagnostics), blockerCodes: clone(blockerCodes), ready: blockerCodes.length === 0 };
  return { schema: 'PipelineInputXmlDocumentPlan.v1', namespace: 'COADE',
    extensionNamespace: 'urn:reallaksh19:inputxml:extension:v1', xmlType: 'Input', version: '11.00',
    metadata: { caesarVersion: '11.00', jobName: 'P3D-GRE-055', issueNo: '', timeText: '',
      northX: 0, northY: 1, northZ: 0 }, counts: { numElt: elements.length,
      numNoz: 0, noHgrs: 0, numBend: elements.filter((item) => item.bend != null).length,
      numRigid: 0, numExpJnt: 0, numRest: 0, numForcMnt: 0, numUnfLoad: 0, numWind: 0,
      numEleOff: 0, numAllow: 0, numISect: 0 }, propertySectionPlan: { schema: 'PipelinePropertySectionPlan.v1' },
    propertySectionPlanSchema: 'PipelinePropertySectionPlan.v1', profileAuthorityPlan,
    profileAuthorityPlanSchema: 'PipelineInputXmlProfileAuthorityPlan.v1', elements,
    diagnostics, blockerCodes, ready: blockerCodes.length === 0, resolvedMode: 'MIXED' };
}

function projected(id, materializedId, kind, section, candidateId, from, to, sourceIndex, disposition, bend = null) {
  return { schema: PIPELINE_INPUTXML_GRE_PROJECTED_ELEMENT_SCHEMA, id, index: Number(id.slice(1)) - 1,
    materializedElementId: materializedId, elementKind: kind, analysisSectionId: section,
    candidateId, fromMaterializedNodeId: from.id, toMaterializedNodeId: to.id,
    fromNode: from.node, toNode: to.node, fromX: from.x, fromY: from.y, fromZ: from.z,
    toX: to.x, toY: to.y, toZ: to.z, deltaX: to.x - from.x, deltaY: to.y - from.y,
    deltaZ: to.z - from.z, sourceElementIndexes: [sourceIndex], lineageDisposition: disposition,
    bend, sourceAuthority: 'TEST', sourceReference: materializedId };
}

function bend(candidateId, ownerId, ownerMaterializedId, semanticId, section, incomingSource, nodes,
  applicationValue = 'EACH_LEG_FROM_CORNER') {
  return { schema: PIPELINE_INPUTXML_GRE_BEND_PROJECTION_SCHEMA, candidateId,
    bendComponentId: `component:${candidateId}`, semanticGreBendElementId: semanticId,
    incomingOwnerProjectionElementId: ownerId, incomingOwnerMaterializedElementId: ownerMaterializedId,
    incomingSourceElementIndex: incomingSource, incomingSourceElementId: `E${incomingSource + 1}`,
    outgoingSourceElementIndex: incomingSource + 1, outgoingSourceElementId: `E${incomingSource + 2}`,
    incomingTangencyNodeId: nodes.incoming.id, incomingTangencyNodeNumber: nodes.incoming.node,
    outgoingTangencyNodeId: nodes.outgoing.id, outgoingTangencyNodeNumber: nodes.outgoing.node,
    inactiveCornerReferenceId: nodes.corner.id, inactiveCornerNodeNumber: nodes.corner.node,
    radiusMm: 300, turnAngleDeg: 90, fittingThicknessMm: 12,
    bendBreakLengthApplication: applicationValue, vendorId: 'VENDOR-A', seriesId: 'SERIES-A',
    qualificationEvidenceId: 'QUAL-A', requirementReference: 'REQ-A',
    sourceAuthority: 'PROJECT_GRE_SPEC', sourceReference: `GRE:${candidateId}` };
}

function projectionPlan(elements, bends, sourceCount, conservation, inactive) {
  return createPipelineInputXmlGreProjectionPlan({
    sourceMaterializationPlanSchema: 'PipelineGreBendMaterializationPlan.v1',
    sourceMaterializedModelSchema: 'PipelineGreBendMaterializedModel.v1', projectedElements: elements,
    bendProjections: bends, sourceElementConservation: conservation,
    inactiveCornerReferences: inactive, notApplicableCandidateIds: [], coverage: {
      sourceNodeCount: sourceCount + 1, activeNodeCount: new Set(elements.flatMap((item) =>
        [item.fromMaterializedNodeId, item.toMaterializedNodeId])).size,
      inactiveCornerCount: inactive.length, sourceElementCount: sourceCount,
      materializedElementCount: elements.length + bends.length, semanticBendElementCount: bends.length,
      zeroLengthElementCount: 0, emittableMaterializedElementCount: elements.length,
      projectedElementCount: elements.length, bendComponentCount: bends.length,
      bendProjectionCount: bends.length } });
}

function greCandidateSegment({ candidateNo, sourceStart, projectionStart, start, corner, end,
  section = 'AS1', applicationValue = 'EACH_LEG_FROM_CORNER' }) {
  const prefix = `c${candidateNo}`, nodes = {
    start: { ...start, id: `route-node:${start.node}` },
    inBreak: { id: `${prefix}:in-break`, node: 1000 + candidateNo * 100, x: start.x + (corner.x - start.x) * 0.6,
      y: start.y + (corner.y - start.y) * 0.6, z: start.z + (corner.z - start.z) * 0.6 },
    incoming: { id: `${prefix}:in-tangent`, node: 1010 + candidateNo * 100, x: start.x + (corner.x - start.x) * 0.7,
      y: start.y + (corner.y - start.y) * 0.7, z: start.z + (corner.z - start.z) * 0.7 },
    outgoing: { id: `${prefix}:out-tangent`, node: 1020 + candidateNo * 100, x: corner.x + (end.x - corner.x) * 0.3,
      y: corner.y + (end.y - corner.y) * 0.3, z: corner.z + (end.z - corner.z) * 0.3 },
    outBreak: { id: `${prefix}:out-break`, node: 1030 + candidateNo * 100, x: corner.x + (end.x - corner.x) * 0.4,
      y: corner.y + (end.y - corner.y) * 0.4, z: corner.z + (end.z - corner.z) * 0.4 },
    corner: { ...corner, id: `route-node:${corner.node}` }, end: { ...end, id: `route-node:${end.node}` },
  };
  const candidateId = `bend:${candidateNo}`, semanticId = `gre-bend:${candidateId}`;
  const raw = [
    projected(`E${projectionStart}`, `${prefix}:incoming-straight`, 'SPLIT_STRAIGHT', section, candidateId,
      nodes.start, nodes.inBreak, sourceStart, 'SPLIT_BY_INCOMING_BREAK'),
    projected(`E${projectionStart + 1}`, `${prefix}:incoming-owner`, 'GRE_INCOMING_TRANSITION', section, candidateId,
      nodes.inBreak, nodes.incoming, sourceStart, 'SPLIT_BY_INCOMING_TANGENCY'),
    projected(`E${projectionStart + 2}`, `${prefix}:outgoing-transition`, 'GRE_OUTGOING_TRANSITION', section, candidateId,
      nodes.outgoing, nodes.outBreak, sourceStart + 1, 'SPLIT_BY_OUTGOING_TANGENCY'),
    projected(`E${projectionStart + 3}`, `${prefix}:outgoing-straight`, 'SPLIT_STRAIGHT', section, candidateId,
      nodes.outBreak, nodes.end, sourceStart + 1, 'SPLIT_BY_OUTGOING_BREAK'),
  ];
  const bendProjection = bend(candidateId, `E${projectionStart + 1}`, `${prefix}:incoming-owner`,
    semanticId, section, sourceStart, nodes, applicationValue);
  raw[1].bend = clone(bendProjection);
  const conservation = [
    { schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA, sourceElementIndex: sourceStart,
      sourceElementId: `E${sourceStart + 1}`, successorMaterializedElementIds:
        [`${prefix}:incoming-straight`, `${prefix}:incoming-owner`, semanticId],
      emittedElementIds: [`E${projectionStart}`, `E${projectionStart + 1}`] },
    { schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA, sourceElementIndex: sourceStart + 1,
      sourceElementId: `E${sourceStart + 2}`, successorMaterializedElementIds:
        [semanticId, `${prefix}:outgoing-transition`, `${prefix}:outgoing-straight`],
      emittedElementIds: [`E${projectionStart + 1}`, `E${projectionStart + 2}`, `E${projectionStart + 3}`] },
  ];
  return { elements: raw, bend: bendProjection, conservation, inactive: nodes.corner.id };
}

export function createGreAdoptionFixture({ twoBends = false,
  applicationValue = 'EACH_LEG_FROM_CORNER' } = {}) {
  const rows = twoBends ? [
    { node: 100, x: 0, y: 0, z: 0 }, { node: 110, x: 1000, y: 0, z: 0 },
    { node: 120, x: 1000, y: 1000, z: 0 }, { node: 130, x: 2000, y: 1000, z: 0 },
    { node: 140, x: 2000, y: 2000, z: 0 },
  ] : [
    { node: 100, x: 0, y: 0, z: 0 }, { node: 110, x: 1000, y: 0, z: 0 },
    { node: 120, x: 1000, y: 1000, z: 0 },
  ];
  const sourceElements = [];
  for (let index = 0; index < rows.length - 1; index += 1) {
    const candidateId = index % 2 === 0 ? `bend:${index / 2 + 1}` : '';
    const auth = authority(index, 'AS1', 'gre', candidateId, candidateId ? 300 : null,
      candidateId ? 12 : null);
    sourceElements.push(sourceElement(index, rows[index], rows[index + 1], 'AS1', 'gre', auth, null, index === 0));
  }
  const first = greCandidateSegment({ candidateNo: 1, sourceStart: 0, projectionStart: 1,
    start: rows[0], corner: rows[1], end: rows[2], applicationValue });
  const segments = [first];
  if (twoBends) segments.push(greCandidateSegment({ candidateNo: 2, sourceStart: 2, projectionStart: 5,
    start: rows[2], corner: rows[3], end: rows[4], applicationValue }));
  const projectedElements = segments.flatMap((item) => item.elements);
  const bends = segments.map((item) => item.bend);
  const conservation = segments.flatMap((item) => item.conservation);
  const projection = projectionPlan(projectedElements, bends, sourceElements.length,
    conservation, segments.map((item) => item.inactive));
  return { sourceDocumentPlan: sourcePlan(sourceElements, [{ id: 'AS1', start: 0, profile: 'gre' }]),
    greProjectionPlan: projection };
}

export function createMixedAdoptionFixture() {
  const rows = [
    { node: 100, x: 0, y: 0, z: 0 }, { node: 110, x: 1000, y: 0, z: 0 },
    { node: 120, x: 1000, y: 1000, z: 0 }, { node: 130, x: 2000, y: 1000, z: 0 },
    { node: 140, x: 2000, y: 2000, z: 0 }, { node: 150, x: 3000, y: 2000, z: 0 },
    { node: 160, x: 3000, y: 3000, z: 0 },
  ];
  const normalBend = { id: 'normal:1', radiusMm: 750, fittingThicknessMm: null };
  const b314Bend = { id: 'b314:1', radiusMm: 12000, fittingThicknessMm: null };
  const profiles = ['normal-metallic', 'normal-metallic', 'gre', 'gre', 'asme-b31.4', 'asme-b31.4'];
  const sections = ['AS1', 'AS1', 'AS2', 'AS2', 'AS3', 'AS3'];
  const sourceElements = profiles.map((profile, index) => {
    const candidateId = index === 0 ? 'normal:1' : index === 2 ? 'bend:1' : index === 4 ? 'b314:1' : '';
    const auth = authority(index, sections[index], profile, candidateId,
      candidateId === 'bend:1' ? 300 : candidateId ? (index === 0 ? 750 : 12000) : null,
      candidateId === 'bend:1' ? 12 : null);
    return sourceElement(index, rows[index], rows[index + 1], sections[index], profile, auth,
      index === 0 ? normalBend : index === 4 ? b314Bend : null, index === 0 || index === 2 || index === 4);
  });
  const before1 = projected('E1', 'normal:E1', 'UNCHANGED_STRAIGHT', 'AS1', '',
    { ...rows[0], id: 'route-node:100' }, { ...rows[1], id: 'route-node:110' }, 0, 'UNCHANGED');
  const before2 = projected('E2', 'normal:E2', 'UNCHANGED_STRAIGHT', 'AS1', '',
    { ...rows[1], id: 'route-node:110' }, { ...rows[2], id: 'route-node:120' }, 1, 'UNCHANGED');
  const gre = greCandidateSegment({ candidateNo: 1, sourceStart: 2, projectionStart: 3,
    start: rows[2], corner: rows[3], end: rows[4], section: 'AS2' });
  const after1 = projected('E7', 'b314:E5', 'UNCHANGED_STRAIGHT', 'AS3', '',
    { ...rows[4], id: 'route-node:140' }, { ...rows[5], id: 'route-node:150' }, 4, 'UNCHANGED');
  const after2 = projected('E8', 'b314:E6', 'UNCHANGED_STRAIGHT', 'AS3', '',
    { ...rows[5], id: 'route-node:150' }, { ...rows[6], id: 'route-node:160' }, 5, 'UNCHANGED');
  const conservation = [
    { schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA, sourceElementIndex: 0,
      sourceElementId: 'E1', successorMaterializedElementIds: ['normal:E1'], emittedElementIds: ['E1'] },
    { schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA, sourceElementIndex: 1,
      sourceElementId: 'E2', successorMaterializedElementIds: ['normal:E2'], emittedElementIds: ['E2'] },
    ...gre.conservation,
    { schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA, sourceElementIndex: 4,
      sourceElementId: 'E5', successorMaterializedElementIds: ['b314:E5'], emittedElementIds: ['E7'] },
    { schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA, sourceElementIndex: 5,
      sourceElementId: 'E6', successorMaterializedElementIds: ['b314:E6'], emittedElementIds: ['E8'] },
  ];
  return { sourceDocumentPlan: sourcePlan(sourceElements, [
    { id: 'AS1', start: 0, profile: 'normal-metallic' }, { id: 'AS2', start: 2, profile: 'gre' },
    { id: 'AS3', start: 4, profile: 'asme-b31.4' }]),
    greProjectionPlan: projectionPlan([before1, before2, ...gre.elements, after1, after2], [gre.bend],
      sourceElements.length, conservation, [gre.inactive]) };
}

export function createNoGreAdoptionFixture(profile = 'normal-metallic') {
  const rows = [{ node: 100, x: 0, y: 0, z: 0 }, { node: 110, x: 1000, y: 0, z: 0 },
    { node: 120, x: 2000, y: 0, z: 0 }];
  const section = 'AS1', elements = rows.slice(1).map((to, index) => {
    const auth = authority(index, section, profile);
    return sourceElement(index, rows[index], to, section, profile, auth, null, index === 0);
  });
  const projectedElements = elements.map((item, index) => projected(`E${index + 1}`, `unchanged:E${index + 1}`,
    'UNCHANGED_STRAIGHT', section, '', { id: `route-node:${item.fromNode}`, node: item.fromNode,
      x: item.fromX, y: item.fromY, z: item.fromZ }, { id: `route-node:${item.toNode}`, node: item.toNode,
      x: item.toX, y: item.toY, z: item.toZ }, index, 'UNCHANGED'));
  const conservation = projectedElements.map((item, index) => ({ schema: PIPELINE_INPUTXML_GRE_SOURCE_CONSERVATION_SCHEMA,
    sourceElementIndex: index, sourceElementId: `E${index + 1}`,
    successorMaterializedElementIds: [item.materializedElementId], emittedElementIds: [item.id] }));
  return { sourceDocumentPlan: sourcePlan(elements, [{ id: section, start: 0, profile }]),
    greProjectionPlan: projectionPlan(projectedElements, [], elements.length, conservation, []) };
}

export function createNormalGreAdoptionFixture() {
  const mixed = clone(createMixedAdoptionFixture());
  mixed.sourceDocumentPlan.elements = mixed.sourceDocumentPlan.elements.slice(0, 4);
  mixed.sourceDocumentPlan.profileAuthorityPlan.elementAuthorities =
    mixed.sourceDocumentPlan.profileAuthorityPlan.elementAuthorities.slice(0, 4);
  mixed.sourceDocumentPlan.profileAuthorityPlan.sectionAuthorities =
    mixed.sourceDocumentPlan.profileAuthorityPlan.sectionAuthorities.slice(0, 2);
  mixed.sourceDocumentPlan.counts.numElt = 4;
  mixed.sourceDocumentPlan.counts.numBend = 1;
  const projection = mixed.greProjectionPlan;
  mixed.greProjectionPlan = createPipelineInputXmlGreProjectionPlan({
    ...projection, projectedElements: projection.projectedElements.slice(0, 6),
    sourceElementConservation: projection.sourceElementConservation.slice(0, 4),
    coverage: { ...projection.coverage, sourceNodeCount: 5, sourceElementCount: 4,
      projectedElementCount: 6, emittableMaterializedElementCount: 6,
      materializedElementCount: 7, activeNodeCount: 7 } });
  return mixed;
}

export function createB314GreAdoptionFixture() {
  const mixed = clone(createMixedAdoptionFixture()), source = mixed.sourceDocumentPlan;
  source.elements = source.elements.slice(2).map((element, index) => {
    element.index = index; element.id = `E${index + 1}`;
    element.profileAuthority.elementIndex = index;
    element.profileAuthority.elementId = element.id;
    return element;
  });
  source.profileAuthorityPlan.elementAuthorities = source.elements.map((item) => clone(item.profileAuthority));
  source.profileAuthorityPlan.sectionAuthorities = source.profileAuthorityPlan.sectionAuthorities.slice(1)
    .map((section) => ({ ...section, startElementIndex: section.startElementIndex - 2 }));
  source.counts.numElt = 4; source.counts.numBend = 1;
  const projection = mixed.greProjectionPlan;
  const mapId = (id) => `E${Number(id.slice(1)) - 2}`;
  const bendProjection = clone(projection.bendProjections[0]);
  bendProjection.incomingOwnerProjectionElementId = mapId(bendProjection.incomingOwnerProjectionElementId);
  bendProjection.incomingSourceElementIndex -= 2;
  bendProjection.outgoingSourceElementIndex -= 2;
  bendProjection.incomingSourceElementId = 'E1'; bendProjection.outgoingSourceElementId = 'E2';
  const projectedElements = projection.projectedElements.slice(2).map((element, index) => {
    const item = clone(element); item.id = `E${index + 1}`; item.index = index;
    item.sourceElementIndexes = item.sourceElementIndexes.map((value) => value - 2);
    if (item.materializedElementId === bendProjection.incomingOwnerMaterializedElementId) item.bend = clone(bendProjection);
    return item;
  });
  const conservation = projection.sourceElementConservation.slice(2).map((item, index) => ({ ...clone(item),
    sourceElementIndex: index, sourceElementId: `E${index + 1}`,
    emittedElementIds: item.emittedElementIds.map(mapId) }));
  mixed.greProjectionPlan = createPipelineInputXmlGreProjectionPlan({ ...projection,
    projectedElements, bendProjections: [bendProjection], sourceElementConservation: conservation,
    coverage: { ...projection.coverage, sourceNodeCount: 5, sourceElementCount: 4,
      projectedElementCount: 6, emittableMaterializedElementCount: 6,
      materializedElementCount: 7, activeNodeCount: 7 } });
  return mixed;
}
