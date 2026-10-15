import assert from 'assert';
import { pairCiiRestraintRecords } from '../tabs/cii-workspace/cii-workspace-restraint-pairing.js';
import { applyCiiTargetWriter1A, ciiWriter1AReadiness } from '../tabs/cii-workspace/cii-workspace-target-writer.js';

const widths = [15, 13, 13, 13, 13, 13];
function row(values) { return values.map((value, index) => String(value).padStart(widths[index], ' ')).join(''); }
function numeric(...values) { return row([...values, 0, 0, 0, 0, 0, 0].slice(0, 6)); }
function record(pointer, slot, node, config = {}) {
  return {
    pointer, slot, node: String(node),
    typeCode: config.typeCode,
    stiffness: config.stiffness,
    gap: config.gap,
    friction: config.friction,
    connectingNode: config.connectingNode ?? 0,
    directionCosines: config.directionCosines,
    tag: { text: config.tag || '' }, guid: { text: config.guid || '' },
  };
}

const sourceRecords = [
  record(2, 1, 500, {
    typeCode: 15, stiffness: 1e12, gap: 2, friction: 0.1, connectingNode: 510,
    directionCosines: { x: 1, y: 0, z: 0 }, tag: 'X-SUPPORT',
  }),
  record(2, 5, 500, {
    typeCode: 9, stiffness: 2e12, gap: 4, friction: 0.2, connectingNode: 0,
    directionCosines: { x: 0, y: 1, z: 0 }, tag: 'Y-SUPPORT',
  }),
];
const targetRecords = [
  record(1, 2, 9500, {
    typeCode: 61, stiffness: 8e9, gap: 99, friction: 0.9, connectingNode: 0,
    directionCosines: { x: 0, y: 1, z: 0 }, tag: 'Y-SUPPORT',
  }),
  record(1, 6, 9500, {
    typeCode: 62, stiffness: 9e9, gap: 88, friction: 0.8, connectingNode: 9520,
    directionCosines: { x: 1, y: 0, z: 0 }, tag: 'X-SUPPORT',
  }),
];
const pairing = pairCiiRestraintRecords(sourceRecords, targetRecords, new Map([['510', '9510']]));
assert.strictEqual(pairing.status, 'QUALIFIED');
const bySourceSlot = new Map(pairing.pairs.map((pair) => [pair.source.slot, pair.target.slot]));
assert.strictEqual(bySourceSlot.get(1), 6, 'source X support must map to target slot 6, not source slot 1');
assert.strictEqual(bySourceSlot.get(5), 2, 'source Y support must map to target slot 2, not source slot 5');
assert.strictEqual(pairing.pairs.find((pair) => pair.source.slot === 1).proposed.connectingNode, 9510, 'connecting node must be projected through node correspondence');

const elementRows = Array.from({ length: 15 }, () => numeric(0, 0, 0, 0, 0, 0));
elementRows[0] = row(['9000.000', '9500.000', '100.000', '0.000000', '0.000000', '114.30000']);
const restraintRows = [];
for (let slot = 1; slot <= 6; slot += 1) {
  const item = targetRecords.find((recordItem) => recordItem.slot === slot);
  if (item) {
    restraintRows.push(row([item.node, item.typeCode, item.stiffness, item.gap, item.friction, item.connectingNode]));
    restraintRows.push(row([item.directionCosines.x, item.directionCosines.y, item.directionCosines.z, 0, 0, 0]));
    restraintRows.push(`${item.tag.text.length} ${item.tag.text}`);
    restraintRows.push('0');
  } else {
    restraintRows.push(numeric(0, 0, 0, 0, 0, 0));
    restraintRows.push(numeric(0, 0, 0, 0, 0, 0));
    restraintRows.push('0'); restraintRows.push('0');
  }
}
assert.strictEqual(restraintRows.length, 24);
const targetText = ['#$ ELEMENTS', ...elementRows, '#$ RESTRANT', ...restraintRows, '#$ UNITS', 'metric', ''].join('\r\n');

const correspondenceId = 'node:500:9500';
const transferPlan = {
  schema: 'CIIWorkspaceTransferPlan.v1', status: 'PREVIEW_READY', blockers: [],
  operations: [{
    operationId: 'op:restraint-pairing', family: 'RESTRAINT', property: 'Qualified restraint record pairing',
    action: 'COPY', status: 'PREVIEW_READY', before: null, proposed: pairing,
    matchAuthority: { correspondenceId, status: 'REVIEWED' },
  }],
};
const correspondence = {
  nodeRows: [{ correspondenceId, kind: 'NODE', sourceNodeId: '500', targetNodeId: '9500', status: 'HIGH' }],
  elementRows: [], componentRows: [],
};
assert.strictEqual(ciiWriter1AReadiness(transferPlan).ready, true);

const result = applyCiiTargetWriter1A({ targetText, targetGraph: { edges: [] }, correspondence, transferPlan });
assert.strictEqual(result.status, 'APPLIED');
assert.strictEqual(result.text.length, targetText.length, 'restraint modification must preserve exact target file length');
assert.strictEqual(result.mutationCount, 9, 'only nine changed numeric restraint fields should be rewritten');
assert.strictEqual(result.negativeAssurance.sectionCardinalityChanged, false);
assert.strictEqual(result.negativeAssurance.pointerOwnershipChanged, false);

const lines = result.text.split(/\r\n/);
const restraintStart = lines.indexOf('#$ RESTRANT') + 1;
const slot2Line1 = lines[restraintStart + 4];
const slot6Line1 = lines[restraintStart + 20];
const slot2Line2 = lines[restraintStart + 5];
const slot6Line2 = lines[restraintStart + 21];
assert.strictEqual(Number(slot2Line1.slice(0, 15)), 9500, 'target restraint node identity must remain target-native');
assert.strictEqual(Number(slot2Line1.slice(15, 28)), 9);
assert.strictEqual(Number(slot2Line1.slice(28, 41)), 2e12);
assert.strictEqual(Number(slot2Line1.slice(41, 54)), 4);
assert.strictEqual(Number(slot2Line1.slice(54, 67)), 0.2);
assert.strictEqual(Number(slot2Line1.slice(67, 80)), 0);
assert.deepStrictEqual([Number(slot2Line2.slice(0, 15)), Number(slot2Line2.slice(15, 28)), Number(slot2Line2.slice(28, 41))], [0, 1, 0]);
assert.strictEqual(Number(slot6Line1.slice(0, 15)), 9500);
assert.strictEqual(Number(slot6Line1.slice(15, 28)), 15);
assert.strictEqual(Number(slot6Line1.slice(28, 41)), 1e12);
assert.strictEqual(Number(slot6Line1.slice(41, 54)), 2);
assert.strictEqual(Number(slot6Line1.slice(54, 67)), 0.1);
assert.strictEqual(Number(slot6Line1.slice(67, 80)), 9510, 'connecting node must be target-native after mapping');
assert.deepStrictEqual([Number(slot6Line2.slice(0, 15)), Number(slot6Line2.slice(15, 28)), Number(slot6Line2.slice(28, 41))], [1, 0, 0]);
assert(lines.includes('9 Y-SUPPORT'), 'target tag row must remain present and untouched');
assert(lines.includes('9 X-SUPPORT'), 'target tag row must remain present and untouched');

console.log('CII Writer 1A paired restraint slot mutation checks passed.');
