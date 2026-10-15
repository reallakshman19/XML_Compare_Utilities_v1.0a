import { createLinewiseUniversalPreset } from './universal-xml-categorizer-contracts.js';

export const UNIVERSAL_VIEWPORT_CONTEXT_SCHEMA = 'universal-viewport-context/v1';

const CONTEXTS = new WeakMap();
const LEVELS = new Set(['element', 'node']);

const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const freeze = (value) => Object.freeze(value);

function scalarEntries(value = {}) {
  return Object.entries(value || {}).filter(([, item]) => item == null || typeof item !== 'object');
}

function scalarRow(record = {}) {
  const raw = record.rawSummary || record.compactFields || record.raw || {};
  return freeze(Object.fromEntries([...scalarEntries(raw), ...scalarEntries(record)]
    .map(([key, value]) => [text(key), value]).filter(([key]) => key)));
}

function first(record, names) {
  for (const name of names) {
    const value = record?.[name] ?? record?.raw?.[name] ?? record?.rawSummary?.[name]
      ?? record?.compactFields?.[name];
    if (text(value)) return value;
  }
  return '';
}

function lineLookupRow(record) {
  const from = first(record, ['FROM_NODE', 'fromNode', 'from']);
  const to = first(record, ['TO_NODE', 'toNode', 'to']);
  const line = first(record, ['LINE_ID', 'lineId', 'lineNo', 'line']);
  if (!text(from) && !text(to) && !text(line)) return null;
  return freeze({ FROM_NODE: from, TO_NODE: to, LINE_ID: line });
}

function coordinateRow(record) {
  const point = record?.position || record?.points?.[0] || null;
  const node = first(record, ['NODE', 'nodeNumber']);
  const x = first(record, ['GLOBAL_X', 'globalX', 'X']) || point?.x;
  const y = first(record, ['GLOBAL_Y', 'globalY', 'Y']) || point?.y;
  const z = first(record, ['GLOBAL_Z', 'globalZ', 'Z']) || point?.z;
  if (!text(node) || ![x, y, z].every((value) => text(value))) return null;
  return freeze({ NODE: node, GLOBAL_X: x, GLOBAL_Y: y, GLOBAL_Z: z });
}

function restraintRow(record) {
  const node = first(record, ['NODE', 'nodeNumber']);
  const type = first(record, ['TYPE', 'type', 'restraintType']);
  const tag = first(record, ['TAG', 'tag', 'restraintTag']);
  const evidence = `${record?.evidenceKind || ''} ${record?.blockName || ''}`;
  if (!text(node) || (!text(type) && !text(tag) && !/restraint/i.test(evidence))) return null;
  return freeze({
    NODE: node,
    TYPE: type,
    STIFFNESS: first(record, ['STIFFNESS', 'stiffness']),
    GAP: first(record, ['GAP', 'gap']),
    TAG: tag,
  });
}

function targetRow(record) {
  const levelId = text(record?.levelId) === 'lineBlock' ? 'line' : text(record?.levelId);
  if (!LEVELS.has(levelId)) return null;
  const row = { ...scalarRow(record), levelId };
  if (levelId === 'element') row.elementKey = first(record, ['elementKey', 'key']);
  if (levelId === 'node') row.nodeNumber = first(record, ['nodeNumber', 'NODE', 'key']);
  row.label = first(record, ['displayName', 'nodeName', 'label']);
  return freeze(row);
}

function compactRecords(records) {
  return freeze(arr(records).map(scalarRow));
}

function mappedRows(records, mapper) {
  return freeze(arr(records).map(mapper).filter(Boolean));
}

function stableSignature(input) {
  const json = JSON.stringify(input);
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `xmlb-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function contextDiagnostics({ loaded, sourceRecords, targetRecords, targetRows, sourceInputs }) {
  const items = [];
  if (loaded && !sourceRecords.length) items.push(diag('warn', 'XMLB_SOURCE_RECORDS_EMPTY', 'No loaded source records are available.'));
  if (loaded && !targetRecords.length) items.push(diag('warn', 'XMLB_TARGET_RECORDS_EMPTY', 'No loaded target/base records are available.'));
  if (loaded && targetRecords.length && !targetRows.length) items.push(diag('warn', 'XMLB_TARGET_LEVEL_IDENTITY_UNAVAILABLE', 'Loaded target records do not expose element/node level identity.'));
  for (const [sourceId, payload] of Object.entries(sourceInputs)) {
    if (sourceId !== 'mainXml' && !payload.rows.length) items.push(diag('info', 'XMLB_SOURCE_ROLE_EMPTY', `No evidence rows are available for ${sourceId}.`, sourceId));
  }
  return freeze(items);
}

function diag(severity, code, message, subjectId = '') {
  return freeze({ severity, code, message, subjectId });
}

export function createUniversalViewportContext(input = {}) {
  const workspace = input.workspace || {};
  const sourceRecords = arr(workspace.source?.baseRecords?.length
    ? workspace.source.baseRecords : workspace.source?.records);
  const targetRecords = arr(workspace.target?.baseRecords?.length
    ? workspace.target.baseRecords : workspace.target?.records);
  const loaded = Boolean(workspace.source?.fileName || workspace.target?.fileName
    || sourceRecords.length || targetRecords.length);
  const sourceInputs = freeze({
    mainXml: freeze({ rows: compactRecords(sourceRecords) }),
    lineIdLookup: freeze({ rows: mappedRows(sourceRecords, lineLookupRow) }),
    coordinateLookup: freeze({ rows: mappedRows(sourceRecords, coordinateRow) }),
    restraintLookup: freeze({ rows: mappedRows(sourceRecords, restraintRow) }),
  });
  const targetRows = mappedRows(targetRecords, targetRow);
  const signature = stableSignature({
    revision: Number(input.state?.workspaceRevision || 0),
    source: workspace.source?.fileName || '',
    target: workspace.target?.fileName || '',
    sourceIds: sourceRecords.map((row) => text(row?.uid || row?.key)),
    targetIds: targetRecords.map((row) => text(row?.uid || row?.key)),
  });
  const diagnostics = contextDiagnostics({ loaded, sourceRecords, targetRecords, targetRows, sourceInputs });
  return freeze({
    schema: UNIVERSAL_VIEWPORT_CONTEXT_SCHEMA,
    profile: input.profile || createLinewiseUniversalPreset(),
    status: loaded && targetRows.length ? 'loaded' : 'sample',
    loaded,
    usableLoaded: loaded && targetRows.length > 0,
    signature,
    sourceInputs,
    targetRows,
    diagnostics,
    sourceSummary: freeze({ fileName: workspace.source?.fileName || '', records: sourceRecords.length }),
    targetSummary: freeze({ fileName: workspace.target?.fileName || '', records: targetRecords.length }),
  });
}

export function publishUniversalViewportContext(doc, input = {}) {
  if (!doc || typeof doc !== 'object') return null;
  const context = createUniversalViewportContext(input);
  CONTEXTS.set(doc, context);
  return context;
}

export function readUniversalViewportContext(doc = globalThis.document) {
  return CONTEXTS.get(doc) || null;
}

export function clearUniversalViewportContext(doc = globalThis.document) {
  return CONTEXTS.delete(doc);
}

export const _test = freeze({ scalarRow, lineLookupRow, coordinateRow, restraintRow, targetRow, stableSignature });
