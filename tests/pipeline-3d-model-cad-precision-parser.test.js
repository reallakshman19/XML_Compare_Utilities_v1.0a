import assert from 'node:assert/strict';
import {
  parsePipelineCadPrecisionExpression,
  parsePipelineCadPrecisionFields,
  parsePipelineCadPrecisionScalar,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-precision-parser.js';

assert.deepEqual(parsePipelineCadPrecisionScalar('125.4'), { value: 125.4, mode: 'absolute', unit: '', raw: '125.4' });
assert.deepEqual(parsePipelineCadPrecisionScalar('@-0.4'), { value: -0.4, mode: 'relative', unit: '', raw: '@-0.4' });
assert.equal(parsePipelineCadPrecisionScalar('1.5M', { depth: true }).value, -1.5);
assert.equal(parsePipelineCadPrecisionScalar('A/G', { depth: true }).value, 0.75);

const pair = parsePipelineCadPrecisionExpression(' @2.5, -0.4 ');
assert.equal(pair.kind, 'pair');
assert.equal(pair.mode, 'relative');
assert.deepEqual(pair.values, [2.5, -0.4]);

const absolute = parsePipelineCadPrecisionExpression('125.4, -1.25');
assert.equal(absolute.mode, 'absolute');
assert.deepEqual(absolute.values, [125.4, -1.25]);

const fields = parsePipelineCadPrecisionFields({ inputMode: 'relative', x: '2.5', y: '-0.4', label: ' PM-002 ' });
assert.deepEqual(fields, { inputMode: 'relative', x: 2.5, y: -0.4, label: 'PM-002' });
const depth = parsePipelineCadPrecisionFields({ inputMode: 'absolute', x: '10', y: '2.4M' }, { depth: true });
assert.equal(depth.y, -2.4);

for (const invalid of ['', '@', '1,2,3', '2 + 2', 'globalThis.process', 'Infinity', 'NaN']) {
  assert.throws(() => parsePipelineCadPrecisionExpression(invalid));
}
assert.throws(() => parsePipelineCadPrecisionFields({ x: '', y: '', label: '' }), /at least one/);

console.log('Pipeline CAD precision parser tests passed');
