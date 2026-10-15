import { clamp, interpolateAbsoluteHFromCumulative, snapValue } from './pipeline-3d-model-cad-math.js';
import { PipelineCadObjectSnapMode } from './pipeline-3d-model-cad-object-snap-contracts.js';

export const PIPELINE_CAD_SNAP_STORAGE_KEY = 'pipeline3dCadSnapV1';

export const DEFAULT_PIPELINE_CAD_SNAP_SETTINGS = Object.freeze({
  gridEnabled: false,
  stationEnabled: false,
  stationStep: 0.5,
  elevationStep: 0.05,
  depthStep: 0.1,
  stationTolerance: 0.75,
  aboveGroundZ: 0.75,
  aboveGroundTolerance: 0.15,
  objectEnabled: false,
  objectAperture: 12,
  endpointEnabled: true,
  midpointEnabled: true,
  stationObjectEnabled: true,
  markerEnabled: true,
  nearestEnabled: true,
  projectionEnabled: true,
  intersectionEnabled: true,
});

const positive = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};
const nonNegative = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};
const boolean = (value, fallback) => value == null ? fallback : Boolean(value);

export function normalizePipelineCadSnapSettings(settings = {}) {
  const defaults = DEFAULT_PIPELINE_CAD_SNAP_SETTINGS;
  return Object.freeze({
    gridEnabled: Boolean(settings.gridEnabled),
    stationEnabled: Boolean(settings.stationEnabled),
    stationStep: positive(settings.stationStep, defaults.stationStep),
    elevationStep: positive(settings.elevationStep, defaults.elevationStep),
    depthStep: positive(settings.depthStep, defaults.depthStep),
    stationTolerance: nonNegative(settings.stationTolerance, defaults.stationTolerance),
    aboveGroundZ: Number.isFinite(Number(settings.aboveGroundZ)) ? Number(settings.aboveGroundZ) : defaults.aboveGroundZ,
    aboveGroundTolerance: nonNegative(settings.aboveGroundTolerance, defaults.aboveGroundTolerance),
    objectEnabled: boolean(settings.objectEnabled, defaults.objectEnabled),
    objectAperture: positive(settings.objectAperture, defaults.objectAperture),
    endpointEnabled: boolean(settings.endpointEnabled, defaults.endpointEnabled),
    midpointEnabled: boolean(settings.midpointEnabled, defaults.midpointEnabled),
    stationObjectEnabled: boolean(settings.stationObjectEnabled, defaults.stationObjectEnabled),
    markerEnabled: boolean(settings.markerEnabled, defaults.markerEnabled),
    nearestEnabled: boolean(settings.nearestEnabled, defaults.nearestEnabled),
    projectionEnabled: boolean(settings.projectionEnabled, defaults.projectionEnabled),
    intersectionEnabled: boolean(settings.intersectionEnabled, defaults.intersectionEnabled),
  });
}

export function pipelineCadObjectSnapModes(settings = {}) {
  const value = normalizePipelineCadSnapSettings(settings);
  const pairs = [
    [PipelineCadObjectSnapMode.ENDPOINT, value.endpointEnabled],
    [PipelineCadObjectSnapMode.MIDPOINT, value.midpointEnabled],
    [PipelineCadObjectSnapMode.STATION, value.stationObjectEnabled],
    [PipelineCadObjectSnapMode.MARKER, value.markerEnabled],
    [PipelineCadObjectSnapMode.NEAREST, value.nearestEnabled],
    [PipelineCadObjectSnapMode.PROJECTION, value.projectionEnabled],
    [PipelineCadObjectSnapMode.INTERSECTION, value.intersectionEnabled],
  ];
  return Object.freeze(pairs.filter(([, enabled]) => enabled).map(([mode]) => mode));
}

export function roundToSnapStep(value, step) {
  const number = Number(value);
  const spacing = Number(step);
  if (!Number.isFinite(number)) throw new TypeError('Snap value must be finite.');
  if (!Number.isFinite(spacing) || spacing <= 0) throw new TypeError('Snap step must be positive.');
  const snapped = Math.round(number / spacing) * spacing;
  return Math.abs(snapped) < 1e-12 ? 0 : Number(snapped.toFixed(9));
}

function uniqueFinite(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).map((value) => Number(value.toFixed(9))))];
}

export function table2StationCandidates(model, excludeIds = []) {
  const excluded = new Set(excludeIds || []);
  return uniqueFinite((model?.table2Rows || []).filter((row) => !excluded.has(row.id)).map((row) => row.stationValue));
}

export function table3StationCandidates(model) {
  return uniqueFinite(model?.coordinateMap?.anchors?.map((anchor) => anchor.cumulative) || []);
}

export function snapTable2Elevation(value, settings = {}) {
  const normalized = normalizePipelineCadSnapSettings(settings);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError('Elevation must be finite.');
  return normalized.gridEnabled ? roundToSnapStep(number, normalized.elevationStep) : number;
}

export function snapTable2Station(value, model, settings = {}, options = {}) {
  const normalized = normalizePipelineCadSnapSettings(settings);
  let station = Number(value);
  if (!Number.isFinite(station)) throw new TypeError('Station must be finite.');
  if (normalized.gridEnabled) station = roundToSnapStep(station, normalized.stationStep);
  if (normalized.stationEnabled) station = snapValue(station, table2StationCandidates(model, options.excludeIds), normalized.stationTolerance);
  const min = Number(options.min);
  const max = Number(options.max);
  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) station = clamp(station, min, max);
  return station;
}

export function snapTable3Cumulative(value, model, settings = {}) {
  const normalized = normalizePipelineCadSnapSettings(settings);
  let cumulative = Number(value);
  if (!Number.isFinite(cumulative)) throw new TypeError('Cumulative station must be finite.');
  if (normalized.gridEnabled) cumulative = roundToSnapStep(cumulative, normalized.stationStep);
  if (normalized.stationEnabled) cumulative = snapValue(cumulative, table3StationCandidates(model), normalized.stationTolerance);
  const min = Number(model?.coordinateMap?.cumulativeMin);
  const max = Number(model?.coordinateMap?.cumulativeMax);
  if (Number.isFinite(min) && Number.isFinite(max)) cumulative = clamp(cumulative, min, max);
  return cumulative;
}

export function snapTable3Depth(value, settings = {}) {
  const normalized = normalizePipelineCadSnapSettings(settings);
  let z = Number(value);
  if (!Number.isFinite(z)) throw new TypeError('Depth Z must be finite.');
  if (z >= -normalized.aboveGroundTolerance) return normalized.aboveGroundZ;
  if (normalized.gridEnabled) z = roundToSnapStep(z, normalized.depthStep);
  return z;
}

export function snapTable3CommittedDepth(value, settings = {}) {
  const normalized = normalizePipelineCadSnapSettings(settings);
  const z = snapTable3Depth(value, normalized);
  if (z >= -normalized.aboveGroundTolerance) return normalized.aboveGroundZ;
  return -Number(Math.abs(z).toFixed(1));
}

export function snapTable3Point(point, model, settings = {}) {
  const cumulative = snapTable3Cumulative(point?.cumulative ?? point?.x, model, settings);
  const z = snapTable3Depth(point?.z ?? point?.y, settings);
  return Object.freeze({ cumulative, absoluteH: interpolateAbsoluteHFromCumulative(cumulative, model.coordinateMap), z });
}

export function loadPipelineCadSnapSettings(graphName, storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(PIPELINE_CAD_SNAP_STORAGE_KEY) || '{}');
    return normalizePipelineCadSnapSettings(parsed?.[graphName]);
  } catch {
    return normalizePipelineCadSnapSettings();
  }
}

export function savePipelineCadSnapSettings(graphName, settings, storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(PIPELINE_CAD_SNAP_STORAGE_KEY) || '{}');
    parsed[graphName] = normalizePipelineCadSnapSettings(settings);
    storage?.setItem?.(PIPELINE_CAD_SNAP_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Snap preference persistence is best-effort only.
  }
}

export function describePipelineCadSnapSettings(settings = {}) {
  const normalized = normalizePipelineCadSnapSettings(settings);
  const modes = [];
  if (normalized.gridEnabled) modes.push('Grid');
  if (normalized.stationEnabled) modes.push('Station');
  const hasObjectSetting = Object.prototype.hasOwnProperty.call(settings || {}, 'objectEnabled');
  if (hasObjectSetting && normalized.objectEnabled) modes.push('Object');
  return modes.length ? `${modes.join(' + ')} snap` : 'Snap off';
}
