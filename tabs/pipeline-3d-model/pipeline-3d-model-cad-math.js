const DEFAULT_TOLERANCE = 1e-9;

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) throw new TypeError('value must be finite');
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new TypeError('min/max must be finite and ordered');
  }
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function normalizeAnchor(anchor, index) {
  return {
    cumulative: finiteNumber(anchor?.cumulative, `anchors[${index}].cumulative`),
    absoluteH: finiteNumber(anchor?.absoluteH, `anchors[${index}].absoluteH`),
  };
}

export function buildMonotonicCoordinateMap(anchors, options = {}) {
  const tolerance = Number.isFinite(options.tolerance) ? Math.abs(options.tolerance) : DEFAULT_TOLERANCE;
  if (!Array.isArray(anchors) || anchors.length < 2) {
    throw new Error('At least two coordinate anchors are required.');
  }

  const sorted = anchors.map(normalizeAnchor).sort((a, b) => a.cumulative - b.cumulative);
  const normalized = [];
  for (const anchor of sorted) {
    const previous = normalized[normalized.length - 1];
    if (previous && Math.abs(anchor.cumulative - previous.cumulative) <= tolerance) {
      if (Math.abs(anchor.absoluteH - previous.absoluteH) > tolerance) {
        throw new Error(`Conflicting absolute H values at cumulative ${anchor.cumulative}.`);
      }
      continue;
    }
    normalized.push(anchor);
  }

  if (normalized.length < 2) throw new Error('Coordinate anchors collapse to fewer than two unique stations.');

  const hDeltas = normalized.slice(1).map((anchor, index) => anchor.absoluteH - normalized[index].absoluteH);
  const increasing = hDeltas.every((delta) => delta > tolerance);
  const decreasing = hDeltas.every((delta) => delta < -tolerance);
  if (!increasing && !decreasing) {
    throw new Error('Absolute H anchors must be strictly monotonic.');
  }

  return Object.freeze({
    anchors: Object.freeze(normalized.map((anchor) => Object.freeze({ ...anchor }))),
    hDirection: increasing ? 1 : -1,
    cumulativeMin: normalized[0].cumulative,
    cumulativeMax: normalized[normalized.length - 1].cumulative,
    absoluteHMin: Math.min(normalized[0].absoluteH, normalized[normalized.length - 1].absoluteH),
    absoluteHMax: Math.max(normalized[0].absoluteH, normalized[normalized.length - 1].absoluteH),
  });
}

function resolveMap(mapOrAnchors) {
  return Array.isArray(mapOrAnchors) ? buildMonotonicCoordinateMap(mapOrAnchors) : mapOrAnchors;
}

function interpolateWithin(value, p1, p2, xKey, yKey) {
  const span = p2[xKey] - p1[xKey];
  if (Math.abs(span) <= DEFAULT_TOLERANCE) return p1[yKey];
  const t = (value - p1[xKey]) / span;
  return p1[yKey] + t * (p2[yKey] - p1[yKey]);
}

function interpolateByKey(value, mapOrAnchors, xKey, yKey, options = {}) {
  const map = resolveMap(mapOrAnchors);
  if (!map?.anchors?.length) throw new Error('A valid coordinate map is required.');
  const clampToDomain = options.clamp !== false;
  const input = finiteNumber(value, xKey);
  const anchors = [...map.anchors].sort((a, b) => a[xKey] - b[xKey]);
  const min = anchors[0][xKey];
  const max = anchors[anchors.length - 1][xKey];
  const normalized = clampToDomain ? clamp(input, min, max) : input;

  if (!clampToDomain && (normalized < min || normalized > max)) {
    throw new RangeError(`${xKey} ${normalized} is outside [${min}, ${max}].`);
  }
  if (normalized <= min) return anchors[0][yKey];
  if (normalized >= max) return anchors[anchors.length - 1][yKey];

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const p1 = anchors[index];
    const p2 = anchors[index + 1];
    if (normalized >= p1[xKey] && normalized <= p2[xKey]) {
      return interpolateWithin(normalized, p1, p2, xKey, yKey);
    }
  }
  throw new Error(`Could not interpolate ${yKey} from ${xKey}.`);
}

export function interpolateAbsoluteHFromCumulative(cumulative, mapOrAnchors, options = {}) {
  return interpolateByKey(cumulative, mapOrAnchors, 'cumulative', 'absoluteH', options);
}

export function interpolateCumulativeFromAbsoluteH(absoluteH, mapOrAnchors, options = {}) {
  return interpolateByKey(absoluteH, mapOrAnchors, 'absoluteH', 'cumulative', options);
}

export function screenXToWorldX(screenX, viewport) {
  const x = finiteNumber(screenX, 'screenX');
  const left = finiteNumber(viewport?.plotLeft, 'viewport.plotLeft');
  const width = finiteNumber(viewport?.plotWidth, 'viewport.plotWidth');
  const min = finiteNumber(viewport?.worldMin, 'viewport.worldMin');
  const max = finiteNumber(viewport?.worldMax, 'viewport.worldMax');
  if (width <= 0 || max <= min) throw new Error('Viewport width and world range must be positive.');
  const ratio = clamp((x - left) / width, 0, 1);
  return min + ratio * (max - min);
}

export function worldXToScreenX(worldX, viewport) {
  const x = finiteNumber(worldX, 'worldX');
  const left = finiteNumber(viewport?.plotLeft, 'viewport.plotLeft');
  const width = finiteNumber(viewport?.plotWidth, 'viewport.plotWidth');
  const min = finiteNumber(viewport?.worldMin, 'viewport.worldMin');
  const max = finiteNumber(viewport?.worldMax, 'viewport.worldMax');
  if (width <= 0 || max <= min) throw new Error('Viewport width and world range must be positive.');
  return left + ((x - min) / (max - min)) * width;
}

export function projectPointToSegment(point, start, end) {
  const px = finiteNumber(point?.x, 'point.x');
  const py = finiteNumber(point?.y, 'point.y');
  const ax = finiteNumber(start?.x, 'start.x');
  const ay = finiteNumber(start?.y, 'start.y');
  const bx = finiteNumber(end?.x, 'end.x');
  const by = finiteNumber(end?.y, 'end.y');
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= DEFAULT_TOLERANCE
    ? 0
    : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Object.freeze({ x, y, t, distance: Math.hypot(px - x, py - y) });
}

export function formatStation(value, decimals = 1) {
  const station = finiteNumber(value, 'station');
  const precision = Number.isInteger(decimals) && decimals >= 0 ? decimals : 1;
  const sign = station < 0 ? '-' : '';
  const absolute = Math.abs(station);
  const major = Math.floor(absolute / 1000);
  const minor = absolute - major * 1000;
  const width = precision > 0 ? 4 + precision : 3;
  return `${sign}${major}+${minor.toFixed(precision).padStart(width, '0')}`;
}

export function parseStation(text) {
  const match = String(text ?? '').trim().match(/^(-)?\s*(\d+)\s*\+\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const value = Number(match[2]) * 1000 + Number(match[3]);
  return match[1] ? -value : value;
}

export function parseDepthText(text, options = {}) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  if (/^A\s*\/\s*G$/i.test(value)) return Object.freeze({ mode: 'ABOVE_GROUND', z: Number(options.aboveGroundZ ?? 0.75), depth: 0 });
  const match = value.match(/^([+-]?\d+(?:\.\d+)?)\s*M?$/i);
  if (!match) return null;
  const depth = Math.abs(Number(match[1]));
  return Object.freeze({ mode: 'DEPTH', z: -depth, depth });
}

export function formatDepth(z, options = {}) {
  const value = finiteNumber(z, 'z');
  const tolerance = Number.isFinite(options.aboveGroundTolerance) ? Math.abs(options.aboveGroundTolerance) : 0.05;
  const decimals = Number.isInteger(options.decimals) && options.decimals >= 0 ? options.decimals : 1;
  if (value >= -tolerance) return 'A/G';
  return `${Math.abs(value).toFixed(decimals)}M`;
}

export function snapValue(value, candidates, tolerance = Infinity) {
  const target = finiteNumber(value, 'value');
  const finiteCandidates = (Array.isArray(candidates) ? candidates : []).map(Number).filter(Number.isFinite);
  if (!finiteCandidates.length) return target;
  let closest = finiteCandidates[0];
  let distance = Math.abs(target - closest);
  for (let index = 1; index < finiteCandidates.length; index += 1) {
    const nextDistance = Math.abs(target - finiteCandidates[index]);
    if (nextDistance < distance) {
      closest = finiteCandidates[index];
      distance = nextDistance;
    }
  }
  return distance <= tolerance ? closest : target;
}
