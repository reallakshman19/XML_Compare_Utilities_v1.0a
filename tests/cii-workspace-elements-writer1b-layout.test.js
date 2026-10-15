import assert from 'assert';
import { CII_SIX_FIELD_WIDTHS } from '../parser/fixed-field.js';
import { parseElements } from '../parser/sections/elements.js';
import { formatCiiWriterSig6 } from '../tabs/cii-workspace/cii-workspace-target-writer.js';

function row(values) {
  return values.map((value, index) => formatCiiWriterSig6(value).padStart(CII_SIX_FIELD_WIDTHS[index], ' ')).join('');
}
function block(from, to, dx, temperatures, pressures) {
  return [
    row([from, to, dx, 0, 0, 114.3]),
    row([6.02, 25, 3, temperatures[0], temperatures[1], temperatures[2]]),
    // This row intentionally looks like a plausible element header under the
    // old heuristic: two positive integer-like values and a sixth value > 10.
    row([temperatures[3], temperatures[4], temperatures[5], temperatures[6], temperatures[7], temperatures[8]]),
    row(pressures.slice(0, 6)),
    row([...pressures.slice(6, 9), 0, 0, 0]),
    row([0.001, 0.002, 0, 0, 0, 5]),
    ...Array.from({ length: 9 }, () => row([0, 0, 0, 0, 0, 0])),
  ];
}

const lines = [
  ...block(10, 20, 100, [100, 110, 120, 130, 140, 150, 160, 170, 180], [10,20,30,40,50,60,70,80,90]),
  ...block(20, 30, 200, [200, 210, 220, 230, 240, 250, 260, 270, 280], [11,21,31,41,51,61,71,81,91]),
];
const log = [];
const parsed = parseElements(lines, log);
assert.strictEqual(parsed.elements.length, 2, 'exact 15-row custody must prevent process rows from becoming false element headers');
assert.strictEqual(parsed.elements[0].from, 10);
assert.strictEqual(parsed.elements[0].to, 20);
assert.strictEqual(parsed.elements[0].T4, 130);
assert.strictEqual(parsed.elements[0].T9, 180);
assert.strictEqual(parsed.elements[0].P7, 70);
assert.strictEqual(parsed.elements[0].P9, 90);
assert.strictEqual(parsed.elements[0].insulationDensity, 0.001);
assert.strictEqual(parsed.elements[0].fluidDensity, 0.002);
assert.strictEqual(parsed.elements[0].hydroPressure, 5);
assert.strictEqual(parsed.elements[1].from, 20);
assert.strictEqual(parsed.elements[1].to, 30);
assert(!log.some((item) => item.level === 'WARN' && String(item.msg).includes('legacy element-start fallback')),
  'canonical 15-row benchmark must not fall back to heuristic block detection');

console.log('CII Writer 1B exact 15-row ELEMENT layout checks passed.');
