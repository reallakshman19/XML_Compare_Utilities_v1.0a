import { validateEngineeringScene } from '../engineering-scene/index.js';
import { applyEngineeringSvgFit, createEngineeringSvgFit, createProjectedBounds } from './engineering-svg-fit.js';
import { projectEngineeringGeometry, projectedGeometryPoints } from './engineering-svg-projection.js';

const LAYER_PRIORITY = Object.freeze({
  authoritative: 10,
  ghost: 20,
  draft: 30,
  difference: 40,
  diagnostic: 45,
  selection: 50,
  feedback: 55,
  handles: 60,
});

function compareProjectedEntities(left, right) {
  const leftLayer = LAYER_PRIORITY[left.layer] ?? 100;
  const rightLayer = LAYER_PRIORITY[right.layer] ?? 100;
  return leftLayer - rightLayer
    || left.layer.localeCompare(right.layer)
    || left.renderOrder - right.renderOrder
    || left.depth - right.depth
    || left.id.localeCompare(right.id);
}

function entityDepth(projectedGeometry) {
  const points = projectedGeometryPoints(projectedGeometry);
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + point.depth, 0) / points.length;
}

function projectEntity(entity, projection) {
  const projectedGeometry = projectEngineeringGeometry(entity.geometry, projection);
  return Object.freeze({
    id: entity.id,
    kind: entity.kind,
    domainType: entity.domainType,
    layer: entity.layer,
    renderOrder: entity.renderOrder,
    visible: entity.visible,
    selectable: entity.selectable,
    contributesToFit: entity.contributesToFit,
    projectedGeometry,
    depth: entityDepth(projectedGeometry),
  });
}

function fitGeometry(geometry, fit) {
  if (geometry == null) return null;
  return Object.freeze({
    ...geometry,
    points: Object.freeze(geometry.points.map((point) => applyEngineeringSvgFit(point, fit))),
  });
}

export function buildEngineeringSvgProjectedScene(scene, options = {}) {
  validateEngineeringScene(scene);
  const projection = options.projection || 'ISO';
  const projected = scene.entities.filter((entity) => entity.visible !== false)
    .map((entity) => projectEntity(entity, projection));
  const fitPoints = projected.filter((entity) => entity.contributesToFit !== false)
    .flatMap((entity) => projectedGeometryPoints(entity.projectedGeometry));
  const bounds = createProjectedBounds(fitPoints);
  const fit = createEngineeringSvgFit(bounds, options.viewport, options.padding);
  const entities = projected.map((entity) => Object.freeze({
    ...entity,
    projectedGeometry: fitGeometry(entity.projectedGeometry, fit),
  })).sort(compareProjectedEntities);
  return Object.freeze({
    sceneId: scene.sceneId,
    revision: scene.revision,
    projection,
    viewport: Object.freeze({ width: fit.width, height: fit.height }),
    fit,
    entities: Object.freeze(entities),
  });
}
