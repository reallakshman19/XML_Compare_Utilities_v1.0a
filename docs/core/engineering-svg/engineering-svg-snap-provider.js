import {
  createEngineeringGeometryConstraint,
  createEngineeringSnapCandidate,
  freezeJsonValue,
  validateEngineeringScene,
} from '../engineering-scene/index.js';

export const ENGINEERING_SVG_SNAP_PROVIDER_SCHEMA = 'EngineeringSvgSnapProvider.v1';
export const ENGINEERING_SVG_SNAP_PROVIDER_RESULT_SCHEMA = 'EngineeringSvgSnapProviderResult.v1';

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function stringList(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  return values.map((value, index) => requiredText(value, `${label}[${index}]`));
}

function providerRequest(input, providerId) {
  const aperture = Number(input.aperture);
  if (!Number.isFinite(aperture) || aperture <= 0) throw new TypeError('Snap provider aperture must be positive and finite.');
  const screenPoint = { x: Number(input.screenPoint?.x), y: Number(input.screenPoint?.y) };
  if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
    throw new TypeError('Snap provider screenPoint must be finite.');
  }
  return freezeJsonValue({
    schema: 'EngineeringSvgSnapProviderRequest.v1',
    providerId,
    scene: validateEngineeringScene(input.scene),
    projection: String(input.projection || 'ISO'),
    fit: input.fit,
    screenPoint,
    worldPoint: input.worldPoint,
    aperture,
    excludeSourceEntityIds: stringList(input.excludeSourceEntityIds || [], 'excludeSourceEntityIds'),
    enabledModes: stringList(input.enabledModes || [], 'enabledModes'),
    constraint: createEngineeringGeometryConstraint(input.constraint),
    metadata: input.metadata ?? {},
  });
}

export function createEngineeringSvgSnapProvider(options = {}) {
  const id = requiredText(options.id, 'Snap provider id');
  if (typeof options.provide !== 'function') throw new TypeError('Snap provider requires a provide function.');
  return Object.freeze({
    schema: ENGINEERING_SVG_SNAP_PROVIDER_SCHEMA,
    id,
    async provide(input = {}) {
      const request = providerRequest(input, id);
      const result = await options.provide(request);
      const candidates = Array.isArray(result) ? result : result?.candidates;
      if (!Array.isArray(candidates)) throw new TypeError(`Snap provider "${id}" must return candidates.`);
      const normalized = candidates.map((candidate) => createEngineeringSnapCandidate({
        ...candidate,
        providerId: id,
      }));
      const ids = normalized.map((candidate) => candidate.id);
      if (new Set(ids).size !== ids.length) throw new TypeError(`Snap provider "${id}" returned duplicate candidate IDs.`);
      return freezeJsonValue({
        schema: ENGINEERING_SVG_SNAP_PROVIDER_RESULT_SCHEMA,
        providerId: id,
        candidates: normalized,
        metadata: Array.isArray(result) ? {} : result?.metadata ?? {},
      });
    },
  });
}
