import { parseCoordinateSideloadTable } from './XmlCompareCoordinateSideload.js';
import {
  createSideloadDiagnostic,
  normalizeSideloadDiagnostic,
} from './XmlCompareSideloadDiagnostics.js';
import {
  normalizeNode,
  pairKey,
  parseLineIdRows,
  parseNodeNameRows,
  parseRestraintTagRows,
  rowIdentity,
  tagKeys,
} from './XmlCompareSideloadTableParser.js';

export const XML_COMPARE_SIDELOAD_INDEX_SCHEMA = 'xml-compare-sideload-index/v1';

const clean = (value) => String(value ?? '').trim();

export function popupFieldValue(name) {
  try {
    if (typeof document === 'undefined') return '';
    return document.querySelector(`[data-xml-compare-sideload-field="${name}"]`)?.value || '';
  } catch {
    return '';
  }
}

export function normalizeSideloadTables(tables = {}) {
  const explicitCoordinateText = clean(tables.coordinateText);
  return Object.freeze({
    ...tables,
    coordinateText: explicitCoordinateText || popupFieldValue('coordinateText'),
    coordinateSource: explicitCoordinateText ? 'argument' : 'popup-dom-fallback',
  });
}

function sourceRowRead(row, sourceField) {
  return createSideloadDiagnostic({
    code: 'SIDELOAD_SOURCE_ROW_READ',
    message: `${rowIdentity(row)} was parsed.`,
    stage: 'table-parse',
    sourceField,
    sourceRow: row.sourceRow,
    action: 'read',
    context: { rowId: row.rowId },
  });
}

function sourceRowSkipped(row, sourceField, message) {
  return createSideloadDiagnostic({
    severity: 'WARNING',
    code: 'SIDELOAD_ROW_SKIPPED',
    message,
    stage: 'table-parse',
    sourceField,
    sourceRow: row.sourceRow,
    action: 'skipped',
    context: { rowId: row.rowId },
  });
}

function duplicateDiagnostic(key, previous, current, sourceField) {
  return createSideloadDiagnostic({
    severity: 'WARNING',
    code: 'SIDELOAD_DUPLICATE_KEY',
    message: `Duplicate ${sourceField} key ${key}; the later row is authoritative.`,
    stage: 'index-build',
    sourceField,
    sourceRow: current.row.sourceRow,
    action: 'superseded',
    context: {
      key,
      previousRow: previous.row.sourceRow,
      selectedRow: current.row.sourceRow,
    },
  });
}

function setIndexedValue(map, key, candidate, diagnostics, sourceField) {
  const previous = map.get(key);
  if (previous) diagnostics.push(duplicateDiagnostic(key, previous, candidate, sourceField));
  map.set(key, candidate);
}

function validPairRow(row, sourceField, diagnostics) {
  if (normalizeNode(row.from) && normalizeNode(row.to)) return true;
  diagnostics.push(sourceRowSkipped(row, sourceField, 'FROM_NODE and TO_NODE are required.'));
  return false;
}

function buildLineIdIndex(rows, diagnostics) {
  const map = new Map();
  for (const row of rows) {
    diagnostics.push(sourceRowRead(row, 'lineIdText'));
    if (!validPairRow(row, 'lineIdText', diagnostics)) continue;
    if (!clean(row.lineId)) {
      diagnostics.push(sourceRowSkipped(row, 'lineIdText', 'LINE_ID is empty.'));
      continue;
    }
    const candidate = Object.freeze({ value: clean(row.lineId), row });
    setIndexedValue(map, pairKey(row.from, row.to), candidate, diagnostics, 'LINE_ID');
  }
  return map;
}

function buildNodeNameIndex(rows, diagnostics) {
  const map = new Map();
  for (const row of rows) {
    diagnostics.push(sourceRowRead(row, 'nodeNameText'));
    if (!validPairRow(row, 'nodeNameText', diagnostics)) continue;
    if (!clean(row.fromName) && !clean(row.toName)) {
      diagnostics.push(sourceRowSkipped(row, 'nodeNameText', 'FROM_NAME and TO_NAME are both empty.'));
      continue;
    }
    const candidate = Object.freeze({
      fromName: clean(row.fromName),
      toName: clean(row.toName),
      row,
    });
    setIndexedValue(map, pairKey(row.from, row.to), candidate, diagnostics, 'node names');
  }
  return map;
}

function ignoredTagPairDiagnostic(row) {
  return createSideloadDiagnostic({
    severity: 'WARNING',
    code: 'SIDELOAD_SOURCE_FIELD_IGNORED',
    message: 'Restraint FROM_NODE/TO_NODE columns are not used by the current global matcher.',
    stage: 'index-build',
    sourceField: 'restraintTagText.from/to',
    sourceRow: row.sourceRow,
    action: 'ignored',
    context: { from: clean(row.from), to: clean(row.to), node: normalizeNode(row.node) },
  });
}

function buildTagCandidates(rows, diagnostics) {
  const exact = new Map();
  const nodeType = new Map();
  const byNode = new Map();
  for (const row of rows) {
    diagnostics.push(sourceRowRead(row, 'restraintTagText'));
    if (clean(row.from) || clean(row.to)) diagnostics.push(ignoredTagPairDiagnostic(row));
    if (!normalizeNode(row.node) || !clean(row.tag)) {
      diagnostics.push(sourceRowSkipped(row, 'restraintTagText', 'NODE and TAG are required.'));
      continue;
    }
    const candidate = Object.freeze({ value: clean(row.tag), row });
    const keys = tagKeys(row);
    setIndexedValue(exact, keys.exact, candidate, diagnostics, 'restraint exact');
    setIndexedValue(nodeType, keys.nodeType, candidate, diagnostics, 'restraint node/type');
    byNode.set(keys.node, [...(byNode.get(keys.node) || []), candidate]);
  }
  return Object.freeze({ exact, nodeType, byNode });
}

function buildUniqueNodeTags(byNode, diagnostics) {
  const unique = new Map();
  const ambiguous = new Set();
  for (const [node, candidates] of byNode.entries()) {
    const values = [...new Set(candidates.map((candidate) => candidate.value))];
    if (values.length === 1) {
      unique.set(node, candidates[candidates.length - 1]);
      continue;
    }
    ambiguous.add(node);
    diagnostics.push(createSideloadDiagnostic({
      severity: 'WARNING',
      code: 'SIDELOAD_AMBIGUOUS_TAG',
      message: `Node ${node} has multiple tags; unique-node fallback is disabled.`,
      stage: 'index-build',
      sourceField: 'restraintTagText',
      action: 'ambiguous',
      context: {
        node,
        tags: values,
        sourceRows: candidates.map((candidate) => candidate.row.sourceRow),
      },
    }));
  }
  return Object.freeze({ unique, ambiguous });
}

function coordinateDiagnosticRecords(table, source, rawText) {
  const records = table.diagnostics.map(normalizeSideloadDiagnostic);
  if (source === 'popup-dom-fallback' && clean(rawText)) {
    records.push(createSideloadDiagnostic({
      severity: 'WARNING',
      code: 'SIDELOAD_IMPLICIT_DOM_INPUT',
      message: 'Coordinate text came from the popup DOM because the caller omitted coordinateText.',
      stage: 'input-normalization',
      sourceField: 'coordinateText',
      action: 'fallback',
    }));
  }
  return records;
}

function coordinateSourceRows(coordinates) {
  return coordinates.map((row) => createSideloadDiagnostic({
    code: 'SIDELOAD_SOURCE_ROW_READ',
    message: `coordinate row ${row.sourceRow} was parsed.`,
    stage: 'table-parse',
    sourceField: 'coordinateText',
    sourceRow: row.sourceRow,
    action: 'read',
    context: { node: normalizeNode(row.node) },
  }));
}

function originMap(coordinates = []) {
  return new Map(coordinates.map((row) => [
    normalizeNode(row.node),
    { x: row.x, y: row.y, z: row.z, sourceRow: row.sourceRow },
  ]));
}

function parseIndexInput(input) {
  const tables = normalizeSideloadTables(input);
  const coordinateTable = parseCoordinateSideloadTable(tables.coordinateText);
  return Object.freeze({
    tables,
    coordinateTable,
    lineIdRows: parseLineIdRows(tables.lineIdText),
    nodeNameRows: parseNodeNameRows(tables.nodeNameText),
    tagRows: parseRestraintTagRows(tables.restraintTagText),
  });
}

function initialDiagnostics(parsed) {
  return [
    ...coordinateDiagnosticRecords(
      parsed.coordinateTable,
      parsed.tables.coordinateSource,
      parsed.tables.coordinateText,
    ),
    ...coordinateSourceRows(parsed.coordinateTable.coordinates),
  ];
}

export function buildXmlCompareSideloadIndex(input = {}) {
  const parsed = parseIndexInput(input);
  const diagnostics = initialDiagnostics(parsed);
  const tags = buildTagCandidates(parsed.tagRows, diagnostics);
  const nodeTags = buildUniqueNodeTags(tags.byNode, diagnostics);
  return Object.freeze({ schema: XML_COMPARE_SIDELOAD_INDEX_SCHEMA,
    lineIdRows: parsed.lineIdRows,
    nodeNameRows: parsed.nodeNameRows,
    tagRows: parsed.tagRows,
    lineIds: buildLineIdIndex(parsed.lineIdRows, diagnostics),
    nodeNames: buildNodeNameIndex(parsed.nodeNameRows, diagnostics),
    tagExact: tags.exact,
    tagNodeType: tags.nodeType,
    tagNode: nodeTags.unique,
    ambiguousTagNodes: nodeTags.ambiguous,
    nodeCoordinates: originMap(parsed.coordinateTable.coordinates),
    diagnostics: Object.freeze(diagnostics),
    stats: Object.freeze({ lineIdRows: parsed.lineIdRows.length,
      nodeNameRows: parsed.nodeNameRows.length,
      tagRows: parsed.tagRows.length,
      coordinateRows: parsed.coordinateTable.coordinates.length,
    }),
  });
}

export const _test = Object.freeze({
  clean,
  sourceRowRead,
  sourceRowSkipped,
  duplicateDiagnostic,
  validPairRow,
  buildLineIdIndex,
  buildNodeNameIndex,
  buildTagCandidates,
  buildUniqueNodeTags,
  coordinateDiagnosticRecords,
  parseIndexInput,
  initialDiagnostics,
  originMap,
});
