import {
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createPolylineGeometry,
  createSegmentGeometry,
  freezeJsonValue,
} from '../../core/engineering-scene/index.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { prepareTopologyEngineeringSvgViewModel } from './topology-engineering-svg-view-model.js';

export const TOPOLOGY_ENGINEERING_SVG_PARITY_SCHEMA = 'TopologyEngineeringSvgParityReport.v1';

const CATEGORY_ORDER = Object.freeze([
  'sourceComponents', 'sourcePorts', 'canonicalNodes', 'canonicalEdges',
  'pointFeatures', 'junctions', 'boundaries',
]);

function exactPoint(value) {
  const record = objectRecord(value);
  if (!['x', 'y', 'z'].every((axis) => typeof record[axis] === 'number' && Number.isFinite(record[axis]))) return null;
  return Object.freeze({ x: record.x, y: record.y, z: record.z });
}

function samePoint(left, right) {
  return left && right && left.x === right.x && left.y === right.y && left.z === right.z;
}

function componentGeometry(component) {
  const positions = objectRecord(component.positions);
  const start = exactPoint(positions.APOS), end = exactPoint(positions.LPOS), point = exactPoint(positions.POS);
  const category = cleanText(component.componentCategory);
  const classification = cleanText(component.geometryClassification);
  if (category === 'ELBO/BEND' && start && point && end && !samePoint(start, point) && !samePoint(point, end)) {
    return createPolylineGeometry([start, point, end]);
  }
  if (['POINT', 'JUNCTION', 'DEFERRED'].includes(classification) && point) return createPointGeometry(point);
  if (start && end && !samePoint(start, end)) return createSegmentGeometry(start, end);
  if (point || start || end) return createPointGeometry(point || start || end);
  return null;
}

function issueEvidence(viewModel, objectKey) {
  return asArray(viewModel.issues).map(objectRecord).filter((issue) => (
    asArray(issue.objectKeys).map(cleanText).includes(objectKey)
  )).map((issue) => ({
    id: cleanText(issue.id), code: cleanText(issue.code), blocking: issue.blocking === true,
    message: cleanText(issue.message),
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function entity(input) {
  const record = objectRecord(input.record);
  const objectKey = cleanText(record.objectKey);
  const issues = issueEvidence(input.viewModel, objectKey);
  return createEngineeringSceneEntity({
    id: objectKey,
    kind: input.geometry.kind,
    domainType: input.domainType,
    geometry: input.geometry,
    domainRef: {
      owner: 'topology-trace-validator',
      objectKey,
      category: input.category,
      sourceEntityId: cleanText(record.sourceEntityId),
      canonicalId: cleanText(record.id),
    },
    propertySetIds: [`ttv:properties:${objectKey}`],
    editCapabilities: [],
    layer: input.layer,
    renderOrder: input.renderOrder,
    metadata: {
      topologyTrace: {
        objectKey,
        sourcePath: cleanText(record.sourcePath),
        sourceEntityIds: asArray(record.sourceEntityIds).map(cleanText).filter(Boolean),
        inputXmlElementIds: asArray(record.inputXmlElementIds).map(cleanText).filter(Boolean),
        componentCategory: cleanText(record.componentCategory),
        disposition: cleanText(record.disposition),
        issues,
      },
    },
  });
}

function categoryResult(name, records, mapRecord) {
  const mapped = [], omissions = [];
  records.map(objectRecord).forEach((record, index) => {
    const objectKey = cleanText(record.objectKey);
    if (!objectKey) {
      omissions.push({ index, objectKey: '', reason: 'OBJECT_KEY_MISSING' });
      return;
    }
    try {
      const result = mapRecord(record);
      if (!result) omissions.push({ index, objectKey, reason: 'AUTHORITATIVE_GEOMETRY_MISSING' });
      else mapped.push(result);
    } catch (error) {
      omissions.push({ index, objectKey, reason: String(error?.message || error) });
    }
  });
  return {
    name,
    entities: mapped,
    evidence: {
      category: name,
      eligible: records.length,
      mapped: mapped.length,
      omitted: omissions.length,
      omissions: omissions.sort((left, right) => left.objectKey.localeCompare(right.objectKey) || left.index - right.index),
    },
  };
}

function pointCategory(viewModel, name, records, domainType, layer, renderOrder) {
  return categoryResult(name, records, (record) => {
    const point = exactPoint(record.position);
    return point ? entity({
      viewModel, record, category: name, domainType, layer, renderOrder,
      geometry: createPointGeometry(point),
    }) : null;
  });
}

export function buildTopologyEngineeringSvgScene(viewModelValue, options = {}) {
  const viewModel = prepareTopologyEngineeringSvgViewModel(viewModelValue);
  if (!options.revision) throw new TypeError('Topology engineering SVG requires an explicit revision token.');
  const sceneId = cleanText(options.sceneId);
  if (!sceneId) throw new TypeError('Topology engineering SVG requires an explicit sceneId.');
  const nodeMap = new Map(asArray(viewModel.canonicalNodes).map(objectRecord).map((node) => [cleanText(node.id), node]));
  const categories = [
    categoryResult('sourceComponents', asArray(viewModel.sourceComponents), (record) => {
      const geometry = componentGeometry(record);
      return geometry ? entity({ viewModel, record, category: 'sourceComponents', domainType: 'TTV_SOURCE_COMPONENT', layer: 'source', renderOrder: 10, geometry }) : null;
    }),
    pointCategory(viewModel, 'sourcePorts', asArray(viewModel.sourcePorts), 'TTV_SOURCE_PORT', 'ports', 20),
    pointCategory(viewModel, 'canonicalNodes', asArray(viewModel.canonicalNodes), 'TTV_CANONICAL_NODE', 'canonical-nodes', 40),
    categoryResult('canonicalEdges', asArray(viewModel.canonicalEdges), (record) => {
      const from = exactPoint(nodeMap.get(cleanText(record.fromNodeId))?.position);
      const to = exactPoint(nodeMap.get(cleanText(record.toNodeId))?.position);
      return from && to ? entity({
        viewModel, record, category: 'canonicalEdges', domainType: 'TTV_CANONICAL_EDGE', layer: 'canonical-edges', renderOrder: 30,
        geometry: createSegmentGeometry(from, to),
      }) : null;
    }),
    pointCategory(viewModel, 'pointFeatures', asArray(viewModel.pointFeatures), 'TTV_POINT_FEATURE', 'features', 50),
    pointCategory(viewModel, 'junctions', asArray(viewModel.junctions), 'TTV_JUNCTION', 'junctions', 60),
    pointCategory(viewModel, 'boundaries', asArray(viewModel.boundaries), 'TTV_BOUNDARY', 'boundaries', 70),
  ];
  const ordered = CATEGORY_ORDER.map((name) => categories.find((category) => category.name === name));
  const entities = ordered.flatMap((category) => category.entities);
  const categoryEvidence = Object.fromEntries(ordered.map((category) => [category.name, category.evidence]));
  const totals = ordered.reduce((sum, category) => ({
    eligible: sum.eligible + category.evidence.eligible,
    mapped: sum.mapped + category.evidence.mapped,
    omitted: sum.omitted + category.evidence.omitted,
  }), { eligible: 0, mapped: 0, omitted: 0 });
  const parity = freezeJsonValue({
    schema: TOPOLOGY_ENGINEERING_SVG_PARITY_SCHEMA,
    sceneId,
    revision: options.revision,
    categories: categoryEvidence,
    totals,
  });
  const scene = createEngineeringScene({
    sceneId,
    revision: options.revision,
    coordinateSystem: options.coordinateSystem,
    projections: ['ISO', 'XY', 'XZ', 'YZ'],
    entities,
    capabilities: { selection: true, properties: true, editing: false },
    metadata: {
      topologyTrace: {
        viewModelSchema: viewModel.schema,
        visibleProjection: cleanText(viewModel.projection),
        mode: cleanText(viewModel.mode),
        parity,
      },
    },
  });
  return Object.freeze({ scene, parity, viewModel });
}

export const _test = Object.freeze({ exactPoint, samePoint, componentGeometry, issueEvidence });
