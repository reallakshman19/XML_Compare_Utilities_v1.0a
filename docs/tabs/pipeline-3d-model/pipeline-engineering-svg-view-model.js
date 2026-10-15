import {
  assertEngineeringRevisionToken,
  createEngineeringRevisionToken,
  freezeJsonValue,
} from '../../core/engineering-scene/index.js';

export const PIPELINE_ENGINEERING_SVG_VIEW_MODEL_SCHEMA = 'PipelineEngineeringSvgViewModel.v1';
export const PIPELINE_ENGINEERING_REVISION_SCHEMA = 'PipelineEngineeringRevision.v1';

const REQUIRED_REVISION_PARTS = Object.freeze([
  'projectRevision', 'geometryRevision', 'processConfigRevision',
]);

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function text(value) {
  return String(value ?? '').trim();
}
function finiteOrNull(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
function values(value) {
  return Array.isArray(value) ? value : [];
}
function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function requiredRevisionPart(parts, key) {
  if (!hasOwn(parts, key) || parts[key] === undefined) {
    throw new TypeError(`Pipeline engineering revision requires ${key}.`);
  }
  return parts[key];
}
export function createPipelineEngineeringRevisionToken(parts = {}) {
  const value = Object.fromEntries(REQUIRED_REVISION_PARTS.map((key) => [
    key, requiredRevisionPart(parts, key),
  ]));
  return createEngineeringRevisionToken({
    schema: PIPELINE_ENGINEERING_REVISION_SCHEMA,
    owner: 'pipeline-3d-model',
    ...value,
  });
}
function parseCoordinateText(source) {
  const lines = String(source ?? '').split(/\r?\n/).filter((line) => line.trim());
  return lines.slice(1).map((line, index) => {
    const [branchName, nodeNumber, x, y, z, nodeName = ''] = line.split('\t');
    return {
      sourceLine: index + 2,
      branchName: text(branchName),
      nodeNumber: finiteOrNull(nodeNumber),
      x: finiteOrNull(x),
      y: finiteOrNull(y),
      z: finiteOrNull(z),
      nodeName,
    };
  });
}
function xmlAttributes(source) {
  return Object.fromEntries([...String(source).matchAll(/([A-Z][A-Z0-9_]*)="([^"]*)"/g)]
    .map((match) => [match[1], match[2]]));
}
function decodeXml(value) {
  return String(value ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (match, entity) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
  }[entity] || match));
}
function parseBendElement(body) {
  const match = String(body ?? '').match(/<BEND\b([^>]*)\/>/);
  if (!match) return null;
  const attributes = xmlAttributes(match[1]);
  return {
    radius: finiteOrNull(attributes.RADIUS),
    type: finiteOrNull(attributes.TYPE),
    numMiter: finiteOrNull(attributes.NUM_MITER),
    nodes: [1, 2, 3].map((slot) => ({
      angle: finiteOrNull(attributes[`ANGLE${slot}`]),
      nodeNumber: finiteOrNull(attributes[`NODE${slot}`]),
    })),
  };
}
function parseInputXmlElements(source) {
  const pattern = /<PIPINGELEMENT\b([^>]*?)(?:\/>|>([\s\S]*?)<\/PIPINGELEMENT>)/g;
  return [...String(source ?? '').matchAll(pattern)].map((match, index) => {
    const attributes = xmlAttributes(match[1]);
    return {
      elementNumber: index + 1,
      fromNode: finiteOrNull(attributes.FROM_NODE),
      toNode: finiteOrNull(attributes.TO_NODE),
      deltaX: finiteOrNull(attributes.DELTA_X),
      deltaY: finiteOrNull(attributes.DELTA_Y),
      deltaZ: finiteOrNull(attributes.DELTA_Z),
      lineNo: decodeXml(attributes.LINE),
      fromName: decodeXml(attributes.FROM_NAME),
      toName: decodeXml(attributes.TO_NAME),
      bend: parseBendElement(match[2]),
    };
  });
}
function pointFromRow(row) {
  const point = { x: finiteOrNull(row.x), y: finiteOrNull(row.y), z: finiteOrNull(row.z) };
  return Object.values(point).every((value) => value !== null) ? point : null;
}
function ownerRowIdentity(row, role) {
  const branchName = text(row.branchName);
  const nodeNumber = finiteOrNull(row.nodeNumber);
  return branchName && Number.isInteger(nodeNumber)
    ? `pipeline:${branchName}:${role}:${nodeNumber}` : '';
}
function sources(combined) {
  const result = values(combined.sources).map(text).filter(Boolean);
  const source = text(combined.source);
  if (source && !result.includes(source)) result.push(source);
  return result;
}
function reviewCategory(eventSources) {
  if (eventSources.includes('marker')) return 'markers';
  if (eventSources.some((source) => source.startsWith('table3-z-'))) return 'depthEvents';
  if (eventSources.includes('table3-anchor')) return 'referenceEvents';
  if (eventSources.includes('table2')) return 'gradeEvents';
  if (eventSources.includes('vertex')) return 'routeVertices';
  return 'coordinateRows';
}
function reviewContractErrors(output, rows) {
  const errors = [];
  if (!Array.isArray(output.coordinateRows)) errors.push({ reason: 'REVIEW_LEDGER_NOT_ARRAY' });
  if (!rows.length) errors.push({ reason: 'REVIEW_LEDGER_EMPTY' });
  return errors;
}
function prepareReviewRows(output) {
  const combinedRows = values(output.combined).map(record);
  return values(output.coordinateRows).map((sourceRow, index) => {
    const row = record(sourceRow);
    const combined = combinedRows[index] || null;
    const eventSources = sources(combined || {});
    return {
      id: ownerRowIdentity(row, 'node'),
      category: reviewCategory(eventSources),
      branchName: text(row.branchName),
      nodeNumber: finiteOrNull(row.nodeNumber),
      nodeName: row.nodeName ?? '',
      point: pointFromRow(row),
      horizontal: finiteOrNull(row.horizontal ?? combined?.horizontal),
      grade: finiteOrNull(combined?.grade),
      elevationAuthority: text(combined?.elevationAuthority),
      eventSources,
      markerEvidence: values(combined?.markerEvidence).map(record),
      sourceIndex: index,
      ledgerSource: 'coordinateRows',
    };
  });
}
function explicitLineage(row) {
  const keys = ['sourceRowId', 'eventId', 'sourceIndex', 'nodeLineage', 'reviewRowId'];
  const lineage = Object.fromEntries(keys.filter((key) => hasOwn(row, key)).map((key) => [key, row[key]]));
  return Object.keys(lineage).length ? lineage : null;
}
function prepareGeometryRows(rawRows, ledgerSource) {
  return rawRows.map((sourceRow, index) => {
    const row = record(sourceRow);
    return {
      id: ownerRowIdentity(row, 'geometry-node'),
      branchName: text(row.branchName),
      nodeNumber: finiteOrNull(row.nodeNumber),
      nodeName: row.nodeName ?? '',
      point: pointFromRow(row),
      sourceIndex: index,
      ledgerSource,
      ownerLineage: explicitLineage(row),
    };
  });
}
function selectGeometryLedger(output, inputXmlElements) {
  const reviewRows = values(output.coordinateRows);
  if (hasOwn(output, 'inputXmlCoordinateRows')) {
    if (!Array.isArray(output.inputXmlCoordinateRows)) {
      return { mode: 'dual', source: 'inputXmlCoordinateRows', rows: [], errors: [{ reason: 'DUAL_GEOMETRY_LEDGER_NOT_ARRAY' }] };
    }
    const errors = output.inputXmlCoordinateRows.length >= 2 ? []
      : [{ reason: 'DUAL_GEOMETRY_LEDGER_TOO_SHORT', actual: output.inputXmlCoordinateRows.length }];
    return { mode: 'dual', source: 'inputXmlCoordinateRows', rows: output.inputXmlCoordinateRows, errors };
  }
  const expected = Math.max(0, reviewRows.length - 1);
  const errors = [];
  if (reviewRows.length < 2) errors.push({ reason: 'LEGACY_GEOMETRY_LEDGER_TOO_SHORT', actual: reviewRows.length });
  if (inputXmlElements.length !== expected) {
    errors.push({ reason: 'LEGACY_INPUTXML_COUNT_MISMATCH', expected, actual: inputXmlElements.length });
  }
  return { mode: 'legacy-single', source: 'coordinateRows', rows: reviewRows, errors };
}
function geometryContractErrors(rows, initialErrors) {
  const errors = [...initialErrors];
  const branches = new Set(rows.map((row) => row.branchName).filter(Boolean));
  if (branches.size > 1) errors.push({ reason: 'GEOMETRY_BRANCH_MISMATCH', branches: [...branches].sort() });
  rows.forEach((row) => {
    if (!row.id) errors.push({ reason: 'GEOMETRY_IDENTITY_INVALID', sourceIndex: row.sourceIndex });
  });
  return errors;
}
function prepareSegments(rows, xmlElements, ledgerSource) {
  return rows.slice(1).map((toRow, index) => {
    const fromRow = rows[index];
    const id = fromRow.branchName && fromRow.nodeNumber !== null && toRow.nodeNumber !== null
      ? `pipeline:${fromRow.branchName}:segment:${fromRow.nodeNumber}-${toRow.nodeNumber}` : '';
    return {
      id,
      category: 'routeSegments',
      branchName: fromRow.branchName,
      fromGeometryId: fromRow.id,
      toGeometryId: toRow.id,
      start: fromRow.point,
      end: toRow.point,
      fromNode: fromRow.nodeNumber,
      toNode: toRow.nodeNumber,
      fromName: fromRow.nodeName,
      toName: toRow.nodeName,
      delta: fromRow.point && toRow.point ? {
        x: toRow.point.x - fromRow.point.x,
        y: toRow.point.y - fromRow.point.y,
        z: toRow.point.z - fromRow.point.z,
      } : null,
      xmlElement: xmlElements[index] || null,
      sourceIndex: index,
      ledgerSource,
      ownerLineage: { from: fromRow.ownerLineage, to: toRow.ownerLineage },
    };
  });
}
function isPreparedViewModel(value) {
  return value?.schema === PIPELINE_ENGINEERING_SVG_VIEW_MODEL_SCHEMA
    && Array.isArray(value.reviewRows) && Array.isArray(value.geometryRows)
    && Array.isArray(value.routeSegments);
}
export function preparePipelineEngineeringSvgViewModel(snapshotValue) {
  if (isPreparedViewModel(snapshotValue)) {
    assertEngineeringRevisionToken(snapshotValue.revision, 'pipelineViewModel.revision');
    return freezeJsonValue(snapshotValue);
  }
  const snapshot = record(snapshotValue);
  const output = record(snapshot.output);
  const revision = assertEngineeringRevisionToken(snapshot.revision, 'pipelineSnapshot.revision');
  const coordinateTextRows = parseCoordinateText(output.coordinateText);
  const inputXmlElements = parseInputXmlElements(output.xmlText);
  const reviewRows = prepareReviewRows(output);
  const selected = selectGeometryLedger(output, inputXmlElements);
  const geometryRows = prepareGeometryRows(selected.rows, selected.source);
  const routeSegments = prepareSegments(geometryRows, inputXmlElements, selected.source);
  return freezeJsonValue({
    schema: PIPELINE_ENGINEERING_SVG_VIEW_MODEL_SCHEMA,
    revision,
    branchInfo: record(snapshot.branchInfo),
    ledgerMode: selected.mode,
    reviewRows,
    geometryRows,
    routeSegments,
    coordinateRows: reviewRows,
    coordinateTextRows,
    inputXmlElements,
    ledgerErrors: [
      ...reviewContractErrors(output, reviewRows),
      ...geometryContractErrors(geometryRows, selected.errors),
    ],
    diagnostics: record(output.diagnostics),
    warnings: values(output.warnings),
    authority: {
      outputContract: 'buildPipelineProjectOutputs',
      reviewPointSource: 'coordinateRows',
      routeGeometrySource: selected.source,
      inputXmlParitySource: 'xmlText',
      ledgerMode: selected.mode,
      unit: 'mm',
      verticalAxis: 'Z',
      frame: 'GLOBAL',
    },
  });
}
export const _test = Object.freeze({
  decodeXml, finiteOrNull, parseCoordinateText, parseInputXmlElements,
  reviewCategory, ownerRowIdentity, selectGeometryLedger,
});
