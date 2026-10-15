import {
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createSegmentGeometry,
  freezeJsonValue,
} from '../../core/engineering-scene/index.js';
import { preparePipelineEngineeringSvgViewModel } from './pipeline-engineering-svg-view-model.js';

export const PIPELINE_ENGINEERING_SVG_PARITY_SCHEMA = 'PipelineEngineeringSvgParityReport.v1';

const REVIEW_CATEGORIES = Object.freeze([
  'routeVertices', 'gradeEvents', 'depthEvents', 'markers', 'referenceEvents', 'coordinateRows',
]);
const CATEGORY_ORDER = Object.freeze(['routeSegments', ...REVIEW_CATEGORIES]);
const DOMAIN_TYPES = Object.freeze({
  routeSegments: 'PIPELINE_ROUTE_SEGMENT',
  routeVertices: 'PIPELINE_ROUTE_VERTEX',
  gradeEvents: 'PIPELINE_GRADE_EVENT',
  depthEvents: 'PIPELINE_DEPTH_EVENT',
  markers: 'PIPELINE_MARKER',
  referenceEvents: 'PIPELINE_REFERENCE_EVENT',
  coordinateRows: 'PIPELINE_COORDINATE_ROW',
});

function samePoint(left, right) {
  return Boolean(left && right
    && left.x === right.x && left.y === right.y && left.z === right.z);
}

function duplicateValues(values) {
  const seen = new Set(), duplicates = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates].sort();
}

function emptyCategoryTotals() {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0]));
}

function reviewCategoryTotals(rows, mappedOnly = false) {
  const totals = Object.fromEntries(REVIEW_CATEGORIES.map((category) => [category, 0]));
  rows.forEach((row) => {
    if (!mappedOnly || (row.id && row.point)) totals[row.category] += 1;
  });
  return totals;
}

function categoryTotals(viewModel, mappedOnly = false) {
  const totals = emptyCategoryTotals();
  totals.routeSegments = mappedOnly
    ? viewModel.routeSegments.filter((segment) => segment.id && segment.start && segment.end).length
    : viewModel.routeSegments.length;
  Object.assign(totals, reviewCategoryTotals(viewModel.reviewRows, mappedOnly));
  return totals;
}

function invalidCoordinates(viewModel) {
  const review = viewModel.reviewRows.filter((row) => !row.point).map((row) => ({
    reason: 'REVIEW_COORDINATE_INVALID', id: row.id, sourceIndex: row.sourceIndex, category: row.category,
  }));
  const geometry = viewModel.geometryRows.filter((row) => !row.point).map((row) => ({
    reason: 'GEOMETRY_COORDINATE_INVALID', id: row.id, sourceIndex: row.sourceIndex,
  }));
  const segments = viewModel.routeSegments.filter((segment) => !segment.start || !segment.end).map((segment) => ({
    reason: 'SEGMENT_COORDINATE_INVALID', id: segment.id, sourceIndex: segment.sourceIndex,
  }));
  return [...review, ...geometry, ...segments];
}

function unresolvedReferences(viewModel) {
  const geometryIds = new Set(viewModel.geometryRows.map((row) => row.id).filter(Boolean));
  return viewModel.routeSegments.flatMap((segment) => {
    const missing = [segment.fromGeometryId, segment.toGeometryId]
      .filter((id) => !id || !geometryIds.has(id));
    return missing.length ? [{ segmentId: segment.id, missing }] : [];
  });
}

function routeDiscontinuities(viewModel) {
  const issues = [];
  viewModel.routeSegments.forEach((segment, index) => {
    const from = viewModel.geometryRows[index], to = viewModel.geometryRows[index + 1];
    if (!from || !to || segment.fromGeometryId !== from.id || segment.toGeometryId !== to.id
      || !samePoint(segment.start, from.point) || !samePoint(segment.end, to.point)) {
      issues.push({ segmentId: segment.id, reason: 'SEGMENT_ENDPOINT_PARITY' });
    }
    if (from && to && from.branchName !== to.branchName) {
      issues.push({ segmentId: segment.id, reason: 'GEOMETRY_BRANCH_DISCONTINUITY' });
    }
    const previous = viewModel.routeSegments[index - 1];
    if (previous && (previous.toGeometryId !== segment.fromGeometryId
      || !samePoint(previous.end, segment.start))) {
      issues.push({ segmentId: segment.id, reason: 'SEQUENTIAL_ROUTE_CONTINUITY' });
    }
  });
  return issues;
}

function coordinateRowMismatches(viewModel) {
  const mismatches = [];
  if (viewModel.coordinateTextRows.length !== viewModel.reviewRows.length) {
    mismatches.push({
      reason: 'COORDINATE_ROW_COUNT',
      expected: viewModel.reviewRows.length,
      actual: viewModel.coordinateTextRows.length,
    });
  }
  viewModel.reviewRows.forEach((row, index) => {
    const textRow = viewModel.coordinateTextRows[index];
    if (!textRow || textRow.branchName !== row.branchName || textRow.nodeNumber !== row.nodeNumber
      || !samePoint(textRow, row.point) || textRow.nodeName !== row.nodeName) {
      mismatches.push({ reason: 'COORDINATE_ROW_VALUE', sourceIndex: index, id: row.id });
    }
  });
  return mismatches;
}

function inputXmlCountMismatches(viewModel) {
  return viewModel.inputXmlElements.length === viewModel.routeSegments.length ? [] : [{
    reason: 'INPUTXML_ELEMENT_COUNT',
    expected: viewModel.routeSegments.length,
    actual: viewModel.inputXmlElements.length,
  }];
}

function inputXmlValueMismatches(viewModel) {
  return viewModel.routeSegments.flatMap((segment, index) => {
    const xml = viewModel.inputXmlElements[index];
    const from = viewModel.geometryRows[index], to = viewModel.geometryRows[index + 1];
    const matches = xml && xml.fromNode === segment.fromNode && xml.toNode === segment.toNode
      && samePoint({ x: xml.deltaX, y: xml.deltaY, z: xml.deltaZ }, segment.delta)
      && xml.fromName === from?.nodeName && xml.toName === to?.nodeName;
    return matches ? [] : [{ reason: 'INPUTXML_ELEMENT_VALUE', sourceIndex: index, segmentId: segment.id }];
  });
}

function reviewPropertyGaps(rows) {
  return rows.flatMap((row) => (
    row.id && row.category && row.branchName && row.nodeNumber !== null
      && row.ledgerSource === 'coordinateRows'
      ? [] : [{ reason: 'REVIEW_PROPERTY_COVERAGE', id: row.id, category: row.category }]
  ));
}

function segmentPropertyGaps(segments) {
  return segments.flatMap((segment) => (
    segment.id && segment.branchName && segment.fromNode !== null && segment.toNode !== null
      && segment.start && segment.end && segment.delta && segment.xmlElement
      && ['inputXmlCoordinateRows', 'coordinateRows'].includes(segment.ledgerSource)
      ? [] : [{ reason: 'SEGMENT_PROPERTY_COVERAGE', id: segment.id }]
  ));
}

function propertyCoverageGaps(viewModel) {
  return [...reviewPropertyGaps(viewModel.reviewRows), ...segmentPropertyGaps(viewModel.routeSegments)];
}

function omittedEntities(expected, mapped) {
  return CATEGORY_ORDER.flatMap((category) => {
    const omitted = expected[category] - mapped[category];
    return omitted ? [{ category, omitted }] : [];
  });
}

export function buildPipelineEngineeringSvgParityReport(viewModelValue) {
  const viewModel = preparePipelineEngineeringSvgViewModel(viewModelValue);
  const entityIds = [...viewModel.routeSegments, ...viewModel.reviewRows].map((value) => value.id);
  const geometryIds = viewModel.geometryRows.map((value) => value.id);
  const expectedByCategory = categoryTotals(viewModel);
  const mappedByCategory = categoryTotals(viewModel, true);
  const inputXmlCount = inputXmlCountMismatches(viewModel);
  const inputXmlValues = inputXmlValueMismatches(viewModel);
  const report = {
    schema: PIPELINE_ENGINEERING_SVG_PARITY_SCHEMA,
    revision: viewModel.revision,
    ledgerMode: viewModel.ledgerMode,
    reviewRowCount: viewModel.reviewRows.length,
    geometryRowCount: viewModel.geometryRows.length,
    inputXmlElementCount: viewModel.inputXmlElements.length,
    expectedReviewPointsByCategory: reviewCategoryTotals(viewModel.reviewRows),
    mappedReviewPointsByCategory: reviewCategoryTotals(viewModel.reviewRows, true),
    expectedRouteSegmentCount: viewModel.routeSegments.length,
    mappedRouteSegmentCount: mappedByCategory.routeSegments,
    expectedByCategory,
    mappedByCategory,
    omittedEntities: omittedEntities(expectedByCategory, mappedByCategory),
    ledgerErrors: viewModel.ledgerErrors,
    duplicateIds: duplicateValues([...entityIds, ...geometryIds]),
    invalidCoordinates: invalidCoordinates(viewModel),
    unresolvedReferences: unresolvedReferences(viewModel),
    routeDiscontinuities: routeDiscontinuities(viewModel),
    coordinateRowMismatches: coordinateRowMismatches(viewModel),
    inputXmlCountMismatches: inputXmlCount,
    inputXmlValueMismatches: inputXmlValues,
    inputXmlMismatches: [...inputXmlCount, ...inputXmlValues],
    propertyCoverageGaps: propertyCoverageGaps(viewModel),
    markerReviewEntityCount: viewModel.reviewRows.filter((row) => row.category === 'markers').length,
    reviewOnlyRowCount: Math.max(0, viewModel.reviewRows.length - viewModel.geometryRows.length),
    totalExpected: Object.values(expectedByCategory).reduce((sum, value) => sum + value, 0),
    totalMapped: Object.values(mappedByCategory).reduce((sum, value) => sum + value, 0),
  };
  const issueKeys = [
    'omittedEntities', 'ledgerErrors', 'duplicateIds', 'invalidCoordinates', 'unresolvedReferences',
    'routeDiscontinuities', 'coordinateRowMismatches', 'inputXmlCountMismatches',
    'inputXmlValueMismatches', 'propertyCoverageGaps',
  ];
  report.passed = issueKeys.every((key) => report[key].length === 0)
    && report.totalMapped === report.totalExpected;
  return freezeJsonValue(report);
}

export function assertPipelineEngineeringSvgParity(report) {
  if (report?.schema !== PIPELINE_ENGINEERING_SVG_PARITY_SCHEMA) {
    throw new TypeError('Pipeline parity report is invalid.');
  }
  if (!report.passed) {
    const first = [
      'ledgerErrors', 'duplicateIds', 'invalidCoordinates', 'unresolvedReferences',
      'routeDiscontinuities', 'coordinateRowMismatches', 'inputXmlCountMismatches',
      'inputXmlValueMismatches', 'propertyCoverageGaps', 'omittedEntities',
    ].find((key) => report[key]?.length);
    throw new Error(`Pipeline engineering SVG parity failed: ${first || 'unknown parity failure'}.`);
  }
  return report;
}

function rowEntity(row) {
  return createEngineeringSceneEntity({
    id: row.id,
    kind: 'point',
    domainType: DOMAIN_TYPES[row.category],
    geometry: createPointGeometry(row.point),
    domainRef: {
      owner: 'pipeline-3d-model', category: row.category,
      branchName: row.branchName, nodeNumber: row.nodeNumber,
    },
    propertySetIds: [`pipeline:properties:${row.id}`],
    editCapabilities: [],
    layer: `pipeline-${row.category.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`,
    renderOrder: 20,
    metadata: { pipeline: row },
  });
}

function segmentEntity(segment) {
  return createEngineeringSceneEntity({
    id: segment.id,
    kind: 'segment',
    domainType: DOMAIN_TYPES.routeSegments,
    geometry: createSegmentGeometry(segment.start, segment.end),
    domainRef: {
      owner: 'pipeline-3d-model', category: 'routeSegments',
      branchName: segment.branchName, fromNode: segment.fromNode, toNode: segment.toNode,
    },
    propertySetIds: [`pipeline:properties:${segment.id}`],
    editCapabilities: [],
    layer: 'pipeline-route',
    renderOrder: 10,
    metadata: { pipeline: segment },
  });
}

export function buildPipelineEngineeringSvgScene(snapshotValue, options = {}) {
  const viewModel = preparePipelineEngineeringSvgViewModel(snapshotValue);
  const sceneId = String(options.sceneId ?? '').trim();
  if (!sceneId) throw new TypeError('Pipeline engineering SVG requires an explicit sceneId.');
  const parity = assertPipelineEngineeringSvgParity(buildPipelineEngineeringSvgParityReport(viewModel));
  const entities = [
    ...viewModel.routeSegments.map(segmentEntity),
    ...viewModel.reviewRows.map(rowEntity),
  ];
  const scene = createEngineeringScene({
    sceneId,
    revision: viewModel.revision,
    coordinateSystem: { unit: 'mm', verticalAxis: 'Z', frame: 'GLOBAL', handedness: 'right' },
    projections: ['ISO', 'XY', 'XZ', 'YZ'],
    entities,
    capabilities: { selection: true, properties: true, editing: false },
    metadata: {
      pipeline: {
        authority: viewModel.authority,
        diagnostics: viewModel.diagnostics,
        parity,
        scenePropertySetId: `pipeline:scene-properties:${sceneId}`,
      },
    },
  });
  return Object.freeze({ scene, parity, viewModel });
}

export const _test = Object.freeze({
  samePoint, duplicateValues, coordinateRowMismatches,
  inputXmlCountMismatches, inputXmlValueMismatches,
});
