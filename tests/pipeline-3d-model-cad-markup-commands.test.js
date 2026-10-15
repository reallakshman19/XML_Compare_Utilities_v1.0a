import assert from 'node:assert/strict';
import { CommandHistory } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import { createPipelineCadMarkupRuntime } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-commands.js';

function profile() {
  return {
    revision: 11,
    table2Rows: [
      { id: 'table2a-0001', sourceTable: 'table2a', sourceLine: 1, stationValue: 0, elevationValue: 100, basisH: 500 },
      { id: 'table2a-0002', sourceTable: 'table2a', sourceLine: 2, stationValue: 10, elevationValue: 104, basisH: 510 },
    ],
    table3LengthRows: [{ id: 'table3a-0001', sourceTable: 'table3a', sourceLine: 1, fromH: 500, toH: 510, hLength: 10 }],
    table3DepthRows: [],
    table3MarkerRows: [{ id: 'table3c-0001', sourceTable: 'table3c', sourceLine: 1, absoluteH: 505, markerText: 'PM-001' }],
    serializeRawCalls: 0,
    serializeRaw() { this.serializeRawCalls += 1; return {}; },
  };
}
function dimensionPayload() {
  return {
    graph: 'table2x', dimensionType: 'LINEAR_HORIZONTAL',
    firstAnchor: { kind: 'ENTITY', graph: 'table2x', entityId: 'table2a-0001', entityType: 'elevation-node', pointRole: 'CENTER' },
    secondAnchor: { kind: 'ENTITY', graph: 'table2x', entityId: 'table2a-0002', entityType: 'elevation-node', pointRole: 'CENTER' },
    offset: 1, labelMode: 'MEASURED',
  };
}
function annotationPayload() {
  return {
    graph: 'table3x',
    anchor: { kind: 'ENTITY', graph: 'table3x', entityId: 'table3c-0001', entityType: 'marker', pointRole: 'CENTER' },
    text: 'Lifecycle note', alignment: 'LEFT', leader: {},
  };
}

const current = profile(); const redraw = { table2x: 0, table3x: 0 };
const graphs = {
  table2x: {
    currentNodes: () => current.table2Rows.map((row) => ({ id: row.id, type: 'elevation-node', x: row.stationValue, y: row.elevationValue })),
    setMarkupProjection(value) { this.projection = value; redraw.table2x += 1; },
  },
  table3x: {
    depthNodes: () => [], markerNodes: () => [{ id: 'table3c-0001', type: 'marker', x: 5, y: .75 }],
    setMarkupProjection(value) { this.projection = value; redraw.table3x += 1; },
  },
};
const engineeringHistory = new CommandHistory();
assert.throws(
  () => createPipelineCadMarkupRuntime({ profileModel: current, graphs, history: engineeringHistory }),
  /owns an independent command history/,
);
assert.equal(engineeringHistory.undoStack.length, 0);

let ownerPublications = 0;
const runtime = createPipelineCadMarkupRuntime({
  profileModel: current, graphs, onPublish: () => { ownerPublications += 1; },
});
let publications = 0; runtime.subscribe(() => { publications += 1; });
const engineeringRevision = current.revision;
runtime.createDimension(dimensionPayload());
assert.equal(publications, 1);
assert.equal(current.revision, engineeringRevision);
assert.equal(current.serializeRawCalls, 0);
assert.equal(runtime.getDocument().nextSequence, 2);
const beforeFailure = runtime.export();
assert.throws(() => runtime.createAnnotation({ ...annotationPayload(), text: '<script>' }), /scriptable/);
assert.equal(runtime.export(), beforeFailure);
assert.equal(publications, 1);
assert.equal(runtime.undo(), true);
assert.equal(runtime.getDocument().dimensions.length, 0);
assert.equal(runtime.getDocument().nextSequence, 1);
assert.equal(runtime.redo(), true);
assert.equal(runtime.getDocument().dimensions.length, 1);
runtime.updateDimension('pcad-dim-000001', { offset: 3 });
runtime.createAnnotation(annotationPayload());
const exported = runtime.export();
runtime.import(exported);
assert.equal(runtime.export(), exported);
assert.equal(current.serializeRawCalls, 0);
assert.ok(redraw.table2x >= publications && redraw.table3x >= publications);

const documentBeforeDestroy = runtime.export();
assert.equal(runtime.canUndo, true);
assert.equal(runtime.destroy(), true);
assert.equal(runtime.destroy(), false);
assert.equal(runtime.canUndo, false);
assert.equal(runtime.canRedo, false);
const redrawAfterDestroy = { ...redraw };
const ownerPublicationsAfterDestroy = ownerPublications;
const blocked = [
  () => runtime.subscribe(() => {}),
  () => runtime.createDimension(dimensionPayload()),
  () => runtime.updateDimension('pcad-dim-000001', { offset: 9 }),
  () => runtime.deleteDimension('pcad-dim-000001'),
  () => runtime.createAnnotation(annotationPayload()),
  () => runtime.updateAnnotation('pcad-note-000002', { text: 'blocked' }),
  () => runtime.deleteAnnotation('pcad-note-000002'),
  () => runtime.import(documentBeforeDestroy),
  () => runtime.reconcile(),
  () => runtime.undo(),
  () => runtime.redo(),
];
for (const call of blocked) assert.throws(call, /runtime is destroyed/);
assert.equal(runtime.export(), documentBeforeDestroy);
assert.deepEqual(redraw, redrawAfterDestroy);
assert.equal(ownerPublications, ownerPublicationsAfterDestroy);
assert.equal(engineeringHistory.undoStack.length, 0);

const remounted = createPipelineCadMarkupRuntime({ profileModel: current, graphs });
assert.equal(remounted.getDocument().dimensions.length, 0);
assert.equal(remounted.getDocument().annotations.length, 0);
remounted.createDimension(dimensionPayload());
assert.equal(remounted.getDocument().dimensions[0].dimensionId, 'pcad-dim-000001');
assert.throws(() => runtime.undo(), /runtime is destroyed/);
assert.equal(remounted.getDocument().dimensions.length, 1);
assert.equal(remounted.destroy(), true);

console.log('Pipeline CAD markup commands: ok');
