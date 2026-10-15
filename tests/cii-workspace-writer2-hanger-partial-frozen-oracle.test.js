import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWriter2HangerDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2HangerPartialDelete } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const PACKED_LABELS = ['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN'];
function raw13(value) { return String(value).padStart(13, ' '); }
function sha256(value) { return createHash('sha256').update(Buffer.from(String(value), 'latin1')).digest('hex'); }
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join(''); }
function numericRows(values) {
  const rows = []; for (let offset = 0; offset < values.length; offset += 6) rows.push(numericRow(values.slice(offset, offset + 6))); return rows;
}
function packedRows(values, overrides = {}) {
  const rows = [];
  for (let offset = 0; offset < values.length; offset += 6) {
    rows.push(`  ${values.slice(offset, offset + 6).map((value, index) => overrides[offset + index + 1] ?? raw13(value)).join('')}`);
  }
  return rows;
}
function control(numelt, count) {
  return [numericRow([numelt, 0, count, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0])];
}
function executionRows() {
  return [numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]), numericRow([3])];
}
function hangerRecord(node, index) {
  const body = `H${node}`;
  return Object.freeze({
    hgrdat: Object.freeze([numericRow([100 + index, 25, 0, 0, 0, 0]), numericRow([0, 9999, index, 0, 0])]),
    tagGuid: Object.freeze([`       ${String(body.length).padStart(5, ' ')} ${body}`, '           0 ']),
  });
}
function parsedModel(nodes) {
  const elements = Array.from({ length: Math.max(1, nodes.length) }, (_, index) => Object.freeze({
    index, from: 1000 + index * 20, to: 1010 + index * 20,
  }));
  const allNodes = new Set(nodes.map(Number));
  for (const item of elements) { allNodes.add(item.from); allNodes.add(item.to); }
  return Object.freeze({
    elements: Object.freeze(elements),
    nodes: Object.freeze(Object.fromEntries([...allNodes].map((node) => [String(node), Object.freeze({})]))),
  });
}
function documentFromBytes(byteString, parsed, contentSha256) {
  const bytes = new Uint8Array(String(byteString).length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = byteString.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes);
  return Object.freeze({
    contentSha256, physicalFile, writer1CByteEligible: true,
    hangerEvidence: buildCiiHangerEvidence(physicalFile.text, parsed), parsed,
  });
}
function target0ForCase(spec) {
  const count = Number(spec.countBefore); const nodes = Array.from({ length: count }, (_, index) => 200 + index * 10);
  const parsed = parsedModel(nodes); const rrmat = numericRows(Array.from({ length: parsed.elements.length }, () => 106));
  const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), `  ${[1, 0, 1, 1, 1].map(raw13).join('')}`];
  const records = nodes.map((node, index) => hangerRecord(node, index + 1));
  const tail = spec.tailOrder === 'INTERLEAVED'
    ? records.flatMap((record) => [...record.hgrdat, ...record.tagGuid])
    : [...records.flatMap((record) => record.hgrdat), ...records.flatMap((record) => record.tagGuid)];
  const free = nodes.map((node, index) => `  ${[node, 0, index + 1, 0].map(raw13).join('')}`);
  const values = {
    IHGRNODE: nodes,
    IHGRNUM: nodes.map((_, index) => index + 10),
    IHGRTABLE: nodes.map((_, index) => index + 20),
    IHGRSHORT: nodes.map((_, index) => index + 30),
    IHGRCN: nodes.map((_, index) => index + 40),
  };
  const overrides = spec.lexicalRawI13
    ? { [spec.lexicalRawI13.family]: { [spec.lexicalRawI13.recordIndex]: raw13(spec.lexicalRawI13.rawToken) } } : {};
  const packed = Object.fromEntries(PACKED_LABELS.map((label) => [label, packedRows(values[label], overrides[label] || {})]));
  const body = ['#$ CONTROL', ...control(parsed.elements.length, count), '#$ MISCEL_1', ...rrmat, ...defaults,
    ...packed.IHGRNODE, ...tail, ...free, ...packed.IHGRNUM, ...packed.IHGRTABLE, ...packed.IHGRSHORT, ...packed.IHGRCN,
    ...executionRows(), '#$ UNITS', 'UNITS-CUSTODY'].join('\r\n') + '\r\n';
  return Object.freeze({ body, nodes, parsed });
}
function hangerDeleteOperation(node) {
  return Object.freeze({
    operationId: `HANGER-${node}`, family: 'HANGER', property: 'Hanger presence', action: 'DELETE',
    status: 'PREVIEW_READY', blockers: Object.freeze([]), evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function boundPlan(before, deleteNodes) {
  const sourceDocument = Object.freeze({ contentSha256: 'source-sha' });
  const targetDocument = Object.freeze({ contentSha256: before.contentSha256 });
  const base = Object.freeze({
    status: 'BLOCKED', blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']),
    sourceDocument, targetDocument, operations: Object.freeze(deleteNodes.map(hangerDeleteOperation)), policy: Object.freeze({ hangerMutation: 'BLOCKED' }),
  });
  const contract = applyCiiWriter2HangerDeletePlanContract(base);
  const operations = Object.freeze(contract.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' })));
  const appliedOperationIds = Object.freeze(operations.map((item) => item.operationId));
  return Object.freeze({
    ...contract, status: 'PREVIEW_READY', blockers: Object.freeze([]), sourceDocument, targetDocument, operations,
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: `oracle-${appliedOperationIds.join('-')}`,
      sourceSha256: 'source-sha', targetSha256: before.contentSha256,
      candidateOperationIds: appliedOperationIds, appliedOperationIds, excludedOperationIds: Object.freeze([]),
    }),
  });
}

const oracleText = await readFile(new URL('./fixtures/cii-writer2-hanger-partial-postimage-oracles.json', import.meta.url), 'utf8');
const oracle = JSON.parse(oracleText);
assert.equal(oracle.schema, 'CIIWriter2HangerPartialPostimageOracles.v1');
assert.equal(oracle.authority, 'IMMUTABLE_INDEPENDENT_EXPECTED_POSTIMAGE_SHA256');

for (const [caseId, spec] of Object.entries(oracle.cases)) {
  const target = target0ForCase(spec);
  assert.equal(target.body.length, spec.target0ByteLength, `${caseId} TARGET0 length`);
  assert.equal(sha256(target.body), spec.target0Sha256, `${caseId} TARGET0 immutable oracle`);
  const before = documentFromBytes(target.body, target.parsed, spec.target0Sha256);
  assert.equal(before.hangerEvidence.status, 'QUALIFIED', `${caseId} pre hanger evidence`);
  assert.equal(before.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER, `${caseId} pre layout`);
  const deleteNodes = spec.deletePositions.map((position) => target.nodes[position - 1]);
  const writer = applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: boundPlan(before, deleteNodes) });
  assert.equal(writer.byteString.length, spec.expectedFinalByteLength, `${caseId} final length`);
  assert.equal(sha256(writer.byteString), spec.expectedFinalSha256, `${caseId} independent frozen postimage SHA`);
  assert.equal(writer.packedRowsBefore, spec.packedRowsBefore, `${caseId} packed rows before`);
  assert.equal(writer.packedRowsAfter, spec.packedRowsAfter, `${caseId} packed rows after`);
}

console.log('Writer2 partial H>1 frozen independent postimage SHA fixtures authored.');
