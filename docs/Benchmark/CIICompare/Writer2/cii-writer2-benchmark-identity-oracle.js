function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error('BM_W2_00_BYTES_REQUIRED');
}

function copyBytes(value) {
  const source = toBytes(value);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

function bytesEqual(left, right) {
  const a = toBytes(left); const b = toBytes(right);
  if (a.byteLength !== b.byteLength) return false;
  for (let index = 0; index < a.byteLength; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

export function buildBmW200ExpectedPostimage(originalBytes) {
  const input = toBytes(originalBytes);
  if (!input.byteLength) throw new Error('BM_W2_00_NONEMPTY_FIXTURE_REQUIRED');
  const outputBytes = copyBytes(input);
  return Object.freeze({
    schema: 'CIIWriter2BenchmarkIdentityOracle.v1',
    caseId: 'BM-W2-00',
    status: 'PASS',
    operation: 'NONE',
    authority: 'ORIGINAL_FROZEN_TARGET_BYTES',
    byteLength: outputBytes.byteLength,
    byteIdentical: true,
    outputBytes,
  });
}

export function assertBmW200IdentityPostimage(originalBytes, candidateBytes) {
  if (!bytesEqual(originalBytes, candidateBytes)) throw new Error('BM_W2_00_IDENTITY_POSTIMAGE_MISMATCH');
  return Object.freeze({
    schema: 'CIIWriter2BenchmarkIdentityValidation.v1',
    caseId: 'BM-W2-00',
    status: 'PASS',
    byteIdentical: true,
    byteLength: toBytes(originalBytes).byteLength,
  });
}

export const _test = Object.freeze({ toBytes, copyBytes, bytesEqual });
