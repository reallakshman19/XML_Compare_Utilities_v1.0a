import { createPipelineCadMarkupAnchor } from './pipeline-3d-model-cad-markup-contracts.js';
import { buildPipelineCadSnapPrimitives } from './pipeline-3d-model-cad-object-snap-adapters.js';
import { acquirePipelineCadObjectSnap } from './pipeline-3d-model-cad-object-snap-engine.js';
import { PipelineCadObjectSnapMode } from './pipeline-3d-model-cad-object-snap-contracts.js';
import {
  normalizePipelineCadSnapSettings,
  pipelineCadObjectSnapModes,
} from './pipeline-3d-model-cad-snap.js';

export const PIPELINE_CAD_MARKUP_ACQUISITION_SCHEMA =
  'PipelineCadMarkupAnchorAcquisition.v1';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function point(value, label) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`${label} must contain finite x/y.`);
  }
  return freeze({ x, y });
}

function graphEntities(graphName, graph) {
  if (graphName === 'table2x') return graph.currentNodes?.() || [];
  return [...(graph.depthNodes?.() || []), ...(graph.markerNodes?.() || [])];
}

function exactEntityCandidate(graphName, graph, candidate) {
  const sourceId = candidate?.sourceIds?.length === 1 ? candidate.sourceIds[0] : null;
  if (!sourceId) return null;
  const allowed = graphName === 'table2x'
    ? candidate.mode === PipelineCadObjectSnapMode.ENDPOINT
    : [PipelineCadObjectSnapMode.ENDPOINT, PipelineCadObjectSnapMode.MARKER].includes(candidate.mode);
  if (!allowed) return null;
  const node = graphEntities(graphName, graph).find((entry) => entry.id === sourceId);
  if (!node) return null;
  if (graphName === 'table2x' && node.type !== 'elevation-node') return null;
  if (graphName === 'table3x' && candidate.mode === PipelineCadObjectSnapMode.ENDPOINT && node.type !== 'depth-node') return null;
  if (graphName === 'table3x' && candidate.mode === PipelineCadObjectSnapMode.MARKER && node.type !== 'marker') return null;
  return node;
}

function entityResult(graphName, node, candidate, acquisition) {
  const anchor = createPipelineCadMarkupAnchor({
    kind: 'ENTITY',
    graph: graphName,
    entityId: node.id,
    entityType: node.type,
    pointRole: node.type === 'marker' ? 'MARKER' : 'ENDPOINT',
  });
  return freeze({
    schema: PIPELINE_CAD_MARKUP_ACQUISITION_SCHEMA,
    anchor,
    worldPoint: point(node, 'Exact entity point'),
    acquisitionMode: candidate.mode,
    identity: `${graphName}:${node.type}:${node.id}`,
    candidateId: candidate.id,
    exactEntity: true,
    snapEvidence: acquisition.evidence,
  });
}

function graphPointResult(graphName, acquisition) {
  const worldPoint = point(acquisition.acquiredWorldPoint, 'Acquired graph point');
  const anchor = createPipelineCadMarkupAnchor({
    kind: 'GRAPH_POINT', graph: graphName, x: worldPoint.x, y: worldPoint.y,
  });
  return freeze({
    schema: PIPELINE_CAD_MARKUP_ACQUISITION_SCHEMA,
    anchor,
    worldPoint,
    acquisitionMode: acquisition.candidate?.mode || 'free',
    identity: `${graphName}:GRAPH_POINT`,
    candidateId: acquisition.candidate?.id || null,
    exactEntity: false,
    snapEvidence: acquisition.evidence,
  });
}

export function acquirePipelineCadMarkupAnchor(input = {}) {
  const graphName = String(input.graphName || '');
  const graph = input.graph;
  if (!['table2x', 'table3x'].includes(graphName) || !graph) {
    throw new TypeError('Markup anchor acquisition requires a supported graph.');
  }
  const rawScreenPoint = point(input.screenPoint, 'screenPoint');
  const rawWorldPoint = point(input.worldPoint || graph.screenToWorld(rawScreenPoint), 'worldPoint');
  const settings = normalizePipelineCadSnapSettings(graph.getSnapSettings?.());
  const acquisition = acquirePipelineCadObjectSnap({
    graphName,
    graph,
    rawScreenPoint,
    rawWorldPoint,
    primitives: buildPipelineCadSnapPrimitives(graphName, graph),
    settings: { ...settings, enabledModes: pipelineCadObjectSnapModes(settings) },
    allowedAxes: { x: true, y: true },
    excludeIds: [],
  });
  const node = exactEntityCandidate(graphName, graph, acquisition.candidate);
  return node
    ? entityResult(graphName, node, acquisition.candidate, acquisition)
    : graphPointResult(graphName, acquisition);
}

export const _markupAnchorAcquisitionTest = Object.freeze({ exactEntityCandidate, graphEntities });
