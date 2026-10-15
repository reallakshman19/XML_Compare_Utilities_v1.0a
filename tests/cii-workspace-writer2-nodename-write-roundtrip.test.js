import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { CII_WRITER_2_NODENAME_RELOCATION_POLICY } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';
import { applyCiiWriter2NodeNameRelocation } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-write.js';
import { validateCiiWriter2NodeNameRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-nodename-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function nameRow(fromName = '', toName = '') { return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`; }
function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]); rows[13] = numericRow([0, 0, 0, 0, 0, pointer]); return rows;
}
function fixture(elements, names) {
  const text = [
    '#$ CONTROL', numericRow([elements.length, 0, 0, names.length, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.pointer)),
    '#$ NODENAME', ...names.map((item) => nameRow(item.fromName, item.toName)), '#$ BEND', 'UNCHANGED-BEND-PAYLOAD', '#$ RIGID',
  ].join('\r\n');
  const parsed = Object.freeze({
    nodes: Object.freeze(Object.fromEntries([...new Set(elements.flatMap((item) => [item.from, item.to]))].map((id) => [String(id), Object.freeze({})]))),
    elements: Object.freeze(elements.map((item, index) => Object.freeze({ index, from: item.from, to: item.to }))),
  });
  return documentFromBytes(new TextEncoder().encode(text), parsed);
}
function documentFromBytes(bytes, parsed) {
  const physicalFile = createCiiPhysicalFile(bytes); const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  return Object.freeze({ physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, nodeNameEvidence, nodeNames: nodeNameEvidence.names, parsed });
}
function op(id, action, nodeId, before, proposed) {
  return Object.freeze({
    operationId: id, family: 'NODE_NAME', property: 'Node name / to-name', action, status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY, targetEvidence: Object.freeze({ identity: String(nodeId) }), before, proposed,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function transferPlan(operations) {
  return Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze(operations), transferScope: Object.freeze({ status: 'BOUND' }) });
}

{
  const before = fixture([
    { from: 10, to: 20, pointer: 1 }, { from: 30, to: 40, pointer: 2 }, { from: 50, to: 60, pointer: 3 }, { from: 70, to: 80, pointer: 0 },
  ], [
    { fromName: 'A10', toName: 'A20' }, { fromName: '', toName: 'D40' }, { fromName: '', toName: 'C60' },
  ]);
  const plan = transferPlan([op('D40', 'DELETE', 40, 'D40', ''), op('C80', 'CREATE', 80, '', 'N80')]);
  const written = applyCiiWriter2NodeNameRelocation({ targetDocument: before, transferPlan: plan });
  const after = documentFromBytes(written.bytes, before.parsed);
  const validation = validateCiiWriter2NodeNameRoundTrip(before, after, plan, written);
  assert.equal(validation.status, 'PASS');
  assert.equal(after.nodeNameEvidence.physicalCustody.rowCount, 3);
  const pointers = Object.values(after.nodeNameEvidence.physicalCustody.byElementIndex).map((item) => Number(item.pointer));
  assert.deepEqual(pointers, [1, 0, 2, 3]);
  assert.equal(after.nodeNames['40'], undefined);
  assert.equal(after.nodeNames['80'], 'N80');
}

{
  const before = fixture([{ from: 10, to: 20, pointer: 0 }], []);
  const plan = transferPlan([op('C20', 'CREATE', 20, '', 'P20')]);
  const written = applyCiiWriter2NodeNameRelocation({ targetDocument: before, transferPlan: plan });
  assert(written.byteLengthAfter > written.byteLengthBefore);
  const after = documentFromBytes(written.bytes, before.parsed);
  assert.equal(validateCiiWriter2NodeNameRoundTrip(before, after, plan, written).status, 'PASS');
  assert.equal(after.nodeNames['20'], 'P20');
}

{
  const before = fixture([{ from: 10, to: 20, pointer: 0 }], []); const plan = transferPlan([op('C20', 'CREATE', 20, '', 'P20')]);
  const written = applyCiiWriter2NodeNameRelocation({ targetDocument: before, transferPlan: plan });
  const tampered = new Uint8Array(written.bytes); const marker = new TextEncoder().encode('UNCHANGED-BEND-PAYLOAD');
  let found = -1;
  outer: for (let i = 0; i <= tampered.length - marker.length; i += 1) {
    for (let j = 0; j < marker.length; j += 1) if (tampered[i + j] !== marker[j]) continue outer;
    found = i; break;
  }
  assert(found >= 0); tampered[found] = 'X'.charCodeAt(0);
  const after = documentFromBytes(tampered, before.parsed);
  assert.throws(() => validateCiiWriter2NodeNameRoundTrip(before, after, plan, written), /WRITER_2_EXACT_POSTIMAGE_MISMATCH/);
}

{
  const before = fixture([{ from: 10, to: 20, pointer: 1 }], [{ fromName: '', toName: 'D20' }]);
  const plan = transferPlan([op('D20', 'DELETE', 20, 'D20', '')]);
  const written = applyCiiWriter2NodeNameRelocation({ targetDocument: before, transferPlan: plan });
  assert(written.byteLengthAfter < written.byteLengthBefore);
  const after = documentFromBytes(written.bytes, before.parsed);
  assert.equal(validateCiiWriter2NodeNameRoundTrip(before, after, plan, written).status, 'PASS');
  assert.equal(after.nodeNameEvidence.physicalCustody.rowCount, 0);
  assert.equal(Number(after.nodeNameEvidence.physicalCustody.byElementIndex['0'].pointer), 0);
}

{
  const before = fixture([{ from: 10, to: 20, pointer: 0 }], []); const plan = transferPlan([op('C20', 'CREATE', 20, '', 'P20')]);
  const written = applyCiiWriter2NodeNameRelocation({ targetDocument: before, transferPlan: plan });
  const after = documentFromBytes(written.bytes, before.parsed);
  const forged = Object.freeze({ ...written, mutations: Object.freeze(written.mutations.slice(1)) });
  assert.throws(() => validateCiiWriter2NodeNameRoundTrip(before, after, plan, forged), /WRITER_2_MUTATION_TESTIMONY_MISMATCH/);
}

console.log('Writer 2 NODENAME physical rewrite and independent exact-postimage validation are covered.');
