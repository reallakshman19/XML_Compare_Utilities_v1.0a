import assert from 'node:assert/strict';
import { createCiiPhysicalFile } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { isCiiSha256Hex, sha256CiiByteString } from '../tabs/cii-workspace/cii-workspace-byte-sha256.js';
import { _test as writerTest } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-write.js';
import { _test as validatorTest } from '../tabs/cii-workspace/cii-workspace-writer2-hanger-partial-validation.js';

const vectors = Object.freeze([
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['The quick brown fox jumps over the lazy dog', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
]);

for (const [input, expected] of vectors) {
  assert.equal(sha256CiiByteString(input), expected);
  assert.equal(isCiiSha256Hex(expected), true);
}

assert.equal(isCiiSha256Hex('ABC'), false);
assert.equal(isCiiSha256Hex('0'.repeat(63)), false);
assert.throws(() => sha256CiiByteString('\u20ac'), /CII_WORKSPACE_SHA256_NON_BYTE_CODE_UNIT/);

const canonicalBytes = 'abc';
const canonicalSha = sha256CiiByteString(canonicalBytes);
function target0(bytes = canonicalBytes, declaredSha = canonicalSha, physicalByteLength = bytes.length, documentByteLength = null) {
  const document = {
    contentSha256: declaredSha,
    physicalFile: Object.freeze({ originalByteString: bytes, byteLength: physicalByteLength }),
  };
  if (documentByteLength != null) document.byteLength = documentByteLength;
  return Object.freeze(document);
}
function postimage(bytes = canonicalBytes, declaredSha = canonicalSha, physicalByteLength = bytes.length, documentByteLength = null) {
  const document = {
    contentSha256: declaredSha,
    physicalFile: Object.freeze({ originalByteString: bytes, byteLength: physicalByteLength }),
  };
  if (documentByteLength != null) document.byteLength = documentByteLength;
  return Object.freeze(document);
}
function transferPlan(targetSha) {
  return Object.freeze({
    targetDocument: Object.freeze({ contentSha256: targetSha }),
    transferScope: Object.freeze({ targetSha256: targetSha }),
  });
}
function byteArray(value) {
  const text = String(value ?? ''); const out = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index) & 0xff;
  return out;
}
const representationByteString = 'alpha\r\nbeta\r\n';
const representationPhysical = createCiiPhysicalFile(byteArray(representationByteString));
const representationSha = sha256CiiByteString(representationByteString);
const expectedRepresentationCustody = Object.freeze({
  authority: 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE',
  byteLength: representationPhysical.byteLength,
  textLength: representationPhysical.text.length,
  textEncodingAuthority: representationPhysical.textEncodingAuthority,
  lineCount: representationPhysical.lines.length,
  lineEndingStyle: representationPhysical.lineEndings.style,
  finalLineTerminated: representationPhysical.lineEndings.finalLineTerminated,
});
function representationDocument(overrides = {}) {
  return Object.freeze({
    contentSha256: representationSha,
    byteLength: representationPhysical.byteLength,
    textLength: representationPhysical.text.length,
    byteAuthority: representationPhysical.byteAuthority,
    writer1CByteEligible: true,
    textEncodingAuthority: representationPhysical.textEncodingAuthority,
    physicalFile: representationPhysical,
    ...overrides,
  });
}
function representationWriter(overrides = {}) {
  return Object.freeze({
    byteString: representationByteString,
    bytes: byteArray(representationByteString),
    text: representationPhysical.text,
    postimageRepresentationCustody: expectedRepresentationCustody,
    ...overrides,
  });
}
const expectedTarget0Custody = Object.freeze({ authority: 'SHA256_ORIGINAL_TARGET0_BYTES', contentSha256: canonicalSha, byteLength: canonicalBytes.length });
const expectedPostimageCustody = Object.freeze({ authority: 'SHA256_WRITER2_POSTIMAGE_BYTES', contentSha256: canonicalSha, byteLength: canonicalBytes.length });
assert.deepEqual(writerTest.assertTarget0HashCustody(target0(), Object.freeze({ targetSha256: canonicalSha })), expectedTarget0Custody);
assert.deepEqual(validatorTest.independentlyValidateTarget0HashCustody(target0(), transferPlan(canonicalSha)), expectedTarget0Custody);
assert.deepEqual(validatorTest.independentlyValidatePostimageHashCustody(postimage()), expectedPostimageCustody);
assert.deepEqual(
  validatorTest.independentlyValidatePostimageRepresentationCustody(representationDocument(), representationWriter()),
  expectedRepresentationCustody,
);

// F40: caller forges all declared TARGET hashes consistently, but they do not match TARGET0 bytes.
{
  const forgedSha = '0'.repeat(64); const forged = target0(canonicalBytes, forgedSha);
  assert.throws(() => writerTest.assertTarget0HashCustody(forged, Object.freeze({ targetSha256: forgedSha })), /TARGET0_SHA256_MISMATCH/);
  assert.throws(() => validatorTest.independentlyValidateTarget0HashCustody(forged, transferPlan(forgedSha)), /TARGET0_SHA256_MISMATCH/);
}
// F41: physical TARGET0 bytes drift while the originally valid digest remains declared.
{
  const stale = target0('abd', canonicalSha);
  assert.throws(() => writerTest.assertTarget0HashCustody(stale, Object.freeze({ targetSha256: canonicalSha })), /TARGET0_SHA256_MISMATCH/);
  assert.throws(() => validatorTest.independentlyValidateTarget0HashCustody(stale, transferPlan(canonicalSha)), /TARGET0_SHA256_MISMATCH/);
}
// F42: non-SHA placeholder labels are not cryptographic custody.
{
  const malformed = target0(canonicalBytes, 'target-sha');
  assert.throws(() => writerTest.assertTarget0HashCustody(malformed, Object.freeze({ targetSha256: 'target-sha' })), /TARGET0_SHA256_FORMAT_REQUIRED/);
  assert.throws(() => validatorTest.independentlyValidateTarget0HashCustody(malformed, transferPlan('target-sha')), /TARGET0_SHA256_FORMAT_REQUIRED/);
}
// F43: physical byte-length testimony must equal the untouched byte string.
{
  const wrongLength = target0(canonicalBytes, canonicalSha, 2);
  assert.throws(() => writerTest.assertTarget0HashCustody(wrongLength, Object.freeze({ targetSha256: canonicalSha })), /TARGET0_BYTE_LENGTH_MISMATCH/);
  assert.throws(() => validatorTest.independentlyValidateTarget0HashCustody(wrongLength, transferPlan(canonicalSha)), /TARGET0_BYTE_LENGTH_MISMATCH/);
}
// F44: document-level byte-length testimony, when present, must also bind TARGET0.
{
  const wrongLength = target0(canonicalBytes, canonicalSha, canonicalBytes.length, 4);
  assert.throws(() => writerTest.assertTarget0HashCustody(wrongLength, Object.freeze({ targetSha256: canonicalSha })), /TARGET0_DOCUMENT_BYTE_LENGTH_MISMATCH/);
  assert.throws(() => validatorTest.independentlyValidateTarget0HashCustody(wrongLength, transferPlan(canonicalSha)), /TARGET0_DOCUMENT_BYTE_LENGTH_MISMATCH/);
}
// F46: byte-perfect postimage with a different well-formed declared digest is rejected.
{
  const forged = postimage(canonicalBytes, '0'.repeat(64));
  assert.throws(() => validatorTest.independentlyValidatePostimageHashCustody(forged), /POSTIMAGE_SHA256_MISMATCH/);
}
// F47: postimage placeholder labels are not cryptographic custody.
{
  const malformed = postimage(canonicalBytes, 'post-sha');
  assert.throws(() => validatorTest.independentlyValidatePostimageHashCustody(malformed), /POSTIMAGE_SHA256_FORMAT_REQUIRED/);
}
// F48: postimage physical byte-length testimony must equal actual bytes.
{
  const wrongLength = postimage(canonicalBytes, canonicalSha, 2);
  assert.throws(() => validatorTest.independentlyValidatePostimageHashCustody(wrongLength), /POSTIMAGE_BYTE_LENGTH_MISMATCH/);
}
// F49: postimage document-level byte-length testimony, when present, must match actual bytes.
{
  const wrongLength = postimage(canonicalBytes, canonicalSha, canonicalBytes.length, 4);
  assert.throws(() => validatorTest.independentlyValidatePostimageHashCustody(wrongLength), /POSTIMAGE_DOCUMENT_BYTE_LENGTH_MISMATCH/);
}
// F51: Writer Uint8Array content cannot diverge from the authoritative postimage byte string.
{
  const forgedBytes = byteArray(representationByteString); forgedBytes[0] ^= 0x01;
  const forged = representationWriter({ bytes: forgedBytes });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(representationDocument(), forged), /RESULT_BYTE_ARRAY_MISMATCH/);
}
// F52: the Writer bytes contract is specifically Uint8Array, not an equal-value surrogate container.
{
  const forged = representationWriter({ bytes: Object.freeze([...byteArray(representationByteString)]) });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(representationDocument(), forged), /RESULT_BYTE_ARRAY_MISMATCH/);
}
// F53: Writer decoded text cannot diverge from canonical physical-file re-intake text.
{
  const forged = representationWriter({ text: 'FORGED-TEXT' });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(representationDocument(), forged), /RESULT_TEXT_MISMATCH/);
}
// F54: physicalFile.text is re-derived from bytes and may not be caller-forged.
{
  const forgedPhysical = Object.freeze({ ...representationPhysical, text: 'FORGED-PHYSICAL-TEXT' });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(
    representationDocument({ physicalFile: forgedPhysical }), representationWriter()), /POSTIMAGE_PHYSICAL_TEXT_MISMATCH/);
}
// F55: physical line spans/text are re-derived from bytes and may not drift independently.
{
  const forgedLines = representationPhysical.lines.map((line, index) => index === representationPhysical.lines.length - 1
    ? Object.freeze({ ...line, text: 'FORGED-LINE' }) : line);
  const forgedPhysical = Object.freeze({ ...representationPhysical, lines: Object.freeze(forgedLines) });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(
    representationDocument({ physicalFile: forgedPhysical }), representationWriter()), /POSTIMAGE_PHYSICAL_LINES_MISMATCH/);
}
// F56: line-ending summary is derived from the physical byte scan, not independent testimony.
{
  const forgedPhysical = Object.freeze({ ...representationPhysical,
    lineEndings: Object.freeze({ ...representationPhysical.lineEndings, style: 'LF' }) });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(
    representationDocument({ physicalFile: forgedPhysical }), representationWriter()), /POSTIMAGE_PHYSICAL_LINE_ENDINGS_MISMATCH/);
}
// F57: physical metadata such as byteAuthority/textEncodingAuthority must match canonical byte re-intake.
{
  const forgedPhysical = Object.freeze({ ...representationPhysical, byteAuthority: 'REENCODED_TEXT_COMPATIBILITY' });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(
    representationDocument({ physicalFile: forgedPhysical }), representationWriter()), /POSTIMAGE_PHYSICAL_METADATA_MISMATCH/);
}
// F58: intake-level representation metadata, when supplied, must agree with the canonical postimage physical file.
{
  const forged = representationDocument({ textLength: representationPhysical.text.length + 1 });
  assert.throws(() => validatorTest.independentlyValidatePostimageRepresentationCustody(forged, representationWriter()),
    /POSTIMAGE_DOCUMENT_REPRESENTATION_METADATA_MISMATCH/);
}

console.log('CII SHA-256 and Writer2 partial-HANGER cryptographic/representation custody falsifiers F40-F44/F46-F49/F51-F58 authored.');
