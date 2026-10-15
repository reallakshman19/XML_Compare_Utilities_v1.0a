import assert from 'node:assert/strict';
import { TopologySvgEditorModel, TOPOLOGY_EDIT_PATCH_SCHEMA } from '../tabs/topology-trace-validator/topology-svg-editor-model.js';
import { TopologySvgEditorHistory, moveTopologySupportCommand } from '../tabs/topology-trace-validator/topology-svg-editor-history.js';
import { applyTopologySvgEditorDraft } from '../tabs/topology-trace-validator/topology-svg-editor-view-model.js';
import { solveTopologyEditorAxisDrag, topologyEditorAxisVector } from '../tabs/topology-trace-validator/topology-svg-editor-overlay.js';
import { createTopologyWorldTransform } from '../tabs/topology-trace-validator/topology-svg-projections.js';

if (typeof globalThis.CustomEvent === 'undefined') globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } };

const supportKey = 'source:$[0].children[0]';
const viewModel = Object.freeze({
  projection: '3D', bounds: Object.freeze({ minX: 0, maxX: 20, minY: 0, maxY: 10, spanX: 20, spanY: 10 }),
  sourceEntities: Object.freeze([{ objectKey: supportKey, sourceEntityId: 'SRC-SUPPORT', sourcePath: '$[0].children[0]', componentCategory: 'SUPPORT', name: 'S1', ref: 'SUPPORT-1', positions: { POS: { x: 15, y: 2, z: 3 } } }]),
  sourceComponents: Object.freeze([{ objectKey: supportKey, componentCategory: 'SUPPORT', positions: { POS: { x: 15, y: 2, z: 3 } }, projectedPoint: { x: 11.258330249, y: 11.5 } }]),
  sourcePorts: Object.freeze([{ objectKey: `${supportKey}:port:P`, projectedPosition: { x: 11.258330249, y: 11.5 } }]),
  canonicalNodes: Object.freeze([]), canonicalEdges: Object.freeze([]), pointFeatures: Object.freeze([]), junctions: Object.freeze([]), boundaries: Object.freeze([]),
});
const hashes = Object.freeze({ source: 's', canonical: 'c', ledger: 'l', inputXml: 'i' });

const model = new TopologySvgEditorModel(viewModel, hashes);
assert.equal(model.dirtyCount, 0);
assert.deepEqual(model.entity(supportKey).position, { x: 15, y: 2, z: 3 });

const history = new TopologySvgEditorHistory();
history.execute(moveTopologySupportCommand(model, supportKey, { x: 17, y: 2, z: 3 }));
assert.equal(model.entity(supportKey).position.x, 17);
assert.equal(model.dirtyCount, 1);
assert.equal(model.patch().schema, TOPOLOGY_EDIT_PATCH_SCHEMA);
assert.equal(model.patch().operations[0].type, 'MOVE_SUPPORT');
assert.deepEqual(model.patch().baseHashes, hashes);
assert.equal(history.undo(), true);
assert.equal(model.entity(supportKey).position.x, 15);
assert.equal(history.redo(), true);
assert.equal(model.entity(supportKey).position.x, 17);

const edited = applyTopologySvgEditorDraft(viewModel, model, true);
assert.notEqual(edited, viewModel);
assert.equal(edited.sourceComponents[0].positions.POS.x, 17);
assert.equal(edited.sourcePorts[0].editorDirty, true);
assert.equal(viewModel.sourceComponents[0].positions.POS.x, 15, 'immutable source view model must stay unchanged');
assert.equal(applyTopologySvgEditorDraft(viewModel, model, false), viewModel);

const transform = createTopologyWorldTransform(viewModel.bounds, 1200, 720, 54);
for (const axis of ['x', 'y', 'z']) assert(topologyEditorAxisVector('3D', axis, transform), `${axis} must be draggable in ISO/3D`);
assert.equal(topologyEditorAxisVector('XY', 'z', transform), null);
const vector = topologyEditorAxisVector('XY', 'x', transform);
assert(Math.abs(solveTopologyEditorAxisDrag({ x: 0, y: 0 }, { x: vector.x * 2, y: vector.y * 2 }, vector) - 2) < 1e-9);

model.revert();
assert.equal(model.dirtyCount, 0);
console.log('topology SVG editor foundation tests passed');
