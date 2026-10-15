export const XML_COMPARE_COMPARE_FIELD_PRESETS_SCHEMA = 'xml-compare-compare-field-presets/v1';

const PRESETS = Object.freeze({
  coordinates: Object.freeze(['globalX', 'globalY', 'globalZ']),
  'element-endpoints': Object.freeze(['FROM_GLOBAL_X', 'FROM_GLOBAL_Y', 'FROM_GLOBAL_Z', 'TO_GLOBAL_X', 'TO_GLOBAL_Y', 'TO_GLOBAL_Z']),
  'line-identity': Object.freeze(['lineNo', 'Branchname']),
  support: Object.freeze(['SupportText', 'support', 'restraint', 'restraintType']),
});

function clean(value) {
  return String(value ?? '').trim();
}

export function compareFieldPresetNames() {
  return Object.freeze(Object.keys(PRESETS));
}

export function fieldsForComparePreset(name = '') {
  return Object.freeze([...(PRESETS[clean(name)] || [])]);
}

export function applyCompareFieldPreset(currentFields = [], presetName = '') {
  const out = [...(Array.isArray(currentFields) ? currentFields : [])];
  for (const field of fieldsForComparePreset(presetName)) {
    if (!out.includes(field)) out.push(field);
  }
  return Object.freeze(out.filter(Boolean));
}
