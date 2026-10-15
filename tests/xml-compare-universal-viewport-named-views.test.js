import assert from 'node:assert/strict';
import {
  createUniversalNamedViewSnapshot,
  createUniversalNamedViewStore,
} from '../xml-compare/universal-categorizer/universal-viewport-named-views.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
const storage = new MemoryStorage();
const snapshot = createUniversalNamedViewSnapshot({
  mode: 'side-by-side', searchText: 'node 10', treeFilters: { level: 'Node' },
  pivotFilters: { level: 'Node', block: 'Coordinates', source: 'mainXml' },
  treeTransform: { zoomX: 2, zoomY: 1.2 }, pivotTransform: { zoomX: 3, zoomY: 1 },
  treeScrollAnchor: { id: 't10', offset: 4 }, pivotScrollAnchor: { id: 'p20', offset: 2 },
  selectedTreeId: 't10', selectedPivotId: 'p20',
});
const storeA = createUniversalNamedViewStore({ signature: 'dataset-a', storage });
const saved = storeA.save(' Review nodes ', snapshot);
assert.equal(saved.length, 1);
assert.equal(saved[0].name, 'Review nodes');
assert.throws(() => storeA.save('review NODES', snapshot), /unique/i);
storeA.rename(saved[0].id, 'Node review');
assert.equal(storeA.list()[0].name, 'Node review');
const storeB = createUniversalNamedViewStore({ signature: 'dataset-b', storage });
assert.equal(storeB.list().length, 0);
assert.ok([...storage.values.keys()].every((key) => key.startsWith('xmlBuilderViewportNamedViewsV1/')));
storage.setItem('xmlBuilderViewportNamedViewsV1/broken', '{bad');
assert.equal(createUniversalNamedViewStore({ signature: 'broken', storage }).diagnostics()[0].code, 'XMLB_NAMED_VIEWS_STORAGE_INVALID');
assert.equal(storeA.delete(saved[0].id), true);
assert.equal(storeA.list().length, 0);
console.log('xml-builder viewport named-view tests passed');
