export function hashText(text = '') {
  let hash = 0x811c9dc5;
  const input = String(text ?? '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `h32:${hash.toString(16).padStart(8, '0')}`;
}
