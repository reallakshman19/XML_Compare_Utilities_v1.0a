import { PipelineCadObjectSnapMode } from './pipeline-3d-model-cad-object-snap-contracts.js';
import {
  intersectPipelineCadSegments,
  pipelineCadSnapPointPrimitive,
  pipelineCadSnapSegmentPrimitive,
} from './pipeline-3d-model-cad-object-snap-primitives.js';

const freeze = (value) => Object.freeze(value);

function segmentList(nodes, graphName) {
  return freeze(nodes.slice(0, -1).map((start, index) => {
    const end = nodes[index + 1];
    return pipelineCadSnapSegmentPrimitive({
      id: `${graphName}:segment:${start.id}:${end.id}`,
      sourceIds: [start.id, end.id],
      start,
      end,
      metadata: { index, graphName },
    });
  }));
}

function pointMode(graphName, mode, id, worldPoint, sourceIds, lockedAxes, label, metadata = {}) {
  return pipelineCadSnapPointPrimitive({
    id: `${graphName}:${mode}:${id}`,
    mode,
    sourceIds,
    worldPoint,
    lockedAxes,
    label,
    metadata,
  });
}

function segmentIntersections(graphName, segments) {
  const points = [];
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 2; second < segments.length; second += 1) {
      const hit = intersectPipelineCadSegments(segments[first], segments[second]);
      if (!hit) continue;
      points.push(pointMode(
        graphName,
        PipelineCadObjectSnapMode.INTERSECTION,
        `${segments[first].id}:${segments[second].id}`,
        hit,
        [...segments[first].sourceIds, ...segments[second].sourceIds],
        { x: true, y: true },
        'Intersection',
        { firstSegmentId: segments[first].id, secondSegmentId: segments[second].id },
      ));
    }
  }
  return points;
}

export function buildTable2PipelineCadSnapPrimitives(graph) {
  const nodes = graph.currentNodes().map((node) => freeze({ ...node }));
  const segments = segmentList(nodes, 'table2x');
  const points = [];
  for (const node of nodes) {
    points.push(pointMode('table2x', PipelineCadObjectSnapMode.ENDPOINT, node.id, node, [node.id], { x: true, y: true }, 'Endpoint'));
    points.push(pointMode('table2x', PipelineCadObjectSnapMode.STATION, node.id, node, [node.id], { x: true, y: false }, 'Station'));
  }
  points.push(...segmentIntersections('table2x', segments));
  return freeze({ graphName: 'table2x', points: freeze(points), segments });
}

function gradeIntersections(graph, segments) {
  const grade = pipelineCadSnapSegmentPrimitive({
    id: 'table3x:construction:grade',
    sourceIds: ['construction:grade'],
    start: { x: graph.bounds.minX, y: 0 },
    end: { x: graph.bounds.maxX, y: 0 },
    metadata: { construction: 'grade' },
  });
  return segments.flatMap((segment) => {
    const hit = intersectPipelineCadSegments(segment, grade);
    if (!hit) return [];
    return [pointMode(
      'table3x',
      PipelineCadObjectSnapMode.INTERSECTION,
      `${segment.id}:grade`,
      hit,
      [...segment.sourceIds, 'construction:grade'],
      { x: true, y: true },
      'Intersection',
      { segmentId: segment.id, construction: 'grade' },
    )];
  });
}

export function buildTable3PipelineCadSnapPrimitives(graph) {
  const depths = graph.depthNodes().map((node) => freeze({ ...node }));
  const markers = graph.markerNodes().map((node) => freeze({ ...node }));
  const segments = segmentList(depths, 'table3x');
  const points = [];
  for (const node of depths) {
    points.push(pointMode('table3x', PipelineCadObjectSnapMode.ENDPOINT, node.id, node, [node.id], { x: true, y: true }, 'Endpoint'));
  }
  for (const marker of markers) {
    points.push(pointMode('table3x', PipelineCadObjectSnapMode.MARKER, marker.id, marker, [marker.id], { x: true, y: false }, 'Marker'));
  }
  for (const [index, anchor] of (graph.model?.coordinateMap?.anchors || []).entries()) {
    points.push(pointMode(
      'table3x',
      PipelineCadObjectSnapMode.STATION,
      `anchor-${index}`,
      { x: anchor.cumulative, y: 0 },
      [`anchor-${index}`],
      { x: true, y: false },
      'Station',
      { absoluteH: anchor.absoluteH },
    ));
  }
  points.push(...segmentIntersections('table3x', segments), ...gradeIntersections(graph, segments));
  return freeze({ graphName: 'table3x', points: freeze(points), segments });
}

export function buildPipelineCadSnapPrimitives(graphName, graph) {
  if (graphName === 'table2x') return buildTable2PipelineCadSnapPrimitives(graph);
  if (graphName === 'table3x') return buildTable3PipelineCadSnapPrimitives(graph);
  throw new TypeError(`Unsupported Pipeline CAD graph: ${graphName}.`);
}
