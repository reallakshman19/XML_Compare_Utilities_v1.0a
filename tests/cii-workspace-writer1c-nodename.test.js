import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { buildWriter1CNodeNamePlan, CII_WRITER_1C_NODENAME_POLICY } from '../tabs/cii-workspace/cii-workspace-writer1c-nodename.js';
import { applyCiiTargetWriter1C, ciiWriter1CReadiness } from '../tabs/cii-workspace/cii-workspace-target-writer-1c.js';
import { validateCiiWriter1CRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer1c-validation.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index], ' ')).join(''); }
function elementBlock(from, to, nodeNamePointer, sifPointer = 0) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 1000, 273]);
  rows[13] = numericRow([0, 0, 0, 0, sifPointer, nodeNamePointer]);
  return rows;
}
function nameRow(fromName, toName) { return `  ${String(fromName).padEnd(26)}${String(toName).padEnd(25)}`; }
function fixture({ pointer = 1, shared = true, name = 'OLD' } = {}) {
  const elements = shared ? [[100, 200], [300, 400]] : [[100, 200]];
  return ['#$ ELEMENTS', ...elements.flatMap(([from, to]) => elementBlock(from, to, pointer)), '#$ NODENAME',
    ...(pointer ? [nameRow('FROM', name)] : []), '#$ CONTROL', numericRow([elements.length, 0, 0, pointer ? 1 : 0, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ SIF&TEES', '#$ RESTRANT', '#$ RIGID', '#$ MISCEL_1'].join('\r\n');
}
function redundantNodeFixture(name = 'PS-NEW1') {
  return ['#$ ELEMENTS', ...elementBlock(100, 200, 1), ...elementBlock(200, 300, 2), '#$ NODENAME',
    nameRow('', name), nameRow(name, ''), '#$ CONTROL', numericRow([2, 0, 0, 2, 0, 0]),
    numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]), numericRow([0, 0, 0, 0, 0, 0]),
    '#$ SIF&TEES', '#$ RESTRANT', '#$ RIGID', '#$ MISCEL_1'].join('\r\n');
}
function parsed(shared = true) {
  return { nodes: shared ? { 100: {}, 200: {}, 300: {}, 400: {} } : { 100: {}, 200: {} },
    elements: shared ? [{ index: 0, from: 100, to: 200 }, { index: 1, from: 300, to: 400 }] : [{ index: 0, from: 100, to: 200 }] };
}
const redundantParsed = { nodes: { 100: {}, 200: {}, 300: {} },
  elements: [{ index: 0, from: 100, to: 200 }, { index: 1, from: 200, to: 300 }] };
function documentFrom(raw, parsedModel = parsed(true), auxiliaryEvidence = {}) {
  const physicalFile = createCiiPhysicalFile(raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw));
  const nodeNameEvidence = extractCiiNodeNameEvidence(physicalFile.text, parsedModel, { physicalFile });
  return { writer1CByteEligible: true, physicalFile, nodeNameEvidence, nodeNames: nodeNameEvidence.names,
    parsed: parsedModel, auxiliaryEvidence, hangerEvidence: {} };
}
function operation(id, nodeId, before, proposed) {
  return { operationId: id, family: 'NODE_NAME', property: 'Node name / to-name', action: 'COPY', status: 'PREVIEW_READY',
    scopeDecision: 'APPLY', policyAuthority: CII_WRITER_1C_NODENAME_POLICY, before, proposed,
    targetEvidence: { identity: String(nodeId) }, matchAuthority: { status: 'REVIEWED' } };
}
function plan(operations) { return { status: 'PREVIEW_READY', blockers: [], operations, transferScope: { status: 'BOUND' } }; }
function sharedValuePlan(beforeValue, proposed) {
  return plan([operation('A', 200, beforeValue, proposed), operation('B', 400, beforeValue, proposed)]);
}

const before = documentFrom(fixture());
const sharedPlan = sharedValuePlan('OLD', 'NEW');
assert.equal(ciiWriter1CReadiness(sharedPlan, before).ready, true);
assert.equal(buildWriter1CNodeNamePlan({ transferPlan: sharedPlan, targetDocument: before }).mutationCount, 1);
const result = applyCiiTargetWriter1C({ targetDocument: before, transferPlan: sharedPlan });
assert.equal(result.mutationCount, 1);
const after = documentFrom(result.bytes);
const validation = validateCiiWriter1CRoundTrip(before, after, sharedPlan, result);
assert.equal(validation.status, 'PASS');
assert.equal(validation.unexpectedSemanticDeltaCount, 0);
assert.equal(after.nodeNames['200'], 'NEW'); assert.equal(after.nodeNames['400'], 'NEW');

// Real TARGET1 custody pattern: one semantic node label can be represented in two
// physical records, as incoming TO and outgoing FROM. Writer 1C must mutate both
// spans atomically so the reparsed semantic name remains conflict-free.
const redundantBefore = documentFrom(redundantNodeFixture(), redundantParsed);
assert.equal(redundantBefore.nodeNameEvidence.conflicts.length, 0);
assert.equal(redundantBefore.nodeNames['200'], 'PS-NEW1');
const redundantPlan = plan([operation('R', 200, 'PS-NEW1', 'PS-NEW2')]);
const redundantMutationPlan = buildWriter1CNodeNamePlan({ transferPlan: redundantPlan, targetDocument: redundantBefore });
assert.equal(redundantMutationPlan.ready, true);
assert.equal(redundantMutationPlan.mutationCount, 2);
assert.deepEqual(new Set(redundantMutationPlan.mutations.map((item) => item.fieldIdentity)), new Set(['NODENAME_FROM', 'NODENAME_TO']));
const redundantResult = applyCiiTargetWriter1C({ targetDocument: redundantBefore, transferPlan: redundantPlan });
const redundantAfter = documentFrom(redundantResult.bytes, redundantParsed);
const redundantValidation = validateCiiWriter1CRoundTrip(redundantBefore, redundantAfter, redundantPlan, redundantResult);
assert.equal(redundantAfter.nodeNameEvidence.conflicts.length, 0);
assert.equal(redundantAfter.nodeNames['200'], 'PS-NEW2');
assert.equal(redundantValidation.authorizedSpanCount, 2);
assert.equal(redundantValidation.expectedSemanticDeltaCount, 1);
assert.equal(redundantValidation.actualSemanticDeltaCount, 1);
assert.equal(redundantValidation.unexpectedSemanticDeltaCount, 0);

const blankBefore = documentFrom(fixture({ name: '' }));
assert.equal(buildWriter1CNodeNamePlan({ transferPlan: sharedValuePlan('', 'A'), targetDocument: blankBefore }).ready, true);
assert.equal(buildWriter1CNodeNamePlan({ transferPlan: sharedValuePlan('OLD', 'X'.repeat(25)), targetDocument: before }).ready, true);
assert.equal(buildWriter1CNodeNamePlan({ transferPlan: sharedValuePlan('OLD', 'P-101 A/B.2'), targetDocument: before }).ready, true);

const nonAscii = buildWriter1CNodeNamePlan({ transferPlan: sharedValuePlan('OLD', 'P–101'), targetDocument: before });
assert.equal(nonAscii.ready, false);
assert(nonAscii.blockers.some((item) => item.startsWith('WRITER_1C_NODENAME_NON_ASCII')));

const conflict = buildWriter1CNodeNamePlan({ transferPlan: plan([
  operation('A', 200, 'OLD', 'P-101A'), operation('B', 400, 'OLD', 'P-101B'),
]), targetDocument: before });
assert.equal(conflict.ready, false);
assert(conflict.blockers.some((item) => item.startsWith('WRITER_1C_NODENAME_SHARED_RECORD_CONFLICT')));

const alias = buildWriter1CNodeNamePlan({ transferPlan: plan([operation('A', 200, 'OLD', 'NEW')]), targetDocument: before });
assert.equal(alias.ready, false);
assert(alias.blockers.some((item) => item.startsWith('WRITER_1C_NODENAME_UNAPPROVED_ALIAS_EFFECT')));

const overflow = buildWriter1CNodeNamePlan({ transferPlan: sharedValuePlan('OLD', 'X'.repeat(26)), targetDocument: before });
assert.equal(overflow.ready, false);
assert(overflow.blockers.some((item) => item.startsWith('WRITER_1C_NODENAME_FIELD_OVERFLOW')));

const pointerZero = documentFrom(fixture({ pointer: 0, shared: false }), parsed(false));
const createRequired = buildWriter1CNodeNamePlan({ transferPlan: plan([operation('A', 200, '', 'NEW')]), targetDocument: pointerZero });
assert.equal(createRequired.ready, false);
assert(createRequired.blockers.some((item) => item.startsWith('WRITER_1C_NODENAME_CREATE_REQUIRES_WRITER_2')));

const tampered = new Uint8Array(result.bytes); const elementRows = ciiPhysicalSectionRows(createCiiPhysicalFile(tampered), 'ELEMENTS');
const pointerRow = elementRows[13]; tampered[pointerRow.byteStart + 66] = '1'.charCodeAt(0);
const tamperedAfter = documentFrom(tampered);
assert.throws(() => validateCiiWriter1CRoundTrip(before, tamperedAfter, sharedPlan, result), /UNAUTHORIZED_BYTE_CHANGE/);

console.log('Writer 1C NODENAME planner, redundant FROM/TO custody, fixed-width boundaries, patcher and independent negative-assurance checks passed.');
