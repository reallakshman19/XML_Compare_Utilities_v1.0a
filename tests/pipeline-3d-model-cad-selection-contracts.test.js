import assert from 'node:assert/strict';
import {
  PIPELINE_CAD_SELECTION_BOX_SCHEMA,
  PIPELINE_CAD_SELECTION_SCHEMA,
  createPipelineCadSelectionDetail,
  normalizePipelineCadSelectionBox,
  normalizePipelineCadSelectionItems,
  partitionPipelineCadSelection,
  pipelineCadSelectionMode,
  selectPipelineCadItemsInBox,
  updatePipelineCadSelection,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-selection-contracts.js';

const one = { id: 'a', type: 'elevation-node' };
const two = { id: 'b', type: 'elevation-node' };
const marker = { id: 'm', type: 'marker' };
assert.equal(PIPELINE_CAD_SELECTION_SCHEMA, 'PipelineCadSelection.v1');
assert.equal(PIPELINE_CAD_SELECTION_BOX_SCHEMA, 'PipelineCadSelectionBox.v1');
assert.deepEqual(normalizePipelineCadSelectionItems([one, one, two]), [one, two]);
assert.equal(pipelineCadSelectionMode({ shiftKey: true }), 'toggle');
assert.equal(pipelineCadSelectionMode({ ctrlKey: true }), 'toggle');
assert.equal(pipelineCadSelectionMode({ metaKey: true }), 'toggle');
assert.equal(pipelineCadSelectionMode({}), 'replace');

let items = updatePipelineCadSelection([], [one], 'replace');
items = updatePipelineCadSelection(items, [two], 'toggle');
assert.deepEqual(items, [one, two]);
items = updatePipelineCadSelection(items, [one], 'toggle');
assert.deepEqual(items, [two]);
items = updatePipelineCadSelection(items, [marker], 'add');
assert.deepEqual(items, [two, marker]);
items = updatePipelineCadSelection(items, [two], 'remove');
assert.deepEqual(items, [marker]);

const detail = createPipelineCadSelectionDetail({ graph: 'table3x', items: [marker, two], primaryId: marker.id });
assert.equal(detail.count, 2); assert.equal(detail.primaryId, marker.id);
assert.equal(detail.entityId, marker.id); assert.equal(detail.homogeneousType, null);
assert.ok(Object.isFrozen(detail)); assert.ok(Object.isFrozen(detail.items));
assert.deepEqual(partitionPipelineCadSelection(detail.items), { marker: [marker], 'elevation-node': [two] });

const windowBox = normalizePipelineCadSelectionBox({ x: 0, y: 0 }, { x: 20, y: 20 });
const crossingBox = normalizePipelineCadSelectionBox({ x: 20, y: 20 }, { x: 0, y: 0 });
assert.equal(windowBox.direction, 'window'); assert.equal(crossingBox.direction, 'crossing');
const candidates = [
  { ...one, screen: { x: 10, y: 10 } },
  { ...two, screen: { x: 19, y: 10 } },
  { ...marker, screen: { x: 30, y: 30 } },
];
assert.deepEqual(selectPipelineCadItemsInBox(candidates, windowBox, { radius: 2 }), [one]);
assert.deepEqual(selectPipelineCadItemsInBox(candidates, crossingBox, { radius: 2 }), [one, two]);
console.log('Pipeline CAD selection contract tests passed');
