import { stableToken } from '../sequential-sketcher-contract.js';
import { CONSTRUCTION_STATES } from './sequential-construction-contract.js';

const ACCEPTED_CONNECTION_STATUSES = new Set([
  'CONFIRMED_EXPLICIT',
  'CONFIRMED_REFERENCE',
  'CONFIRMED_EXACT',
  'AUTO_REPAIRED_SMALL_GAP',
  'USER_CONFIRMED',
  'INTENTIONAL_TERMINAL',
  'EXTERNAL_BOUNDARY',
]);

function clonePoint(point) { return point ? Object.freeze({ x: point.x, y: point.y, z: point.z }) : null; }
function freezeArray(rows) { return Object.freeze(rows.map((row) => Object.freeze(row))); }
function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Confirmed construction contains duplicate ${label}: ${value}`);
    seen.add(value);
  }
}
function normalizedShadowCarrier(shadow) {
  if (!shadow) return null;
  return Object.freeze({
    ...shadow,
    ports: Object.freeze((shadow.ports || []).map((port) => Object.freeze({
      ...port,
      sourcePosition: clonePoint(port.sourcePosition),
      resolvedPosition: clonePoint(port.resolvedPosition),
      tangent: port.tangent ? Object.freeze({ ...port.tangent }) : null,
    }))),
  });
}
function confirmedComponent(component) {
  return Object.freeze({
    componentId: component.componentId,
    sourceComponentId: component.sourceComponentId,
    sourceName: component.sourceName,
    branchId: component.branchId,
    sourceIndex: component.sourceIndex,
    canonicalType: component.canonicalType,
    sourceType: component.sourceType,
    attributes: component.attributes,
    geometry: component.geometry,
    shadowCarrierEvidence: normalizedShadowCarrier(component.shadowCarrierEvidence),
    ports: Object.freeze(component.ports.map((port) => Object.freeze({
      portId: port.portId,
      role: port.role,
      sourcePosition: clonePoint(port.sourcePosition),
      boreMm: port.boreMm,
      boreStatus: port.boreStatus,
      tangent: port.tangent ? Object.freeze({ ...port.tangent }) : null,
      referenceTarget: port.referenceTarget,
    }))),
  });
}
function normalizedConnection(connection) {
  return Object.freeze({
    ...connection,
    fromPosition: clonePoint(connection.fromPosition),
    toPosition: clonePoint(connection.toPosition),
    fromSourcePosition: clonePoint(connection.fromSourcePosition),
    toSourcePosition: clonePoint(connection.toSourcePosition),
    branchBoundaryPosition: clonePoint(connection.branchBoundaryPosition),
    basis: Object.freeze([...(connection.basis || [])]),
  });
}
function normalizedRepair(repair) {
  return Object.freeze({
    ...repair,
    sourceFromPosition: clonePoint(repair.sourceFromPosition),
    sourceToPosition: clonePoint(repair.sourceToPosition),
    resolvedFromPosition: clonePoint(repair.resolvedFromPosition),
    resolvedToPosition: clonePoint(repair.resolvedToPosition),
  });
}
function normalizedBoundaryClassification(classification) {
  if (classification.classification !== 'EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED') {
    throw new Error(`Boundary classification is not physically confirmed: ${classification.classificationId}`);
  }
  if (classification.positionStatus !== 'POSITION_CONFIRMED') {
    throw new Error(`Boundary position evidence is not confirmed: ${classification.classificationId}`);
  }
  return Object.freeze({
    ...classification,
    normalizationOperations: Object.freeze([...(classification.normalizationOperations || [])]),
    basis: Object.freeze([...(classification.basis || [])]),
    sourcePosition: clonePoint(classification.sourcePosition),
    boundaryPosition: clonePoint(classification.boundaryPosition),
    resolvedPosition: clonePoint(classification.resolvedPosition),
  });
}

export function createConfirmedSequentialConstruction(session, indexes) {
  if (!session || session.state !== CONSTRUCTION_STATES.ROUTE_COMPLETE) {
    throw new Error('Confirmed construction requires ROUTE_COMPLETE state.');
  }
  if (session.currentDecisionRequest) throw new Error('Confirmed construction cannot contain an open decision request.');
  if (!session.headBoundaryValidated) throw new Error('Confirmed construction requires head-boundary validation.');
  if (!session.confirmedComponentIds.length) throw new Error('Confirmed construction requires at least one component.');
  assertUnique(session.confirmedComponentIds, 'component ID');
  assertUnique(session.committedConnections.map((connection) => connection.connectionId), 'connection ID');
  assertUnique((session.boundaryClassifications || []).map((row) => row.classificationId), 'boundary classification ID');

  const components = session.confirmedComponentIds.map((componentId) => {
    const component = indexes.components.get(componentId);
    if (!component) throw new Error(`Confirmed component evidence is missing: ${componentId}`);
    return confirmedComponent(component);
  });
  const connections = session.committedConnections.map((connection) => {
    if (!ACCEPTED_CONNECTION_STATUSES.has(connection.status)) {
      throw new Error(`Connection is not accepted: ${connection.connectionId} (${connection.status})`);
    }
    if (!indexes.ports.has(connection.fromPortId) || !indexes.ports.has(connection.toPortId)) {
      throw new Error(`Connection references an unknown port: ${connection.connectionId}`);
    }
    if (!connection.coordinateDerivationStatus) {
      throw new Error(`Connection audit evidence is incomplete: ${connection.connectionId}`);
    }
    return normalizedConnection(connection);
  });
  const repairs = session.repairLedger.map(normalizedRepair);
  const boundaryClassifications = (session.boundaryClassifications || []).map(normalizedBoundaryClassification);
  const branchIds = [...new Set(components.map((component) => component.branchId))];
  const evidenceForFingerprint = {
    rootBranchId: session.rootBranchId,
    componentIds: components.map((component) => [component.componentId, component.shadowCarrierEvidence?.componentId || null]),
    connections: connections.map((connection) => [connection.connectionId, connection.fromPortId, connection.toPortId, connection.status, connection.resolvedGapMm]),
    repairs: repairs.map((repair) => [repair.repairId, repair.connectionId, repair.gapMm, repair.approvedBy]),
    boundaryClassifications: boundaryClassifications.map((row) => [
      row.classificationId,
      row.boundaryRole,
      row.branchId,
      row.rawReference,
      row.normalizedReference,
      row.classification,
      row.dialect,
      row.confidence,
      [...row.basis],
      row.activePortId,
      row.positionStatus,
      row.positionGapMm,
      row.exactBoundaryToleranceMm,
    ]),
    strokes: session.strokeLedger.map((stroke) => [stroke.op, stroke.componentId || stroke.connectionId || stroke.branchId || '']),
  };
  const shadowCarrierCount = components.filter((component) => component.shadowCarrierEvidence).length;

  return Object.freeze({
    schema: 'ConfirmedSequentialConstruction.v1',
    constructionFingerprint: stableToken(JSON.stringify(evidenceForFingerprint)),
    rootBranchId: session.rootBranchId,
    branchIds: Object.freeze(branchIds),
    headBoundaryConnectionId: session.headBoundaryConnectionId,
    components: Object.freeze(components),
    connections: Object.freeze(connections),
    repairs: Object.freeze(repairs),
    boundaryClassifications: Object.freeze(boundaryClassifications),
    decisions: freezeArray(session.decisionLedger.map((decision) => ({ ...decision }))),
    strokeLedger: freezeArray(session.strokeLedger.map((stroke) => ({ ...stroke }))),
    downstreamEligibility: Object.freeze({ supportProjection: true, export: true, calculation: true }),
    audit: Object.freeze({
      confirmedComponentCount: components.length,
      shadowCarrierCount,
      committedConnectionCount: connections.length,
      repairCount: repairs.length,
      boundaryClassificationCount: boundaryClassifications.length,
      branchCount: branchIds.length,
      sourceCoordinatesMutated: false,
      openDecisionCount: 0,
      unacceptedConnectionCount: 0,
    }),
  });
}
