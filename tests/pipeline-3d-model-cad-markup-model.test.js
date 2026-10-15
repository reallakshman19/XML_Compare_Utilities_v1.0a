import assert from 'node:assert/strict';
import { createPipelineCadMarkupDocument } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-contracts.js';
import { createPipelineCadMarkupModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-model.js';

const entity = (graph, entityId, entityType) => ({ kind: 'ENTITY', graph, entityId, entityType, pointRole: 'CENTER' });
const model = createPipelineCadMarkupModel(createPipelineCadMarkupDocument({ sourceFingerprint: 'pcad-src-model' }));
const before = model.snapshot();
const dimension = model.createDimension({
  graph: 'table2x', dimensionType: 'LINEAR_ALIGNED',
  firstAnchor: entity('table2x', 'table2a-0001', 'elevation-node'),
  secondAnchor: entity('table2x', 'table2a-0002', 'elevation-node'),
  offset: 2, labelMode: 'MEASURED',
});
assert.equal(dimension.dimensionId, 'pcad-dim-000001');
assert.equal(model.getDocument().nextSequence, 2);
const annotation = model.createAnnotation({
  graph: 'table3x', anchor: entity('table3x', 'table3c-0001', 'marker'),
  text: 'Marker note', alignment: 'CENTER', leader: { enabled: false },
});
assert.equal(annotation.annotationId, 'pcad-note-000002');
assert.equal(model.getDocument().nextSequence, 3);
model.updateDimension(dimension.dimensionId, { offset: 4 });
assert.equal(model.getDocument().dimensions[0].offset, 4);
assert.equal(model.getDocument().dimensions[0].revision, 2);
model.updateAnnotation(annotation.annotationId, { text: 'Updated marker note' });
assert.equal(model.getDocument().annotations[0].revision, 2);
const priorFailure = model.getDocument();
assert.throws(() => model.createAnnotation({
  graph: 'table3x', anchor: entity('table3x', 'table3c-0001', 'marker'), text: '<bad>',
}), /scriptable/);
assert.strictEqual(model.getDocument(), priorFailure);
model.deleteDimension(dimension.dimensionId);
assert.equal(model.getDocument().dimensions.length, 0);
assert.equal(model.getDocument().nextSequence, 3, 'deleted IDs are not recycled');
model.restore(before, 'test-restore');
assert.equal(model.getDocument().nextSequence, 1);
assert.equal(model.getDocument().dimensions.length, 0);
console.log('Pipeline CAD markup model: ok');
