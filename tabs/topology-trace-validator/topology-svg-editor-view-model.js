/** Applies a support draft to a derived SVG view model without mutating evidence. */
import { asArray, deepFreeze, objectRecord } from './topology-validator-values.js';
import { calculateTopologyBounds, projectTopologyPoint } from './topology-svg-projections.js';

function editorPositionMap(model) {
  return new Map(model?.supports?.().map((entity) => [entity.objectKey, entity.position]) ?? []);
}

function projectComponent(component, positions, projection) {
  const position = positions.get(component.objectKey);
  if (!position) return component;
  return deepFreeze({
    ...component,
    positions: deepFreeze({ ...objectRecord(component.positions), POS: deepFreeze({ ...position }) }),
    projectedPoint: projectTopologyPoint(position, projection),
    editorDirty: true,
  });
}

function projectPort(port, positions, projection) {
  const owner = [...positions.keys()].find((key) => String(port.objectKey).startsWith(`${key}:port:`));
  return owner ? deepFreeze({ ...port, projectedPosition: projectTopologyPoint(positions.get(owner), projection), editorDirty: true }) : port;
}

function projectedPoints(viewModel, components, ports) {
  return [
    ...components.flatMap((row) => [row.projectedStart, row.projectedEnd, row.projectedPoint]),
    ...ports.map((row) => row.projectedPosition),
    ...asArray(viewModel.canonicalNodes).map((row) => objectRecord(row).projectedPosition),
    ...asArray(viewModel.canonicalEdges).flatMap((row) => [objectRecord(row).projectedStart, objectRecord(row).projectedEnd]),
    ...asArray(viewModel.pointFeatures).map((row) => objectRecord(row).projectedPosition),
    ...asArray(viewModel.junctions).map((row) => objectRecord(row).projectedPosition),
    ...asArray(viewModel.boundaries).map((row) => objectRecord(row).projectedPosition),
  ].filter(Boolean);
}

export function applyTopologySvgEditorDraft(viewModel, model, enabled) {
  if (!enabled || !model) return viewModel;
  const positions = editorPositionMap(model), projection = String(viewModel.projection || 'XY');
  const sourceComponents = Object.freeze(asArray(viewModel.sourceComponents).map((component) => projectComponent(objectRecord(component), positions, projection)));
  const sourcePorts = Object.freeze(asArray(viewModel.sourcePorts).map((port) => projectPort(objectRecord(port), positions, projection)));
  return Object.freeze({
    ...viewModel,
    bounds: calculateTopologyBounds(projectedPoints(viewModel, sourceComponents, sourcePorts)),
    sourceComponents,
    sourcePorts,
    editor: deepFreeze({ schema: 'TopologySvgEditorView.v1', enabled: true, revision: model.revision, dirtyCount: model.dirtyCount }),
  });
}

export const _test = Object.freeze({ editorPositionMap, projectComponent, projectPort, projectedPoints });
