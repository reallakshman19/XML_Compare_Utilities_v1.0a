import assert from 'node:assert/strict';
import { parseTableXOcr } from '../tabs/pipeline-3d-model/pipeline-3d-model-ocr-tablex-parser.js';

const sampleText = `
DESIGN FACTOR DF:0.72
SIZE/MATERIAL/COATING/CODE 6" CS, ISO 3183 L415 (X60), 3LPE
WALL THK. 5.8MM
HORIZONTAL LENGTH 24.2 328.7 138.0 50.0
MINIMUM COVER 0.6M 1.2M 0.6M
MARKERS PM-D10 PM-OD6 PM-OD3
CROSSING WDX
SPECIAL PROVISION NOTE-4
`;

const result = parseTableXOcr({ text: sampleText, axisStart: 0, axisEnd: '' });
const byType = (type) => result.rows.filter((row) => row.type === type);

assert.deepEqual(
  byType('segment-length').map((row) => ({ start: row.start, end: row.end, value: row.value })),
  [
    { start: 0, end: 24.2, value: '24.2' },
    { start: 24.2, end: 352.9, value: '328.7' },
    { start: 352.9, end: 490.9, value: '138' },
    { start: 490.9, end: 540.9, value: '50' },
  ],
);
assert.deepEqual(byType('marker').map((row) => row.value), ['PM-D10', 'PM-OD6', 'PM-OD3']);
assert.deepEqual(byType('range-value').map((row) => row.value), ['0.6M', '1.2M', '0.6M']);
assert.equal(result.rows.find((row) => row.label === 'CROSSING')?.value, 'WDX');
assert.equal(result.rows.find((row) => row.label === 'SPECIAL PROVISION')?.value, 'NOTE-4');
assert.equal(result.rows.find((row) => row.label === 'WALL THK.')?.value, '5.8MM');
assert.ok(result.warnings.some((warning) => warning.code === 'tablex_review_required'));

const noisyText = `
[MINIMUM COVER ~~~
en TL ee
[L] CONSTRUCTION[MARKERS ~~
(NOTE- 4)
`;
const noisyResult = parseTableXOcr({ text: noisyText, axisStart: 0, axisEnd: '' });
assert.equal(noisyResult.rows.find((row) => row.label === 'MINIMUM COVER')?.value, '');
assert.equal(noisyResult.rows.find((row) => row.label === 'MARKERS')?.value, '');
assert.equal(noisyResult.rows.find((row) => row.label === 'SPECIAL PROVISION')?.value, 'NOTE-4');
assert.ok(!noisyResult.warnings.some((warning) => warning.code === 'tablex_no_rows'));

console.log('pipeline-3d-model-ocr-tablex-parser tests passed');
