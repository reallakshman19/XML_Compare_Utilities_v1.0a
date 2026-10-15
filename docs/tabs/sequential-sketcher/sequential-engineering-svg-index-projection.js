import { freezeJsonValue } from '../../core/engineering-scene/index.js';

export const SEQUENTIAL_ENGINEERING_SVG_INDEX_PROJECTION_SCHEMA =
  'SequentialEngineeringSvgIndexProjection.v1';

function requiredMap(value, label) {
  if (!(value instanceof Map)) throw new TypeError(`${label} must be a private Map.`);
  return value;
}

function orderedEntries(map) {
  return [...map.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
}

function indexedRows(map, idKey, valueKey) {
  return orderedEntries(map).map(([id, value]) => ({ [idKey]: String(id), [valueKey]: value }));
}

function referenceRows(map) {
  return orderedEntries(map).map(([reference, components]) => {
    if (!Array.isArray(components)) {
      throw new TypeError(`Sequential component reference "${reference}" must contain an array of claims.`);
    }
    const componentIds = components.map((component) => String(component?.componentId || '')).sort();
    if (componentIds.some((componentId) => !componentId)) {
      throw new TypeError(`Sequential component reference "${reference}" contains a claim without componentId.`);
    }
    return { reference: String(reference), componentIds, conflict: componentIds.length > 1 };
  });
}

export function createSequentialEngineeringSvgIndexProjection(indexes) {
  const branches = requiredMap(indexes?.branches, 'Sequential branch index');
  const components = requiredMap(indexes?.components, 'Sequential component index');
  const ports = requiredMap(indexes?.ports, 'Sequential port index');
  const componentReferences = requiredMap(
    indexes?.componentReferences,
    'Sequential component reference index',
  );
  return freezeJsonValue({
    schema: SEQUENTIAL_ENGINEERING_SVG_INDEX_PROJECTION_SCHEMA,
    branches: indexedRows(branches, 'branchId', 'branch'),
    components: indexedRows(components, 'componentId', 'component'),
    ports: indexedRows(ports, 'portId', 'port'),
    componentReferences: referenceRows(componentReferences),
  });
}
