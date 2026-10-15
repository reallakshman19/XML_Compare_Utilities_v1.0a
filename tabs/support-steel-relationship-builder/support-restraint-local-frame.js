export const SUPPORT_CARRIER_LOCAL_FRAME_SCHEMA = 'SupportCarrierLocalFrame.v1';

export function buildSupportCarrierLocalFrames(input = {}) {
  const config = resolveFrameConfig(input.config || {});
  const carrierFrames = (input.carrierObjects || []).map((carrier) => buildFrame(carrier, config));
  const frameExceptions = carrierFrames
    .filter((row) => row.frameStatus !== 'RESOLVED_ORTHOGONAL_FRAME')
    .map(frameException);
  return {
    schema: SUPPORT_CARRIER_LOCAL_FRAME_SCHEMA,
    config,
    carrierFrames,
    frameExceptions,
    summary: {
      carrierFrameCount: carrierFrames.length,
      resolvedFrameCount: carrierFrames.filter((row) => row.frameStatus === 'RESOLVED_ORTHOGONAL_FRAME').length,
      verticalPipeAmbiguousCount: carrierFrames.filter((row) => row.frameStatus === 'VERTICAL_PIPE_FRAME_AMBIGUOUS').length,
      unresolvedFrameCount: carrierFrames.filter((row) => row.frameStatus.startsWith('UNRESOLVED_')).length,
      exceptionCount: frameExceptions.length,
    },
  };
}

export function projectPointToCarrierFrame(point, frame) {
  if (!point || !frame?.originGlobal || !frame?.axialAxis || !frame?.lateralAxis || !frame?.verticalAxis) {
    return { available: false, axialMm: null, lateralMm: null, verticalMm: null };
  }
  const delta = subtract(point, frame.originGlobal);
  return {
    available: true,
    axialMm: round3(dot(delta, frame.axialAxis)),
    lateralMm: round3(dot(delta, frame.lateralAxis)),
    verticalMm: round3(dot(delta, frame.verticalAxis)),
  };
}

export function geometryRepresentativePoint(member = {}) {
  const geometry = member.analyticalGeometry || member;
  if (geometry?.worldObb?.center) return geometry.worldObb.center;
  if (geometry?.worldAabb?.min && geometry?.worldAabb?.max) {
    return midpoint(geometry.worldAabb.min, geometry.worldAabb.max);
  }
  if (geometry?.axis?.start && geometry?.axis?.end) return midpoint(geometry.axis.start, geometry.axis.end);
  return geometry?.representativePointGlobal || member.positionGlobal || null;
}

function buildFrame(carrier, config) {
  const geometry = carrier?.analyticalGeometry || {};
  const axis = geometry.axis;
  const base = {
    schema: SUPPORT_CARRIER_LOCAL_FRAME_SCHEMA,
    carrierObjectId: carrier?.carrierObjectId || null,
    lineContext: carrier?.lineContext || null,
    frameStatus: 'UNRESOLVED_CARRIER_AXIS',
    frameQuality: 'NONE',
    frameOrthogonal: false,
    verticalPipe: false,
    originGlobal: null,
    axialAxis: null,
    lateralAxis: null,
    verticalAxis: null,
    gravityAxis: config.gravityAxis,
    axialGravityAlignment: null,
    relationshipBasis: [],
  };
  if (!axis?.start || !axis?.end) return base;
  const axial = normalize(subtract(axis.end, axis.start));
  if (magnitude(axial) <= 1e-9) return { ...base, frameStatus: 'UNRESOLVED_ZERO_LENGTH_CARRIER_AXIS' };
  const alignment = Math.abs(dot(axial, config.gravityAxis));
  const originGlobal = midpoint(axis.start, axis.end);
  if (alignment >= config.verticalPipeParallelThreshold) {
    const reference = leastParallelReference(axial);
    const lateral = normalize(cross(reference, axial));
    const transverse = normalize(cross(axial, lateral));
    return {
      ...base,
      frameStatus: 'VERTICAL_PIPE_FRAME_AMBIGUOUS',
      frameQuality: 'LOW',
      verticalPipe: true,
      originGlobal,
      axialAxis: axial,
      lateralAxis: lateral,
      verticalAxis: config.gravityAxis,
      transverseAxis: transverse,
      axialGravityAlignment: round6(alignment),
      relationshipBasis: ['CARRIER_ANALYTICAL_AXIS', 'GLOBAL_GRAVITY_AXIS', 'DETERMINISTIC_TRANSVERSE_REFERENCE'],
    };
  }
  const lateral = normalize(cross(config.gravityAxis, axial));
  const vertical = normalize(cross(axial, lateral));
  return {
    ...base,
    frameStatus: 'RESOLVED_ORTHOGONAL_FRAME',
    frameQuality: 'HIGH',
    frameOrthogonal: true,
    originGlobal,
    axialAxis: axial,
    lateralAxis: lateral,
    verticalAxis: vertical,
    axialGravityAlignment: round6(alignment),
    relationshipBasis: ['CARRIER_ANALYTICAL_AXIS', 'GLOBAL_GRAVITY_AXIS', 'ORTHOGONAL_LOCAL_FRAME'],
  };
}

function resolveFrameConfig(config) {
  const gravityAxis = normalizePoint(config.gravityAxis || config.verticalAxis || { x: 0, y: 0, z: 1 });
  const threshold = Number(config.verticalPipeParallelThreshold);
  return {
    gravityAxis: magnitude(gravityAxis) > 0 ? gravityAxis : { x: 0, y: 0, z: 1 },
    verticalPipeParallelThreshold: Number.isFinite(threshold) && threshold > 0 && threshold <= 1 ? threshold : 0.95,
  };
}

function frameException(row) {
  const code = row.frameStatus === 'VERTICAL_PIPE_FRAME_AMBIGUOUS'
    ? 'VERTICAL_PIPE_FRAME_AMBIGUOUS'
    : row.frameStatus;
  return {
    exceptionId: `SSRF-FRAME:${code}:${row.carrierObjectId || 'UNKNOWN'}`,
    exceptionCode: code,
    severity: row.frameStatus === 'VERTICAL_PIPE_FRAME_AMBIGUOUS' ? 'WARN' : 'INFO',
    carrierObjectId: row.carrierObjectId,
    message: row.frameStatus === 'VERTICAL_PIPE_FRAME_AMBIGUOUS'
      ? 'The carrier axis is parallel to gravity; lateral orientation is deterministic but not engineering-authoritative.'
      : 'The carrier local restraint frame cannot be resolved from an analytical carrier axis.',
  };
}

function leastParallelReference(axis) {
  const candidates = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  return candidates.sort((left, right) => Math.abs(dot(axis, left)) - Math.abs(dot(axis, right)))[0];
}
function normalizePoint(value) {
  if (Array.isArray(value)) return normalize({ x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) });
  return normalize({ x: Number(value?.x), y: Number(value?.y), z: Number(value?.z) });
}
function normalize(value) {
  const length = magnitude(value);
  return Number.isFinite(length) && length > 1e-12 ? scale(value, 1 / length) : { x: 0, y: 0, z: 0 };
}
function midpoint(left, right) { return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 }; }
function subtract(left, right) { return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z }; }
function scale(value, factor) { return { x: value.x * factor, y: value.y * factor, z: value.z * factor }; }
function cross(left, right) { return { x: left.y * right.z - left.z * right.y, y: left.z * right.x - left.x * right.z, z: left.x * right.y - left.y * right.x }; }
function dot(left, right) { return left.x * right.x + left.y * right.y + left.z * right.z; }
function magnitude(value) { return Math.hypot(value?.x || 0, value?.y || 0, value?.z || 0); }
function round3(value) { return Math.round(value * 1000) / 1000; }
function round6(value) { return Math.round(value * 1e6) / 1e6; }
