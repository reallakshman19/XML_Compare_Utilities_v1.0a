import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWriter2HangerDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import {
  applyCiiWriter2HangerPartialDelete,
  CII_WRITER_2_HANGER_PACKED_TAIL_AUTHORITY,
} from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js';
import { validateCiiWriter2HangerPartialRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-validation.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const PACKED_LABELS = ['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN'];
function raw13(value) { return String(value).padStart(13, ' '); }
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index] || 13, ' ')).join(''); }
function numericRows(values) {
  const rows = []; for (let offset = 0; offset < values.length; offset += 6) rows.push(numericRow(values.slice(offset, offset + 6))); return rows;
}
function packedRows(values, tail = '') {
  const rows = [];
  for (let offset = 0; offset < values.length; offset += 6) rows.push(`  ${values.slice(offset, offset + 6).map(raw13).join('')}`);
  if (rows.length) rows[rows.length - 1] += tail;
  return rows;
}
function packedIntegerRow(values) { return `  ${values.map(raw13).join('')}`; }
function control(numelt, nohgrs) {
  return [numericRow([numelt, 0, nohgrs, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0])];
}
function executionRows() {
  return [numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]), numericRow([3])];
}
function hangerRecord(node, index) {
  const hgrdat = [numericRow([100 + index, 25, 0, 0, 0, 0]), numericRow([0, 9999, index, 0, 0])];
  const tag = `       ${String(`H${node}`).length.toString().padStart(5, ' ')} H${node}`;
  return [...hgrdat, tag, '           0 '];
}
function parsedModel(nodes) {
  const elements = Array.from({ length: Math.max(1, nodes.length) }, (_, index) => Object.freeze({ index, from: 1000 + index * 20, to: 1010 + index * 20 }));
  const allNodes = new Set(nodes.map(Number)); for (const item of elements) { allNodes.add(item.from); allNodes.add(item.to); }
  return Object.freeze({ elements: Object.freeze(elements), nodes: Object.freeze(Object.fromEntries([...allNodes].map((node) => [String(node), Object.freeze({})]))) });
}
function documentFromByteString(byteString, parsed, contentSha256 = sha256CiiByteString(byteString)) {
  const bytes = new Uint8Array(String(byteString).length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = byteString.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes);
  return Object.freeze({ contentSha256, physicalFile, writer1CByteEligible: true,
    hangerEvidence: buildCiiHangerEvidence(physicalFile.text, parsed), parsed });
}
function target(count, tails = {}) {
  const nodes = Array.from({ length: count }, (_, index) => 200 + index * 10); const parsed = parsedModel(nodes);
  const rrmat = numericRows(Array.from({ length: parsed.elements.length }, () => 106));
  const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1])];
  const values = {
    IHGRNODE: nodes,
    IHGRNUM: nodes.map((_, index) => index + 10),
    IHGRTABLE: nodes.map((_, index) => index + 20),
    IHGRSHORT: nodes.map((_, index) => index + 30),
    IHGRCN: nodes.map((_, index) => index + 40),
  };
  const packed = Object.fromEntries(PACKED_LABELS.map((label) => [label, packedRows(values[label], tails[label] || '')]));
  const free = nodes.map((node, index) => packedIntegerRow([node, 0, index + 1, 0]));
  const body = ['#$ CONTROL', ...control(parsed.elements.length, count), '#$ MISCEL_1', ...rrmat, ...defaults,
    ...packed.IHGRNODE, ...nodes.flatMap((node, index) => hangerRecord(node, index + 1)), ...free,
    ...packed.IHGRNUM, ...packed.IHGRTABLE, ...packed.IHGRSHORT, ...packed.IHGRCN,
    ...executionRows(), '#$ UNITS', 'UNITS-CUSTODY'].join('\r\n') + '\r\n';
  const document = documentFromByteString(body, parsed);
  assert.equal(document.hangerEvidence.status, 'QUALIFIED');
  assert.equal(document.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  return { document, nodes };
}
function deleteOperation(node) {
  return Object.freeze({ operationId: `HANGER-${node}`, family: 'HANGER', property: 'Hanger presence', action: 'DELETE',
    status: 'PREVIEW_READY', blockers: Object.freeze([]), evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE',
    sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: true }), before: true, proposed: false,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
}
function boundPlan(before, node) {
  const contracted = applyCiiWriter2HangerDeletePlanContract(Object.freeze({
    status: 'BLOCKED', blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']),
    sourceDocument: Object.freeze({ contentSha256: 'source-sha' }), targetDocument: Object.freeze({ contentSha256: before.contentSha256 }),
    operations: Object.freeze([deleteOperation(node)]), policy: Object.freeze({ hangerMutation: 'BLOCKED' }),
  }));
  const operations = Object.freeze(contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' })));
  return Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]), operations, excludedOperations: Object.freeze([]),
    sourceDocument: Object.freeze({ contentSha256: 'source-sha' }), targetDocument: Object.freeze({ contentSha256: before.contentSha256 }),
    transferScope: Object.freeze({ status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: `tail-scope-${node}`, sourceSha256: 'source-sha', targetSha256: before.contentSha256,
      candidateOperationIds: Object.freeze([`HANGER-${node}`]), appliedOperationIds: Object.freeze([`HANGER-${node}`]), excludedOperationIds: Object.freeze([]) }) });
}
function sectionRows(document, section) {
  const lines = document.physicalFile.lines; const marker = lines.findIndex((line) => String(line.text).trim().toUpperCase() === `#$ ${section}`);
  const rows = []; for (let index = marker + 1; index < lines.length && !String(lines[index].text).trim().startsWith('#$'); index += 1) rows.push(lines[index]); return rows;
}
function packedGroups(document) {
  const count = Number(document.hangerEvidence.count); const rows = sectionRows(document, 'MISCEL_1');
  const prefix = Math.ceil(Number(document.hangerEvidence.control.numelt) / 6); const packedCount = Math.ceil(count / 6); let cursor = prefix + 2;
  const result = {}; result.IHGRNODE = rows.slice(cursor, cursor + packedCount); cursor += packedCount + 4 * count + count;
  for (const label of PACKED_LABELS.slice(1)) { result[label] = rows.slice(cursor, cursor + packedCount); cursor += packedCount; }
  return result;
}
function lineEndingLength(row) { return row.lineEnding === 'CRLF' ? 2 : 1; }
function insertBeforeLineEnding(byteString, row, insertion) {
  const position = row.byteEnd - lineEndingLength(row); return byteString.slice(0, position) + insertion + byteString.slice(position);
}

// Active-only source and post shapes are the qualified synchronizer/vendor form.
{
  const { document: before, nodes } = target(8); const transferPlan = boundPlan(before, nodes[1]);
  const writer = applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan });
  const after = documentFromByteString(writer.byteString, before.parsed);
  assert.equal(validateCiiWriter2HangerPartialRoundTrip(before, after, transferPlan, writer).status, 'PASS');
  assert.equal(writer.packedTailAuthority, CII_WRITER_2_HANGER_PACKED_TAIL_AUTHORITY);
  for (const label of PACKED_LABELS) {
    assert.equal(packedGroups(before)[label].at(-1).text.length, 28, `${label} source row = 2X + two active I13 fields`);
    assert.equal(packedGroups(after)[label].at(-1).text.length, 15, `${label} post row = 2X + one active I13 field`);
  }

  const forged = Object.freeze({ ...writer, packedTailAuthority: 'FORGED_PACKED_TAIL_AUTHORITY' });
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(before, after, transferPlan, forged), /PACKED_TAIL_TESTIMONY_MISMATCH/);

  const row = packedGroups(after).IHGRNUM.at(-1);
  const paddedPost = insertBeforeLineEnding(writer.byteString, row, ' '.repeat(13));
  const paddedAfter = documentFromByteString(paddedPost, before.parsed);
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(before, paddedAfter, transferPlan, writer), /EXACT_POSTIMAGE_MISMATCH/);
}

// A full six-field source row compacting to five fields still emits exactly the active fields.
{
  const { document: before, nodes } = target(6); const transferPlan = boundPlan(before, nodes[0]);
  const writer = applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan });
  const after = documentFromByteString(writer.byteString, before.parsed);
  assert.equal(validateCiiWriter2HangerPartialRoundTrip(before, after, transferPlan, writer).status, 'PASS');
  for (const label of PACKED_LABELS) {
    assert.equal(packedGroups(before)[label].at(-1).text.length, 80, `${label} full source row = 2X + six I13 fields`);
    assert.equal(packedGroups(after)[label].at(-1).text.length, 67, `${label} post row = 2X + five active I13 fields`);
  }
}

// Merged #1025 tolerates whitespace-only trailing data, but PR1027 physical authority does not silently normalize it.
for (const label of PACKED_LABELS) {
  const { document: before, nodes } = target(8, { [label]: ' '.repeat(13) }); const transferPlan = boundPlan(before, nodes[1]);
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan }),
    new RegExp(`PACKED_SOURCE_ACTIVE_FIELDS_ONLY_REQUIRED:${label}`));
}
{
  const { document: before, nodes } = target(8, { IHGRNUM: '\t' }); const transferPlan = boundPlan(before, nodes[1]);
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan }),
    /PACKED_SOURCE_ACTIVE_FIELDS_ONLY_REQUIRED:IHGRNUM/);
}

console.log('Writer2 partial HANGER active-fields-only packed-row custody qualification authored.');