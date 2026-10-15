function text(value) { return String(value ?? '').trim(); }
function clonePoint(value) { return value ? Object.freeze({ x: value.x, y: value.y, z: value.z }) : null; }
function unique(values) { return Object.freeze([...new Set(values.map(text).filter(Boolean))].sort()); }

export const ANALYTICAL_GEOMETRY_STATUSES = Object.freeze({
  COMPLETE: 'ANALYTICAL_GEOMETRY_COMPLETE',
  PARTIAL: 'ANALYTICAL_GEOMETRY_PARTIAL',
  DISPLAY_ONLY: 'DISPLAY_GEOMETRY_ONLY',
});
export const MASS_PROPERTY_STATUSES = Object.freeze({
  COMPLETE: 'MASS_PROPERTIES_COMPLETE',
  INCOMPLETE: 'MASS_PROPERTIES_INCOMPLETE',
});

function lineContext(branchId) {
  const fullLineTag = text(branchId).replace(/\/B[^/]+$/u, '');
  const tokens = fullLineTag.match(/[A-Z][0-9]{7}/gu) || [];
  return Object.freeze({
    sourceBranch: text(branchId),
    fullLineTag,
    lineFamily: tokens.length === 1 ? tokens[0] : null,
  });
}

function resolvedPortPositions(construction) {
  const positions = new Map();
  for (const connection of construction.connections || []) {
    if (connection.fromPortId && connection.fromPosition) positions.set(connection.fromPortId, connection.fromPosition);
    if (connection.toPortId && connection.toPosition) positions.set(connection.toPortId, connection.toPosition);
  }
  return positions;
}

function componentRepairRecords(component, construction) {
  const portIds = new Set((component.ports || []).map((port) => port.portId));
  const connectionIds = new Set((construction.connections || [])
    .filter((connection) => portIds.has(connection.fromPortId) || portIds.has(connection.toPortId))
    .map((connection) => connection.connectionId));
  return Object.freeze((construction.repairs || [])
    .filter((repair) => connectionIds.has(repair.connectionId))
    .map((repair) => Object.freeze({ ...repair })));
}

function shadowEvidence(component) {
  const shadow = component.shadowCarrierEvidence;
  if (!shadow) return null;
  return Object.freeze({
    ...shadow,
    aliases: unique([shadow.componentId, shadow.sourceComponentId, shadow.sourceName]),
    searchable: true,
    supportReferenceAddressable: true,
    independentlyRendered: false,
    independentlyExported: false,
    independentlyMassCounted: false,
  });
}

function requiredPositionedPortCount(component) {
  if (component.canonicalType === 'TEE') return 3;
  if (component.canonicalType === 'CAP' || component.canonicalType === 'BLIND') return 1;
  return 2;
}

function geometryStatus(component, ports) {
  const positioned = ports.filter((port) => port.resolvedPosition).length;
  const geometry = component.geometry;
  if (geometry && positioned >= requiredPositionedPortCount(component)) {
    return ANALYTICAL_GEOMETRY_STATUSES.COMPLETE;
  }
  if (geometry || positioned > 0) return ANALYTICAL_GEOMETRY_STATUSES.PARTIAL;
  return ANALYTICAL_GEOMETRY_STATUSES.DISPLAY_ONLY;
}

function massStatus(component) {
  return component.massProperties?.status === MASS_PROPERTY_STATUSES.COMPLETE
    ? MASS_PROPERTY_STATUSES.COMPLETE
    : MASS_PROPERTY_STATUSES.INCOMPLETE;
}

function carrierRecord(component, index, construction, resolvedPositions) {
  const shadow = shadowEvidence(component);
  const repairs = componentRepairRecords(component, construction);
  const ports = Object.freeze((component.ports || []).map((port) => Object.freeze({
    portId: port.portId,
    role: port.role,
    sourcePosition: clonePoint(port.sourcePosition),
    resolvedPosition: clonePoint(resolvedPositions.get(port.portId) || port.sourcePosition),
    tangent: port.tangent ? Object.freeze({ ...port.tangent }) : null,
    boreMm: port.boreMm ?? null,
    boreStatus: port.boreStatus || null,
    referenceTarget: port.referenceTarget || null,
  })));
  const analyticalGeometryStatus = geometryStatus(component, ports);
  const massPropertiesStatus = massStatus(component);
  return Object.freeze({
    schema: 'SequentialCarrierEvidence.v1',
    constructionFingerprint: construction.constructionFingerprint,
    routeOrder: index,
    componentId: component.componentId,
    sourceComponentId: component.sourceComponentId,
    aliases: unique([
      component.componentId,
      component.sourceComponentId,
      component.sourceName,
      shadow?.componentId,
      shadow?.sourceComponentId,
      shadow?.sourceName,
    ]),
    ...lineContext(component.branchId),
    canonicalType: component.canonicalType,
    sourceType: component.sourceType,
    analyticalGeometry: component.geometry || null,
    analyticalGeometryStatus,
    ports,
    shadowCarrierEvidence: shadow,
    repairRecords: repairs,
    confidence: repairs.length ? 'AUDITED_REPAIR' : 'CONFIRMED_SOURCE_EVIDENCE',
    sourceCoordinatesPreserved: true,
    massPropertiesStatus,
    physicalMassCountEligible: massPropertiesStatus === MASS_PROPERTY_STATUSES.COMPLETE,
    supportFamilyOwnership: Object.freeze([]),
    supportFamilyOwnershipStatus: 'NOT_PROJECTED_BY_ADAPTER',
  });
}

export function buildSequentialCarrierEvidenceCatalog(confirmedConstruction) {
  if (confirmedConstruction?.schema !== 'ConfirmedSequentialConstruction.v1') {
    throw new Error('Sequential carrier evidence requires ConfirmedSequentialConstruction.v1.');
  }
  if (!confirmedConstruction.downstreamEligibility?.supportProjection) {
    throw new Error('Sequential carrier evidence requires accepted downstream eligibility.');
  }
  if (!confirmedConstruction.constructionFingerprint) {
    throw new Error('Sequential carrier evidence requires a construction fingerprint.');
  }
  const resolvedPositions = resolvedPortPositions(confirmedConstruction);
  const carriers = Object.freeze((confirmedConstruction.components || []).map((component, index) => (
    carrierRecord(component, index, confirmedConstruction, resolvedPositions)
  )));
  return Object.freeze({
    schema: 'SequentialCarrierEvidenceCatalog.v1',
    constructionFingerprint: confirmedConstruction.constructionFingerprint,
    rootBranchId: confirmedConstruction.rootBranchId,
    branchIds: Object.freeze([...(confirmedConstruction.branchIds || [])]),
    carriers,
    boundaryClassifications: Object.freeze((confirmedConstruction.boundaryClassifications || []).map((row) => Object.freeze({ ...row }))),
    audit: Object.freeze({
      carrierCount: carriers.length,
      completeAnalyticalGeometryCount: carriers.filter((row) => row.analyticalGeometryStatus === ANALYTICAL_GEOMETRY_STATUSES.COMPLETE).length,
      partialAnalyticalGeometryCount: carriers.filter((row) => row.analyticalGeometryStatus === ANALYTICAL_GEOMETRY_STATUSES.PARTIAL).length,
      displayGeometryOnlyCount: carriers.filter((row) => row.analyticalGeometryStatus === ANALYTICAL_GEOMETRY_STATUSES.DISPLAY_ONLY).length,
      massPropertiesCompleteCount: carriers.filter((row) => row.massPropertiesStatus === MASS_PROPERTY_STATUSES.COMPLETE).length,
      massPropertiesIncompleteCount: carriers.filter((row) => row.massPropertiesStatus === MASS_PROPERTY_STATUSES.INCOMPLETE).length,
      shadowCarrierAliasCount: carriers.filter((carrier) => carrier.shadowCarrierEvidence).length,
      repairBearingCarrierCount: carriers.filter((carrier) => carrier.repairRecords.length).length,
      sourceCoordinatesMutated: false,
      supportProjectionConsumed: false,
    }),
  });
}
