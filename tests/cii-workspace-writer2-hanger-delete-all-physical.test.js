import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import {
  applyCiiWriter2HangerDeletePlanContract, CII_WRITER_2_HANGER_DELETE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import {
  applyCiiWriter2HangerDeleteAll, _test as writerTest,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-write.js';
import { validateCiiWriter2HangerDeleteAllRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join(''); }
function packedIntegerRow(values) { return `  ${values.map((value) => String(value).padStart(13, ' ')).join('')}`; }
function control(numelt, nohgrs, numnoz = 0) {
  return [numericRow([numelt, numnoz, nohgrs, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0])];
}
function executionRows() {
  return [numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]), numericRow([3])];
}
function hangerRows(node, index) {
  const hgrdat = [numericRow([100 + index, 25, 0, 0, 0, 0]), numericRow([0, 9999, index, 0, 0])];
  const tagGuid = [`       ${String(`H${node}`).length.toString().padStart(5, ' ')} H${node}`, '           0 '];
  return { hgrdat, tagGuid };
}
function parsedModel(nodes) {
  const elementCount = Math.max(1, nodes.length);
  return Object.freeze({
    elements: Object.freeze(Array.from({ length: elementCount }, (_, index) => Object.freeze({
      index, from: 10 + index * 10, to: 20 + index * 10,
    }))),
    nodes: Object.freeze(Object.fromEntries([...new Set([10, 20, 30, 40, 50, ...nodes])]
      .map((node) => [String(node), Object.freeze({})]))),
  });
}
function documentFromByteString(byteString, parsed) {
  const bytes = new Uint8Array(String(byteString).length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = byteString.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes);
  const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({ physicalFile, writer1CByteEligible: true, hangerEvidence, parsed });
}
function syntheticTarget(nodes, tailOrder = 'INTERLEAVED') {
  const count = nodes.length; const parsed = parsedModel(nodes); const elementCount = parsed.elements.length;
  const rrmat = [numericRow(Array.from({ length: elementCount }, () => 106))];
  const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1])];
  const records = nodes.map((node, index) => hangerRows(node, index));
  const hgrdatTagGuid = tailOrder === 'INTERLEAVED'
    ? records.flatMap((record) => [...record.hgrdat, ...record.tagGuid])
    : [...records.flatMap((record) => record.hgrdat), ...records.flatMap((record) => record.tagGuid)];
  const free = nodes.map((node, index) => packedIntegerRow([node, 0, index + 1, 0]));
  const body = ['#$ CONTROL', ...control(elementCount, count), '#$ MISCEL_1', ...rrmat, ...defaults,
    packedIntegerRow(nodes), ...hgrdatTagGuid, ...free,
    packedIntegerRow(nodes.map((_, index) => index + 10)), packedIntegerRow(nodes.map((_, index) => index + 20)),
    packedIntegerRow(nodes.map((_, index) => index + 30)), packedIntegerRow(nodes.map((_, index) => index + 40)),
    ...executionRows(), '#$ UNITS', 'UNITS-CUSTODY'].join('\r\n') + '\r\n';
  const target = documentFromByteString(body, parsed);
  assert.equal(target.hangerEvidence.status, 'QUALIFIED');
  assert.equal(target.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  return target;
}
function hangerOperation(node, id = `HANGER-${node}`) {
  return Object.freeze({
    operationId: id, family: 'HANGER', property: 'Hanger presence', action: 'DELETE', status: 'PREVIEW_READY', blockers: Object.freeze([]),
    evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function rawPlan(operations, blockers = ['NO_TRANSFERABLE_PREVIEW_OPERATIONS']) {
  return Object.freeze({ status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: Object.freeze(blockers),
    mutationAuthority: 'WRITER_1B_CONDITIONAL', sourceDocument: Object.freeze({ contentSha256: 'source' }),
    targetDocument: Object.freeze({ contentSha256: 'target' }), operations: Object.freeze(operations),
    policy: Object.freeze({ hangerMutation: 'BLOCKED' }) });
}
function boundForNodes(nodes) {
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan(nodes.map((node) => hangerOperation(node))));
  assert.equal(contracted.status, 'PREVIEW_READY');
  assert(contracted.operations.every((item) => item.policyAuthority === CII_WRITER_2_HANGER_DELETE_POLICY));
  return Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]),
    operations: Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' }))),
    excludedOperations: Object.freeze([]), transferScope: Object.freeze({ status: 'BOUND' }) });
}
function sectionRows(document, section) {
  const lines = document.physicalFile.lines; const wanted = `#$ ${section}`;
  const marker = lines.findIndex((line) => String(line.text).trim().toUpperCase() === wanted.toUpperCase());
  const out = [];
  for (let index = marker + 1; index < lines.length && !String(lines[index].text).trim().startsWith('#$'); index += 1) out.push(lines[index].text);
  return out;
}

// H=1: exact two-span mutation, then independent full-postimage validation.
{
  const before = syntheticTarget([20]); const transferPlan = boundForNodes([20]);
  const originalMiscel = sectionRows(before, 'MISCEL_1');
  const writer = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan });
  assert.equal(writer.status, 'APPLIED'); assert.equal(writer.family, 'HANGER_DELETE_ALL');
  assert.equal(writer.hangerCountBefore, 1); assert.equal(writer.hangerCountAfter, 0);
  assert.deepEqual(writer.mutations.map((item) => item.kind), ['CONTROL_HANGER_COUNT', 'MISCEL_1_HANGER_DELETE_ALL_PAYLOAD']);
  const after = documentFromByteString(writer.byteString, before.parsed);
  const validation = validateCiiWriter2HangerDeleteAllRoundTrip(before, after, transferPlan, writer);
  assert.equal(validation.status, 'PASS');
  assert.equal(after.hangerEvidence.count, 0); assert.equal(after.hangerEvidence.layout, CII_HANGER_LAYOUTS.NONE);
  const postMiscel = sectionRows(after, 'MISCEL_1');
  assert.deepEqual(postMiscel, [originalMiscel[0], ...originalMiscel.slice(-4)], 'RRMAT + execution rows must be byte/text preserved');
}

// H=3 delete-all is valid for both disputed HGRDAT/TAG-GUID tail orders because the complete hanger envelope is removed.
for (const tailOrder of ['INTERLEAVED', 'GROUPED']) {
  const before = syntheticTarget([20, 30, 40], tailOrder); const transferPlan = boundForNodes([20, 30, 40]);
  const originalMiscel = sectionRows(before, 'MISCEL_1');
  const writer = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan });
  const after = documentFromByteString(writer.byteString, before.parsed);
  const validation = validateCiiWriter2HangerDeleteAllRoundTrip(before, after, transferPlan, writer);
  assert.equal(validation.status, 'PASS'); assert.equal(validation.hangerCountBefore, 3); assert.equal(validation.expectedMiscelRowsAfter, 5);
  assert.deepEqual(sectionRows(after, 'MISCEL_1'), [originalMiscel[0], ...originalMiscel.slice(-4)]);
}

// Partial H>1 may now be planner-qualified, but this physical writer remains delete-all-only.
{
  const before = syntheticTarget([20, 30, 40]);
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan([hangerOperation(30)]));
  const transferPlan = Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]),
    operations: Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' }))),
    excludedOperations: Object.freeze([]), transferScope: Object.freeze({ status: 'BOUND' }) });
  assert.throws(() => applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan }),
    /CII_WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED/);
}

// Unrelated postimage tamper must fail exact independent postimage equality.
{
  const before = syntheticTarget([20]); const transferPlan = boundForNodes([20]);
  const writer = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan });
  const tampered = writer.byteString.replace('UNITS-CUSTODY', 'XNITS-CUSTODY');
  const after = documentFromByteString(tampered, before.parsed);
  assert.throws(() => validateCiiWriter2HangerDeleteAllRoundTrip(before, after, transferPlan, writer),
    /WRITER_2_HANGER_EXACT_POSTIMAGE_MISMATCH/);
}

// Forged mutation testimony cannot authorize correct bytes.
{
  const before = syntheticTarget([20]); const transferPlan = boundForNodes([20]);
  const writer = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan });
  const after = documentFromByteString(writer.byteString, before.parsed);
  const forged = Object.freeze({ ...writer, mutations: Object.freeze(writer.mutations.map((item, index) => index === 0
    ? Object.freeze({ ...item, afterField: '            9' }) : item)) });
  assert.throws(() => validateCiiWriter2HangerDeleteAllRoundTrip(before, after, transferPlan, forged),
    /WRITER_2_HANGER_MUTATION_TESTIMONY_MISMATCH/);
}

// Replacement application is preimage-bound: stale bytes at an authorized span are rejected.
{
  const original = 'ABCDE';
  assert.throws(() => writerTest.applyReplacements(original, [{ kind: 'X', byteStart: 1, byteEnd: 3, beforeField: 'ZZ', afterField: '12' }]),
    /CII_WRITER_2_HANGER_STALE_PREIMAGE/);
}

// Real repository benchmark: node 205 single-hanger delete-all must pass through writer + independent validator.
{
  const bytes = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
  const before = await intakeCiiWorkspaceDocument(bytes, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
  assert.equal(before.hangerEvidence.status, 'QUALIFIED'); assert.deepEqual(before.hangerEvidence.nodes, ['205']);
  const transferPlan = boundForNodes([205]);
  const writer = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan });
  const after = await intakeCiiWorkspaceDocument(writer.bytes, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
  const validation = validateCiiWriter2HangerDeleteAllRoundTrip(before, after, transferPlan, writer);
  assert.equal(validation.status, 'PASS'); assert.equal(validation.hangerCountBefore, 1); assert.equal(validation.expectedMiscelRowsAfter, 11);
  assert.equal(after.hangerEvidence.count, 0);
}

console.log('Writer2 HANGER delete-all physical transaction and independent postimage falsifiers authored.');
