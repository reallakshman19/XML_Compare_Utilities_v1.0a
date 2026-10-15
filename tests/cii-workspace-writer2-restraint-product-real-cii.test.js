import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { decodeCiiNumericRow } from '../parser/fixed-field.js';
import {
  applyCiiWorkspaceTargetWriter2,
  createCiiWorkspacePreview,
} from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { applyCiiWriter2CompositeWithRestraintDelete } from '../tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js';
import { validateCiiWriter2ProductRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer2-product-validation.js';
import {
  bindCiiTransferScopeToPreview,
  ciiTransferScopeCandidateOperations,
  createCiiTransferScopeSelection,
} from '../tabs/cii-workspace/cii-workspace-transfer-scope.js';

const SOURCE_SHA = '3'.repeat(64);
const BLOCK_ROWS = 24;
const SLOT_ROWS = 4;
const SLOTS = 6;

function prefixedText(row) {
  const match = String(row ?? '').match(/^\s*(\d+)\s?(.*)$/);
  if (!match) return null;
  return String(match[2] || '').slice(0, Number(match[1]));
}
function slotState(rows, pointer, slot) {
  const base = (pointer - 1) * BLOCK_ROWS + (slot - 1) * SLOT_ROWS;
  if (base < 0 || base + 3 >= rows.length) return null;
  const first = decodeCiiNumericRow(rows[base].text);
  const second = decodeCiiNumericRow(rows[base + 1].text);
  if (!Array.isArray(first) || first.length < 6 || !Array.isArray(second) || second.length < 3) return null;
  const line1 = first.slice(0, 6).map(Number);
  const line2 = second.slice(0, 3).map(Number);
  if (![...line1, ...line2].every(Number.isFinite)) return null;
  const tag = prefixedText(rows[base + 2].text);
  const guid = prefixedText(rows[base + 3].text);
  if (tag == null || guid == null) return null;
  return Object.freeze({
    pointer, slot, line1: Object.freeze(line1), line2: Object.freeze(line2), tag, guid,
    occupied: !(Math.abs(line1[0]) <= 1e-12 && Math.abs(line1[1]) <= 1e-12),
  });
}
function ownersForPointer(document, pointer) {
  return Object.values(document?.auxiliaryEvidence?.elements || {})
    .filter((item) => Number(item?.pointers?.restraint || 0) === pointer)
    .sort((a, b) => Number(a.parsedElementIndex) - Number(b.parsedElementIndex));
}
function chooseRealDeleteCandidate(document) {
  const rows = ciiPhysicalSectionRows(document.physicalFile, 'RESTRANT');
  assert.equal(rows.length % BLOCK_ROWS, 0, 'real V11 RESTRANT section must retain 24-row block shape');
  for (let pointer = 1; pointer <= rows.length / BLOCK_ROWS; pointer += 1) {
    const states = Array.from({ length: SLOTS }, (_, index) => slotState(rows, pointer, index + 1));
    if (states.some((item) => !item || item.tag || item.guid)) continue;
    const occupied = states.filter((item) => item.occupied);
    if (occupied.length !== 1) continue;
    const owners = ownersForPointer(document, pointer);
    if (owners.length !== 1) continue;
    const state = occupied[0];
    const node = String(Math.round(state.line1[0]));
    if (node !== String(owners[0].from) && node !== String(owners[0].to)) continue;
    const nodeRecords = document?.auxiliaryEvidence?.restraints?.byNode?.[node] || [];
    if (nodeRecords.length !== 1) continue;
    return Object.freeze({ pointer, slot: state.slot, targetNode: node, beforeSlot: state, owner: owners[0] });
  }
  throw new Error('W213_REAL_CII_SINGLE_RECORD_DELETE_CANDIDATE_REQUIRED');
}
function deleteOperation(candidate) {
  const mutation = Object.freeze({
    schema: 'CIIWorkspaceRestraintSlotMutation.v1',
    status: 'QUALIFIED',
    mode: 'CLEAR',
    authority: 'PROTECTED_WRITER_EXISTING_24_ROW_BLOCK_EMPTY_SLOT_TEMPLATE',
    pointer: candidate.pointer,
    slot: candidate.slot,
    targetNode: candidate.targetNode,
    beforeSlot: candidate.beforeSlot,
  });
  return Object.freeze({
    operationId: `W213-REAL-RESTRAINT-DELETE-P${candidate.pointer}-S${candidate.slot}`,
    family: 'RESTRAINT',
    property: 'Qualified restraint slot mutation',
    action: 'DELETE',
    status: 'PREVIEW_READY',
    scopeDecision: 'APPLY',
    policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT',
    matchAuthority: Object.freeze({ status: 'REVIEWED' }),
    sourceEvidence: Object.freeze({ value: mutation }),
    proposed: mutation,
  });
}
function boundPlan(targetDocument, operation) {
  const id = operation.operationId;
  return Object.freeze({
    status: 'PREVIEW_READY',
    blockers: Object.freeze([]),
    sourceDocument: Object.freeze({ fileName: 'CONTROLLED_W213_SOURCE', contentSha256: SOURCE_SHA }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze([operation]),
    excludedOperations: Object.freeze([]),
    transferScope: Object.freeze({
      schema: 'CIIWorkspaceTransferScope.v1',
      mode: 'EXPLICIT_APPLY_EXCLUDE',
      status: 'BOUND',
      authority: 'USER_EXPLICIT_OPERATION_SCOPE',
      scopeId: `W213-REAL-SEED:${id}`,
      sourceSha256: SOURCE_SHA,
      targetSha256: targetDocument.contentSha256,
      candidateOperationIds: Object.freeze([id]),
      appliedOperationIds: Object.freeze([id]),
      excludedOperationIds: Object.freeze([]),
      appliedOperationCount: 1,
      excludedOperationCount: 0,
    }),
  });
}
function connectivity(document) {
  return document.parsed.elements.map((element) => [Number(element.index), String(element.from), String(element.to)]);
}
function textRows(physicalFile, name) {
  return ciiPhysicalSectionRows(physicalFile, name).map((row) => row.text);
}

const fixture = new Uint8Array(await readFile(new URL('../Benchmark/CIICompare/BM_CII_SOURCE.CII', import.meta.url)));
const before = await intakeCiiWorkspaceDocument(fixture, 'BM_CII_SOURCE.CII', { side: 'TARGET', cryptoRef: webcrypto });
const graph = adaptCiiDocumentToTopologyGraph(before);
const candidate = chooseRealDeleteCandidate(before);
const seedPlan = boundPlan(before, deleteOperation(candidate));

const seedResult = applyCiiWriter2CompositeWithRestraintDelete({
  targetDocument: before, targetGraph: graph, transferPlan: seedPlan,
});
assert.equal(seedResult.status, 'APPLIED');
assert.equal(seedResult.familyMutationCounts.restraintDeleteOperations, 1);
assert.deepEqual(seedResult.components.restraintDelete.relocationPlan.deletedPointers, [candidate.pointer]);

const policy = Object.freeze({
  writerVersion: '2',
  cryptoRef: webcrypto,
  spatialToleranceMm: 1,
  diameterToleranceRatio: 0.01,
  wallToleranceRatio: 0.01,
  identityWeight: 50,
  diameterWeight: 30,
  wallWeight: 30,
  winnerGap: 8,
});
const initialPreview = await createCiiWorkspacePreview({
  sourceBytes: seedResult.bytes,
  sourceFileName: 'W213_SOURCE_WITH_ONE_RESTRAINT_BLOCK_REMOVED.CII',
  targetBytes: fixture,
  targetFileName: 'BM_CII_SOURCE.CII',
  anchorPairs: [{ sourceNodeId: candidate.targetNode, targetNodeId: candidate.targetNode }],
}, policy);

const productOperation = (initialPreview.transferPlan.operations || []).find((operation) =>
  operation.family === 'RESTRAINT'
  && operation.property === 'Qualified restraint slot mutation'
  && operation.action === 'DELETE');
assert(productOperation, `real Writer2 preview must expose RESTRAINT DELETE: ${initialPreview.transferPlan.blockers?.join('|')}`);
assert.equal(productOperation.status, 'PREVIEW_READY', productOperation.blockers?.join('|'));
const decisions = Object.fromEntries(
  ciiTransferScopeCandidateOperations(initialPreview.transferPlan)
    .filter((operation) => operation.action !== 'KEEP')
    .map((operation) => [operation.operationId, operation.operationId === productOperation.operationId ? 'APPLY' : 'EXCLUDE']),
);
const selection = createCiiTransferScopeSelection(initialPreview.transferPlan, decisions);
const preview = bindCiiTransferScopeToPreview(initialPreview, selection);
assert.equal(preview.transferScope.status, 'BOUND');
assert.deepEqual(preview.transferScope.appliedOperationIds, [productOperation.operationId]);
assert.equal(preview.writerReadiness.ready, true, preview.writerReadiness.blockers?.join('|'));
assert.equal(preview.writerReadiness.familyMutationCounts.restraintDelete, 1);
assert.equal(preview.writerReadiness.restraintTransactionClass, 'BLOCK_DELETE_COMPACTION');

const directProduct = applyCiiWriter2CompositeWithRestraintDelete({
  targetDocument: before, targetGraph: graph, transferPlan: preview.transferPlan,
});
assert.equal(directProduct.byteString, seedResult.byteString, 'product plan must reproduce the controlled real-CII deletion');

const applied = await applyCiiWorkspaceTargetWriter2(preview, fixture, { cryptoRef: webcrypto });
assert.equal(applied.status, 'PASS');
assert.equal(applied.writer, 'WRITER_2');
assert.equal(applied.byteString, directProduct.byteString);
assert.equal(applied.validation.status, 'PASS');
assert.equal(applied.validation.productValidatorClass, 'RESTRAINT_DELETE_COMPOSITE');

const after = await intakeCiiWorkspaceDocument(directProduct.bytes, 'Modified_BM_CII_SOURCE.CII', {
  side: 'TARGET', cryptoRef: webcrypto,
});
const beforeControl = textRows(before.physicalFile, 'CONTROL');
const afterControl = textRows(after.physicalFile, 'CONTROL');
assert.equal(afterControl[0], beforeControl[0], 'CONTROL row1 including NONAM must remain byte-identical');
assert.notEqual(afterControl[1], beforeControl[1], 'CONTROL row2 RESTRAINT count must change');
for (let index = 2; index < beforeControl.length; index += 1) {
  assert.equal(afterControl[index], beforeControl[index], `unrelated CONTROL row ${index + 1} must remain unchanged`);
}
assert.equal(
  ciiPhysicalSectionRows(after.physicalFile, 'RESTRANT').length,
  ciiPhysicalSectionRows(before.physicalFile, 'RESTRANT').length - BLOCK_ROWS,
);
assert.deepEqual(connectivity(after), connectivity(before), 'RESTRAINT product route must not alter topology');

for (const change of preview.writerReadiness.components.restraintDelete.pointerChanges) {
  const post = after.auxiliaryEvidence.elements?.[String(change.parsedElementIndex)];
  assert.equal(Number(post?.pointers?.restraint), Number(change.newPointer));
}

const header = 'Data generated by CAESAR II/CADWorx/PIPE interface';
const tamperIndex = directProduct.byteString.indexOf(header);
assert(tamperIndex >= 0, 'real benchmark header token required');
const tamperedString = `${directProduct.byteString.slice(0, tamperIndex)}X${directProduct.byteString.slice(tamperIndex + 1)}`;
const tampered = await intakeCiiWorkspaceDocument(
  new Uint8Array([...tamperedString].map((char) => char.charCodeAt(0) & 0xff)),
  'Tampered_W213.CII', { side: 'TARGET', cryptoRef: webcrypto },
);
assert.throws(
  () => validateCiiWriter2ProductRoundTrip(before, tampered, graph, preview.transferPlan, directProduct),
  /EXACT_COMPLETE_POSTIMAGE_MISMATCH/,
);

await assert.rejects(
  () => applyCiiWorkspaceTargetWriter2(preview, directProduct.bytes, { cryptoRef: webcrypto }),
  /CII_WRITER_2_STALE_TARGET_HASH/,
);

console.log(`Writer2 W2.13 real-CII RESTRAINT product qualification passed at pointer ${candidate.pointer}.`);
