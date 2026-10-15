import {
  formatDepth,
  formatStation,
  interpolateAbsoluteHFromCumulative,
  interpolateCumulativeFromAbsoluteH,
  parseDepthText,
} from './pipeline-3d-model-cad-math.js';
import {
  createPipelineCadPrecisionResult,
  createPipelineCadPrecisionSession,
} from './pipeline-3d-model-cad-precision-contracts.js';
import { parsePipelineCadPrecisionFields } from './pipeline-3d-model-cad-precision-parser.js';

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite.`);
  return number;
}

function rowFor(model, entityId) {
  const row = model?.findRow?.(entityId);
  if (!row) throw new Error(`Unknown selected entity: ${entityId}.`);
  return row;
}

function table2Before(row) {
  return Object.freeze({ station: finite(row.stationValue, 'Station'), elevation: finite(row.elevationValue, 'Elevation') });
}

function table3DepthBefore(model, row) {
  const absoluteH = finite(row.absoluteH ?? row.textPositionH, 'Absolute H');
  return Object.freeze({
    cumulative: interpolateCumulativeFromAbsoluteH(absoluteH, model.coordinateMap),
    absoluteH,
    z: finite(row.z, 'Depth Z'),
    zText: row.zText || formatDepth(row.z),
  });
}

function markerBefore(model, row) {
  const absoluteH = finite(row.absoluteH, 'Marker absolute H');
  return Object.freeze({
    cumulative: interpolateCumulativeFromAbsoluteH(absoluteH, model.coordinateMap),
    absoluteH,
    label: String(row.markerText ?? '').trim(),
  });
}

export function readPipelineCadPrecisionBefore(model, identity = {}) {
  const row = rowFor(model, identity.entityId);
  if (identity.graph === 'table2x') return table2Before(row);
  if (identity.entityType === 'depth-node') return table3DepthBefore(model, row);
  if (identity.entityType === 'marker') return markerBefore(model, row);
  throw new Error(`Unsupported precision entity type: ${identity.entityType}.`);
}

function relative(base, delta, mode) {
  return delta == null ? base : mode === 'relative' ? base + delta : delta;
}

function validateTable2Order(model, entityId, station) {
  const rows = model.table2Rows.filter((row) => Number.isFinite(row.stationValue));
  const index = rows.findIndex((row) => row.id === entityId);
  if (index < 0) throw new Error('Selected Table 2 row is unavailable.');
  const previous = rows[index - 1]?.stationValue;
  const next = rows[index + 1]?.stationValue;
  if (Number.isFinite(previous) && station <= previous) throw new Error(`Station must be greater than ${formatStation(previous)}.`);
  if (Number.isFinite(next) && station >= next) throw new Error(`Station must be less than ${formatStation(next)}.`);
}

function stageTable2(model, identity, before, parsed) {
  const station = relative(before.station, parsed.x, parsed.inputMode);
  const elevation = relative(before.elevation, parsed.y, parsed.inputMode);
  validateTable2Order(model, identity.entityId, station);
  return Object.freeze({ station, elevation });
}

function normalizeDepth(value) {
  const text = formatDepth(value);
  const parsed = parseDepthText(text);
  return Object.freeze({ z: parsed?.z ?? value, zText: text });
}

function stageDepth(model, before, parsed, coordinateMode) {
  let cumulative = before.cumulative;
  let absoluteH = before.absoluteH;
  if (parsed.x != null && coordinateMode === 'absolute-h') {
    absoluteH = relative(before.absoluteH, parsed.x, parsed.inputMode);
    cumulative = interpolateCumulativeFromAbsoluteH(absoluteH, model.coordinateMap, { clamp: false });
  } else if (parsed.x != null) {
    cumulative = relative(before.cumulative, parsed.x, parsed.inputMode);
    absoluteH = interpolateAbsoluteHFromCumulative(cumulative, model.coordinateMap, { clamp: false });
  }
  const depth = normalizeDepth(relative(before.z, parsed.y, parsed.inputMode));
  return Object.freeze({ cumulative, absoluteH, z: depth.z, zText: depth.zText });
}

function stageMarker(model, before, parsed, coordinateMode) {
  let cumulative = before.cumulative;
  let absoluteH = before.absoluteH;
  if (parsed.x != null && coordinateMode === 'absolute-h') {
    absoluteH = relative(before.absoluteH, parsed.x, parsed.inputMode);
    cumulative = interpolateCumulativeFromAbsoluteH(absoluteH, model.coordinateMap, { clamp: false });
  } else if (parsed.x != null) {
    cumulative = relative(before.cumulative, parsed.x, parsed.inputMode);
    absoluteH = interpolateAbsoluteHFromCumulative(cumulative, model.coordinateMap, { clamp: false });
  }
  return Object.freeze({ cumulative, absoluteH, label: parsed.label || before.label });
}

export function stagePipelineCadPrecisionEdit(input = {}) {
  const { model, identity = {}, fields = {} } = input;
  const before = readPipelineCadPrecisionBefore(model, identity);
  const parsed = parsePipelineCadPrecisionFields(fields, { depth: identity.entityType === 'depth-node' });
  const coordinateMode = fields.coordinateMode === 'absolute-h' ? 'absolute-h' : 'cumulative';
  let staged;
  if (identity.graph === 'table2x') staged = stageTable2(model, identity, before, parsed);
  else if (identity.entityType === 'depth-node') staged = stageDepth(model, before, parsed, coordinateMode);
  else staged = stageMarker(model, before, parsed, coordinateMode);
  return createPipelineCadPrecisionSession({
    sessionId: input.sessionId,
    graph: identity.graph,
    entityId: identity.entityId,
    entityType: identity.entityType,
    sourceRevision: model.revision,
    coordinateMode,
    inputMode: parsed.inputMode,
    source: input.source || 'typed',
    before,
    requested: parsed,
    staged,
    valid: true,
  });
}

export function precisionCommandReason(session) {
  if (session.graph === 'table2x') return 'move-table2-node';
  return session.entityType === 'marker' ? 'move-table3-marker' : 'move-table3-depth';
}

export function precisionCanvasValues(session, values = session.staged) {
  if (session.graph === 'table2x') return Object.freeze({
    stationValue: values.station,
    elevationValue: values.elevation,
  });
  if (session.entityType === 'marker') return Object.freeze({
    cumulative: values.cumulative,
    absoluteH: values.absoluteH,
    markerText: values.label,
  });
  return Object.freeze({
    cumulative: values.cumulative,
    absoluteH: values.absoluteH,
    z: values.z,
    zText: values.zText,
  });
}

export function precisionMoveDetail(session) {
  return Object.freeze({
    graph: session.graph,
    entityId: session.entityId,
    entityType: session.entityType,
    before: precisionCanvasValues(session, session.before),
    after: precisionCanvasValues(session, session.staged),
    commitReason: 'precision-edit',
    commandReason: precisionCommandReason(session),
  });
}

export function resultForPrecisionSession(session) {
  return createPipelineCadPrecisionResult({
    session,
    before: session.before,
    after: session.staged,
    reason: precisionCommandReason(session),
  });
}

export const _test = Object.freeze({ normalizeDepth, relative, validateTable2Order });
