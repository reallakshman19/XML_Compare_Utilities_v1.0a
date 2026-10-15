import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { _test as sifDeltaTest } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-deltas.js';
import {
  buildWriter1CSifPlan, CII_WRITER_1C_SIF_IN_PLANE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer1c-sif.js';
import { applyCiiTargetWriter1C, ciiWriter1CReadiness } from '../tabs/cii-workspace/cii-workspace-target-writer-1c.js';
import { validateCiiWriter1CRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer1c-validation.js';
import { classifyCiiTransferDelta, CII_WRITER_1C_SIF_CONTEXT_AUTHORITY } from '../tabs/cii-workspace/cii-workspace-transfer-policy.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const DELTA_AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index], ' ')).join(''); }
function elementBlock(from, to, sifPointer, nodeNamePointer = 0) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 1000, 273]);
  rows[13] = numericRow([0, 0, 0, 0, sifPointer, nodeNamePointer]);
  return rows;
}
function sifBlock(node = 100, type = 5, ii = 1.25, io = 1.5) {
  const rows = Array.from({ length: 10 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([node, type, ii, io, 0, 0]);
  return rows;
}
function rawFile({ version = 11, elements = [elementBlock(10, 20, 1)], sifs = sifBlock() } = {}) {
  return [
    '#$ VERSION', numericRow([5, version, 1256, 0, 0, 0]),
    '#$ CONTROL', numericRow([elements.length, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 1, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elements.flat(), '#$ SIF&TEES', ...sifs,
  ].join('\r\n');
}
function parsed(elements = [{ index: 0, from: 10, to: 20 }]) {
  return Object.freeze({ nodes: { 10: {}, 20: {}, 30: {} }, elements: Object.freeze(elements.map((item) => Object.freeze(item))) });
}
function documentFromBytes(bytes, parsedModel) {
  const physicalFile = createCiiPhysicalFile(bytes);
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsedModel, { physicalFile });
  return Object.freeze({
    writer1CByteEligible: true, physicalFile, sifWriter1CEvidence, parsed: parsedModel,
    nodeNames: Object.freeze({}), auxiliaryEvidence: Object.freeze({}), hangerEvidence: Object.freeze({}),
  });
}
function context(code = 'ASME B31.3-2018') {
  return Object.freeze({ status: 'QUALIFIED', authority: CII_WRITER_1C_SIF_CONTEXT_AUTHORITY, sourceCode: code, targetCode: code });
}
function operation(evidence, overrides = {}) {
  const binding = evidence.byParsedElementIndex[String(overrides.parsedElementIndex ?? 0)]; const block = evidence.byPointer[String(binding.pointer)]; const slot = block.slots[1];
  return Object.freeze({
    operationId: overrides.operationId || `SIF-${overrides.parsedElementIndex ?? 0}`,
    family: 'SIF_TEE', property: 'SIF/Tee slot 1 In-Plane SIF (ii)', action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
    policyAuthority: CII_WRITER_1C_SIF_IN_PLANE_POLICY,
    sourceEvidence: Object.freeze({ identity: 'SOURCE-E', authority: DELTA_AUTHORITY }), targetEvidence: Object.freeze({ identity: 'TARGET-E' }),
    before: overrides.before ?? slot.ii.numericValue, proposed: overrides.proposed ?? 1.75,
    matchAuthority: Object.freeze({ status: 'REVIEWED', correspondenceId: overrides.operationId || 'CORR' }),
    sifContext: overrides.sifContext ?? context(),
    sifField: Object.freeze({
      slot: 1, item: 3, fieldKey: 'ii', sourceParsedElementIndex: overrides.parsedElementIndex ?? 0,
      targetParsedElementIndex: overrides.parsedElementIndex ?? 0,
      sourcePointer: binding.pointer, targetPointer: binding.pointer,
      sourceNode: slot.node, targetNode: slot.node, sourceType: slot.type, targetType: slot.type,
      nodeMappingQualified: true, sourceNeutralVersion: 11, targetNeutralVersion: 11,
      sourceSpan: slot.ii, targetSpan: slot.ii,
      ...(overrides.sifField || {}),
    }),
  });
}
function transferPlan(operations) {
  return Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze(operations),
    transferScope: Object.freeze({ status: 'BOUND' }) });
}

// Exact Version-11 physical custody qualifies item3/item4 and preserves exact 13-byte spans.
const raw = rawFile(); const bytes = new TextEncoder().encode(raw); const parsedOne = parsed(); const before = documentFromBytes(bytes, parsedOne);
assert.equal(before.sifWriter1CEvidence.status, 'QUALIFIED');
assert.equal(before.sifWriter1CEvidence.neutralVersion.major, 11);
assert.equal(before.sifWriter1CEvidence.byPointer['1'].slots[1].ii.width, 13);
assert.equal(before.sifWriter1CEvidence.byPointer['1'].slots[1].ii.item, 3);
assert.equal(before.sifWriter1CEvidence.byPointer['1'].slots[1].io.item, 4);

// Blank is not numeric zero. This prevents blank/default semantics from being silently normalized into an explicit SIF.
assert.equal(sifDeltaTest.sameSifValue(null, 0), false);
assert.equal(sifDeltaTest.sameSifValue(null, null), true);
assert.equal(sifDeltaTest.numericDelta(null, 0), null);

// Version drift fails closed.
const version12 = documentFromBytes(new TextEncoder().encode(rawFile({ version: 12 })), parsedOne);
assert.equal(version12.sifWriter1CEvidence.status, 'BLOCKED');
assert(version12.sifWriter1CEvidence.blockers.some((item) => item.startsWith('WRITER_1C_SIF_NEUTRAL_VERSION_11_REQUIRED')));

// Parsed element index must bind the same physical 15-row block; endpoint-only fallback is not mutation authority.
const displacedIndex = documentFromBytes(bytes, parsed([{ index: 7, from: 10, to: 20 }]));
assert.equal(displacedIndex.sifWriter1CEvidence.status, 'BLOCKED');
assert(displacedIndex.sifWriter1CEvidence.blockers.includes('WRITER_1C_SIF_ELEMENT_PHYSICAL_BINDING_EXACT_REQUIRED:7'));
assert.equal(displacedIndex.sifWriter1CEvidence.byParsedElementIndex['7'], undefined);

// Policy requires Writer1C, exact semantic authority, >=1.0 values, and explicit same-code attestation.
const baseDelta = Object.freeze({
  category: 'SIF_TEE', property: 'SIF/Tee slot 1 In-Plane SIF (ii)', changed: true,
  sourceValue: 1.75, targetValue: 1.25, authority: DELTA_AUTHORITY, evidenceStatus: 'QUALIFIED',
  sifField: Object.freeze({ slot: 1, item: 3, fieldKey: 'ii', sourcePointer: 1, targetPointer: 1, sourceNode: '100', targetNode: '100',
    sourceType: 5, targetType: 5, nodeMappingQualified: true, sourceNeutralVersion: 11, targetNeutralVersion: 11 }),
});
let classified = classifyCiiTransferDelta(baseDelta, { writerVersion: '1C', sifEngineeringContext: {
  authority: CII_WRITER_1C_SIF_CONTEXT_AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.3-2018',
} });
assert.equal(classified.status, 'PREVIEW_READY');
assert.equal(classified.policyAuthority, CII_WRITER_1C_SIF_IN_PLANE_POLICY);
assert.equal(classified.sifContext.status, 'QUALIFIED');
classified = classifyCiiTransferDelta(baseDelta, { writerVersion: '1C' });
assert.equal(classified.status, 'BLOCKED');
assert(classified.blockers.includes('SIF_TEE_PIPING_CODE_CONTEXT_ATTESTATION_REQUIRED'));
classified = classifyCiiTransferDelta(baseDelta, { writerVersion: '1C', sifEngineeringContext: {
  authority: CII_WRITER_1C_SIF_CONTEXT_AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.8-2018',
} });
assert.equal(classified.status, 'BLOCKED');
assert(classified.blockers.some((item) => item.startsWith('SIF_TEE_PIPING_CODE_CONTEXT_MISMATCH')));
classified = classifyCiiTransferDelta({ ...baseDelta, targetValue: 0 }, { writerVersion: '1C', sifEngineeringContext: {
  authority: CII_WRITER_1C_SIF_CONTEXT_AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.3-2018',
} });
assert.equal(classified.status, 'BLOCKED');
assert(classified.blockers.includes('SIF_TEE_EXPLICIT_GE_1_VALUE_REQUIRED'));

// Planner independently rejects missing/non-finite Type context even if a caller bypasses delta classification.
const missingTypePlan = buildWriter1CSifPlan({
  transferPlan: transferPlan([operation(before.sifWriter1CEvidence, { sifField: { sourceType: null, targetType: null } })]), targetDocument: before,
});
assert.equal(missingTypePlan.ready, false);
assert(missingTypePlan.blockers.some((item) => item.startsWith('WRITER_1C_SIF_TYPE_CONTEXT_REQUIRED')));
const mismatchedTypePlan = buildWriter1CSifPlan({
  transferPlan: transferPlan([operation(before.sifWriter1CEvidence, { sifField: { sourceType: 5, targetType: 6 } })]), targetDocument: before,
});
assert.equal(mismatchedTypePlan.ready, false);
assert(mismatchedTypePlan.blockers.some((item) => item.startsWith('WRITER_1C_SIF_TYPE_CONTEXT_MISMATCH')));

// Positive SIF-only one-preimage round trip passes independent negative assurance.
const op = operation(before.sifWriter1CEvidence); const plan = transferPlan([op]);
assert.equal(ciiWriter1CReadiness(plan, before).ready, true);
const writer = applyCiiTargetWriter1C({ targetDocument: before, transferPlan: plan });
assert.equal(writer.mutationCount, 1); assert.equal(writer.familyCounts.sifTee, 1); assert.equal(writer.familyCounts.nodeName, 0);
const after = documentFromBytes(writer.bytes, parsedOne);
const validation = validateCiiWriter1CRoundTrip(before, after, plan, writer);
assert.equal(validation.status, 'PASS'); assert.equal(validation.expectedSifDeltaCount, 1); assert.equal(validation.actualSifDeltaCount, 1);
assert.equal(after.sifWriter1CEvidence.byPointer['1'].slots[1].ii.numericValue, 1.75);

// A correct SIF write plus one unrelated ELEMENT pointer digit is NOT PASS.
const tamperedBytes = new Uint8Array(writer.bytes); const elementRows = ciiPhysicalSectionRows(after.physicalFile, 'ELEMENTS');
const unrelatedPointerByte = elementRows[13].byteStart + 67 + 12; tamperedBytes[unrelatedPointerByte] = tamperedBytes[unrelatedPointerByte] === 0x30 ? 0x31 : 0x30;
const tampered = documentFromBytes(tamperedBytes, parsedOne);
assert.throws(() => validateCiiWriter1CRoundTrip(before, tampered, plan, writer), /UNAUTHORIZED_BYTE_CHANGE/);

// Shared physical SIF pointer: one selected owner blocks alias side effect.
const sharedParsed = parsed([{ index: 0, from: 10, to: 20 }, { index: 1, from: 20, to: 30 }]);
const sharedRaw = rawFile({ elements: [elementBlock(10, 20, 1), elementBlock(20, 30, 1)] });
const shared = documentFromBytes(new TextEncoder().encode(sharedRaw), sharedParsed);
const firstOnly = buildWriter1CSifPlan({ transferPlan: transferPlan([operation(shared.sifWriter1CEvidence, { parsedElementIndex: 0, operationId: 'SIF-A' })]), targetDocument: shared });
assert.equal(firstOnly.ready, false);
assert(firstOnly.blockers.some((item) => item.startsWith('WRITER_1C_SIF_UNAPPROVED_ALIAS_EFFECT')));

// Identical requests from all shared owners canonicalize to one physical mutation.
const opA = operation(shared.sifWriter1CEvidence, { parsedElementIndex: 0, operationId: 'SIF-A', proposed: 1.75 });
const opB = operation(shared.sifWriter1CEvidence, { parsedElementIndex: 1, operationId: 'SIF-B', proposed: 1.75 });
const sharedSame = buildWriter1CSifPlan({ transferPlan: transferPlan([opA, opB]), targetDocument: shared });
assert.equal(sharedSame.ready, true); assert.equal(sharedSame.mutationCount, 1); assert.deepEqual(sharedSame.mutations[0].operationIds, ['SIF-A', 'SIF-B']);

// Divergent requests for the same physical span fail closed.
const opBConflict = operation(shared.sifWriter1CEvidence, { parsedElementIndex: 1, operationId: 'SIF-B', proposed: 2.25 });
const sharedConflict = buildWriter1CSifPlan({ transferPlan: transferPlan([opA, opBConflict]), targetDocument: shared });
assert.equal(sharedConflict.ready, false);
assert(sharedConflict.blockers.some((item) => item.startsWith('WRITER_1C_SIF_SHARED_RECORD_CONFLICT')));

console.log('Writer 1C SIF Phase-2B custody, policy, alias and negative-assurance checks passed.');
