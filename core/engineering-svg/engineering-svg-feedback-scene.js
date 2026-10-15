import {
  createEngineeringGeometryConstraint,
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createSegmentGeometry,
  validateEngineeringScene,
} from '../engineering-scene/index.js';
import { engineeringDeltaMagnitude, engineeringGeometryCentroid, engineeringPointDelta } from './engineering-svg-geometry-analysis.js';
import { projectEngineeringSvgDirection } from './engineering-svg-constraint-solver.js';

const AXIS_DIRECTIONS = Object.freeze({
  X: Object.freeze({ x: 1, y: 0, z: 0 }),
  Y: Object.freeze({ x: 0, y: 1, z: 0 }),
  Z: Object.freeze({ x: 0, y: 0, z: 1 }),
});

function feedbackId(type, sourceId, suffix = '') {
  const tail = suffix ? `/${encodeURIComponent(suffix)}` : '';
  return `@esvg/feedback/${type}/${encodeURIComponent(sourceId)}${tail}`;
}

function pointAlong(origin, direction, distance) {
  return {
    x: origin.x + (direction.x * distance),
    y: origin.y + (direction.y * distance),
    z: origin.z + (direction.z * distance),
  };
}

function referenceDirection(constraint, resolver) {
  if (typeof resolver !== 'function') throw new TypeError(`${constraint.kind} feedback requires resolveReferenceVector.`);
  return resolver({
    kind: constraint.kind,
    referenceId: constraint.referenceId,
    constraint,
  });
}

function handleDirections(constraint, resolver) {
  if (constraint.kind === 'axis') return [{ id: constraint.axis, direction: AXIS_DIRECTIONS[constraint.axis] }];
  if (constraint.kind === 'plane') return constraint.axes.map((axis) => ({ id: axis, direction: AXIS_DIRECTIONS[axis] }));
  return [{ id: constraint.kind, direction: referenceDirection(constraint, resolver) }];
}

function handleEntity(source, origin, entry, projection, fit, pixelLength) {
  try {
    const projected = projectEngineeringSvgDirection(entry.direction, projection, fit);
    const worldLength = pixelLength / projected.length;
    return createEngineeringSceneEntity({
      id: feedbackId('handle', source.id, entry.id),
      kind: 'constraint-handle',
      domainType: 'ENGINEERING_CONSTRAINT_HANDLE',
      geometry: createSegmentGeometry(origin, pointAlong(origin, projected.direction, worldLength)),
      domainRef: { owner: 'engineering-svg-core', sourceEntityId: source.id, feedbackType: 'handle' },
      propertySetIds: [],
      editCapabilities: [],
      layer: 'handles',
      renderOrder: source.renderOrder,
      selectable: true,
      contributesToFit: false,
      metadata: {
        engineeringSvgFeedback: {
          type: 'handle',
          handleId: entry.id,
          constraint: entry.id,
          targetScreenLength: pixelLength,
        },
      },
    });
  } catch (error) {
    if (/not visible/.test(String(error?.message))) return null;
    throw error;
  }
}

function guideEntity(source, original, draft) {
  if (!draft) return null;
  const start = engineeringGeometryCentroid(original);
  const end = engineeringGeometryCentroid(draft);
  const delta = engineeringPointDelta(start, end);
  const magnitude = engineeringDeltaMagnitude(delta);
  if (!magnitude) return null;
  return createEngineeringSceneEntity({
    id: feedbackId('guide', source.id),
    kind: 'interaction-guide',
    domainType: 'ENGINEERING_INTERACTION_GUIDE',
    geometry: createSegmentGeometry(start, end),
    domainRef: { owner: 'engineering-svg-core', sourceEntityId: source.id, feedbackType: 'guide' },
    propertySetIds: [],
    editCapabilities: [],
    layer: 'feedback',
    renderOrder: source.renderOrder,
    selectable: false,
    contributesToFit: false,
    metadata: { engineeringSvgFeedback: { type: 'guide', delta, magnitude } },
  });
}

function snapEntity(source, acquisition) {
  if (!acquisition?.candidate) return null;
  return createEngineeringSceneEntity({
    id: feedbackId('snap', source.id),
    kind: 'snap-feedback',
    domainType: 'ENGINEERING_SNAP_FEEDBACK',
    geometry: createPointGeometry(acquisition.candidate.worldPoint),
    domainRef: { owner: 'engineering-svg-core', sourceEntityId: source.id, feedbackType: 'snap' },
    propertySetIds: [],
    editCapabilities: [],
    layer: 'feedback',
    renderOrder: source.renderOrder + 1,
    selectable: false,
    contributesToFit: false,
    metadata: {
      engineeringSvgFeedback: {
        type: 'snap',
        candidateId: acquisition.candidate.id,
        mode: acquisition.candidate.mode,
        label: acquisition.candidate.label,
      },
    },
  });
}

export function composeEngineeringSvgFeedbackScene(sceneValue, input = {}) {
  const scene = validateEngineeringScene(sceneValue);
  const entityId = String(input.entityId ?? '').trim();
  const source = scene.entities.find((entity) => entity.id === entityId);
  if (!source) throw new Error(`Feedback source entity "${entityId}" was not found.`);
  const constraint = createEngineeringGeometryConstraint(input.constraint);
  const geometry = input.draftGeometry || source.geometry;
  const origin = engineeringGeometryCentroid(geometry);
  const pixelLength = Number(input.handlePixelLength ?? 48);
  if (!Number.isFinite(pixelLength) || pixelLength <= 0) throw new TypeError('Handle pixel length must be positive and finite.');
  const handles = handleDirections(constraint, input.resolveReferenceVector)
    .map((entry) => handleEntity(source, origin, entry, input.projection || 'ISO', input.fit, pixelLength))
    .filter(Boolean);
  const feedback = [guideEntity(source, source.geometry, input.draftGeometry), snapEntity(source, input.acquisition)]
    .filter(Boolean);
  return createEngineeringScene({
    ...scene,
    revision: createEngineeringRevisionToken({
      authoritative: scene.revision.value,
      feedback: { entityId, constraint, draftGeometry: input.draftGeometry ?? null, acquisition: input.acquisition ?? null },
    }),
    entities: [...scene.entities, ...handles, ...feedback],
    metadata: { ...scene.metadata, engineeringSvgFeedback: { entityId, constraint } },
  });
}

export function engineeringSvgFeedbackEntityId(type, sourceId, suffix = '') {
  return feedbackId(type, sourceId, suffix);
}
