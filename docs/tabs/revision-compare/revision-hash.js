/** SHA-256 helpers for exact revision bytes and deterministic JSON artifacts. */

function cryptoDigest(cryptoRef) {
  const digest = cryptoRef?.subtle?.digest;
  if (!digest) throw new Error('Web Crypto SHA-256 is unavailable; revision loading is blocked.');
  return digest.bind(cryptoRef.subtle);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

/** @returns {Promise<string>} lowercase SHA-256 hex for exact bytes. */
export async function sha256Bytes(value, cryptoRef) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return toHex(await cryptoDigest(cryptoRef)('SHA-256', bytes));
}

/** @returns {Promise<string>} lowercase SHA-256 hex for UTF-8 text. */
export function sha256Text(value, cryptoRef) {
  return sha256Bytes(new TextEncoder().encode(String(value)), cryptoRef);
}
