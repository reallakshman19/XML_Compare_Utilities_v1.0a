import assert from 'assert';
import { applyCiiHangerCapabilities, buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';

function row(values) {
  const widths = [15, ...values.slice(1).map(() => 13)];
  return values.map((value, index) => String(value).padStart(widths[index])).join('');
}
function control(numelt, nohgrs, numnoz = 0) {
  return [
    row([String(numelt), String(numnoz), String(nohgrs), '0', '0', '0']),
    row(['0', '0', '0', '0', '0', '0']),
    row(['0', '0', '0', '0', '0', '0']),
    row(['0']),
  ];
}
function parsed() {
  return {
    elements: [
      { index: 0, from: 10, to: 20 },
      { index: 1, from: 20, to: 30 },
    ],
    nodes: { 10: { x: 0, y: 0, z: 0 }, 20: { x: 100, y: 0, z: 0 }, 30: { x: 200, y: 0, z: 0 } },
  };
}
function baseCapabilities() {
  return { schema: 'CIIWorkspaceCapabilities.v1', families: { hangers: { state: 'NOT_PARSED', count: null, qualification: 'NONE' } } };
}
const material = row(['106.000', '106.000']);
const default1 = row(['1', '25.0000', '0.000000', '9999.99', '1.00000', '1.00000']);
const default2 = row(['1', '0', '1', '1', '1']);
const hgrdat1 = row(['0.000000', '25.0000', '0.000000', '0.000000', '0.000000', '0.000000']);
const hgrdat2 = row(['0.000000', '9999.99', '1.00000', '0.000000', '0.000000']);
const free = row(['0', '0', '0', '0']);

// Vendor/CAESAR synchronizer layout: IHGRNODE immediately follows defaults.
const synchronizerText = [
  '#$ CONTROL', ...control(2, 1),
  '#$ MISCEL_1', material, default1, default2, row(['20']), hgrdat1, hgrdat2, row(['0']), row(['0']), free,
].join('\n');
const synchronizer = buildCiiHangerEvidence(synchronizerText, parsed());
assert.strictEqual(synchronizer.status, 'QUALIFIED');
assert.strictEqual(synchronizer.count, 1);
assert.deepStrictEqual(synchronizer.nodes, ['20']);
assert.strictEqual(synchronizer.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
assert.strictEqual(synchronizer.candidates.length, 1);
assert.strictEqual(synchronizer.candidates[0].startRow1Based, 4);
const syncCapabilities = applyCiiHangerCapabilities(baseCapabilities(), synchronizer);
assert.strictEqual(syncCapabilities.families.hangers.state, 'PARSED');
assert.strictEqual(syncCapabilities.families.hangers.count, 1);
assert.strictEqual(syncCapabilities.families.hangers.details.nodePresenceQualified, true);

// Current inputxml_to_cii2019.py layout: five per-hanger rows precede IHGRNODE.
const coreText = [
  '#$ CONTROL', ...control(2, 1),
  '#$ MISCEL_1', material, default1, default2, hgrdat1, hgrdat2, row(['0']), row(['0']), free, row(['20']),
].join('\n');
const core = buildCiiHangerEvidence(coreText, parsed());
assert.strictEqual(core.status, 'QUALIFIED');
assert.strictEqual(core.count, 1);
assert.deepStrictEqual(core.nodes, ['20']);
assert.strictEqual(core.layout, CII_HANGER_LAYOUTS.INPUTXML_CURRENT);
assert.strictEqual(core.candidates.length, 1);
assert.strictEqual(core.candidates[0].startRow1Based, 9);

// NOHGRS=0 is authoritative empty hanger presence; no fake zero-node record.
const emptyText = ['#$ CONTROL', ...control(2, 0), '#$ MISCEL_1', material].join('\n');
const empty = buildCiiHangerEvidence(emptyText, parsed());
assert.strictEqual(empty.status, 'QUALIFIED');
assert.strictEqual(empty.count, 0);
assert.deepStrictEqual(empty.nodes, []);
assert.strictEqual(empty.layout, CII_HANGER_LAYOUTS.NONE);
const emptyCapabilities = applyCiiHangerCapabilities(baseCapabilities(), empty);
assert.strictEqual(emptyCapabilities.families.hangers.state, 'EMPTY');
assert.strictEqual(emptyCapabilities.families.hangers.count, 0);

// A candidate node that is not in parsed topology must fail closed.
const badText = [
  '#$ CONTROL', ...control(2, 1),
  '#$ MISCEL_1', material, default1, default2, row(['999']), hgrdat1, hgrdat2, row(['0']), row(['0']), free,
].join('\n');
const bad = buildCiiHangerEvidence(badText, parsed());
assert.strictEqual(bad.status, 'PARSE_ERROR');
assert(bad.conflicts.some((item) => item.code === 'HANGER_IHGRNODE_LAYOUT_UNRESOLVED'));
assert.strictEqual(applyCiiHangerCapabilities(baseCapabilities(), bad).families.hangers.state, 'PARSE_ERROR');

console.log('CII dual-layout hanger node-custody checks passed.');
