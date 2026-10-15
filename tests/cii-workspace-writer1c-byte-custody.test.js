import assert from 'node:assert/strict';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiNodeNameEvidence } from '../tabs/cii-workspace/cii-workspace-nodename.js';

const widths = [15, 13, 13, 13, 13, 13];

function numericRow(values) {
  return values.map((value, index) => String(value ?? '').padStart(widths[index], ' ')).join('');
}

function elementBlock(from, to, pointer) {
  const rows = Array.from({ length: 15 }, () => numericRow([0, 0, 0, 0, 0, 0]));
  rows[0] = numericRow([from, to, 0, 0, 1000, 273]);
  rows[13] = numericRow([0, 0, 0, 0, 0, pointer]);
  return rows;
}

function nameRow(fromName, toName) {
  return `  ${String(fromName).padEnd(26)}${String(toName).padEnd(25)}`;
}

function fixture(lineEnding = '\r\n', finalNewline = false) {
  const lines = [
    '#$ ELEMENTS', ...elementBlock(100, 200, 1), ...elementBlock(300, 400, 1),
    '#$ NODENAME', nameRow('FROM-SHARED', 'TO-SHARED'), '#$ CONTROL', 'x',
  ];
  return lines.join(lineEnding) + (finalNewline ? lineEnding : '');
}

const raw = fixture('\r\n', false);
const encoded = new TextEncoder().encode(raw);
const physical = createCiiPhysicalFile(encoded);
assert.equal(physical.byteAuthority, 'ORIGINAL_BYTES');
assert.equal(physical.writer1CByteEligible, true);
assert.equal(physical.textEncodingAuthority, 'UTF8_STRICT');
assert.equal(physical.lineEndings.style, 'CRLF');
assert.equal(physical.lineEndings.finalLineTerminated, false);
assert.equal(physical.byteLength, encoded.length);
assert.equal(ciiPhysicalSectionRows(physical, 'NODENAME').length, 1);

const parsed = {
  nodes: { 100: {}, 200: {}, 300: {}, 400: {} },
  elements: [{ index: 0, from: 100, to: 200 }, { index: 1, from: 300, to: 400 }],
};
const evidence = extractCiiNodeNameEvidence(raw, parsed, { physicalFile: physical });
assert.equal(evidence.physicalCustody.status, 'QUALIFIED');
assert.equal(evidence.physicalCustody.rowCount, 1);
assert.equal(evidence.physicalCustody.byElementIndex[0].pointer, 1);
assert.equal(evidence.physicalCustody.byElementIndex[0].pointerField.width, 13);
assert.equal(evidence.physicalCustody.byElementIndex[0].toField.width, 25);
const toSpan = Object.values(evidence.physicalCustody.bySpan).find((item) => item.fieldIdentity === 'NODENAME_TO');
assert.equal(toSpan.owners.length, 2);
assert.deepEqual(toSpan.owners.map((item) => item.nodeId), ['200', '400']);
assert.equal(toSpan.rawField, 'TO-SHARED'.padEnd(25));

const compatibility = extractCiiNodeNameEvidence(raw, parsed);
assert.equal(compatibility.physicalCustody.status, 'BLOCKED');
assert(compatibility.physicalCustody.blockers.includes('NODENAME_ORIGINAL_BYTE_CUSTODY_REQUIRED'));

const malformedBytes = new Uint8Array(encoded); const elementRows = ciiPhysicalSectionRows(physical, 'ELEMENTS');
malformedBytes[elementRows[13].byteStart + 79] = 'X'.charCodeAt(0);
const malformedPhysical = createCiiPhysicalFile(malformedBytes);
const malformedEvidence = extractCiiNodeNameEvidence(malformedPhysical.text, parsed, { physicalFile: malformedPhysical });
assert(malformedEvidence.conflicts.some((item) => item.code === 'NODENAME_POINTER_UNREADABLE'));
assert.equal(malformedEvidence.physicalCustody.status, 'BLOCKED');
assert(malformedEvidence.physicalCustody.blockers.includes('NODENAME_CUSTODY_CONFLICT:NODENAME_POINTER_UNREADABLE'));

const legacyBytes = new Uint8Array([0x23, 0x24, 0x20, 0x56, 0x45, 0x52, 0x53, 0x49, 0x4f, 0x4e, 0x0d, 0x0a, 0x80]);
const legacyPhysical = createCiiPhysicalFile(legacyBytes);
assert.equal(legacyPhysical.byteAuthority, 'ORIGINAL_BYTES');
assert.equal(legacyPhysical.writer1CByteEligible, true);
assert.equal(legacyPhysical.textEncodingAuthority, 'UTF8_REPLACEMENT_COMPATIBILITY');
assert.equal(legacyPhysical.originalByteString.charCodeAt(legacyPhysical.originalByteString.length - 1), 0x80);

console.log('Writer 1C byte custody and shared NODENAME physical ownership checks passed.');
