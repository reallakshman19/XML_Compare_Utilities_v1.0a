import assert from 'node:assert/strict';
import {
  createUniversalViewportSearchIndex,
  normalizeUniversalViewportSearch,
  universalViewportItemMatches,
} from '../xml-compare/universal-categorizer/universal-viewport-search.js';

const treeRows = Object.freeze([
  Object.freeze({ nodeId: 't1', path: 'Plant / Line A', label: 'Valve A', level: 'Element', key: '10+20', fields: Object.freeze({ 'LineBlock.LINE_ID': 'LINE-100' }) }),
  Object.freeze({ nodeId: 't2', path: 'Plant / Line B', label: 'Node 30', level: 'Node', key: '30', fields: Object.freeze({ 'Coordinate.X': 120 }) }),
]);
const index = createUniversalViewportSearchIndex(treeRows, { surface: 'tree', identityFor: (row) => row.nodeId });
assert.equal(index.rows, treeRows);
assert.deepEqual(normalizeUniversalViewportSearch('  VALVE   line-100 ').tokens, ['valve', 'line-100']);
assert.equal(universalViewportItemMatches(index.items[0], normalizeUniversalViewportSearch('valve line-100')), true);
assert.equal(universalViewportItemMatches(index.items[1], normalizeUniversalViewportSearch('valve line-100')), false);
assert.equal(index.items[0].row, treeRows[0]);
console.log('xml-builder viewport literal search tests passed');
