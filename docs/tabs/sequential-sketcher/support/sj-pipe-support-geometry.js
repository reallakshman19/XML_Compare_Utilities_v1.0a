// Copied from 3D_Converters@ffbbafbb1757a84826b736731a8d75c43a2c3e9c.
// Adapted to use Sequential Sketcher's owned point resolver and canonical fitting aliases.
import {
  cleanText,
  clonePoint,
  finiteNumber,
  isPoint,
  nonNegativeNumber,
  parsePoint,
  positiveNumber,
} from './sj-pipe-support-utils.js';

export const STRAIGHT_CARRIER_TYPES = Object.freeze(new Set(['PIPE', 'TUBE', 'SEGMENT']));
export const FITTING_LOCATION_TYPES = Object.freeze([
  'INLET_PORT', 'OUTLET_PORT', 'BRANCH_PORT', 'COMPONENT_CENTRE',
  'ARC_STATION', 'AXIAL_STATION', 'SURFACE_ATTACHMENT',
]);
export const FITTING_LOCATION_TYPE = Object.freeze(Object.fromEntries(
  FITTING_LOCATION_TYPES.map((value) => [value, value]),
));
export const POSITION_STATUS = Object.freeze({
  ON_CENTERLINE: 'ON_CENTERLINE',
  PROJECTED_TO_CENTERLINE: 'PROJECTED_TO_CENTERLINE',
  ATTACHED_TO_COMPONENT_PORT: 'ATTACHED_TO_COMPONENT_PORT',
  ATTACHED_TO_FITTING: 'ATTACHED_TO_FITTING',
  AMBIGUOUS_CARRIER: 'AMBIGUOUS_CARRIER',
  OUTSIDE_PROJECTION_TOLERANCE: 'OUTSIDE_PROJECTION_TOLERANCE',
  UNRESOLVED: 'UNRESOLVED',
});
const FITTING_LOCATION_TYPE_SET = new Set(FITTING_LOCATION_TYPES);
const AXIAL_FITTING_TYPES = new Set([
  'REDU', 'REDUCER', 'VALV', 'VALVE', 'FLAN', 'FLANGE',
  'GASK', 'GASKET', 'INST', 'INSTRUMENT', 'COUPLING', 'UNION',
]);
const DEFAULT_PLANT_UP = Object.freeze({ x: 0, y: 0, z: 1 });

export function normalizePlantUp(value) {
  return normalizeVector(parsePoint(value)) || clonePoint(DEFAULT_PLANT_UP);
}

export function locateSupportOnCarrier(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const supportPosGlobal = parsePoint(input.supportPosGlobal);
  const carrier = input.carrier;
  if (!supportPosGlobal || !carrier || typeof carrier !== 'object' || Array.isArray(carrier)) return null;

  const options = {
    projectionToleranceMm: positiveNumber(input.projectionToleranceMm, 50),
    onCenterlineToleranceMm: nonNegativeNumber(input.onCenterlineToleranceMm, 0.001),
    plantUp: normalizePlantUp(input.plantUp),
  };
  const carrierType = cleanText(carrier.carrierType || carrier.componentType || carrier.type).toUpperCase();
  const prefersStraight = STRAIGHT_CARRIER_TYPES.has(carrierType) || AXIAL_FITTING_TYPES.has(carrierType);
  let projection = prefersStraight
    ? projectPointToStraightCarrier(supportPosGlobal, carrier, options)
    : projectPointToFittingCarrier(supportPosGlobal, carrier, options);
  if (!projection) {
    projection = prefersStraight
      ? projectPointToFittingCarrier(supportPosGlobal, carrier, options)
      : projectPointToStraightCarrier(supportPosGlobal, carrier, options);
  }
  if (!projection) return null;

  const distanceToCarrierMm = finiteNumber(projection.distanceToCarrierMm)
    ?? finiteNumber(projection.distanceMm);
  const fittingOutsideTolerance = projection.projectionKind === 'FITTING_LOCATION'
    && Number.isFinite(distanceToCarrierMm)
    && distanceToCarrierMm > options.projectionToleranceMm;
  return {
    ...projection,
    supportPosGlobal: clonePoint(supportPosGlobal),
    distanceToCarrierMm,
    positionStatus: fittingOutsideTolerance
      ? POSITION_STATUS.OUTSIDE_PROJECTION_TOLERANCE
      : projection.positionStatus,
  };
}

export function projectPointToStraightCarrier(point, carrier, options = {}) {
  const start = carrier.centerline?.start;
  const end = carrier.centerline?.end;
  if (!isPoint(start) || !isPoint(end) || !isPoint(point)) return null;

  const axis = sub(end, start);
  const lengthSq = dot(axis, axis);
  if (lengthSq <= 1e-18) return null;
  const lengthMm = Math.sqrt(lengthSq);
  const rawFraction = dot(sub(point, start), axis) / lengthSq;
  const fraction = clamp(rawFraction, 0, 1);
  const projected = add(start, scale(axis, fraction));
  const tangent = scale(axis, 1 / lengthMm);
  const localFrame = buildLocalFrame(projected, tangent, options.plantUp || DEFAULT_PLANT_UP);
  const offset = decomposeOffset(sub(point, projected), localFrame);
  const radialDistanceMm = distance(point, projected);
  const projectionToleranceMm = positiveNumber(options.projectionToleranceMm, 50);
  const onCenterlineToleranceMm = nonNegativeNumber(options.onCenterlineToleranceMm, 0.001);

  let positionStatus = POSITION_STATUS.OUTSIDE_PROJECTION_TOLERANCE;
  if (radialDistanceMm <= onCenterlineToleranceMm && rawFraction >= -1e-9 && rawFraction <= 1 + 1e-9) {
    positionStatus = POSITION_STATUS.ON_CENTERLINE;
  } else if (radialDistanceMm <= projectionToleranceMm) {
    positionStatus = POSITION_STATUS.PROJECTED_TO_CENTERLINE;
  }

  return {
    projectionKind: 'STRAIGHT_CENTERLINE',
    positionStatus,
    distanceMm: radialDistanceMm,
    distanceToCarrierMm: radialDistanceMm,
    centerlinePointGlobal: clonePoint(projected),
    carrierStationMm: lengthMm * fraction,
    carrierFraction: fraction,
    rawCarrierFraction: rawFraction,
    offsetFromCenterline: {
      alongMm: offset.alongMm,
      lateralMm: offset.lateralMm,
      verticalMm: offset.verticalMm,
      radialDistanceMm,
    },
    localFrame,
  };
}

export function projectPointToFittingCarrier(point, carrier, options = {}) {
  if (!isPoint(point)) return null;
  const geometry = carrier.fittingGeometry || {};
  const candidates = [];

  for (const port of normalizePorts(carrier)) {
    const portPoint = parsePoint(port.point || port.position || port.centerlinePointGlobal);
    if (!portPoint) continue;
    const locationType = normalizeFittingLocationType(port.locationType || port.type || port.role, FITTING_LOCATION_TYPE.SURFACE_ATTACHMENT);
    const tangent = normalizeVector(parsePoint(port.tangent || port.axis || port.direction))
      || tangentFromCentreToPoint(geometry.componentCentre, portPoint);
    candidates.push({
      distanceMm: distance(point, portPoint),
      point: portPoint,
      tangent,
      fittingLocation: {
        locationType,
        nearestCenterlinePointGlobal: clonePoint(portPoint),
        portId: cleanText(port.portId || port.id || port.name) || null,
      },
    });
  }

  const arcCandidate = projectPointToArc(point, geometry.arc);
  if (arcCandidate) candidates.push(arcCandidate);

  const axis = geometry.axis || (AXIAL_FITTING_TYPES.has(cleanText(carrier.carrierType).toUpperCase()) ? carrier.centerline : null);
  const axialCandidate = projectPointToAxis(point, axis);
  if (axialCandidate) candidates.push(axialCandidate);

  const componentCentre = parsePoint(geometry.componentCentre || carrier.componentCentre);
  if (componentCentre) candidates.push({
    distanceMm: distance(point, componentCentre),
    point: componentCentre,
    tangent: normalizeVector(parsePoint(geometry.tangent || carrier.tangent))
      || tangentFromCenterline(carrier.centerline),
    fittingLocation: {
      locationType: FITTING_LOCATION_TYPE.COMPONENT_CENTRE,
      nearestCenterlinePointGlobal: clonePoint(componentCentre),
    },
  });

  for (const surface of geometry.surfaceAttachments || []) {
    const surfacePoint = parsePoint(surface.point || surface.position);
    if (!surfacePoint) continue;
    candidates.push({
      distanceMm: distance(point, surfacePoint),
      point: surfacePoint,
      tangent: normalizeVector(parsePoint(surface.tangent || surface.axis || surface.direction))
        || tangentFromCenterline(carrier.centerline),
      fittingLocation: {
        locationType: FITTING_LOCATION_TYPE.SURFACE_ATTACHMENT,
        nearestCenterlinePointGlobal: clonePoint(surfacePoint),
        surfaceId: cleanText(surface.surfaceId || surface.id || surface.name) || null,
      },
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.distanceMm - b.distanceMm);
  const selected = candidates[0];
  const localFrame = selected.tangent
    ? buildLocalFrame(selected.point, selected.tangent, options.plantUp || DEFAULT_PLANT_UP)
    : null;
  const offset = localFrame ? decomposeOffset(sub(point, selected.point), localFrame) : null;
  const portAttachment = /_PORT$/u.test(selected.fittingLocation.locationType);

  return {
    projectionKind: 'FITTING_LOCATION',
    positionStatus: portAttachment ? POSITION_STATUS.ATTACHED_TO_COMPONENT_PORT : POSITION_STATUS.ATTACHED_TO_FITTING,
    distanceMm: selected.distanceMm,
    distanceToCarrierMm: selected.distanceMm,
    centerlinePointGlobal: clonePoint(selected.point),
    carrierStationMm: null,
    carrierFraction: null,
    offsetFromCenterline: {
      alongMm: offset?.alongMm ?? null,
      lateralMm: offset?.lateralMm ?? null,
      verticalMm: offset?.verticalMm ?? null,
      radialDistanceMm: selected.distanceMm,
    },
    localFrame,
    fittingLocation: selected.fittingLocation,
  };
}

export function buildLocalFrame(originValue, tangentValue, plantUpValue = DEFAULT_PLANT_UP) {
  let origin = originValue;
  let tangentInput = tangentValue;
  let plantUpInput = plantUpValue;
  if (originValue && typeof originValue === 'object' && !Array.isArray(originValue)
    && 'origin' in originValue && tangentValue === undefined) {
    origin = originValue.origin;
    tangentInput = originValue.tangent;
    plantUpInput = originValue.plantUp ?? DEFAULT_PLANT_UP;
  }
  const tangent = normalizeVector(tangentInput);
  const vertical = normalizeVector(plantUpInput);
  if (!isPoint(origin) || !tangent || !vertical) return null;
  const lateral = normalizeVector(cross(vertical, tangent));
  if (!lateral) return {
    origin: clonePoint(origin),
    tangent: clonePoint(tangent),
    lateral: null,
    vertical: clonePoint(vertical),
    handedness: 'DEGENERATE',
    frameStatus: 'DEGENERATE',
    reason: 'TANGENT_PARALLEL_TO_PLANT_UP',
  };
  return {
    origin: clonePoint(origin),
    tangent: clonePoint(tangent),
    lateral: clonePoint(lateral),
    vertical: clonePoint(vertical),
    handedness: 'RIGHT_HANDED',
    frameStatus: 'RESOLVED',
  };
}

export function pointDistance(a, b) { return distance(a, b); }
export function normalizedTangent(centerline) { return tangentFromCenterline(centerline); }

function projectPointToArc(point, arc) {
  if (!arc || typeof arc !== 'object') return null;
  const center = parsePoint(arc.center);
  const normal = normalizeVector(parsePoint(arc.normal));
  const startPoint = parsePoint(arc.startPoint);
  const sweepRadians = finiteNumber(arc.sweepRadians)
    ?? degreesToRadians(finiteNumber(arc.sweepDegrees));
  if (!center || !normal || !startPoint || !Number.isFinite(sweepRadians) || Math.abs(sweepRadians) <= 1e-12) return null;

  const startRadial = rejectFromAxis(sub(startPoint, center), normal);
  const startUnit = normalizeVector(startRadial);
  if (!startUnit) return null;
  const radiusMm = positiveNumber(arc.radiusMm, length(startRadial));
  if (!(radiusMm > 0)) return null;

  const pointUnit = normalizeVector(rejectFromAxis(sub(point, center), normal)) || startUnit;
  const signedAngle = signedAngleAroundAxis(startUnit, pointUnit, normal);
  const fraction = clamp(signedAngle / sweepRadians, 0, 1);
  const radialUnit = rotateAroundAxis(startUnit, normal, sweepRadians * fraction);
  const projected = add(center, scale(radialUnit, radiusMm));
  const tangent = sweepRadians >= 0
    ? normalizeVector(cross(normal, radialUnit))
    : normalizeVector(cross(radialUnit, normal));

  return {
    distanceMm: distance(point, projected),
    point: projected,
    tangent,
    fittingLocation: {
      locationType: FITTING_LOCATION_TYPE.ARC_STATION,
      arcFraction: fraction,
      nearestCenterlinePointGlobal: clonePoint(projected),
    },
  };
}

function projectPointToAxis(point, axis) {
  if (!axis || typeof axis !== 'object') return null;
  const start = parsePoint(axis.start || axis.apos || axis.APOS);
  const end = parsePoint(axis.end || axis.lpos || axis.LPOS);
  if (!start || !end) return null;
  const vector = sub(end, start);
  const lengthSq = dot(vector, vector);
  if (lengthSq <= 1e-18) return null;
  const fraction = clamp(dot(sub(point, start), vector) / lengthSq, 0, 1);
  const projected = add(start, scale(vector, fraction));
  return {
    distanceMm: distance(point, projected),
    point: projected,
    tangent: normalizeVector(vector),
    fittingLocation: {
      locationType: FITTING_LOCATION_TYPE.AXIAL_STATION,
      axialFraction: fraction,
      nearestCenterlinePointGlobal: clonePoint(projected),
    },
  };
}

function decomposeOffset(displacement, localFrame) {
  return {
    alongMm: dot(displacement, localFrame.tangent),
    lateralMm: localFrame.lateral ? dot(displacement, localFrame.lateral) : null,
    verticalMm: dot(displacement, localFrame.vertical),
  };
}

function normalizePorts(carrier) {
  const raw = carrier.ports || carrier.fittingGeometry?.ports || [];
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([key, value]) => ({
    ...(value && typeof value === 'object' ? value : { point: value }),
    locationType: value?.locationType || key,
  }));
}

function normalizeFittingLocationType(value, fallback) {
  const compact = cleanText(value).toUpperCase().replace(/[\s-]+/gu, '_');
  const aliases = {
    INLET: FITTING_LOCATION_TYPE.INLET_PORT,
    OUTLET: FITTING_LOCATION_TYPE.OUTLET_PORT,
    BRANCH: FITTING_LOCATION_TYPE.BRANCH_PORT,
    CENTRE: FITTING_LOCATION_TYPE.COMPONENT_CENTRE,
    CENTER: FITTING_LOCATION_TYPE.COMPONENT_CENTRE,
    COMPONENT_CENTER: FITTING_LOCATION_TYPE.COMPONENT_CENTRE,
    ARC: FITTING_LOCATION_TYPE.ARC_STATION,
    AXIS: FITTING_LOCATION_TYPE.AXIAL_STATION,
    SURFACE: FITTING_LOCATION_TYPE.SURFACE_ATTACHMENT,
  };
  const resolved = aliases[compact] || compact;
  return FITTING_LOCATION_TYPE_SET.has(resolved) ? resolved : fallback;
}

function tangentFromCenterline(centerline) {
  if (!isPoint(centerline?.start) || !isPoint(centerline?.end)) return null;
  return normalizeVector(sub(centerline.end, centerline.start));
}

function tangentFromCentreToPoint(centreValue, point) {
  const centre = parsePoint(centreValue);
  return centre ? normalizeVector(sub(point, centre)) : null;
}

function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(v, factor) { return { x: v.x * factor, y: v.y * factor, z: v.z * factor }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function length(v) { return Math.hypot(v.x, v.y, v.z); }
function distance(a, b) { return length(sub(a, b)); }
function normalizeVector(v) {
  if (!isPoint(v)) return null;
  const magnitude = length(v);
  return magnitude > 1e-12 ? scale(v, 1 / magnitude) : null;
}
function rejectFromAxis(v, axis) { return sub(v, scale(axis, dot(v, axis))); }
function signedAngleAroundAxis(from, to, axis) {
  return Math.atan2(dot(axis, cross(from, to)), clamp(dot(from, to), -1, 1));
}
function rotateAroundAxis(vector, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return add(add(scale(vector, cos), scale(cross(axis, vector), sin)), scale(axis, dot(axis, vector) * (1 - cos)));
}
function degreesToRadians(value) { return Number.isFinite(value) ? value * Math.PI / 180 : null; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
