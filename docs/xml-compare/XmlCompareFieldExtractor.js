// Single field-read + extraction path shared by matching, both validators, and compare.
// Collapses the historical readField/readRecordField divergence and hosts the regex->numeric (2.2.1)
// and text-normalize/match% (2.2.2) logic that previously lived only as a UI sandbox tester.
export const XML_COMPARE_FIELD_EXTRACTOR_SCHEMA = 'xml-compare-field-extractor/v1';

const clean = (value) => String(value ?? '').trim();
const keyNorm = (value) => clean(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
const num = (value) => { const n = Number(clean(value)); return Number.isFinite(n) ? n : null; };
const SENTINEL = -1.0101;
const isSentinel = (n) => n != null && Math.abs(n - SENTINEL) < 1e-4;

const BAG_KEYS = Object.freeze(['attributes', 'fields', 'compactFields', 'sourceAttributes', 'transferFields', 'rawSummary']);
function bagsOf(record = {}) {
  return [record, ...BAG_KEYS.map((key) => record?.[key]), record?.raw, record?.raw?.attributes];
}

// Read a raw field value from a record, checking every common bag plus case and normalized-key variants.
export function readFieldValue(record = {}, field = '') {
  if (!record || !clean(field)) return undefined;
  const names = [field, clean(field), clean(field).toUpperCase()];
  const bags = bagsOf(record);
  for (const bag of bags) for (const name of names) if (bag && bag[name] != null) return bag[name];
  const wanted = keyNorm(field);
  for (const bag of bags) if (bag && typeof bag === 'object') for (const [key, value] of Object.entries(bag)) if (keyNorm(key) === wanted) return value;
  return undefined;
}

// Apply an optional capture regex to a text value, returning the chosen group (default 0 = whole match).
export function applyCaptureRegex(text = '', { regex = '', group = 0, caseInsensitive = true } = {}) {
  const value = clean(text);
  if (!clean(regex)) return value;
  try {
    const match = new RegExp(regex, caseInsensitive ? 'i' : '').exec(value);
    return match ? clean(match[Number(group) || 0] ?? '') : '';
  } catch {
    return value;
  }
}

// Token extraction (promoted from the converter regex sandbox): split on a delimiter, pick a 1-based position.
export function extractToken(text = '', { delimiter = '-', position = 1, stripLeadingSlash = true, stripTrailingBranch = true } = {}) {
  let value = clean(text);
  if (stripLeadingSlash) value = value.replace(/^\/+/, '');
  if (stripTrailingBranch) value = value.replace(/\/B\d+$/i, '');
  const tokens = value.split(clean(delimiter) || '-').map((item) => clean(item)).filter(Boolean);
  return tokens[Math.max(0, (Number(position) || 1) - 1)] || '';
}

// Numeric extraction (2.2.1): optional regex capture -> parse to number; CAESAR sentinel (-1.0101) -> null.
export function extractNumeric(record = {}, field = '', options = {}) {
  const raw = readFieldValue(record, field);
  if (raw == null) return null;
  const n = num(applyCaptureRegex(raw, options));
  return n == null || isSentinel(n) ? null : n;
}

// Text normalization (2.2.2): optional regex capture, whitespace-collapse, case-fold.
export function normalizeText(value = '', { regex = '', group = 0, caseSensitive = false } = {}) {
  let text = applyCaptureRegex(value, { regex, group });
  text = text.replace(/\s+/g, ' ').trim();
  return caseSensitive ? text : text.toLowerCase();
}

function levenshtein(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// Text match percent 0..1 (normalized Levenshtein similarity) after applying normalization options.
export function textMatchPercent(a = '', b = '', options = {}) {
  const s = normalizeText(a, options);
  const t = normalizeText(b, options);
  if (!s && !t) return 1;
  if (!s || !t) return 0;
  if (s === t) return 1;
  return 1 - levenshtein(s, t) / Math.max(s.length, t.length);
}

export const _test = Object.freeze({ clean, keyNorm, num, isSentinel, bagsOf, levenshtein });
