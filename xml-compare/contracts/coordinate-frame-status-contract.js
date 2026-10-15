export const COORDINATE_FRAME_STATUS_SCHEMA = 'coordinate-frame-status/v1';

const MODES = new Set([
  'absolute',
  'relative-from-first-node',
  'sideload-global',
  'synthetic-disconnected-layout',
  'unknown',
]);

function clean(value) {
  return String(value ?? '').trim();
}

function modeOf(value) {
  const mode = clean(value);
  return MODES.has(mode) ? mode : 'unknown';
}

function warningsOf(items = []) {
  return Object.freeze((Array.isArray(items) ? items : [items]).map(clean).filter(Boolean));
}

export function createCoordinateFrameStatus(input = {}) {
  const mode = modeOf(input.mode);
  return Object.freeze({
    schema: COORDINATE_FRAME_STATUS_SCHEMA,
    sourceId: clean(input.sourceId),
    recordUid: clean(input.recordUid),
    mode,
    comparableForDelta: Boolean(input.comparableForDelta),
    basis: clean(input.basis),
    warnings: warningsOf(input.warnings),
  });
}

export function createCoordinateFrameSummary(statuses = []) {
  const normalized = (Array.isArray(statuses) ? statuses : []).map(createCoordinateFrameStatus);
  return Object.freeze({
    recordCount: normalized.length,
    absoluteCount: normalized.filter((item) => item.mode === 'absolute').length,
    relativeCount: normalized.filter((item) => item.mode === 'relative-from-first-node').length,
    sideloadGlobalCount: normalized.filter((item) => item.mode === 'sideload-global').length,
    syntheticLayoutCount: normalized.filter((item) => item.mode === 'synthetic-disconnected-layout').length,
    unknownCount: normalized.filter((item) => item.mode === 'unknown').length,
    comparableForDeltaCount: normalized.filter((item) => item.comparableForDelta).length,
    notComparableForDeltaCount: normalized.filter((item) => !item.comparableForDelta).length,
  });
}

export function coordinateFrameReadyForConnector(summary = {}) {
  const recordCount = Number(summary.recordCount) || 0;
  const synthetic = Number(summary.syntheticLayoutCount) || 0;
  const unknown = Number(summary.unknownCount) || 0;
  return recordCount > 0 && synthetic + unknown < recordCount;
}
