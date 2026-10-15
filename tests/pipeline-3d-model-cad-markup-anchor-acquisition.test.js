import assert from 'node:assert/strict';
import { acquirePipelineCadMarkupAnchor } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-anchor-acquisition.js';

function graph() {
  const table2 = [
    { id: 't2-1', type: 'elevation-node', x: 0, y: 10 },
    { id: 't2-2', type: 'elevation-node', x: 20, y: 15 },
  ];
  const depths = [
    { id: 't3-d1', type: 'depth-node', x: 0, y: -1 },
    { id: 't3-d2', type: 'depth-node', x: 20, y: -2 },
  ];
  const markers = [{ id: 't3-m1', type: 'marker', x: 10, y: .75 }];
  return {
    bounds: { minX: 0, maxX: 20 },
    model: { coordinateMap: { anchors: [] } },
    currentNodes: () => table2,
    depthNodes: () => depths,
    markerNodes: () => markers,
    worldToScreen: ({ x, y }) => ({ x, y }),
    screenToWorld: ({ x, y }) => ({ x, y }),
    getSnapSettings: () => ({ objectEnabled: true, objectAperture: 2 }),
  };
}

const t2 = graph();
const endpoint = acquirePipelineCadMarkupAnchor({ graphName: 'table2x', graph: t2, screenPoint: { x: 0, y: 10 } });
assert.equal(endpoint.anchor.kind, 'ENTITY');
assert.equal(endpoint.anchor.entityId, 't2-1');
assert.equal(endpoint.anchor.entityType, 'elevation-node');
assert.equal(endpoint.acquisitionMode, 'endpoint');

const midpoint = acquirePipelineCadMarkupAnchor({ graphName: 'table2x', graph: t2, screenPoint: { x: 10, y: 12.5 } });
assert.equal(midpoint.anchor.kind, 'GRAPH_POINT');
assert.equal(midpoint.acquisitionMode, 'midpoint');
assert.deepEqual(midpoint.worldPoint, { x: 10, y: 12.5 });

const t3 = graph();
const depth = acquirePipelineCadMarkupAnchor({ graphName: 'table3x', graph: t3, screenPoint: { x: 0, y: -1 } });
assert.equal(depth.anchor.kind, 'ENTITY');
assert.equal(depth.anchor.entityType, 'depth-node');
const marker = acquirePipelineCadMarkupAnchor({ graphName: 'table3x', graph: t3, screenPoint: { x: 10, y: .75 } });
assert.equal(marker.anchor.kind, 'ENTITY');
assert.equal(marker.anchor.entityType, 'marker');
assert.equal(marker.worldPoint.y, .75, 'marker ENTITY uses exact complete entity point');

const freeGraph = graph();
freeGraph.getSnapSettings = () => ({ objectEnabled: false });
const free = acquirePipelineCadMarkupAnchor({ graphName: 'table2x', graph: freeGraph, screenPoint: { x: 3, y: 4 } });
assert.equal(free.anchor.kind, 'GRAPH_POINT');
assert.deepEqual(free.worldPoint, { x: 3, y: 4 });
console.log('Pipeline CAD markup anchor acquisition: ok');
