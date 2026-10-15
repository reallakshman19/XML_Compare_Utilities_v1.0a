import assert from 'node:assert/strict';
import { createUniversalViewportSearchIndex } from '../xml-compare/universal-categorizer/universal-viewport-search.js';
import {
  createUniversalViewportProjection,
  deriveUniversalViewportFilterOptions,
} from '../xml-compare/universal-categorizer/universal-viewport-projection.js';

const rows = Object.freeze([
  Object.freeze({ path: 'A', level: 'Node', key: '1', block: 'Coordinates', field: 'X', value: '10', source: 'mainXml' }),
  Object.freeze({ path: 'B', level: 'Node', key: '2', block: 'Coordinates', field: 'X', value: '20', source: 'coordinateLookup' }),
  Object.freeze({ path: 'C', level: 'Element', key: '3', block: 'LineBlock', field: 'LINE_ID', value: 'L-1', source: 'lineIdLookup' }),
]);
const index = createUniversalViewportSearchIndex(rows, { surface: 'pivot', identityFor: (_, i) => `p${i}` });
const projection = createUniversalViewportProjection(index, {
  searchText: 'coordinates x',
  filters: { level: 'Node', source: 'coordinateLookup' },
  dimensions: ['level', 'block', 'source'],
  selectedId: 'p0',
});
assert.equal(projection.rows.length, 1);
assert.equal(projection.rows[0], rows[1]);
assert.deepEqual(projection.ids, ['p1']);
assert.equal(projection.selectedVisible, false);
assert.deepEqual(deriveUniversalViewportFilterOptions(index, ['level', 'block', 'source']).level, ['Element', 'Node']);
assert.equal(rows[0].source, 'mainXml');
console.log('xml-builder viewport projection tests passed');
