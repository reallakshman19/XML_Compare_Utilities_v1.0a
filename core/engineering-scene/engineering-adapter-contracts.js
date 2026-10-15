import { freezeJsonValue, isPlainObject } from './engineering-json-value.js';

export const ENGINEERING_SVG_ADAPTER_DESCRIPTOR_SCHEMA = 'EngineeringSvgAdapterDescriptor.v1';
export const ENGINEERING_SVG_ADAPTER_ACCESS_MODE = Object.freeze({
  READ_ONLY: 'read-only',
  EDITABLE: 'editable',
});

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function uniqueTextList(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const result = values.map((value, index) => requiredText(value, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} must contain unique values.`);
  return Object.freeze(result);
}

export function createEngineeringSvgAdapterDescriptor(input = {}) {
  const accessMode = input.accessMode || ENGINEERING_SVG_ADAPTER_ACCESS_MODE.READ_ONLY;
  if (!Object.values(ENGINEERING_SVG_ADAPTER_ACCESS_MODE).includes(accessMode)) {
    throw new TypeError(`Unsupported engineering SVG adapter access mode "${accessMode}".`);
  }
  if (input.capabilities != null && !isPlainObject(input.capabilities)) {
    throw new TypeError('Engineering SVG adapter capabilities must be a plain object.');
  }
  if (input.metadata != null && !isPlainObject(input.metadata)) {
    throw new TypeError('Engineering SVG adapter metadata must be a plain object.');
  }
  return freezeJsonValue({
    schema: ENGINEERING_SVG_ADAPTER_DESCRIPTOR_SCHEMA,
    adapterId: requiredText(input.adapterId, 'Engineering SVG adapter id'),
    domainType: requiredText(input.domainType, 'Engineering SVG adapter domain type'),
    accessMode,
    projections: uniqueTextList(input.projections || ['ISO', 'XY', 'XZ', 'YZ'], 'Adapter projections'),
    capabilities: input.capabilities ?? {},
    metadata: input.metadata ?? {},
  });
}
