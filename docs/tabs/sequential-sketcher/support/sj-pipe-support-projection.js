// Copied from 3D_Converters@ffbbafbb1757a84826b736731a8d75c43a2c3e9c.
// Sequential Sketcher owns this copy and its local dependencies.
import {
  POSITION_STATUS,
  FITTING_LOCATION_TYPE,
  buildLocalFrame,
  locateSupportOnCarrier,
} from './sj-pipe-support-geometry.js';
import {
  cleanText,
  cloneJson,
  clonePoint,
  finiteNumber,
  isPoint,
  parsePoint,
  pointDistance,
  round6,
  sequenceIndexFromPath,
  sourceAttributes,
  unique,
} from './sj-pipe-support-utils.js';
import {
  deriveSupportFamilyIdentity,
  reconstructSupportFamilies,
} from './sj-pipe-support-family.js';

export const PIPE_SUPPORT_PROJECTION_SCHEMA = 'PipeSupportProjectionBundle.v1';
export { POSITION_STATUS, FITTING_LOCATION_TYPE, deriveSupportFamilyIdentity };

const STRAIGHT_CARRIER_TYPES = new Set([
  'PIPE', 'REDUCER', 'VALVE', 'FLANGE', 'GASKET',
  'INSTRUMENT', 'COUPLING', 'UNION',
]);
const POSITION_STATUS_SET = new Set(Object.values(POSITION_STATUS));

export function buildPipeSupportProjectionBundle(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('buildPipeSupportProjectionBundle input must be an object.');
  }
  if (!Array.isArray(input.carriers)) {
    throw new TypeError('input.carriers must be an already validated ordered carrier traversal.');
  }
  if (!Array.isArray(input.supportRecords)) {
    throw new TypeError('input.supportRecords must be an array of source support sibling records.');
  }
  const requestedUnits = cleanText(input.coordinateSystem?.units || 'mm').toLowerCase();
  if (requestedUnits && requestedUnits !== 'mm') {
    throw new TypeError('Pipe support projection accepts millimetres only.');
  }

  const options = normalizeOptions(input);
  if (!options.branchId) throw new TypeError('input.branchId is required.');
  const diagnostics = [];
  const sourceCarriers = input.carriers;
  const carriers = sourceCarriers.map((carrier, index) => (
    normalizeCarrier(carrier, index, options.branchId, diagnostics)
  ));
  const families = reconstructSupportFamilies(input.supportRecords, {
    branchId: options.branchId,
    diagnostics,
    hasPhysicalGeometry: input.hasPhysicalGeometry,
  });
  const branchAliases = new Set([
    options.branchId,
    ...(input.branchAliases || []),
  ].map(cleanText).filter(Boolean));
  const resolvedFamilies = [];
  const unresolvedFamilies = [];

  for (const family of families) {
    if (family.sourceParentBranch && !branchAliases.has(family.sourceParentBranch)) {
      diagnostics.push({
        severity: 'INFO',
        code: 'SUPPORT_FAMILY_EXCLUDED_FROM_BRANCH_BUNDLE',
        familyId: family.familyId,
        sourceParentBranch: family.sourceParentBranch,
        message: 'Support family belongs to another piping branch and was excluded from this branch bundle.',
      });
      continue;
    }

    const binding = resolveCarrierBinding(family, carriers, sourceCarriers, options, diagnostics);
    if (binding.bindingStatus !== 'RESOLVED') {
      unresolvedFamilies.push(finalizeUnresolvedFamily(family, binding, binding.positionStatus));
      continue;
    }
    const resolved = finalizeResolvedFamily(family, binding, options, diagnostics);
    if (resolved.position.positionStatus === POSITION_STATUS.AMBIGUOUS_CARRIER
      || resolved.position.positionStatus === POSITION_STATUS.OUTSIDE_PROJECTION_TOLERANCE
      || resolved.position.positionStatus === POSITION_STATUS.UNRESOLVED) {
      unresolvedFamilies.push(resolved);
    } else {
      resolvedFamilies.push(resolved);
    }
  }

  resolvedFamilies.sort((left, right) => (
    left.carrierBinding.carrierTraversalIndex - right.carrierBinding.carrierTraversalIndex
    || (left.position.carrierStationMm ?? Number.POSITIVE_INFINITY)
      - (right.position.carrierStationMm ?? Number.POSITIVE_INFINITY)
    || left.familyId.localeCompare(right.familyId)
  ));
  unresolvedFamilies.sort((left, right) => left.familyId.localeCompare(right.familyId));

  const byCarrier = new Map(carriers.map((carrier, carrierTraversalIndex) => [carrier.carrierId, {
    ...carrier.output,
    carrierTraversalIndex,
    supportFamilies: [],
  }]));
  for (const family of resolvedFamilies) {
    byCarrier.get(family.carrierBinding.carrierId)?.supportFamilies.push(cloneJson(family));
  }

  return {
    schema: PIPE_SUPPORT_PROJECTION_SCHEMA,
    coordinateSystem: {
      units: 'mm',
      globalAxes: cloneJson(input.coordinateSystem?.globalAxes || null),
      plantUp: clonePoint(options.plantUp),
      localFrameHandedness: 'RIGHT_HANDED',
    },
    branchId: options.branchId,
    carriers: [...byCarrier.values()],
    resolvedSupportFamilies: resolvedFamilies.map(cloneJson),
    unresolvedSupportFamilies: unresolvedFamilies.map(cloneJson),
    supportGlyphs: resolvedFamilies.map(toSupportGlyph),
    diagnostics: diagnostics.map(cloneJson),
    audit: {
      inputCarrierCount: carriers.length,
      sourceSupportRecordCount: input.supportRecords.length,
      reconstructedFamilyCount: families.length,
      resolvedFamilyCount: resolvedFamilies.length,
      unresolvedFamilyCount: unresolvedFamilies.length,
      excludedForeignFamilyCount: diagnostics.filter((row) => (
        row.code === 'SUPPORT_FAMILY_EXCLUDED_FROM_BRANCH_BUNDLE'
      )).length,
      sourceCarrierTraversalPreserved: true,
      carrierCoordinatesModified: false,
      structuralTraversalPerformed: false,
      structuralMatrixCompositionPerformed: false,
      clashDetectionPerformed: false,
      structuralProximityEvaluationPerformed: false,
    },
  };
}

function resolveCarrierBinding(family, carriers, sourceCarriers, options, diagnostics) {
  const explicit = explicitCarrierCandidates(family, carriers);
  if (explicit.length === 1) {
    return locateOnCarrier(family, explicit[0], carriers, options, 'EXPLICIT_REFERENCE');
  }
  if (explicit.length > 1) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'SUPPORT_CARRIER_REFERENCE_AMBIGUOUS',
      familyId: family.familyId,
      candidateCarrierIds: explicit.map((carrier) => carrier.carrierId),
      message: 'Explicit support carrier references matched multiple carriers.',
    });
    return {
      bindingStatus: 'AMBIGUOUS',
      bindingBasis: 'EXPLICIT_REFERENCE',
      candidateCarrierIds: explicit.map((carrier) => carrier.carrierId),
      positionStatus: POSITION_STATUS.AMBIGUOUS_CARRIER,
    };
  }

  const sequenceCandidates = carriers.filter((carrier) => (
    isSourceSequenceMatch(family, carrier, sourceCarriers)
  ));
  if (sequenceCandidates.length === 1) {
    const located = locateOnCarrier(family, sequenceCandidates[0], carriers, options, 'SOURCE_SEQUENCE');
    if (located.bindingStatus === 'RESOLVED') return located;
  }

  const locatedCandidates = carriers
    .map((carrier) => locateOnCarrier(family, carrier, carriers, options, 'GEOMETRIC_PROJECTION'))
    .filter((candidate) => candidate.bindingStatus === 'RESOLVED')
    .sort((left, right) => (
      left.position.distanceToCarrierMm - right.position.distanceToCarrierMm
      || left.carrierTraversalIndex - right.carrierTraversalIndex
    ));
  if (!locatedCandidates.length) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'SUPPORT_CARRIER_UNRESOLVED',
      familyId: family.familyId,
      message: 'No validated carrier was within the projection tolerance.',
    });
    return {
      bindingStatus: 'UNRESOLVED',
      bindingBasis: 'GEOMETRIC_PROJECTION',
      candidateCarrierIds: [],
      positionStatus: POSITION_STATUS.OUTSIDE_PROJECTION_TOLERANCE,
    };
  }

  const best = locatedCandidates[0];
  const tied = locatedCandidates.filter((candidate) => (
    Math.abs(candidate.position.distanceToCarrierMm - best.position.distanceToCarrierMm)
      <= options.ambiguityToleranceMm
  ));
  if (tied.length > 1) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'SUPPORT_CARRIER_GEOMETRIC_AMBIGUITY',
      familyId: family.familyId,
      candidateCarrierIds: tied.map((candidate) => candidate.carrierId),
      message: 'Multiple carriers are equally plausible within the ambiguity tolerance.',
    });
    return {
      bindingStatus: 'AMBIGUOUS',
      bindingBasis: 'GEOMETRIC_PROJECTION',
      candidateCarrierIds: tied.map((candidate) => candidate.carrierId),
      positionStatus: POSITION_STATUS.AMBIGUOUS_CARRIER,
    };
  }
  return best;
}

function explicitCarrierCandidates(family, carriers) {
  if (!family.explicitCarrierReferences.length) return [];
  return carriers.filter((carrier) => family.explicitCarrierReferences.some((reference) => (
    carrier.references.has(reference)
  )));
}

function locateOnCarrier(family, carrier, carriers, options, bindingBasis) {
  const carrierTraversalIndex = carriers.indexOf(carrier);
  const location = locateSupportOnCarrier({
    supportPosGlobal: family.supportPosGlobal,
    carrier,
    projectionToleranceMm: options.projectionToleranceMm,
    onCenterlineToleranceMm: options.onCenterlineToleranceMm,
    plantUp: options.plantUp,
  });
  if (!location || !POSITION_STATUS_SET.has(location.positionStatus)) {
    return {
      bindingStatus: 'UNRESOLVED',
      bindingBasis,
      candidateCarrierIds: [carrier.carrierId],
      positionStatus: POSITION_STATUS.UNRESOLVED,
    };
  }
  if (location.positionStatus === POSITION_STATUS.OUTSIDE_PROJECTION_TOLERANCE) {
    return {
      bindingStatus: 'UNRESOLVED',
      bindingBasis,
      candidateCarrierIds: [carrier.carrierId],
      positionStatus: location.positionStatus,
      position: normalizePosition(location),
    };
  }
  return {
    bindingStatus: 'RESOLVED',
    bindingBasis,
    carrierId: carrier.carrierId,
    carrierType: carrier.carrierType,
    carrierTraversalIndex,
    sourceBranchId: carrier.sourceBranchId,
    candidateCarrierIds: [carrier.carrierId],
    carrier,
    positionStatus: location.positionStatus,
    position: normalizePosition(location),
  };
}

function finalizeResolvedFamily(family, binding, options, diagnostics) {
  const localFrame = binding.position?.localFrame || buildLocalFrame({
    origin: binding.position?.centerlinePointGlobal || family.supportPosGlobal,
    tangent: binding.carrier.tangent,
    plantUp: options.plantUp,
  });
  if (!localFrame) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'LOCAL_FRAME_UNRESOLVED',
      familyId: family.familyId,
      carrierId: binding.carrierId,
      message: 'A right-handed carrier-local frame could not be resolved.',
    });
  }
  const normalizedFrame = localFrame ? normalizeLocalFrame(localFrame) : null;

  return {
    familyId: family.familyId,
    familyIdBasis: family.familyIdBasis,
    sourceParentBranch: family.sourceParentBranch,
    sourceParentBranches: cloneJson(family.sourceParentBranches),
    resolvedFunction: {
      supportKind: family.resolvedSupportKind,
      resolutionBasis: 'SOURCE_FAMILY_EVIDENCE',
    },
    carrierBinding: {
      bindingStatus: binding.bindingStatus,
      bindingBasis: binding.bindingBasis,
      carrierId: binding.carrierId,
      carrierType: binding.carrierType,
      carrierTraversalIndex: binding.carrierTraversalIndex,
      sourceBranchId: binding.sourceBranchId,
      candidateCarrierIds: cloneJson(binding.candidateCarrierIds),
    },
    traversal: cloneJson(binding.carrier.traversal),
    localFrame: normalizedFrame,
    position: {
      ...normalizePosition(binding.position),
      localFrame: normalizedFrame,
    },
    members: cloneJson(family.members),
  };
}

function finalizeUnresolvedFamily(family, binding, positionStatus) {
  return {
    familyId: family.familyId,
    familyIdBasis: family.familyIdBasis,
    sourceParentBranch: family.sourceParentBranch,
    sourceParentBranches: cloneJson(family.sourceParentBranches),
    resolvedFunction: {
      supportKind: family.resolvedSupportKind,
      resolutionBasis: 'SOURCE_FAMILY_EVIDENCE',
    },
    carrierBinding: {
      bindingStatus: binding.bindingStatus,
      bindingBasis: binding.bindingBasis,
      carrierId: binding.carrierId || null,
      carrierType: binding.carrierType || null,
      carrierTraversalIndex: binding.carrierTraversalIndex ?? null,
      sourceBranchId: binding.sourceBranchId || null,
      candidateCarrierIds: cloneJson(binding.candidateCarrierIds || []),
    },
    traversal: binding.carrier?.traversal ? cloneJson(binding.carrier.traversal) : null,
    localFrame: binding.position?.localFrame ? normalizeLocalFrame(binding.position.localFrame) : null,
    position: {
      supportPosGlobal: family.supportPosGlobal ? clonePoint(family.supportPosGlobal) : null,
      centerlinePointGlobal: binding.position?.centerlinePointGlobal
        ? clonePoint(binding.position.centerlinePointGlobal)
        : null,
      carrierStationMm: roundedNumber(binding.position?.carrierStationMm),
      carrierFraction: roundedNumber(binding.position?.carrierFraction),
      distanceToCarrierMm: roundedNumber(binding.position?.distanceToCarrierMm),
      offsetFromCenterline: binding.position?.offsetFromCenterline
        ? cloneJson(binding.position.offsetFromCenterline)
        : null,
      positionStatus: normalizePositionStatus(positionStatus),
      fittingLocation: binding.position?.fittingLocation
        ? cloneJson(binding.position.fittingLocation)
        : null,
      localFrame: binding.position?.localFrame
        ? normalizeLocalFrame(binding.position.localFrame)
        : null,
    },
    members: cloneJson(family.members),
  };
}

function toSupportGlyph(family) {
  return {
    glyphId: `SUPPORT:${family.familyId}`,
    familyId: family.familyId,
    carrierId: family.carrierBinding.carrierId,
    carrierStationMm: family.position.carrierStationMm,
    centerlinePointGlobal: clonePoint(family.position.centerlinePointGlobal),
    localFrame: cloneJson(family.position.localFrame),
    fittingLocation: family.position.fittingLocation
      ? cloneJson(family.position.fittingLocation)
      : null,
    displayKind: family.resolvedFunction.supportKind,
    label: family.familyId.replace(/^\//u, ''),
    resolutionStatus: 'RESOLVED',
  };
}

function normalizeCarrier(carrier, index, branchId, diagnostics) {
  if (!carrier || typeof carrier !== 'object' || Array.isArray(carrier)) {
    throw new TypeError(`carriers[${index}] must be an object.`);
  }
  const carrierId = cleanText(carrier.carrierId || carrier.id || carrier.ref || carrier.name);
  if (!carrierId) throw new TypeError(`carriers[${index}].carrierId is required.`);
  const carrierType = cleanText(
    carrier.carrierType || carrier.componentType || carrier.type,
  ).toUpperCase() || 'UNKNOWN';
  const sourceBranchId = cleanText(
    carrier.sourceBranchId || carrier.sourceBranchName || carrier.branchId || carrier.branchName,
  ) || branchId;
  const attrs = sourceAttributes(carrier);
  const traversal = normalizeTraversal(carrier.traversal || carrier);
  const centerline = normalizeCenterline(carrier, attrs, traversal);
  if (!centerline && STRAIGHT_CARRIER_TYPES.has(carrierType)) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'CARRIER_CENTERLINE_MISSING',
      carrierId,
      message: 'Straight carrier has no usable validated centreline.',
    });
  }

  const references = new Set(unique([
    carrierId,
    cleanText(carrier.sourceRef),
    cleanText(carrier.ref),
    cleanText(carrier.name),
    cleanText(attrs.REF),
    cleanText(attrs.COMPRE),
    cleanText(attrs.NAME),
    ...(Array.isArray(carrier.references) ? carrier.references.map(cleanText) : []),
  ].filter(Boolean)));
  const sourceSequenceIndex = finiteNumber(carrier.sourceSequenceIndex)
    ?? sequenceIndexFromPath(carrier.sourcePath || carrier.path);
  const fittingGeometry = cloneJson(carrier.fittingGeometry || {});
  const ports = cloneJson(carrier.ports || carrier.fittingGeometry?.ports || []);
  const componentCentre = parsePoint(
    carrier.componentCentre || carrier.fittingGeometry?.componentCentre,
  );
  const tangent = parsePoint(carrier.tangent || carrier.fittingGeometry?.tangent)
    || normalizedTangent(centerline);

  return {
    carrierId,
    carrierType,
    sourceBranchId,
    sourceSequenceIndex,
    centerline,
    traversal,
    fittingGeometry,
    ports,
    componentCentre,
    tangent,
    references,
    output: {
      carrierId,
      carrierType,
      sourceBranchId,
      sourceSequenceIndex,
      centerline: centerline ? cloneJson(centerline) : null,
      traversal: cloneJson(traversal),
      supportFamilies: [],
    },
  };
}

function normalizeCenterline(carrier, attrs, traversal) {
  const explicitStart = parsePoint(carrier.centerline?.start);
  const explicitEnd = parsePoint(carrier.centerline?.end);
  if (explicitStart && explicitEnd) {
    return {
      start: clonePoint(explicitStart),
      end: clonePoint(explicitEnd),
      lengthMm: finiteNumber(carrier.centerline.lengthMm)
        ?? pointDistance(explicitStart, explicitEnd),
    };
  }

  const apos = parsePoint(attrs.APOS);
  const lpos = parsePoint(attrs.LPOS);
  if (!apos || !lpos) return null;
  const start = traversal.reversedForTraversal ? lpos : apos;
  const end = traversal.reversedForTraversal ? apos : lpos;
  return {
    start: clonePoint(start),
    end: clonePoint(end),
    lengthMm: pointDistance(start, end),
  };
}

function normalizeTraversal(value = {}) {
  const reversedForTraversal = Boolean(value.reversedForTraversal);
  return {
    sourceStartField: cleanText(value.sourceStartField) || 'APOS',
    traversalStartField: cleanText(value.traversalStartField)
      || (reversedForTraversal ? 'LPOS' : 'APOS'),
    reversedForTraversal,
  };
}

function normalizeOptions(input) {
  return {
    branchId: cleanText(input.branchId),
    projectionToleranceMm: positiveNumber(input.projectionToleranceMm, 50),
    onCenterlineToleranceMm: nonNegativeNumber(input.onCenterlineToleranceMm, 0.001),
    ambiguityToleranceMm: nonNegativeNumber(input.ambiguityToleranceMm, 1),
    plantUp: normalizePlantUp(input.plantUp),
    sourceCarriers: input.carriers,
  };
}

function isSourceSequenceMatch(family, carrier, sourceCarriers) {
  if (!Number.isFinite(family.sourceSequenceIndex)
    || !Number.isFinite(carrier.sourceSequenceIndex)) return false;
  const rows = sourceCarriers.map((row, index) => ({
    id: cleanText(row.carrierId || row.id || row.ref || row.name),
    sequence: finiteNumber(row.sourceSequenceIndex)
      ?? sequenceIndexFromPath(row.sourcePath || row.path)
      ?? index,
  })).filter((row) => row.id);
  const preceding = rows
    .filter((row) => row.sequence <= family.sourceSequenceIndex)
    .sort((left, right) => right.sequence - left.sequence)[0];
  return preceding?.id === carrier.carrierId;
}

function normalizePosition(value = {}) {
  return {
    supportPosGlobal: isPoint(value.supportPosGlobal)
      ? normalizePoint(value.supportPosGlobal)
      : null,
    centerlinePointGlobal: isPoint(value.centerlinePointGlobal)
      ? normalizePoint(value.centerlinePointGlobal)
      : null,
    carrierStationMm: roundedNumber(value.carrierStationMm),
    carrierFraction: roundedNumber(value.carrierFraction),
    distanceToCarrierMm: roundedNumber(value.distanceToCarrierMm),
    offsetFromCenterline: value.offsetFromCenterline
      ? cloneJson(value.offsetFromCenterline)
      : null,
    positionStatus: normalizePositionStatus(value.positionStatus),
    fittingLocation: value.fittingLocation ? cloneJson(value.fittingLocation) : null,
    localFrame: value.localFrame ? normalizeLocalFrame(value.localFrame) : null,
  };
}

function normalizeLocalFrame(value) {
  if (!value) return null;
  const frame = {
    origin: normalizePoint(value.origin),
    tangent: normalizePoint(value.tangent),
    lateral: value.lateral ? normalizePoint(value.lateral) : null,
    vertical: normalizePoint(value.vertical),
    handedness: cleanText(value.handedness) || 'RIGHT_HANDED',
    frameStatus: cleanText(value.frameStatus)
      || (value.lateral ? 'RESOLVED' : 'DEGENERATE'),
  };
  if (value.reason) frame.reason = cleanText(value.reason);
  return frame;
}

function normalizePlantUp(value) {
  const point = parsePoint(value) || { x: 0, y: 0, z: 1 };
  const length = Math.hypot(point.x, point.y, point.z);
  if (length <= 1e-12) throw new TypeError('plantUp must have a non-zero length.');
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function positiveNumber(value, fallback) {
  const number = finiteNumber(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = finiteNumber(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizedTangent(centerline) {
  if (!centerline) return null;
  const dx = centerline.end.x - centerline.start.x;
  const dy = centerline.end.y - centerline.start.y;
  const dz = centerline.end.z - centerline.start.z;
  const length = Math.hypot(dx, dy, dz);
  return length > 1e-12 ? { x: dx / length, y: dy / length, z: dz / length } : null;
}

function roundedNumber(value) {
  const number = finiteNumber(value);
  return Number.isFinite(number) ? round6(number) : null;
}

function normalizePoint(point) {
  return isPoint(point)
    ? { x: round6(point.x), y: round6(point.y), z: round6(point.z) }
    : null;
}

function normalizePositionStatus(value) {
  return POSITION_STATUS_SET.has(value) ? value : POSITION_STATUS.UNRESOLVED;
}
