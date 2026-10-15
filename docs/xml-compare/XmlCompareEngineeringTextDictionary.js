export const XML_COMPARE_ENGINEERING_TEXT_DICTIONARY_SCHEMA = 'xml-compare-engineering-text-dictionary/v1';

const DEFAULT_SUPPORT_TERMS = Object.freeze({
  '+Y': 'REST',
  '-Y': 'REST',
  Y: 'GUIDE',
  Z: 'GUIDE',
  X: 'LINE_STOP',
  LIM: 'LINE_STOP',
  LIMIT: 'LINE_STOP',
  LINESTOP: 'LINE_STOP',
  LINE_STOP: 'LINE_STOP',
  ANC: 'ANCHOR',
  ANCH: 'ANCHOR',
  ANCHOR: 'ANCHOR',
  REST: 'REST',
  GUIDE: 'GUIDE',
});

function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeEngineeringToken(value) {
  return clean(value).toUpperCase().replace(/[\s-]+/g, '_');
}

export function createDefaultSupportDictionary() {
  return Object.freeze({ ...DEFAULT_SUPPORT_TERMS });
}

export function mapEngineeringTerm(value, dictionary = {}) {
  const token = normalizeEngineeringToken(value);
  const mapped = dictionary[token] || dictionary[clean(value).toUpperCase()] || '';
  return Object.freeze({
    token,
    mapped: mapped || token,
    known: Boolean(mapped || token in dictionary),
  });
}

export function compareEngineeringTerms({ sourceValue = '', targetValue = '', dictionary = {} } = {}) {
  const source = mapEngineeringTerm(sourceValue, dictionary);
  const target = mapEngineeringTerm(targetValue, dictionary);
  if (!source.token || !target.token) return Object.freeze({ status: 'BLANK', source, target });
  if (!source.known || !target.known) return Object.freeze({ status: 'UNKNOWN_ENGINEERING_TOKEN', source, target });
  return Object.freeze({ status: source.mapped === target.mapped ? 'OK' : 'ENGINEERING_TERM_MISMATCH', source, target });
}
