export const REV_COMPARE_CHANGE_TYPES = Object.freeze({
  IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
  NUMERIC_CHANGED: 'NUMERIC_CHANGED',
  TEXT_CHANGED: 'TEXT_CHANGED',
  MISSING: 'MISSING',
  NEW: 'NEW',
  DUPLICATE: 'DUPLICATE',
  MATCH: 'MATCH'
});

export const REV_COMPARE_SCHEMA = 'xml-compare-rev-compare/v1';

const clean = (value) => String(value ?? '').trim();

export function normalizeNodeKey(key) {
  const text = clean(key);
  if (!text) return '';
  return text.split('|')[0].split('/')[0].trim();
}

export function isNumericField(fieldName, value1, value2) {
  const f = clean(fieldName).toLowerCase();
  const v1 = clean(value1);
  const v2 = clean(value2);
  
  if (f.endsWith('kn') || f.includes('gap') || f.includes('delta') || f.endsWith('mm')) {
    return true;
  }
  
  if (v1 && v2 && !isNaN(Number(v1)) && !isNaN(Number(v2))) {
    return true;
  }
  return false;
}

export const _test = Object.freeze({ clean, normalizeNodeKey, isNumericField });
