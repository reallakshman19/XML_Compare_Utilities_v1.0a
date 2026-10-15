import assert from 'node:assert/strict';
import {
  buildPipelineDerivedTablePreview,
  buildPipelineDerivedTablePreviewHtml,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-derived-table-preview.js';

const rows = Array.from({ length: 500 }, (_, index) => `${index + 1}\tvalue-${index + 1}`);
const source = ['Id\tValue', ...rows].join('\n');
const preview = buildPipelineDerivedTablePreview(source);

assert.equal(preview.totalRows, 500);
assert.equal(preview.displayedRows, 200);
assert.equal(preview.omittedRows, 300);
assert.equal(preview.headRows[0][0], '1');
assert.equal(preview.headRows.at(-1)[0], '100');
assert.equal(preview.tailRows[0][0], '401');
assert.equal(preview.tailRows.at(-1)[0], '500');
assert.equal(preview.truncated, true);
assert.equal(Object.isFrozen(preview), true);

const html = buildPipelineDerivedTablePreviewHtml(source);
assert.match(html, /Showing first 100 and last 100 of 500 rows/);
assert.match(html, /300 rows omitted from preview/);
assert.match(html, /value-1</);
assert.match(html, /value-500</);
assert.doesNotMatch(html, /value-250</);

const shortHtml = buildPipelineDerivedTablePreviewHtml('A\tB\n1\t2\n3\t4');
assert.match(shortHtml, /Showing all 2 rows/);
assert.doesNotMatch(shortHtml, /data-p3d-derived-preview-gap/);
console.log('pipeline derived table preview tests passed');
