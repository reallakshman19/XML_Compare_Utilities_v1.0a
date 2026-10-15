import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import {
  buildCiiWriter2NodeNameRelocationPlan, CII_WRITER_2_NODENAME_RELOCATION_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? 0).padStart(WIDTHS[index], ' ')).join(''); }
function nameRow(fromName = '', toName = '') { return `  ${String(fromName).padEnd(26, ' ')}${String(toName).padEnd(25, ' ')}`; }
function nameRowFixture(fromName, toName) { return { fromName, toName }; }
function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 0, 100]);
  rows[13] = numericRow([0, 0, 0, 0, 0, pointer]);
  return rows;
}
function fixture({ elements, names, nodeNames }) {
  const body = [
    '#$ CONTROL', numericRow([elements.length, 0, 0, names.length, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flatMap((item) => elementBlock(item.from, item.to, item.pointer)),
    '#$ NODENAME', ...names.map((item) => nameRow(item.fromName, item.toName)), '#$ BEND',
  ].join('\r\n');
  const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(body));
  const parsed = Object.freeze({
    nodes: Object.freeze(Object.fromEntries([...new Set(elements.flatMap((item) => [item.from, item.to]))].map((id) => [String(id), Object.freeze({})]))),
    elements: Object.freeze(elements.map((item, index) => Object.freeze({ index, from: item.from, to: item.to }))),
  });
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
  const targetDocument = Object.freeze({
    physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, nodeNameEvidence,
    nodeNames: Object.freeze(nodeNames || nodeNameEvidence.names),
  });
  const targetGraph = Object.freeze({
    edges: Object.freeze(elements.map((item, index) => Object.freeze({ elementId: `E${index + 1}`, parsedElementIndex: index, from: item.from, to: item.to }))),
  });
  return { targetDocument, targetGraph };
}
function operation(id, action, nodeId, before, proposed) {
  return Object.freeze({
    operationId: id, family: 'NODE_NAME', property: 'Node name / to-name', action,
    status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_2_NODENAME_RELOCATION_POLICY,
    targetEvidence: Object.freeze({ identity: String(nodeId) }), before, proposed,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function plan(model, operations) {
  return buildCiiWriter2NodeNameRelocationPlan({
    ...model,
    transferPlan: Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze(operations), transferScope: Object.freeze({ status: 'BOUND' }) }),
  });
}

{
  const model = fixture({ elements: [{ from: 10, to: 20, pointer: 0 }], names: [], nodeNames: {} });
  const result = plan(model, [operation('CREATE-20', 'CREATE', 20, '', 'P-20')]);
  assert.equal(result.ready, true);
  assert.equal(result.rowCountBefore, 0);
  assert.equal(result.rowCountAfter, 1);
  assert.equal(result.controlCountAfter, 1);
  assert.equal(result.appendedRows[0].newPointer, 1);
  assert.equal(result.appendedRows[0].toName, 'P-20');
  assert.equal(result.appendedRows[0].rowText.length, 53);
  assert.deepEqual(result.pointerChanges.map((item) => [item.parsedElementIndex, item.oldPointer, item.newPointer]), [[0, 0, 1]]);
}

{
  const model = fixture({ elements: [{ from: 10, to: 20, pointer: 0 }], names: [], nodeNames: {} });
  const result = plan(model, [
    operation('CREATE-10', 'CREATE', 10, '', 'P-10'), operation('CREATE-20', 'CREATE', 20, '', 'P-20'),
  ]);
  assert.equal(result.ready, true);
  assert.equal(result.appendedRows.length, 1);
  assert.equal(result.appendedRows[0].fromName, 'P-10');
  assert.equal(result.appendedRows[0].toName, 'P-20');
}

{
  const model = fixture({
    elements: [
      { from: 10, to: 20, pointer: 1 }, { from: 30, to: 40, pointer: 2 }, { from: 50, to: 60, pointer: 3 },
    ],
    names: [nameRowFixture('A10', ''), nameRowFixture('', 'DELETE40'), nameRowFixture('', 'C60')],
    nodeNames: { 10: 'A10', 40: 'DELETE40', 60: 'C60' },
  });
  const result = plan(model, [operation('DELETE-40', 'DELETE', 40, 'DELETE40', '')]);
  assert.equal(result.ready, true);
  assert.deepEqual(result.oldToNewPointer, { 1: 1, 2: 0, 3: 2 });
  assert.deepEqual(result.deletedPointers, [2]);
  assert.equal(result.rowCountAfter, 2);
  assert.equal(result.controlCountAfter, 2);
  assert(result.pointerChanges.some((item) => item.parsedElementIndex === 1 && item.oldPointer === 2 && item.newPointer === 0));
  assert(result.pointerChanges.some((item) => item.parsedElementIndex === 2 && item.oldPointer === 3 && item.newPointer === 2));
}

{
  const model = fixture({
    elements: [{ from: 10, to: 20, pointer: 1 }], names: [nameRowFixture('KEEP10', 'DELETE20')],
    nodeNames: { 10: 'KEEP10', 20: 'DELETE20' },
  });
  const result = plan(model, [operation('DELETE-20', 'DELETE', 20, 'DELETE20', '')]);
  assert.equal(result.ready, true);
  assert.equal(result.rowCountAfter, 1);
  assert.deepEqual(result.deletedPointers, []);
  assert.equal(result.pointerChanges.length, 0);
  assert.equal(result.finalRows[0].rowText.slice(2, 28).trim(), 'KEEP10');
  assert.equal(result.finalRows[0].rowText.slice(28, 53).trim(), '');
}

console.log('Writer 2 NODENAME relocation CREATE/DELETE/compaction plans are deterministic.');
