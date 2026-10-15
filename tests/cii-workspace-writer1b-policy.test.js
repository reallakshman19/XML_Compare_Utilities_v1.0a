import assert from 'assert';
import { classifyCiiTransferDelta } from '../tabs/cii-workspace/cii-workspace-transfer-policy.js';

function delta(category, property, sourceValue, targetValue, authority, extra = {}) {
  return Object.freeze({ category, property, sourceValue, targetValue, authority, changed: true, semanticChange: 'CHANGED', ...extra });
}

const od = classifyCiiTransferDelta(delta('PIPE_SIZE', 'OD', 168.3, 114.3,
  'PROTECTED_WRITER_ELEMENT_ROW1_OD_FIXED_FIELD:WRITER_1B_PLAIN_PIPE_NO_REDUCER'));
assert.strictEqual(od.action, 'COPY');
assert.strictEqual(od.status, 'PREVIEW_READY');
assert.strictEqual(od.policyAuthority, 'CII_WRITER_1B_CONDITIONAL_OD_FIXED_FIELD');

const reducerOd = classifyCiiTransferDelta(delta('PIPE_SIZE', 'OD', 168.3, 114.3,
  'PARSED_ELEMENT_PIPE_PROPERTY;WRITER_1B_OD_BLOCKED:OD_TARGET_REDUCER_POINTER_PRESENT',
  { limitations: Object.freeze(['OD_TARGET_REDUCER_POINTER_PRESENT']) }));
assert.strictEqual(reducerOd.action, 'KEEP');
assert.strictEqual(reducerOd.status, 'PROTECTED');
assert(reducerOd.blockers.includes('OD_TARGET_REDUCER_POINTER_PRESENT'));

for (const [property, authority] of [
  ['T9', 'PROTECTED_WRITER_ELEMENT_ROW3_T9_FIXED_FIELD'],
  ['P8', 'PROTECTED_WRITER_ELEMENT_ROW5_P8_FIXED_FIELD'],
  ['Fluid density', 'PROTECTED_WRITER_ELEMENT_ROW6_FLUID_DENSITY_FIXED_FIELD'],
]) {
  const result = classifyCiiTransferDelta(delta('PROCESS', property, 9, 3, authority));
  assert.strictEqual(result.action, 'COPY', `${property} must be Writer 1B COPY`);
  assert.strictEqual(result.status, 'PREVIEW_READY');
  assert.strictEqual(result.policyAuthority, 'CII_WRITER_1B_CARDINALITY_PRESERVING_ELEMENT_FIELD');
}

const slotPlan = Object.freeze({ status: 'QUALIFIED', mode: 'CREATE', pointer: 2, slot: 5, blockers: Object.freeze([]) });
const slot = classifyCiiTransferDelta(delta('RESTRAINT', 'Qualified restraint slot mutation', slotPlan, null,
  'PROTECTED_WRITER_RESTRANT_SLOT_MUTATION:PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_FREE_SLOT'));
assert.strictEqual(slot.action, 'CREATE');
assert.strictEqual(slot.status, 'PREVIEW_READY');
assert.strictEqual(slot.policyAuthority, 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT');

const sif = classifyCiiTransferDelta(delta('SIF_TEE', 'SIF/Tee raw code (field 2)', 3, 5,
  'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD'));
assert.strictEqual(sif.action, 'COPY');
assert.strictEqual(sif.status, 'BLOCKED');
assert(sif.blockers.includes('SIF_TEE_FIELD_SEMANTICS_UNQUALIFIED'));

const presence = delta('RESTRAINT', 'Restraint presence', true, false, 'CONTROL_RESTRAINT_EVIDENCE');
const writer1A = classifyCiiTransferDelta(presence, { writerVersion: '1A' });
assert.strictEqual(writer1A.action, 'CREATE');
assert.strictEqual(writer1A.status, 'BLOCKED');
assert(writer1A.blockers.includes('RESTRAINT_RECORD_CARDINALITY_CHANGE_WRITER_1A'));
const writer1B = classifyCiiTransferDelta(presence, { writerVersion: '1B' });
assert.strictEqual(writer1B.action, 'KEEP');
assert.strictEqual(writer1B.status, 'PROTECTED');

console.log('CII Writer 1B transfer-policy authority checks passed.');
