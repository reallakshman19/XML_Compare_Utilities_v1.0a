import assert from 'node:assert/strict';
import { validateCiiWriterCompositeRoundTrip } from '../tabs/cii-workspace/cii-workspace-writer-composite-validation.js';

function document(byteString) {
  return Object.freeze({
    writer1CByteEligible: true,
    physicalFile: Object.freeze({
      originalByteString: byteString, byteLength: byteString.length,
      lines: Object.freeze([Object.freeze({ text: byteString, byteStart: 0 })]),
      lineEndings: Object.freeze({ sequence: Object.freeze(['']) }),
    }),
  });
}
const beforeString = 'ABCDEFGHIJKLM---NOPQRSTUVWXYZ';
const afterString = '1234567890123---NOPQRSTUVWXYZ';
const bytes = new Uint8Array([...afterString].map((char) => char.charCodeAt(0)));
const componentMutation = Object.freeze({
  absoluteByteStart: 0, absoluteByteEnd: 13, beforeField: 'ABCDEFGHIJKLM', afterField: '1234567890123', operationIds: Object.freeze(['W1C']),
});
const reportedMutation = Object.freeze({
  spanKey: '0:13', absoluteByteStart: 0, absoluteByteEnd: 13,
  beforeField: 'ABCDEFGHIJKLM', afterField: '1234567890123', sourceWriters: Object.freeze(['WRITER_1C']),
});
const writerResult = Object.freeze({
  bytes, mutations: Object.freeze([reportedMutation]),
  components: Object.freeze({
    lower: null,
    writer1C: Object.freeze({ transferPlan: Object.freeze({ operations: Object.freeze([]) }), result: Object.freeze({ mutations: Object.freeze([componentMutation]) }) }),
  }),
});
const validations = Object.freeze({ writer1C: Object.freeze({ status: 'PASS' }) });
const validation = validateCiiWriterCompositeRoundTrip(document(beforeString), document(afterString), writerResult, validations);
assert.equal(validation.status, 'PASS');
assert.equal(validation.authorizedSpanCount, 1);

// Correct authorized postimage plus one unrelated byte remains a hard failure.
const tampered = `${afterString.slice(0, 16)}X${afterString.slice(17)}`;
const tamperedBytes = new Uint8Array([...tampered].map((char) => char.charCodeAt(0)));
assert.throws(() => validateCiiWriterCompositeRoundTrip(document(beforeString), document(tampered), { ...writerResult, bytes: tamperedBytes }, validations), /COMPOSITE_UNAUTHORIZED_BYTE_CHANGE/);

// Component authority exists, but the composite writer omits that span from its own ledger: NOT PASS.
assert.throws(() => validateCiiWriterCompositeRoundTrip(document(beforeString), document(afterString), {
  ...writerResult, mutations: Object.freeze([]),
}, validations), /COMPOSITE_WRITER_REPORTED_UNION_MISMATCH/);

// Writer1C component evidence cannot be accepted without the independent Writer1C validation result.
assert.throws(() => validateCiiWriterCompositeRoundTrip(document(beforeString), document(afterString), writerResult, {}), /WRITER_1C_COMPONENT_VALIDATION_REQUIRED/);

// Lower-family authority is reconstructed independently from operation policy and physical line/column custody.
const lowerMutation = Object.freeze({
  lineNumber: 1, startColumn: 1, endColumn: 13, beforeField: 'ABCDEFGHIJKLM', afterField: '1234567890123', operationId: 'W1A',
});
const lowerResult = Object.freeze({
  bytes,
  mutations: Object.freeze([Object.freeze({ ...reportedMutation, sourceWriters: Object.freeze(['WRITER_1A']) })]),
  components: Object.freeze({
    lower: Object.freeze({
      transferPlan: Object.freeze({ operations: Object.freeze([Object.freeze({ operationId: 'W1A', policyAuthority: 'CII_WRITER_1A_CARDINALITY_PRESERVING_ELEMENT_FIELD' })]) }),
      result: Object.freeze({ mutations: Object.freeze([lowerMutation]) }),
    }),
    writer1C: null,
  }),
});
const lowerValidation = validateCiiWriterCompositeRoundTrip(document(beforeString), document(afterString), lowerResult, { lower: { status: 'PASS' } });
assert.equal(lowerValidation.status, 'PASS');
assert.throws(() => validateCiiWriterCompositeRoundTrip(document(beforeString), document(afterString), {
  ...lowerResult,
  components: Object.freeze({ lower: Object.freeze({
    transferPlan: Object.freeze({ operations: Object.freeze([Object.freeze({ operationId: 'W1A', policyAuthority: 'UNQUALIFIED' })]) }),
    result: Object.freeze({ mutations: Object.freeze([lowerMutation]) }),
  }), writer1C: null }),
}, { lower: { status: 'PASS' } }), /COMPOSITE_LOWER_POLICY_AUTHORITY_REQUIRED/);

console.log('Composite validator independently reconstructs component authority and rejects writer-ledger drift.');
