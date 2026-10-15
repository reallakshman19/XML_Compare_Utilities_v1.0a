import assert from 'node:assert/strict';
import { createPipelineCadMarkupRuntime } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-commands.js';
import {
  createPipelineCadMarkupDragPatch,
  createPipelineCadMarkupDraggedProjection,
  hitTestPipelineCadMarkupProjection,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-interaction-renderer.js';

const model = {
  table2Rows: [
    { id: 't2-1', sourceTable: 'table2a', sourceLine: 1, stationValue: 0, elevationValue: 10, basisH: 0 },
    { id: 't2-2', sourceTable: 'table2a', sourceLine: 2, stationValue: 10, elevationValue: 12, basisH: 10 },
  ],
  table3LengthRows: [], table3DepthRows: [], table3MarkerRows: [],
};
const projections = [];
const graph = {
  pipelineCadMarkupGraph: 'table2x',
  currentNodes: () => model.table2Rows.map((row) => ({ id: row.id, type: 'elevation-node', x: row.stationValue, y: row.elevationValue })),
  worldToScreen: (value) => ({ x: value.x * 10, y: value.y * 10 }),
  setMarkupProjection: (value) => projections.push(value),
};
const graphs = { table2x: graph, table3x: { pipelineCadMarkupGraph: 'table3x', depthNodes: () => [], markerNodes: () => [], setMarkupProjection() {} } };
let publications = 0;
const markup = createPipelineCadMarkupRuntime({ profileModel: model, graphs, onPublish: () => { publications += 1; } });
const initial = markup.getDocument();
markup.createDimension({
  graph: 'table2x', dimensionType: 'LINEAR_HORIZONTAL',
  firstAnchor: { kind: 'ENTITY', graph: 'table2x', entityId: 't2-1', entityType: 'elevation-node', pointRole: 'ENDPOINT' },
  secondAnchor: { kind: 'ENTITY', graph: 'table2x', entityId: 't2-2', entityType: 'elevation-node', pointRole: 'ENDPOINT' },
  offset: 1, labelMode: 'MEASURED',
});
assert.equal(markup.getDocument().nextSequence, initial.nextSequence + 1);
assert.equal(markup.getDocument().dimensions.length, 1);
assert.equal(publications, 2, 'mount plus one accepted create publication');
const projection = projections.at(-1);
const item = projection.dimensions[0];
const midpoint = graph.worldToScreen({ x: 5, y: 12 });
const engineeringHitTest = () => ({ type: 'engineering-only' });
assert.equal(hitTestPipelineCadMarkupProjection(graph, projection, midpoint).id, item.id);
assert.deepEqual(engineeringHitTest(midpoint), { type: 'engineering-only' }, 'markup hit testing does not alter engineering hit testing');

const record = markup.getDocument().dimensions[0];
const patch = createPipelineCadMarkupDragPatch(record, {
  startWorld: { x: 5, y: 12 }, initial: { offset: record.offset }, item,
}, { x: 5, y: 14 });
assert.deepEqual(patch, { offset: 3 });
const preview = createPipelineCadMarkupDraggedProjection(item, record, patch);
assert.equal(preview.geometry.start.y, item.evidence.first.y + 3);
const beforeUpdateRevision = markup.getDocument().revision;
markup.updateDimension(record.dimensionId, patch);
assert.equal(markup.getDocument().revision, beforeUpdateRevision + 1);
assert.equal(markup.getDocument().dimensions[0].offset, 3);
markup.undo();
assert.equal(markup.getDocument().dimensions[0].offset, 1);
markup.redo();
assert.equal(markup.getDocument().dimensions[0].offset, 3);
const preservedId = markup.getDocument().dimensions[0].dimensionId;
const preservedSequence = markup.getDocument().dimensions[0].createdSequence;
markup.deleteDimension(preservedId);
assert.equal(markup.getDocument().dimensions.length, 0);
markup.undo();
assert.equal(markup.getDocument().dimensions[0].dimensionId, preservedId);
assert.equal(markup.getDocument().dimensions[0].createdSequence, preservedSequence);
markup.destroy();
console.log('Pipeline CAD markup interaction integration: ok');
