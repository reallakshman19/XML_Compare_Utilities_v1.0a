import {
  TOPOLOGY_VIEW_MODEL_SCHEMA,
  asArray,
  cleanText,
  deepFreeze,
  objectRecord,
} from './topology-validator-values.js';

const PORT_POSITION_FIELD = Object.freeze({ A: 'APOS', L: 'LPOS', P: 'POS' });

function exactPoint(value) {
  const record = objectRecord(value);
  const point = { x: record.x, y: record.y, z: record.z };
  return ['x', 'y', 'z'].every((axis) => typeof point[axis] === 'number' && Number.isFinite(point[axis]))
    ? deepFreeze(point)
    : null;
}

function ownerKey(port) {
  const key = cleanText(port.objectKey);
  const separator = key.lastIndexOf(':port:');
  return separator >= 0 ? key.slice(0, separator) : '';
}

function portPosition(port, componentsByKey) {
  const component = componentsByKey.get(ownerKey(port));
  const field = PORT_POSITION_FIELD[cleanText(port.role).toUpperCase()];
  return field ? exactPoint(objectRecord(component?.positions)[field]) : null;
}

export function prepareTopologyEngineeringSvgViewModel(viewModelValue) {
  const viewModel = objectRecord(viewModelValue);
  if (viewModel.schema !== TOPOLOGY_VIEW_MODEL_SCHEMA) {
    throw new TypeError(`Topology engineering SVG requires ${TOPOLOGY_VIEW_MODEL_SCHEMA}.`);
  }
  const components = asArray(viewModel.sourceComponents).map(objectRecord);
  const componentsByKey = new Map(components.map((component) => [cleanText(component.objectKey), component]));
  const sourcePorts = asArray(viewModel.sourcePorts).map((value) => {
    const port = objectRecord(value);
    const component = componentsByKey.get(ownerKey(port));
    return deepFreeze({
      ...port,
      sourceEntityId: cleanText(component?.sourceEntityId),
      sourcePath: cleanText(component?.sourcePath),
      sourceType: cleanText(component?.type),
      position: portPosition(port, componentsByKey),
    });
  });
  return deepFreeze({ ...viewModel, sourcePorts });
}

export const _test = Object.freeze({ exactPoint, ownerKey, portPosition });
