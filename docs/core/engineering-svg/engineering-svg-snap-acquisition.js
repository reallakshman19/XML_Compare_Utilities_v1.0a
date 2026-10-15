import {
  createEngineeringPoint3D,
  createEngineeringSnapAcquisition,
  createEngineeringSnapCandidate,
  freezeJsonValue,
  validateEngineeringScene,
} from '../engineering-scene/index.js';
import { rankEngineeringSvgSnapCandidates } from './engineering-svg-snap-ranking.js';

export const ENGINEERING_SVG_SNAP_ERROR_MODE = Object.freeze({
  FAIL_CLOSED: 'fail-closed',
  ISOLATE: 'isolate',
});

function finitePoint2D(value, label) {
  const point = { x: Number(value?.x), y: Number(value?.y) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must contain finite x and y values.`);
  }
  return Object.freeze(point);
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function providers(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError('Snap acquisition requires at least one provider.');
  const sorted = [...values].sort((left, right) => String(left?.id).localeCompare(String(right?.id)));
  sorted.forEach((provider, index) => {
    if (!provider?.id || typeof provider.provide !== 'function') throw new TypeError(`providers[${index}] is invalid.`);
  });
  const ids = sorted.map((provider) => provider.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Snap provider IDs must be unique.');
  return sorted;
}

function normalizeCandidate(candidate, rawScreenPoint) {
  return createEngineeringSnapCandidate({
    ...candidate,
    screenDistance: distance(rawScreenPoint, candidate.screenPoint),
  });
}

async function collectProviderResults(input, providerValues, errorMode) {
  const candidates = [];
  const errors = [];
  const counts = Object.fromEntries(providerValues.map((provider) => [provider.id, 0]));
  for (const provider of providerValues) {
    try {
      const result = await provider.provide(input);
      counts[provider.id] = result.candidates.length;
      result.candidates.forEach((candidate) => candidates.push(normalizeCandidate(candidate, input.screenPoint)));
    } catch (error) {
      if (errorMode === ENGINEERING_SVG_SNAP_ERROR_MODE.FAIL_CLOSED) throw error;
      errors.push(Object.freeze({ providerId: provider.id, message: String(error?.message || error) }));
    }
  }
  return Object.freeze({
    candidates: Object.freeze(candidates),
    errors: Object.freeze(errors),
    providerCounts: Object.freeze(counts),
  });
}

export async function acquireEngineeringSvgSnap(input = {}) {
  const scene = validateEngineeringScene(input.scene);
  const rawScreenPoint = finitePoint2D(input.rawScreenPoint, 'Snap rawScreenPoint');
  const rawWorldPoint = createEngineeringPoint3D(input.rawWorldPoint);
  const aperture = Number(input.aperture);
  if (!Number.isFinite(aperture) || aperture <= 0) throw new TypeError('Snap aperture must be positive and finite.');
  const errorMode = input.errorMode || ENGINEERING_SVG_SNAP_ERROR_MODE.FAIL_CLOSED;
  if (!Object.values(ENGINEERING_SVG_SNAP_ERROR_MODE).includes(errorMode)) {
    throw new TypeError(`Unsupported snap provider error mode "${errorMode}".`);
  }
  const providerValues = providers(input.providers);
  const request = freezeJsonValue({
    scene,
    projection: input.projection || 'ISO',
    fit: input.fit,
    screenPoint: rawScreenPoint,
    worldPoint: rawWorldPoint,
    aperture,
    excludeSourceEntityIds: input.excludeSourceEntityIds || [],
    enabledModes: input.enabledModes || [],
    constraint: input.constraint,
    metadata: input.metadata ?? {},
  });
  const collected = await collectProviderResults(request, providerValues, errorMode);
  const ranked = rankEngineeringSvgSnapCandidates(collected.candidates, {
    aperture,
    enabledModes: input.enabledModes,
    excludeSourceEntityIds: input.excludeSourceEntityIds,
    constraint: input.constraint,
    screenTolerance: input.screenTolerance,
    worldTolerance: input.worldTolerance,
    providerErrors: collected.errors,
    providerCounts: collected.providerCounts,
  });
  return createEngineeringSnapAcquisition({
    rawScreenPoint,
    rawWorldPoint,
    aperture,
    candidate: ranked.candidate,
    evidence: ranked.evidence,
  });
}

export function composeEngineeringSvgSnapPoint(rawPointValue, acquisition) {
  const rawPoint = createEngineeringPoint3D(rawPointValue);
  if (acquisition?.schema !== 'EngineeringSnapAcquisition.v1') {
    throw new TypeError('Snap composition requires EngineeringSnapAcquisition.v1.');
  }
  const acquired = acquisition.acquiredWorldPoint;
  return createEngineeringPoint3D({
    x: acquisition.lockedAxes.x ? acquired.x : rawPoint.x,
    y: acquisition.lockedAxes.y ? acquired.y : rawPoint.y,
    z: acquisition.lockedAxes.z ? acquired.z : rawPoint.z,
  });
}
