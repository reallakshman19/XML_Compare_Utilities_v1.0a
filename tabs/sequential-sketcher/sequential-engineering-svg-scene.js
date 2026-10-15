import {
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createPolylineGeometry,
  createSegmentGeometry,
  freezeJsonValue,
} from '../../core/engineering-scene/index.js';
import { classifySequentialEngineeringSvgAuthority } from './sequential-engineering-svg-authority.js';
import { buildSequentialReversalSceneEntities } from './sequential-engineering-svg-reversal-scene.js';

export const SEQUENTIAL_ENGINEERING_SVG_PARITY_SCHEMA = 'SequentialEngineeringSvgParityReport.v1';

function point(value) {
  if (!value || !['x', 'y', 'z'].every((axis) => typeof value[axis] === 'number' && Number.isFinite(value[axis]))) return null;
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}

function samePoint(left, right) {
  return left && right && left.x === right.x && left.y === right.y && left.z === right.z;
}

function uniquePoints(values) {
  const points = values.map(point).filter(Boolean);
  return points.filter((value, index) => !index || !samePoint(value, points[index - 1]));
}

function lineGeometry(startValue, endValue) {
  const start = point(startValue); const end = point(endValue);
  if (!start || !end) return null;
  return samePoint(start, end) ? createPointGeometry(start) : createSegmentGeometry(start, end);
}

function pathGeometry(values) {
  const points = uniquePoints(values);
  if (!points.length) return null;
  if (points.length === 1) return createPointGeometry(points[0]);
  return points.length === 2 ? createSegmentGeometry(points[0], points[1]) : createPolylineGeometry(points);
}

function propertyId(entityId) { return `ssk:properties:${entityId}`; }

function sceneEntity(input) {
  return createEngineeringSceneEntity({
    id: input.id,
    kind: input.geometry.kind,
    domainType: input.domainType,
    geometry: input.geometry,
    domainRef: input.domainRef,
    propertySetIds: [propertyId(input.id)],
    editCapabilities: [],
    layer: input.layer,
    renderOrder: input.renderOrder,
    contributesToFit: input.contributesToFit,
    metadata: { sequential: input.metadata },
  });
}

function connectionsFor(component, authority) {
  const ports = new Set((component.ports || []).map((port) => port.portId));
  return authority.committedConnections.filter((row) => ports.has(row.fromPortId) || ports.has(row.toPortId));
}

function componentParts(component, stroke) {
  if (!stroke) return [];
  const common = { role: 'primary', geometry: null };
  if (stroke.op === 'DRAW_ELBOW') common.geometry = pathGeometry([stroke.entryPosition, stroke.centre, stroke.exitPosition]);
  else if (stroke.op === 'DRAW_TEE_RUN') {
    const run = pathGeometry([stroke.entryPosition, stroke.centre, stroke.exitPosition]);
    const branch = lineGeometry(stroke.centre, stroke.branchPosition);
    return [
      run ? { role: 'run', geometry: run } : null,
      branch ? { role: 'branch', geometry: branch } : null,
    ].filter(Boolean);
  } else if (stroke.op === 'DRAW_OLET') common.geometry = lineGeometry(stroke.hostPosition, stroke.branchPosition)
    || (point(stroke.hostPosition) ? createPointGeometry(point(stroke.hostPosition)) : null);
  else if (stroke.op === 'DRAW_CAP') common.geometry = point(stroke.entryPosition)
    ? createPointGeometry(point(stroke.entryPosition)) : null;
  else common.geometry = lineGeometry(stroke.entryPosition, stroke.exitPosition);
  return common.geometry ? [common] : [];
}

function confirmedEntities(authority, omissions) {
  const strokes = new Map(authority.session.strokeLedger
    .filter((row) => row.componentId && row.op.startsWith('DRAW_'))
    .map((row) => [row.componentId, row]));
  const entities = [];
  authority.confirmedComponents.forEach((component, routeOrder) => {
    const parts = componentParts(component, strokes.get(component.componentId));
    if (!parts.length) {
      omissions.push({ category: 'confirmed', id: component.componentId, reason: 'AUTHORITATIVE_DRAW_GEOMETRY_MISSING' });
      return;
    }
    const connections = connectionsFor(component, authority);
    parts.forEach((part) => {
      const suffix = part.role === 'primary' ? '' : `:${part.role}`;
      const id = `ssk:component:${component.componentId}${suffix}`;
      entities.push(sceneEntity({
        id, geometry: part.geometry, domainType: 'SEQUENTIAL_CONFIRMED_COMPONENT',
        layer: 'sequential-confirmed', renderOrder: 10, contributesToFit: true,
        domainRef: { owner: 'sequential-sketcher', category: 'confirmed', componentId: component.componentId, geometryRole: part.role },
        metadata: { category: 'confirmed', status: 'CONFIRMED', routeOrder, geometryRole: part.role, component, connections },
      }));
    });
  });
  return entities;
}

function repairEntities(authority, omissions) {
  return authority.repairs.map((repair) => {
    const connection = authority.committedConnections.find((row) => row.connectionId === repair.connectionId);
    const geometry = lineGeometry(repair.resolvedFromPosition || connection?.fromPosition, repair.resolvedToPosition || connection?.toPosition);
    if (!geometry) {
      omissions.push({ category: 'repair', id: repair.repairId, reason: 'REPAIR_GEOMETRY_MISSING' });
      return null;
    }
    const id = `ssk:repair:${repair.repairId}`;
    return sceneEntity({
      id, geometry, domainType: 'SEQUENTIAL_REPAIRED_CONTINUITY', layer: 'sequential-diagnostic',
      renderOrder: 20, contributesToFit: true,
      domainRef: { owner: 'sequential-sketcher', category: 'repair', repairId: repair.repairId, connectionId: repair.connectionId },
      metadata: { category: 'repair', status: 'CONFIRMED_REPAIR', repair, connection: connection || null },
    });
  }).filter(Boolean);
}

function candidateEntities(authority, omissions) {
  return authority.candidates.map((candidate) => {
    const geometry = lineGeometry(candidate.fromPosition || candidate.targetPosition, candidate.toPosition || candidate.connectedPosition);
    if (!geometry) {
      omissions.push({ category: 'candidate', id: candidate.candidateId, reason: 'CANDIDATE_GEOMETRY_MISSING' });
      return null;
    }
    const id = `ssk:candidate:${candidate.candidateId}`;
    return sceneEntity({
      id, geometry, domainType: 'SEQUENTIAL_CONNECTION_CANDIDATE', layer: 'sequential-candidate',
      renderOrder: 30, contributesToFit: false,
      domainRef: { owner: 'sequential-sketcher', category: 'candidate', candidateId: candidate.candidateId },
      metadata: { category: 'candidate', status: 'NOT_CONFIRMED', reason: authority.candidateReason, candidate },
    });
  }).filter(Boolean);
}

function activePortEntity(authority, omissions) {
  if (!authority.session.activeExitPortId) return [];
  const active = authority.activePort;
  const position = point(active?.resolvedPosition);
  if (!active || !position) {
    omissions.push({ category: 'activePort', id: authority.session.activeExitPortId, reason: 'ACTIVE_PORT_POSITION_MISSING' });
    return [];
  }
  const id = `ssk:port:${active.portId}`;
  return [sceneEntity({
    id, geometry: createPointGeometry(position), domainType: 'SEQUENTIAL_ACTIVE_PORT',
    layer: 'sequential-active-port', renderOrder: 50, contributesToFit: false,
    domainRef: { owner: 'sequential-sketcher', category: 'activePort', portId: active.portId, componentId: active.componentId },
    metadata: { category: 'activePort', status: 'ACTIVE', port: active, constructionState: authority.state },
  })];
}

function supportEntities(authority, omissions) {
  return authority.supports.map(({ glyph, family }) => {
    const position = point(glyph.centerlinePointGlobal);
    if (!position || !glyph.carrierId) {
      omissions.push({ category: 'support', id: glyph.glyphId, reason: !glyph.carrierId ? 'SUPPORT_CARRIER_EVIDENCE_MISSING' : 'SUPPORT_POSITION_MISSING' });
      return null;
    }
    const id = `ssk:support:${glyph.glyphId}`;
    return sceneEntity({
      id, geometry: createPointGeometry(position), domainType: 'SEQUENTIAL_CONFIRMED_SUPPORT', layer: 'sequential-support',
      renderOrder: 40, contributesToFit: true,
      domainRef: { owner: 'sequential-sketcher', category: 'support', supportId: glyph.glyphId, familyId: glyph.familyId, carrierId: glyph.carrierId },
      metadata: { category: 'support', status: glyph.resolutionStatus, glyph, family },
    });
  }).filter(Boolean);
}

function rejectedEntities(authority, omissions) {
  const rows = authority.rejectedCandidates.map(({ candidateId, candidate, decision }) => {
    const geometry = lineGeometry(candidate.fromPosition || candidate.targetPosition, candidate.toPosition || candidate.connectedPosition);
    if (!geometry) {
      omissions.push({ category: 'rejectedCandidate', id: candidateId, reason: 'REJECTED_CANDIDATE_GEOMETRY_MISSING' });
      return null;
    }
    const id = `ssk:rejected:${candidateId}`;
    return sceneEntity({
      id, geometry, domainType: 'SEQUENTIAL_REJECTED_CANDIDATE', layer: 'sequential-diagnostic',
      renderOrder: 5, contributesToFit: false,
      domainRef: { owner: 'sequential-sketcher', category: 'rejectedCandidate', candidateId },
      metadata: { category: 'rejectedCandidate', status: 'REJECTED', candidate, decision },
    });
  }).filter(Boolean);
  authority.rejectedCandidateIdsMissingEvidence.forEach((id) => omissions.push({ category: 'rejectedCandidate', id, reason: 'REJECTED_CANDIDATE_EVIDENCE_MISSING' }));
  return rows;
}

function disconnectedComponents(authority) {
  const ids = authority.confirmedComponents.map((component) => component.componentId);
  if (ids.length < 2) return [];
  const confirmed = new Set(ids); const adjacency = new Map(ids.map((id) => [id, new Set()]));
  for (const connection of authority.committedConnections) {
    const left = authority.evidenceModel.ports.find((port) => port.portId === connection.fromPortId)?.componentId;
    const right = authority.evidenceModel.ports.find((port) => port.portId === connection.toPortId)?.componentId;
    if (!confirmed.has(left) || !confirmed.has(right) || left === right) continue;
    adjacency.get(left).add(right); adjacency.get(right).add(left);
  }
  const visited = new Set([ids[0]]); const queue = [ids[0]];
  while (queue.length) for (const next of adjacency.get(queue.shift()) || []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  return ids.filter((id) => !visited.has(id));
}

function parityReport(authority, sceneId, entities, omissions) {
  const categories = ['confirmed', 'repair', 'candidate', 'reversalCandidate', 'activePort', 'support', 'rejectedCandidate'];
  const mapped = Object.fromEntries(categories.map((category) => [category, entities.filter((entity) => entity.domainRef.category === category).length]));
  const ids = entities.map((entity) => entity.id);
  const unresolvedPorts = authority.confirmedComponents.flatMap((component) => component.ports || [])
    .filter((port) => !point(port.sourcePosition) && !authority.committedConnections.some((row) => (
      (row.fromPortId === port.portId && point(row.fromPosition)) || (row.toPortId === port.portId && point(row.toPosition))
    ))).map((port) => port.portId).sort();
  const candidatesMissingEvidence = authority.candidates.filter((candidate) => !candidate.sourceAdjacent && !candidate.referenceMatch && !candidate.attachmentEvent).map((candidate) => candidate.candidateId).sort();
  const supportMissingCarrier = [
    ...authority.supports.filter(({ glyph }) => !glyph.carrierId).map(({ glyph }) => glyph.glyphId),
    ...authority.unresolvedSupportFamilies.map((family) => family.familyId),
  ].sort();
  return freezeJsonValue({
    schema: SEQUENTIAL_ENGINEERING_SVG_PARITY_SCHEMA,
    sceneId,
    revision: authority.revision,
    confirmedComponentCount: authority.confirmedComponents.length,
    confirmedGeometryCount: mapped.confirmed,
    repairCount: authority.repairs.length,
    candidateCount: authority.candidates.length,
    reversalCandidateCount: authority.reversalCandidates.length,
    activePortCount: authority.session.activeExitPortId ? 1 : 0,
    supportCount: authority.supports.length,
    restraintCount: 0,
    rejectedCandidateCount: (authority.session.rejectedCandidateIds || []).length,
    mappedCountByCategory: mapped,
    mappedTotal: entities.length,
    omissions: [...omissions, ...authority.architecturalOmissions],
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    invalidGeometry: [],
    unresolvedPorts,
    disconnectedConfirmedGeometry: disconnectedComponents(authority),
    candidatesMissingContinuityEvidence: candidatesMissingEvidence,
    supportAttachmentsMissingCarrierEvidence: supportMissingCarrier,
    propertySetCoverage: { eligible: entities.length, mapped: entities.filter((entity) => entity.propertySetIds.length === 1).length },
    revisionConsistency: {
      sessionFingerprint: authority.sessionFingerprint,
      confirmedConstructionFingerprint: authority.confirmedConstructionFingerprint,
      supportConstructionFingerprint: authority.supportConstructionFingerprint,
      supportMatchesConfirmed: !authority.supportConstructionFingerprint || authority.supportConstructionFingerprint === authority.confirmedConstructionFingerprint,
    },
  });
}

export function buildSequentialEngineeringSvgScene(input, options = {}) {
  const authority = input?.schema === 'SequentialEngineeringSvgAuthority.v1'
    ? input : classifySequentialEngineeringSvgAuthority(input);
  const sceneId = String(options.sceneId || '').trim();
  if (!sceneId) throw new TypeError('Sequential engineering SVG requires an explicit sceneId.');
  const omissions = [];
  const entities = [
    ...confirmedEntities(authority, omissions),
    ...repairEntities(authority, omissions),
    ...candidateEntities(authority, omissions),
    ...buildSequentialReversalSceneEntities(authority, omissions),
    ...supportEntities(authority, omissions),
    ...activePortEntity(authority, omissions),
    ...rejectedEntities(authority, omissions),
  ];
  const parity = parityReport(authority, sceneId, entities, omissions);
  const scene = createEngineeringScene({
    sceneId, revision: authority.revision, coordinateSystem: options.coordinateSystem,
    projections: ['ISO', 'XY', 'XZ', 'YZ'], entities,
    capabilities: { selection: true, properties: true, parity: true, editing: false },
    metadata: { sequential: { authoritySchema: authority.schema, state: authority.state, visibleProjection: String(options.visibleProjection || ''), parity } },
  });
  return Object.freeze({ scene, parity, authority });
}

export const _test = Object.freeze({ point, samePoint, componentParts, disconnectedComponents });
