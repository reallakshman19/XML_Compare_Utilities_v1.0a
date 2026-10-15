import { freezeConstructionSession } from './sequential-construction-contract.js';

function clonePoint(point) { return point ? { x: point.x, y: point.y, z: point.z } : null; }
function distance(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function derivedBasis(connection, side, sourcePosition) {
  if (sourcePosition) return 'SOURCE_EXPLICIT';
  if (side === 'from' && connection.connectionType === 'HEAD_BOUNDARY_TO_JUNCTION') return 'DERIVED_FROM_BRANCH_BOUNDARY';
  if (side === 'to' && connection.connectionType === 'BOUNDARY_TO_JUNCTION') return 'DERIVED_FROM_ACTIVE_BOUNDARY_PORT';
  if (connection.branchBoundaryPosition) return 'DERIVED_FROM_BRANCH_BOUNDARY';
  return 'DERIVED_FROM_CONFIRMED_CONNECTION';
}
function componentCentre(connection, indexes) {
  const componentId = connection.targetComponentId || indexes.ports.get(connection.toPortId)?.componentId;
  return clonePoint(indexes.components.get(componentId)?.geometry?.centre);
}
function enrichConnection(connection, indexes) {
  const fromPort = indexes.ports.get(connection.fromPortId);
  const toPort = indexes.ports.get(connection.toPortId);
  const fromSourcePosition = connection.fromSourcePosition !== undefined
    ? clonePoint(connection.fromSourcePosition)
    : clonePoint(fromPort?.sourcePosition);
  const toSourcePosition = connection.toSourcePosition !== undefined
    ? clonePoint(connection.toSourcePosition)
    : clonePoint(toPort?.sourcePosition);
  const fromPosition = clonePoint(connection.fromPosition);
  const toPosition = clonePoint(connection.toPosition);
  const centre = componentCentre(connection, indexes);
  const derivedBranchLegLengthMm = connection.derivedBranchLegLengthMm ?? (
    !toSourcePosition && toPosition && centre ? distance(centre, toPosition) : null
  );
  return Object.freeze({
    ...connection,
    fromSourcePosition,
    toSourcePosition,
    fromPosition,
    toPosition,
    fromPositionBasis: connection.fromPositionBasis || derivedBasis(connection, 'from', fromSourcePosition),
    toPositionBasis: connection.toPositionBasis || derivedBasis(connection, 'to', toSourcePosition),
    sourceGapMm: distance(fromSourcePosition, toSourcePosition),
    resolvedGapMm: distance(fromPosition, toPosition),
    derivedBranchLegLengthMm,
    coordinateDerivationStatus: fromSourcePosition && toSourcePosition
      ? 'BOTH_SOURCE_EXPLICIT'
      : fromSourcePosition || toSourcePosition
        ? 'ONE_PORT_DERIVED'
        : 'BOTH_PORTS_DERIVED',
  });
}

export function enrichCommittedConnectionEvidence(previousSession, nextSession, indexes) {
  if (!nextSession?.committedConnections?.length) return nextSession;
  const previousCount = previousSession?.committedConnections?.length || 0;
  const enriched = nextSession.committedConnections.map((connection, index) => (
    index < previousCount && connection.coordinateDerivationStatus
      ? connection
      : enrichConnection(connection, indexes)
  ));
  return freezeConstructionSession({ ...nextSession, committedConnections: enriched });
}
