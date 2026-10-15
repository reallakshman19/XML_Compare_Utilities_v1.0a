import assert from 'assert';
import { CII_SIX_FIELD_WIDTHS, decodeFixedFields, parseFortranNumber } from '../parser/fixed-field.js';
import { formatCiiWriterSig6 } from '../tabs/cii-workspace/cii-workspace-target-writer.js';
import { applyCiiTargetWriter1B } from '../tabs/cii-workspace/cii-workspace-target-writer-1b.js';

function row(values) { return values.map((value, index) => formatCiiWriterSig6(value).padStart(CII_SIX_FIELD_WIDTHS[index], ' ')).join(''); }
function emptySlot() { return [row([0, 0, 0, 0, 0, 0]), row([0, 0, 0, 0, 0, 0]), '0', '0']; }
function occupiedSlot(node = 20) { return [row([node, 9, 1.75e12, 3, 0.2, 0]), row([1, 0, 0, 0, 0, 0]), '0', '0']; }
function cii(restraintRows) {
  const element = [row([10, 20, 100, 0, 0, 114.3]), ...Array.from({ length: 14 }, () => row([0, 0, 0, 0, 0, 0]))];
  return ['#$ ELEMENTS', ...element, '#$ RESTRANT', ...restraintRows, '#$ END', ''].join('\n');
}
function field(text, slot, rowOffset, fieldIndex) {
  const lines = text.split(/\r?\n/); const marker = lines.indexOf('#$ RESTRANT');
  const line = lines[marker + 1 + (slot - 1) * 4 + rowOffset];
  return parseFortranNumber(decodeFixedFields(line, CII_SIX_FIELD_WIDTHS)[fieldIndex]);
}
function graphAndCorrespondence() {
  return {
    targetGraph: Object.freeze({ edges: Object.freeze([]) }),
    correspondence: Object.freeze({ elementRows: Object.freeze([]), componentRows: Object.freeze([]), nodeRows: Object.freeze([Object.freeze({ correspondenceId: 'n1' })]) }),
  };
}
function slotOperation(mode, plan) {
  return Object.freeze({ operationId: `slot-${mode}`, family: 'RESTRAINT', property: 'Qualified restraint slot mutation',
    action: mode === 'CREATE' ? 'CREATE' : 'DELETE', status: 'PREVIEW_READY', proposed: Object.freeze({ status: 'QUALIFIED', mode, ...plan, existingPairs: Object.freeze([]) }),
    matchAuthority: Object.freeze({ correspondenceId: 'n1', status: 'LOCKED' }) });
}

const { targetGraph, correspondence } = graphAndCorrespondence();
const createTarget = cii([...occupiedSlot(20), ...emptySlot(), ...emptySlot(), ...emptySlot(), ...emptySlot(), ...emptySlot()]);
const createPlan = Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([slotOperation('CREATE', {
  pointer: 1, slot: 2,
  beforeSlot: Object.freeze({ line1: Object.freeze([0, 0, 0, 0, 0, 0]), line2: Object.freeze([0, 0, 0]) }),
  proposedSlot: Object.freeze({ node: 20, typeCode: 15, stiffness: 2.5e9, gap: 4, friction: 0.1, connectingNode: 0,
    directionCosines: Object.freeze({ x: 0, y: 1, z: 0 }) }),
})]) });
const created = applyCiiTargetWriter1B({ targetText: createTarget, targetGraph, correspondence, transferPlan: createPlan });
assert.strictEqual(created.text.length, createTarget.length);
assert.strictEqual(field(created.text, 2, 0, 0), 20);
assert.strictEqual(field(created.text, 2, 0, 1), 15);
assert.strictEqual(field(created.text, 2, 0, 2), 2.5e9);
assert.strictEqual(field(created.text, 2, 0, 3), 4);
assert.strictEqual(field(created.text, 2, 0, 4), 0.1);
assert.strictEqual(field(created.text, 2, 1, 1), 1);
assert(created.mutations.every((item) => item.section === 'RESTRANT' && item.pointer === 1 && item.slot === 2));
assert(created.mutations.every((item) => item.slotMode === 'CREATE'));

const clearTarget = cii([...occupiedSlot(20), ...occupiedSlot(20), ...emptySlot(), ...emptySlot(), ...emptySlot(), ...emptySlot()]);
const clearPlan = Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([slotOperation('CLEAR', {
  pointer: 1, slot: 2,
  beforeSlot: Object.freeze({ line1: Object.freeze([20, 9, 1.75e12, 3, 0.2, 0]), line2: Object.freeze([1, 0, 0]) }),
  proposedSlot: Object.freeze({ line1: Object.freeze([0, 0, 0, 0, 0, 0]), line2: Object.freeze([0, 0, 0]) }),
})]) });
const cleared = applyCiiTargetWriter1B({ targetText: clearTarget, targetGraph, correspondence, transferPlan: clearPlan });
assert.strictEqual(cleared.text.length, clearTarget.length);
for (let index = 0; index < 6; index += 1) assert.strictEqual(field(cleared.text, 2, 0, index), 0);
for (let index = 0; index < 3; index += 1) assert.strictEqual(field(cleared.text, 2, 1, index), 0);
assert.strictEqual(field(cleared.text, 1, 0, 0), 20, 'unrelated occupied slot must remain unchanged');
assert(cleared.mutations.every((item) => item.slotMode === 'CLEAR'));

console.log('CII Writer 1B existing-block restraint slot create/clear checks passed.');
