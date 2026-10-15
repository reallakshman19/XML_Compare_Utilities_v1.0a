import {
  createEngineeringPropertyField,
  createEngineeringPropertySet,
} from '../../core/engineering-scene/index.js';

const SOURCE = 'sequential-sketcher';

function field(input) {
  return createEngineeringPropertyField({ scope: 'ENTITY', editable: false, source: SOURCE, ...input });
}

function textField(key, label, value) {
  return field({ key, label, type: 'text', value: String(value ?? '') });
}

function numberField(key, label, value, unit = null) {
  return field({ key, label, type: 'number', value: Number.isFinite(value) ? value : null, unit });
}

function booleanField(key, label, value) {
  return field({ key, label, type: 'boolean', value: Boolean(value) });
}

function optionalText(fields, key, label, value) {
  if (String(value ?? '').trim()) fields.push(textField(key, label, value));
}

function pointFields(prefix, label, value) {
  if (!value) return [];
  return [
    numberField(`${prefix}X`, `${label} X`, value.x, 'mm'),
    numberField(`${prefix}Y`, `${label} Y`, value.y, 'mm'),
    numberField(`${prefix}Z`, `${label} Z`, value.z, 'mm'),
  ];
}

function geometryFields(geometry) {
  if (geometry.kind === 'point') return pointFields('position', 'Position', geometry.position);
  if (geometry.kind === 'segment') return [
    ...pointFields('start', 'Start', geometry.start),
    ...pointFields('end', 'End', geometry.end),
  ];
  return [
    numberField('pointCount', 'Point count', geometry.points.length),
    textField('coordinates', 'Coordinates', JSON.stringify(geometry.points.map(({ x, y, z }) => ({ x, y, z })))),
  ];
}

function commonFields(entity, trace) {
  return [
    textField('entityId', 'Entity ID', entity.id),
    textField('domainType', 'Domain type', entity.domainType),
    textField('category', 'Category', trace.category),
    textField('status', 'Status', trace.status),
    textField('layer', 'Layer', entity.layer),
    textField('geometryKind', 'Geometry kind', entity.geometry.kind),
    booleanField('contributesToFit', 'Contributes to fit', entity.contributesToFit),
    ...geometryFields(entity.geometry),
  ];
}

function componentFields(trace) {
  const component = trace.component || {};
  const ports = component.ports || [];
  const fields = [
    textField('componentId', 'Component ID', component.componentId),
    textField('sourceComponentId', 'Source component reference', component.sourceComponentId),
    textField('componentType', 'Component type', component.canonicalType),
    textField('sourceType', 'Source type', component.sourceType),
    textField('branchId', 'Branch ID', component.branchId),
    numberField('constructionStep', 'Construction step', trace.routeOrder),
    textField('geometryRole', 'Geometry role', trace.geometryRole),
    booleanField('confirmed', 'Confirmed', true),
    numberField('connectionCount', 'Continuity connection count', (trace.connections || []).length),
  ];
  optionalText(fields, 'sourceName', 'Source name', component.sourceName);
  optionalText(fields, 'startPortId', 'Start port ID', ports[0]?.portId);
  optionalText(fields, 'endPortId', 'End port ID', ports[1]?.portId);
  fields.push(...pointFields('startPort', 'Start port', ports[0]?.sourcePosition));
  fields.push(...pointFields('endPort', 'End port', ports[1]?.sourcePosition));
  if (trace.connections?.length) {
    fields.push(textField('continuityEvidence', 'Continuity evidence', JSON.stringify(trace.connections.map((row) => ({
      connectionId: row.connectionId,
      status: row.status,
      basis: row.basis,
      fromPortId: row.fromPortId,
      toPortId: row.toPortId,
      gapMm: row.gapMm,
    })))));
    fields.push(booleanField('repairBearing', 'Has repaired continuity', trace.connections.some((row) => row.status === 'AUTO_REPAIRED_SMALL_GAP' || row.status === 'USER_CONFIRMED')));
  }
  return fields;
}

function candidateFields(trace) {
  const candidate = trace.candidate || {};
  const fields = [
    textField('candidateId', 'Candidate ID', candidate.candidateId),
    textField('candidateStatus', 'Candidate status', 'NOT_CONFIRMED'),
    textField('decisionReason', 'Decision reason', trace.reason),
    textField('fromPortId', 'From port ID', candidate.fromPortId || candidate.targetPortId),
    textField('toPortId', 'To port ID', candidate.toPortId || candidate.connectedPortId),
    textField('targetComponentId', 'Target component ID', candidate.targetComponentId),
    textField('targetSourceComponentId', 'Target source reference', candidate.targetSourceComponentId),
    textField('targetComponentType', 'Target component type', candidate.targetComponentType),
    textField('targetBranchId', 'Target branch ID', candidate.targetBranchId),
    textField('targetPortRole', 'Target port role', candidate.targetPortRole),
    numberField('gapMm', 'Gap', candidate.gapMm ?? candidate.totalGapMm, 'mm'),
    numberField('directionAngleDeg', 'Direction angle', candidate.directionAngleDeg, 'deg'),
    textField('boreCompatibility', 'Bore compatibility', candidate.boreCompatibility),
    booleanField('eligible', 'Eligible', candidate.eligible),
    booleanField('sourceAdjacent', 'Source adjacent', candidate.sourceAdjacent),
    booleanField('referenceMatch', 'Reference match', candidate.referenceMatch),
    booleanField('directionCompatible', 'Direction compatible', candidate.directionCompatible),
    booleanField('boreCompatible', 'Bore compatible', candidate.boreCompatible),
    booleanField('confirmed', 'Confirmed', false),
    ...pointFields('from', 'Candidate from', candidate.fromPosition || candidate.targetPosition),
    ...pointFields('to', 'Candidate to', candidate.toPosition || candidate.connectedPosition),
  ];
  optionalText(fields, 'fromPositionBasis', 'From-position basis', candidate.fromPositionBasis);
  optionalText(fields, 'toPositionBasis', 'To-position basis', candidate.toPositionBasis);
  return fields;
}

function activePortFields(trace) {
  const port = trace.port || {};
  return [
    textField('portId', 'Port ID', port.portId),
    textField('ownerComponentId', 'Owner component', port.componentId),
    textField('branchId', 'Branch ID', port.branchId),
    textField('portRole', 'Port role', port.role),
    textField('constructionState', 'Construction state', trace.constructionState),
    textField('connectionStatus', 'Connection status', port.connectionStatus),
    textField('expectedContinuation', 'Expected continuation', port.referenceTarget),
    numberField('boreMm', 'Bore', port.boreMm, 'mm'),
    ...pointFields('activePort', 'Active port', port.resolvedPosition),
  ];
}

function repairFields(trace) {
  const repair = trace.repair || {};
  const connection = trace.connection || {};
  return [
    textField('repairId', 'Repair ID', repair.repairId),
    textField('connectionId', 'Connection ID', repair.connectionId),
    textField('repairType', 'Repair type', repair.type),
    textField('repairPolicy', 'Repair policy', repair.repairPolicy),
    textField('connectionStatus', 'Connection status', connection.status),
    textField('approvedBy', 'Approved by', repair.approvedBy),
    textField('fromPortId', 'From port ID', repair.fromPortId),
    textField('toPortId', 'To port ID', repair.toPortId),
    numberField('gapMm', 'Gap', repair.gapMm, 'mm'),
    numberField('thresholdMm', 'Threshold', repair.thresholdMm, 'mm'),
    textField('tolerancePolicyId', 'Tolerance policy ID', repair.tolerancePolicyId),
    textField('tolerancePolicyRevision', 'Tolerance policy revision', repair.tolerancePolicyRevision),
    textField('tolerancePolicyFingerprint', 'Tolerance policy fingerprint', repair.tolerancePolicyFingerprint),
    ...pointFields('from', 'Resolved from', repair.resolvedFromPosition || connection.fromPosition),
    ...pointFields('to', 'Resolved to', repair.resolvedToPosition || connection.toPosition),
  ];
}

function supportFields(trace) {
  const glyph = trace.glyph || {}; const family = trace.family || {};
  return [
    textField('supportId', 'Support ID', glyph.glyphId),
    textField('supportFamilyId', 'Support family ID', glyph.familyId),
    textField('supportType', 'Support type', glyph.displayKind),
    textField('attachmentCarrierId', 'Attachment carrier', glyph.carrierId),
    textField('attachmentStatus', 'Attachment status', glyph.resolutionStatus),
    textField('attachmentBasis', 'Attachment basis', family.carrierBinding?.bindingBasis),
    textField('positionStatus', 'Position status', family.position?.positionStatus),
    numberField('carrierStationMm', 'Carrier station', glyph.carrierStationMm, 'mm'),
    numberField('distanceToCarrierMm', 'Distance to carrier', family.position?.distanceToCarrierMm, 'mm'),
    textField('analyticalStatus', 'Analytical support-member status', 'NOT_AVAILABLE_IN_SEQUENTIAL_FINGERPRINT_DOMAIN'),
    ...pointFields('attachment', 'Attachment point', glyph.centerlinePointGlobal),
  ];
}

function rejectedFields(trace) {
  const candidate = trace.candidate || {}; const decision = trace.decision || {};
  return [
    textField('candidateId', 'Candidate ID', candidate.candidateId),
    textField('candidateStatus', 'Candidate status', 'REJECTED'),
    textField('decisionId', 'Decision ID', decision.decisionId),
    textField('rejectionReason', 'Rejection reason', decision.resolution?.reason),
    textField('evidenceNote', 'Evidence note', decision.resolution?.evidenceNote),
    textField('fromPortId', 'From port ID', candidate.fromPortId || candidate.targetPortId),
    textField('toPortId', 'To port ID', candidate.toPortId || candidate.connectedPortId),
    numberField('gapMm', 'Gap', candidate.gapMm ?? candidate.totalGapMm, 'mm'),
    ...pointFields('from', 'Rejected from', candidate.fromPosition || candidate.targetPosition),
    ...pointFields('to', 'Rejected to', candidate.toPosition || candidate.connectedPosition),
  ];
}

function categoryFields(trace) {
  if (trace.category === 'confirmed') return componentFields(trace);
  if (trace.category === 'candidate') return candidateFields(trace);
  if (trace.category === 'activePort') return activePortFields(trace);
  if (trace.category === 'repair') return repairFields(trace);
  if (trace.category === 'support') return supportFields(trace);
  if (trace.category === 'rejectedCandidate') return rejectedFields(trace);
  return [];
}

export function buildSequentialEngineeringSvgPropertySet(entity, revision) {
  const trace = entity.metadata?.sequential || {};
  return createEngineeringPropertySet({
    id: `ssk:properties:${entity.id}`,
    revision,
    ownerIds: [entity.id],
    fields: [...commonFields(entity, trace), ...categoryFields(trace)],
    metadata: { owner: SOURCE, readOnly: true, category: trace.category || null },
  });
}

export function buildSequentialEngineeringSvgPropertySets(scene, selectedIds) {
  const requested = new Set(selectedIds.map(String));
  const entities = scene.entities.filter((entity) => requested.has(entity.id));
  if (entities.length !== requested.size) {
    const found = new Set(entities.map((entity) => entity.id));
    const missing = [...requested].filter((id) => !found.has(id)).sort();
    throw new Error(`Sequential engineering SVG property owners are missing: ${missing.join(', ')}.`);
  }
  return Object.freeze(entities.map((entity) => buildSequentialEngineeringSvgPropertySet(entity, scene.revision)));
}
