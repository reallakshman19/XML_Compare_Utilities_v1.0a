import {
  createEngineeringPropertyField,
  createEngineeringPropertySet,
} from '../../core/engineering-scene/index.js';

function textField(key, label, value) {
  return createEngineeringPropertyField({
    key, label, type: 'text', scope: 'ENTITY', value: String(value ?? ''), editable: false,
    source: 'topology-trace-validator',
  });
}

function numberField(key, label, value, unit = null) {
  return createEngineeringPropertyField({
    key, label, type: 'number', scope: 'ENTITY', value, unit, editable: false,
    source: 'topology-trace-validator',
  });
}

function geometryFields(geometry) {
  if (geometry.kind === 'point') return [
    numberField('x', 'X', geometry.position.x, 'mm'),
    numberField('y', 'Y', geometry.position.y, 'mm'),
    numberField('z', 'Z', geometry.position.z, 'mm'),
  ];
  if (geometry.kind === 'segment') return [
    numberField('startX', 'Start X', geometry.start.x, 'mm'),
    numberField('startY', 'Start Y', geometry.start.y, 'mm'),
    numberField('startZ', 'Start Z', geometry.start.z, 'mm'),
    numberField('endX', 'End X', geometry.end.x, 'mm'),
    numberField('endY', 'End Y', geometry.end.y, 'mm'),
    numberField('endZ', 'End Z', geometry.end.z, 'mm'),
  ];
  return [
    numberField('pointCount', 'Point count', geometry.points.length),
    textField('coordinates', 'Coordinates', JSON.stringify(geometry.points.map(({ x, y, z }) => ({ x, y, z })))),
  ];
}

function optionalText(fields, key, label, value) {
  if (String(value ?? '')) fields.push(textField(key, label, value));
}

export function buildTopologyEngineeringSvgPropertySet(entity, revision) {
  const trace = entity.metadata?.topologyTrace || {};
  const fields = [
    textField('objectKey', 'Object key', entity.id),
    textField('domainType', 'Domain type', entity.domainType),
    textField('geometryKind', 'Geometry kind', entity.geometry.kind),
    textField('layer', 'Layer', entity.layer),
    numberField('issueCount', 'Issue count', Array.isArray(trace.issues) ? trace.issues.length : 0),
    ...geometryFields(entity.geometry),
  ];
  optionalText(fields, 'sourceEntityId', 'Source entity ID', entity.domainRef.sourceEntityId);
  optionalText(fields, 'canonicalId', 'Canonical ID', entity.domainRef.canonicalId);
  optionalText(fields, 'sourcePath', 'Source path', trace.sourcePath);
  optionalText(fields, 'componentCategory', 'Component category', trace.componentCategory);
  optionalText(fields, 'disposition', 'Disposition', trace.disposition);
  if (Array.isArray(trace.sourceEntityIds) && trace.sourceEntityIds.length) {
    fields.push(textField('sourceEntityIds', 'Source entity lineage', trace.sourceEntityIds.join(', ')));
  }
  if (Array.isArray(trace.inputXmlElementIds) && trace.inputXmlElementIds.length) {
    fields.push(textField('inputXmlElementIds', 'InputXML lineage', trace.inputXmlElementIds.join(', ')));
  }
  if (Array.isArray(trace.issues) && trace.issues.length) {
    fields.push(textField('issueCodes', 'Issue codes', trace.issues.map((issue) => issue.code).join(', ')));
  }
  return createEngineeringPropertySet({
    id: `ttv:properties:${entity.id}`,
    revision,
    ownerIds: [entity.id],
    fields,
    metadata: { owner: 'topology-trace-validator', readOnly: true },
  });
}

export function buildTopologyEngineeringSvgPropertySets(scene, selectedIds) {
  const requested = new Set(selectedIds.map(String));
  const entities = scene.entities.filter((entity) => requested.has(entity.id));
  if (entities.length !== requested.size) {
    const found = new Set(entities.map((entity) => entity.id));
    const missing = [...requested].filter((id) => !found.has(id)).sort();
    throw new Error(`Topology engineering SVG property owners are missing: ${missing.join(', ')}.`);
  }
  return Object.freeze(entities.map((entity) => buildTopologyEngineeringSvgPropertySet(entity, scene.revision)));
}
