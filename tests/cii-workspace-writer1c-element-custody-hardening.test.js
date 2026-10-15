import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';
import { buildWriter1CNodeNamePlan, CII_WRITER_1C_NODENAME_POLICY } from '../tabs/cii-workspace/cii-workspace-writer1c-nodename.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
function numericRow(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index], ' ')).join(''); }
function elementBlock(from, to, nodeNamePointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 1000, 273]);
  rows[13] = numericRow([0, 0, 0, 0, 0, nodeNamePointer]);
  return rows;
}
function nameRow(fromName, toName) { return `  ${String(fromName).padEnd(26)}${String(toName).padEnd(25)}`; }
function rawFile(elementRows, nameRows) {
  return ['#$ ELEMENTS', ...elementRows, '#$ NODENAME', ...nameRows, '#$ CONTROL', numericRow([1, 0, 0, nameRows.length, 0, 0])].join('\r\n');
}
function evidence(raw, parsed) {
  const physicalFile = createCiiPhysicalFile(new TextEncoder().encode(raw));
  return extractCiiNodeNameEvidence(physicalFile.text, parsed, { physicalFile });
}
function operation(nodeId, before = 'OLD', proposed = 'NEW') {
  return Object.freeze({
    operationId: 'HARDEN-1', family: 'NODE_NAME', property: 'Node name / to-name', action: 'COPY', status: 'PREVIEW_READY',
    scopeDecision: 'APPLY', policyAuthority: CII_WRITER_1C_NODENAME_POLICY, before, proposed,
    targetEvidence: Object.freeze({ identity: String(nodeId) }), matchAuthority: Object.freeze({ status: 'REVIEWED' }),
  });
}
function transferPlan(op) {
  return Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([op]),
    transferScope: Object.freeze({ status: 'BOUND' }),
  });
}

// Canonical parser index + physical block index + endpoints remains qualified.
const canonicalRaw = rawFile(elementBlock(100, 200, 1), [nameRow('FROM', 'OLD')]);
const canonicalParsed = Object.freeze({ nodes: { 100: {}, 200: {} }, elements: [Object.freeze({ index: 0, from: 100, to: 200 })] });
const canonical = evidence(canonicalRaw, canonicalParsed);
assert.equal(canonical.physicalCustody.status, 'QUALIFIED');
assert.equal(canonical.physicalCustody.byElementIndex[0].bindingAuthority, 'EXACT_PARSED_INDEX_AND_ENDPOINTS');
assert.equal(buildWriter1CNodeNamePlan({ transferPlan: transferPlan(operation(200)), targetDocument: {
  writer1CByteEligible: true, nodeNameEvidence: canonical,
} }).ready, true);

// A unique FROM/TO fallback may preserve read-only semantic evidence, but it is never Writer-1C custody.
const displacedParsed = Object.freeze({ nodes: { 100: {}, 200: {} }, elements: [Object.freeze({ index: 7, from: 100, to: 200 })] });
const displaced = evidence(canonicalRaw, displacedParsed);
assert.equal(displaced.names['200'], 'OLD');
assert.equal(displaced.physicalCustody.byElementIndex[0].bindingAuthority, 'ENDPOINT_FALLBACK_READ_ONLY');
assert.equal(displaced.physicalCustody.status, 'BLOCKED');
assert(displaced.physicalCustody.blockers.some((item) => item.startsWith('NODENAME_ELEMENT_PHYSICAL_BINDING_EXACT_REQUIRED')));
const displacedPlan = buildWriter1CNodeNamePlan({
  transferPlan: transferPlan(operation(200)), targetDocument: { writer1CByteEligible: true, nodeNameEvidence: displaced },
});
assert.equal(displacedPlan.ready, false);
assert(displacedPlan.blockers.some((item) => item.startsWith('NODENAME_ELEMENT_PHYSICAL_BINDING_EXACT_REQUIRED')));

// Parallel/duplicate FROM->TO physical elements must never be resolved by first-match ordering.
const duplicateRaw = rawFile([
  ...elementBlock(100, 200, 1),
  ...elementBlock(100, 200, 2),
], [nameRow('FROM-1', 'OLD-1'), nameRow('FROM-2', 'OLD-2')]);
const duplicateParsed = Object.freeze({
  nodes: { 100: {}, 200: {} },
  elements: [Object.freeze({ index: 7, from: 100, to: 200 }), Object.freeze({ index: 8, from: 100, to: 200 })],
});
const duplicate = evidence(duplicateRaw, duplicateParsed);
assert.equal(duplicate.physicalCustody.status, 'BLOCKED');
assert(duplicate.conflicts.some((item) => item.code === 'NODENAME_ELEMENT_BLOCK_AMBIGUOUS'));
assert(duplicate.physicalCustody.blockers.includes('NODENAME_CUSTODY_CONFLICT:NODENAME_ELEMENT_BLOCK_AMBIGUOUS'));
assert.equal(Object.keys(duplicate.physicalCustody.bySpan).length, 0, 'ambiguous endpoint fallback must create no writable physical spans');

// Non-canonical ELEMENT cardinality is read-only/blocked regardless of endpoint appearance.
const shortRaw = rawFile(elementBlock(100, 200, 1).slice(0, 14), [nameRow('FROM', 'OLD')]);
const short = evidence(shortRaw, canonicalParsed);
assert.equal(short.physicalCustody.status, 'BLOCKED');
assert(short.physicalCustody.blockers.includes('NODENAME_ELEMENT_BLOCK_ROW_COUNT_NOT_MULTIPLE_OF_15'));
assert(short.physicalCustody.blockers.includes('NODENAME_ELEMENT_BLOCK_COUNT_MISMATCH'));

console.log('Writer 1C exact ELEMENT/NODENAME physical custody hardening checks passed.');
