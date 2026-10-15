export const PIPELINE_CAD_PREVIEW_MODE_SCHEMA = 'PipelineCadPreviewMode.v1';
export const PIPELINE_CAD_PREVIEW_MODE_BUILD = '2026.07.14-pcad-001';
export const PIPELINE_CAD_PREVIEW_MODE_STORAGE_KEY = 'pipeline3dCadPreviewModeV1';
export const PIPELINE_CAD_PREVIEW_MODE_TABLE2 = 'table2x';
export const PIPELINE_CAD_PREVIEW_MODE_TABLE3 = 'table3x';
export const PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE = 'side-by-side';
export const PIPELINE_CAD_PREVIEW_MODE_OVERLAY = 'overlay';
export const PIPELINE_CAD_OVERLAY_FORMULA = 'Projected elevation = Z-origin elevation + Z';

const MODES = new Set([
  PIPELINE_CAD_PREVIEW_MODE_TABLE2,
  PIPELINE_CAD_PREVIEW_MODE_TABLE3,
  PIPELINE_CAD_PREVIEW_MODE_SIDE_BY_SIDE,
  PIPELINE_CAD_PREVIEW_MODE_OVERLAY,
]);

function finite(value, fallback = null) {
  if (value == null || String(value).trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizePipelineCadPreviewMode(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const mode = String(source.mode || '').toLowerCase();
  return Object.freeze({
    schema: PIPELINE_CAD_PREVIEW_MODE_SCHEMA,
    build: PIPELINE_CAD_PREVIEW_MODE_BUILD,
    mode: MODES.has(mode) ? mode : PIPELINE_CAD_PREVIEW_MODE_TABLE2,
    zOriginElevation: finite(source.zOriginElevation),
  });
}

export function readPipelineCadPreviewMode(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(PIPELINE_CAD_PREVIEW_MODE_STORAGE_KEY);
    return raw ? normalizePipelineCadPreviewMode(JSON.parse(raw)) : normalizePipelineCadPreviewMode();
  } catch {
    return normalizePipelineCadPreviewMode();
  }
}

export function writePipelineCadPreviewMode(value, storage = globalThis.localStorage) {
  const state = normalizePipelineCadPreviewMode(value);
  try {
    storage?.setItem?.(PIPELINE_CAD_PREVIEW_MODE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Preview preference persistence is best-effort only.
  }
  return state;
}

export function projectPipelineCadZToElevation(zOriginElevation, z) {
  const origin = finite(zOriginElevation);
  const zValue = finite(z);
  return origin == null || zValue == null ? null : origin + zValue;
}

export function derivePipelineCadDefaultZOrigin(model) {
  const rows = (model?.table2Rows || [])
    .filter((row) => Number.isFinite(row.stationValue) && Number.isFinite(row.elevationValue))
    .sort((a, b) => Number(a.stationValue) - Number(b.stationValue));
  return rows.length ? Number(rows[0].elevationValue) : 0;
}
