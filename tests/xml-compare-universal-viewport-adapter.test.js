import assert from 'node:assert/strict';
import { validateWorkbenchViewportHost } from '../core/workbench-viewport/index.js';
import { createUniversalTreeViewportHost } from '../xml-compare/universal-categorizer/universal-tree-viewport-host.js';
import { createUniversalPivotViewportHost } from '../xml-compare/universal-categorizer/universal-pivot-viewport-host.js';
import {
  createUniversalSelectionIndex,
  createUniversalViewportState,
  loadUniversalSurfaceState,
  persistUniversalViewportUiState,
  pivotViewIdentity,
  selectPivotIdentity,
  selectTreeIdentity,
  treeViewIdentity,
} from '../xml-compare/universal-categorizer/universal-viewport-state.js';

if (!globalThis.CSS) globalThis.CSS = { escape: (value) => String(value).replaceAll('"', '\\"') };

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function surface() {
  const content = { style: {} };
  return {
    content,
    getBoundingClientRect: () => ({ width: 800, height: 400 }),
    querySelector: (selector) => selector === '[data-uxc-viewport-content]' ? content : null,
  };
}

const treeNodes = Object.freeze([
  Object.freeze({ nodeId: 'tree:root', level: 'DocumentRoot', levelId: 'documentRoot', key: 'root', depth: 0, label: 'Root' }),
  Object.freeze({ nodeId: 'tree:element:10+20', level: 'Element', levelId: 'element', key: '10+20', depth: 2, label: 'Element 10-20' }),
  Object.freeze({ nodeId: 'tree:node:10', level: 'Node', levelId: 'node', key: '10', depth: 3, label: 'Node 10' }),
]);
const pivotRows = Object.freeze([
  Object.freeze({ path: 'Root / Element 10-20', level: 'Element', key: '10+20', block: 'LineBlock', field: 'LINE_ID', value: 'LINE-100', source: 'lineIdLookup' }),
  Object.freeze({ path: 'Root / Node 10', level: 'Node', key: '10', block: 'DerivedCoordinateBlock', field: 'GLOBAL_X', value: '1', source: 'coordinateLookup' }),
]);
const tree = Object.freeze({ nodes: treeNodes });
const pivot = Object.freeze({ columns: Object.freeze(['path', 'level', 'key', 'block', 'field', 'value', 'source']), rows: pivotRows });
const storage = new MemoryStorage();

const treeSurface = surface();
const pivotSurface = surface();
const treeHost = createUniversalTreeViewportHost({ surface: treeSurface, tree, signature: 'dataset-a', storage });
const pivotHost = createUniversalPivotViewportHost({ surface: pivotSurface, pivot, signature: 'dataset-a', storage });
assert.equal(validateWorkbenchViewportHost(treeHost), true);
assert.equal(validateWorkbenchViewportHost(pivotHost), true);
assert.ok(treeHost.capabilities.includes('fit'));
assert.ok(!treeHost.capabilities.includes('grid'));
assert.equal(treeHost.rows, treeNodes);
assert.equal(pivotHost.rows, pivotRows);

const treePoint = { x: 2, y: 1 };
const treeRoundTrip = treeHost.screenToWorld(treeHost.worldToScreen(treePoint));
assert.ok(Math.abs(treeRoundTrip.x - treePoint.x) < 1e-9);
assert.ok(Math.abs(treeRoundTrip.y - treePoint.y) < 1e-9);
const pivotPoint = { x: 4, y: 1 };
const pivotRoundTrip = pivotHost.screenToWorld(pivotHost.worldToScreen(pivotPoint));
assert.ok(Math.abs(pivotRoundTrip.x - pivotPoint.x) < 1e-9);
assert.ok(Math.abs(pivotRoundTrip.y - pivotPoint.y) < 1e-9);

const beforeTreeRows = treeHost.rows;
const beforePivotRows = pivotHost.rows;
treeHost.zoomBy(1.5, 1);
pivotHost.zoomBy(1, 1.4);
assert.equal(treeHost.readViewTransform().zoomX, 1.5);
assert.equal(treeHost.readViewTransform().zoomY, 1);
assert.equal(pivotHost.readViewTransform().zoomX, 1);
assert.equal(pivotHost.readViewTransform().zoomY, 1.4);
assert.equal(treeHost.rows, beforeTreeRows);
assert.equal(pivotHost.rows, beforePivotRows);
assert.ok(!pivotHost.capabilities.includes('grid'));
assert.ok(!pivotHost.capabilities.includes('scale-ratio'));

const index = createUniversalSelectionIndex(tree, pivot);
const elementTreeId = treeViewIdentity(treeNodes[1]);
const elementPivotId = pivotViewIdentity(pivotRows[0], 0);
assert.equal(index.treeByPivot[elementPivotId], elementTreeId);
assert.deepEqual(index.pivotByTree[elementTreeId], [elementPivotId]);
const state = createUniversalViewportState({ signature: 'dataset-a', tree, pivot, storage });
selectTreeIdentity(state, elementTreeId);
assert.equal(state.selectedPivotId, elementPivotId);
selectPivotIdentity(state, pivotViewIdentity(pivotRows[1], 1));
assert.equal(state.selectedTreeId, treeViewIdentity(treeNodes[2]));
persistUniversalViewportUiState(state, storage);
assert.equal(createUniversalViewportState({ signature: 'dataset-a', tree, pivot, storage }).selectedTreeId, state.selectedTreeId);
assert.equal(createUniversalViewportState({ signature: 'dataset-b', tree, pivot, storage }).selectedTreeId, '');
assert.notEqual(loadUniversalSurfaceState('dataset-a', 'tree', storage).zoomX, loadUniversalSurfaceState('dataset-b', 'tree', storage).zoomX);
assert.ok([...storage.values.keys()].every((key) => key.includes('xml-builder') || key.includes('xmlBuilderViewportUiV1')));

assert.equal(treeHost.dispose(), true);
assert.equal(treeHost.dispose(), false);
assert.equal(pivotHost.dispose(), true);

console.log('xml-compare universal viewport adapter tests passed');
