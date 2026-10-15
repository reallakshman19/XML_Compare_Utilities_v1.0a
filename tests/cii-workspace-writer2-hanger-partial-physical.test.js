import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { buildCiiHangerEvidence, CII_HANGER_LAYOUTS } from '../tabs/cii-workspace/cii-workspace-hanger.js';
import { applyCiiWriter2HangerDeletePlanContract } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete.js';
import { applyCiiWriter2HangerPartialDelete } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js';
import { validateCiiWriter2HangerPartialRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-validation.js';
import { applyCiiWriter2HangerDeleteAll } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-delete-all-write.js';
import { ciiWriter2CompositeReadiness } from '../tabs/cii-workspace/cii-workspace-writer2-composite-routing.js';
import { sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const PACKED_LABELS = ['IHGRNODE', 'IHGRNUM', 'IHGRTABLE', 'IHGRSHORT', 'IHGRCN'];
function raw13(value) { return String(value).padStart(13, ' '); }
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
function packedIntegerRow(values) { return `  ${values.map(raw13).join('')}`; }
function control(numelt, nohgrs, numnoz = 0) {
  return [numericRow([numelt, numnoz, nohgrs, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0])];
}
function executionRows() {
  return [numericRow([0, 0, 0, 2, 0, 1]), numericRow([0, 0, 21, 21, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 3]), numericRow([3])];
}
function hangerRecord(node, index) {
  const hgrdat = [numericRow([100 + index, 25, 0, 0, 0, 0]), numericRow([0, 9999, index, 0, 0])];
  const tag = `       ${String(`H${node}`).length.toString().padStart(5, ' ')} H${node}`;
  return { hgrdat, tagGuid: [tag, '           0 '] };
}
function parsedModel(nodes) {
  const elements = Array.from({ length: Math.max(1, nodes.length) }, (_, index) => Object.freeze({ index, from: 1000 + index * 20, to: 1010 + index * 20 }));
  const allNodes = new Set(nodes.map(Number)); for (const item of elements) { allNodes.add(item.from); allNodes.add(item.to); }
  return Object.freeze({ elements: Object.freeze(elements), nodes: Object.freeze(Object.fromEntries([...allNodes].map((node) => [String(node), Object.freeze({})]))) });
}
function documentFromByteString(byteString, parsed, contentSha256 = sha256CiiByteString(byteString)) {
  const bytes = new Uint8Array(String(byteString).length);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = byteString.charCodeAt(index) & 0xff;
  const physicalFile = createCiiPhysicalFile(bytes); const hangerEvidence = buildCiiHangerEvidence(physicalFile.text, parsed);
  return Object.freeze({ contentSha256, physicalFile, writer1CByteEligible: true, hangerEvidence, parsed });
}
function syntheticTarget(count, tailOrder = 'INTERLEAVED', options = {}) {
  const nodes = Array.from({ length: count }, (_, index) => 200 + index * 10); const parsed = parsedModel(nodes); const numnoz = Number(options.numnoz || 0);
  const rrmat = numericRows(Array.from({ length: parsed.elements.length }, () => 106));
  const nozzleRows = Array.from({ length: numnoz * 4 }, (_, index) => numericRow([700 + index, 0, 0, 0, 0, 0]));
  const defaults = [numericRow([1, 25, 0, 9999, 1, 1]), packedIntegerRow([1, 0, 1, 1, 1])];
  const records = nodes.map((node, index) => hangerRecord(node, index + 1));
  const tail = tailOrder === 'INTERLEAVED'
    ? records.flatMap((record) => [...record.hgrdat, ...record.tagGuid])
    : [...records.flatMap((record) => record.hgrdat), ...records.flatMap((record) => record.tagGuid)];
  const free = nodes.map((node, index) => packedIntegerRow([node, 0, index + 1, 0]));
  const values = {
    IHGRNODE: nodes,
    IHGRNUM: nodes.map((_, index) => index + 10),
    IHGRTABLE: nodes.map((_, index) => index + 20),
    IHGRSHORT: nodes.map((_, index) => index + 30),
    IHGRCN: nodes.map((_, index) => index + 40),
  };
  const packed = Object.fromEntries(PACKED_LABELS.map((label) => [label, packedRows(values[label], options.rawOverrides?.[label] || {})]));
  const body = ['#$ CONTROL', ...control(parsed.elements.length, count, numnoz), '#$ MISCEL_1', ...rrmat, ...nozzleRows, ...defaults,
    ...packed.IHGRNODE, ...tail, ...free, ...packed.IHGRNUM, ...packed.IHGRTABLE, ...packed.IHGRSHORT, ...packed.IHGRCN,
    ...executionRows(), '#$ UNITS', 'UNITS-CUSTODY'].join('\r\n') + '\r\n';
  const target = documentFromByteString(body, parsed);
  assert.equal(target.hangerEvidence.status, 'QUALIFIED'); assert.equal(target.hangerEvidence.layout, CII_HANGER_LAYOUTS.SYNCHRONIZER);
  return Object.freeze({ target, nodes });
}
function hangerDeleteOperation(node, id = `HANGER-${node}`) {
  return Object.freeze({ operationId: id, family: 'HANGER', property: 'Hanger presence', action: 'DELETE', status: 'PREVIEW_READY', blockers: Object.freeze([]),
    evidenceAuthority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE', sourceEvidence: Object.freeze({ identity: `SRC-${node}`, value: false, authority: 'CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE' }),
    targetEvidence: Object.freeze({ identity: String(node), value: true }), before: true, proposed: false, matchAuthority: Object.freeze({ status: 'REVIEWED' }) });
}
function rawPlan(operations, targetSha) {
  return Object.freeze({ status: 'BLOCKED', blockers: Object.freeze(['NO_TRANSFERABLE_PREVIEW_OPERATIONS']), mutationAuthority: 'WRITER_1B_CONDITIONAL',
    sourceDocument: Object.freeze({ contentSha256: 'source-sha' }), targetDocument: Object.freeze({ contentSha256: targetSha }),
    operations: Object.freeze(operations), policy: Object.freeze({ hangerMutation: 'BLOCKED' }) });
}
function canonicalScope(appliedIds, targetSha, excludedIds = []) {
  const candidates = [...appliedIds, ...excludedIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return Object.freeze({ status: 'BOUND', mode: 'EXPLICIT_APPLY_EXCLUDE', authority: 'USER_EXPLICIT_OPERATION_SCOPE', scopeId: `scope-${candidates.join('-')}`,
    sourceSha256: 'source-sha', targetSha256: targetSha, candidateOperationIds: Object.freeze(candidates),
    appliedOperationIds: Object.freeze([...appliedIds]), excludedOperationIds: Object.freeze([...excludedIds]) });
}
function boundForDelete(before, nodes) {
  const contracted = applyCiiWriter2HangerDeletePlanContract(rawPlan(nodes.map((node) => hangerDeleteOperation(node)), before.contentSha256));
  assert.equal(contracted.status, 'PREVIEW_READY');
  const operations = contracted.operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' }));
  const ids = operations.filter((item) => item.action !== 'KEEP').map((item) => item.operationId);
  return Object.freeze({ ...contracted, status: 'PREVIEW_READY', blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ contentSha256: 'source-sha' }), targetDocument: Object.freeze({ contentSha256: before.contentSha256 }),
    operations: Object.freeze(operations), excludedOperations: Object.freeze([]), transferScope: canonicalScope(ids, before.contentSha256) });
}
function arbitraryBoundPlan(before, operations) {
  const rows = operations.map((item) => Object.freeze({ ...item, scopeDecision: 'APPLY' })); const ids = rows.filter((item) => item.action !== 'KEEP').map((item) => item.operationId);
  return Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), sourceDocument: Object.freeze({ contentSha256: 'source-sha' }),
    targetDocument: Object.freeze({ contentSha256: before.contentSha256 }), operations: Object.freeze(rows), excludedOperations: Object.freeze([]),
    transferScope: canonicalScope(ids, before.contentSha256) });
}
function sectionObjects(document, section) {
  const lines = document.physicalFile.lines; const marker = lines.findIndex((line) => String(line.text).trim().toUpperCase() === `#$ ${section}`);
  const rows = []; for (let index = marker + 1; index < lines.length && !String(lines[index].text).trim().startsWith('#$'); index += 1) rows.push(lines[index]); return rows;
}
function groups(document) {
  const count = Number(document.hangerEvidence.count); const control = document.hangerEvidence.control;
  const rows = sectionObjects(document, 'MISCEL_1'); const prefixCount = Math.ceil(Number(control.numelt) / 6) + 4 * Number(control.numnoz); const packedCount = Math.ceil(count / 6);
  let cursor = prefixCount; const prefix = rows.slice(0, prefixCount); const defaults = rows.slice(cursor, cursor + 2); cursor += 2;
  const packed = {}; packed.IHGRNODE = rows.slice(cursor, cursor + packedCount); cursor += packedCount;
  const tail = rows.slice(cursor, cursor + 4 * count); cursor += 4 * count; const free = rows.slice(cursor, cursor + count); cursor += count;
  for (const label of PACKED_LABELS.slice(1)) { packed[label] = rows.slice(cursor, cursor + packedCount); cursor += packedCount; }
  const execution = rows.slice(cursor, cursor + 4);
  return { rows, prefix, defaults, packed, tail, free, execution };
}
function packedFields(document, label) {
  const count = Number(document.hangerEvidence.count); const rows = groups(document).packed[label]; const out = [];
  for (let index = 0; index < count; index += 1) {
    const row = rows[Math.floor(index / 6)]; const column = index % 6; out.push(row.text.slice(2 + column * 13, 2 + (column + 1) * 13));
  }
  return out;
}
function replaceSpan(text, start, end, replacement) { return text.slice(0, start) + replacement + text.slice(end); }
function rowRaw(byteString, row) { return byteString.slice(row.byteStart, row.byteEnd); }
function replaceRowSequence(byteString, rows, permutation) {
  const replacement = permutation.map((index) => rowRaw(byteString, rows[index])).join(''); return replaceSpan(byteString, rows[0].byteStart, rows[rows.length - 1].byteEnd, replacement);
}
function swapPackedFields(byteString, document, label, left, right) {
  const row = groups(document).packed[label][0]; const body = rowRaw(byteString, row); const a = 2 + left * 13; const b = 2 + right * 13;
  const leftField = body.slice(a, a + 13); const rightField = body.slice(b, b + 13);
  const changed = body.slice(0, a) + rightField + body.slice(a + 13, b) + leftField + body.slice(b + 13);
  return replaceSpan(byteString, row.byteStart, row.byteEnd, changed);
}
function replacePackedField(byteString, document, label, position, rawField) {
  const rowIndex = Math.floor((position - 1) / 6); const column = (position - 1) % 6; const row = groups(document).packed[label][rowIndex];
  const start = row.byteStart + 2 + column * 13; return replaceSpan(byteString, start, start + 13, rawField);
}
function swapRows(byteString, rows, left, right) {
  const leftRaw = rowRaw(byteString, rows[left]); const rightRaw = rowRaw(byteString, rows[right]); assert.equal(leftRaw.length, rightRaw.length);
  let out = replaceSpan(byteString, rows[right].byteStart, rows[right].byteEnd, leftRaw); out = replaceSpan(out, rows[left].byteStart, rows[left].byteEnd, rightRaw); return out;
}
function tamperRowByte(byteString, row) {
  const position = row.byteStart; const current = byteString[position]; const replacement = current === 'X' ? 'Y' : 'X'; return replaceSpan(byteString, position, position + 1, replacement);
}
function validateFails(before, transferPlan, writer, tamperedBytes, pattern = /CII_WRITER_2_HANGER_PARTIAL_ROUNDTRIP_FAILED/) {
  const after = documentFromByteString(tamperedBytes, before.parsed);
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(before, after, transferPlan, writer), pattern);
}
function runCase(count, deletePositions, tailOrder = 'INTERLEAVED', options = {}) {
  const { target: before, nodes } = syntheticTarget(count, tailOrder, options); const deleteNodes = deletePositions.map((position) => nodes[position - 1]);
  const transferPlan = boundForDelete(before, deleteNodes); const writer = applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan });
  const after = documentFromByteString(writer.byteString, before.parsed); const validation = validateCiiWriter2HangerPartialRoundTrip(before, after, transferPlan, writer);
  assert.equal(validation.status, 'PASS'); const deleted = new Set(deletePositions); const retained = Array.from({ length: count }, (_, index) => index + 1).filter((index) => !deleted.has(index));
  assert.deepEqual(writer.retainedRecordIndices, retained); assert.equal(writer.hangerCountAfter, retained.length);
  assert.equal(writer.packedRowsBefore, Math.ceil(count / 6)); assert.equal(writer.packedRowsAfter, Math.ceil(retained.length / 6));
  for (const label of PACKED_LABELS) {
    const beforeFields = packedFields(before, label); const expected = retained.map((index) => beforeFields[index - 1]); assert.deepEqual(packedFields(after, label), expected, `${label} raw-field order`);
  }
  return { before, after, transferPlan, writer, validation, nodes, retained };
}

// Mandatory packing-boundary matrix.
for (const [count, deleted] of [[2, [1]], [3, [2]], [6, [1]], [7, [1]], [7, [7]], [8, [2]], [8, [2, 7]], [12, [1]], [13, [1]]]) {
  runCase(count, deleted);
}
for (const [count, deleted] of [[3, [2]], [7, [2]], [13, [1]]]) runCase(count, deleted, 'GROUPED');

// Lexical I13 custody: +12 must survive H=7 -> 6 relocation exactly.
const lexical = runCase(7, [2], 'INTERLEAVED', { rawOverrides: { IHGRNUM: { 7: raw13('+12') } } });
assert(packedFields(lexical.after, 'IHGRNUM').includes(raw13('+12')));

// F01 wrong oldToNewRecordIndex testimony.
{
  const c = runCase(3, [2]); const forged = Object.freeze({ ...c.writer, oldToNewRecordIndex: Object.freeze({ 1: 2, 2: 0, 3: 1 }) });
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(c.before, c.after, c.transferPlan, forged), /RECORD_TESTIMONY_MISMATCH/);
}
// F02 retained record order changed across all physical representations.
{
  const c = runCase(3, [2]); let bytes = c.writer.byteString; const g = groups(c.after);
  for (const label of PACKED_LABELS) bytes = swapPackedFields(bytes, c.after, label, 0, 1);
  bytes = replaceRowSequence(bytes, g.tail, [4, 5, 6, 7, 0, 1, 2, 3]); bytes = swapRows(bytes, g.free, 0, 1);
  validateFails(c.before, c.transferPlan, c.writer, bytes);
}
// F03 one packed family uses a different retained order.
{
  const c = runCase(3, [2]); validateFails(c.before, c.transferPlan, c.writer, swapPackedFields(c.writer.byteString, c.after, 'IHGRNUM', 0, 1));
}
// F04 wrong packed-row count.
{
  const c = runCase(8, [2]); const row = groups(c.after).packed.IHGRNUM[1]; const bytes = replaceSpan(c.writer.byteString, row.byteStart, row.byteEnd, '');
  validateFails(c.before, c.transferPlan, c.writer, bytes);
}
// F05 blank packed 13-byte field cannot become numeric zero authority.
{
  const { target: before, nodes } = syntheticTarget(3, 'INTERLEAVED', { rawOverrides: { IHGRNUM: { 2: '             ' } } });
  const plan = boundForDelete(before, [nodes[1]]);
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: plan }), /PARTIAL_BLOCKED|RECORD_BINDING/);
}
// F06 retained numeric token may not be reserialized.
{
  const c = lexical; const position = c.retained.indexOf(7) + 1; const bytes = replacePackedField(c.writer.byteString, c.after, 'IHGRNUM', position, raw13('12'));
  validateFails(c.before, c.transferPlan, c.writer, bytes, /EXACT_POSTIMAGE_MISMATCH/);
}
// F07 IHGRFREE row from the wrong record.
{
  const c = runCase(3, [2]); validateFails(c.before, c.transferPlan, c.writer, swapRows(c.writer.byteString, groups(c.after).free, 0, 1));
}
// F08/F09 order-class conversion is forbidden.
for (const order of ['INTERLEAVED', 'GROUPED']) {
  const c = runCase(3, [2], order); const tail = groups(c.after).tail; const bytes = replaceRowSequence(c.writer.byteString, tail, [0, 1, 4, 5, 2, 3, 6, 7]);
  validateFails(c.before, c.transferPlan, c.writer, bytes);
}
// F10 HGRDAT pair from wrong retained record.
{
  const c = runCase(3, [2]); const tail = groups(c.after).tail; validateFails(c.before, c.transferPlan, c.writer, replaceRowSequence(c.writer.byteString, tail, [4, 5, 2, 3, 0, 1, 6, 7]));
}
// F11 TAG/GUID assigned to wrong retained record.
{
  const c = runCase(3, [2]); const tail = groups(c.after).tail; validateFails(c.before, c.transferPlan, c.writer, replaceRowSequence(c.writer.byteString, tail, [0, 1, 6, 7, 4, 5, 2, 3]));
}
// F12 TAG and GUID swapped.
{
  const c = runCase(3, [2]); const tail = groups(c.after).tail; validateFails(c.before, c.transferPlan, c.writer, replaceRowSequence(c.writer.byteString, tail, [0, 1, 3, 2, 4, 5, 6, 7]));
}
// F13 CONTROL.NOHGRS wrong.
{
  const c = runCase(3, [2]); const mutation = c.writer.mutations.find((item) => item.kind === 'CONTROL_HANGER_COUNT');
  validateFails(c.before, c.transferPlan, c.writer, replaceSpan(c.writer.byteString, mutation.byteStart, mutation.byteEnd, raw13(9)));
}
// F14 hanger default row changed.
{
  const c = runCase(3, [2]); validateFails(c.before, c.transferPlan, c.writer, tamperRowByte(c.writer.byteString, groups(c.after).defaults[0]));
}
// F15 RRMAT byte changed.
{
  const c = runCase(3, [2]); validateFails(c.before, c.transferPlan, c.writer, tamperRowByte(c.writer.byteString, groups(c.after).prefix[0]));
}
// F16 VFLEX/nozzle-prefix byte changed.
{
  const c = runCase(3, [2], 'INTERLEAVED', { numnoz: 1 }); const prefix = groups(c.after).prefix;
  validateFails(c.before, c.transferPlan, c.writer, tamperRowByte(c.writer.byteString, prefix[prefix.length - 1]));
}
// F17 execution-row byte changed.
{
  const c = runCase(3, [2]); validateFails(c.before, c.transferPlan, c.writer, tamperRowByte(c.writer.byteString, groups(c.after).execution[0]));
}
// F18 unrelated CII byte changed outside authorized replacements.
{
  const c = runCase(3, [2]); validateFails(c.before, c.transferPlan, c.writer, c.writer.byteString.replace('UNITS-CUSTODY', 'XNITS-CUSTODY'));
}
// F19 stale TARGET hash/preimage replay.
{
  const { target: before, nodes } = syntheticTarget(3); const plan = boundForDelete(before, [nodes[1]]);
  const stale = Object.freeze({ ...plan, transferScope: Object.freeze({ ...plan.transferScope, targetSha256: 'stale-target' }) });
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: stale }), /SCOPE_TARGET_HASH_MISMATCH/);
}
// F20 forged writer mutation ledger.
{
  const c = runCase(3, [2]); const mutations = c.writer.mutations.map((item, index) => index === 0 ? Object.freeze({ ...item, afterField: raw13(9) }) : item);
  const forged = Object.freeze({ ...c.writer, mutations: Object.freeze(mutations) });
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(c.before, c.after, c.transferPlan, forged), /MUTATION_TESTIMONY_MISMATCH/);
}
// F21 forged writer retained-record testimony.
{
  const c = runCase(3, [2]); const forged = Object.freeze({ ...c.writer, retainedRecordIndices: Object.freeze([3, 1]) });
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(c.before, c.after, c.transferPlan, forged), /RECORD_TESTIMONY_MISMATCH/);
}
// F22 forged writer tail-order testimony.
{
  const c = runCase(3, [2]); const forged = Object.freeze({ ...c.writer, tailOrder: 'FORGED_ORDER' });
  assert.throws(() => validateCiiWriter2HangerPartialRoundTrip(c.before, c.after, c.transferPlan, forged), /TAIL_ORDER_TESTIMONY_MISMATCH/);
}
// F23 unsupported INPUTXML_CURRENT/HGRDAT-first layout.
{
  const { target: before, nodes } = syntheticTarget(3); const bad = Object.freeze({ ...before, hangerEvidence: Object.freeze({ ...before.hangerEvidence, layout: CII_HANGER_LAYOUTS.INPUTXML_CURRENT }) });
  const plan = boundForDelete(before, [nodes[1]]); assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: bad, transferPlan: plan }), /PARTIAL_BLOCKED|CANONICAL_LAYOUT/);
}
// F24 HANGER CREATE request remains blocked.
{
  const { target: before } = syntheticTarget(3); const create = Object.freeze({ operationId: 'CREATE-H', family: 'HANGER', property: 'Hanger presence', action: 'CREATE', status: 'PREVIEW_READY', before: false, proposed: true });
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: arbitraryBoundPlan(before, [create]) }), /PARTIAL_BLOCKED/);
}
// F25 HANGER value-edit request remains outside this authority.
{
  const { target: before } = syntheticTarget(3); const edit = Object.freeze({ operationId: 'EDIT-H', family: 'HANGER', property: 'Hanger load', action: 'COPY', status: 'PREVIEW_READY' });
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: arbitraryBoundPlan(before, [edit]) }), /PARTIAL_BLOCKED/);
}
// F26 physical partial write without qualified PR1025 record binding.
{
  const { target: before, nodes } = syntheticTarget(3, 'INTERLEAVED', { rawOverrides: { IHGRCN: { 1: '             ' } } }); const plan = boundForDelete(before, [nodes[1]]);
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: plan }), /PARTIAL_BLOCKED|RECORD_BINDING/);
}
// F27 countAfter == 0 must stay on delete-all path.
{
  const { target: before, nodes } = syntheticTarget(3); const deleteAll = boundForDelete(before, nodes);
  assert.throws(() => applyCiiWriter2HangerPartialDelete({ targetDocument: before, transferPlan: deleteAll }), /PARTIAL_SCOPE_REQUIRED|COUNT_SCOPE_REQUIRED/);
  const oldWriter = applyCiiWriter2HangerDeleteAll({ targetDocument: before, transferPlan: deleteAll }); assert.equal(oldWriter.hangerCountAfter, 0);
}
// F28 composite/product readiness must remain blocked for partial HANGER.
{
  const c = runCase(3, [2]); const readiness = ciiWriter2CompositeReadiness(c.transferPlan, c.before, null);
  assert.equal(readiness.ready, false); assert(readiness.blockers.includes('WRITER_2_HANGER_DELETE_ALL_SCOPE_REQUIRED'));
  assert.throws(() => applyCiiWriter2HangerDeleteAll({ targetDocument: c.before, transferPlan: c.transferPlan }), /DELETE_ALL_SCOPE_REQUIRED/);
}
// F29/F30 are explicit critical boundary assertions in addition to the matrix.
{
  const c7 = runCase(7, [2]); assert.equal(c7.writer.packedRowsBefore, 2); assert.equal(c7.writer.packedRowsAfter, 1);
  const c13 = runCase(13, [1]); assert.equal(c13.writer.packedRowsBefore, 3); assert.equal(c13.writer.packedRowsAfter, 2);
}

console.log('Writer2 partial H>1 HANGER physical compaction, independent postimage validation, boundary matrix and F01-F30 falsifiers authored.');
