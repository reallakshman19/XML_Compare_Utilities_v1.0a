import {
  createCoordinateFrameStatus,
  createCoordinateFrameSummary,
} from '../contracts/coordinate-frame-status-contract.js';

function clean(value) {
  return String(value ?? '').trim();
}

function firstValue(...values) {
  return values.map(clean).find(Boolean) || '';
}

function rawOf(record = {}) {
  return record.raw || record.rawSummary || record.attributes || {};
}

function coord(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value.X), y = Number(value.y ?? value.Y), z = Number(value.z ?? value.Z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function hasCoordinate(record = {}) {
  return Boolean(coord(record.position) || coord(record.centrePoint) || coord(record.coOrds) || (Array.isArray(record.points) && record.points.some(coord)));
}

function explicitMode(record = {}) {
  const raw = rawOf(record);
  return firstValue(record.coordinateFrameMode, record.coordinateMode, record.coordinateFrame, record.coordinateFrameStatus?.mode, raw.coordinateFrameMode, raw.coordinateMode);
}

function basisOf(record = {}) {
  const raw = rawOf(record);
  return firstValue(record.coordinateBasis, record.coordinateBasisNode, record.GLOBAL_COORD_BASIS_NODE, record.BasisNode, raw.coordinateBasis, raw.coordinateBasisNode, raw.GLOBAL_COORD_BASIS_NODE);
}

function hasGlobalFields(record = {}) {
  const raw = rawOf(record);
  return ['globalX', 'globalY', 'globalZ', 'GLOBAL_X', 'GLOBAL_Y', 'GLOBAL_Z'].some((key) => clean(record[key] ?? raw[key]));
}

function hasDeltaFields(record = {}) {
  const raw = rawOf(record);
  return ['DELTA_X', 'DELTA_Y', 'DELTA_Z'].some((key) => clean(record[key] ?? raw[key]));
}

function isSynthetic(record = {}) {
  const raw = rawOf(record);
  const text = [record.placementMode, record.coordinateFrameMode, record.coordinateMode, raw.placementMode, raw.coordinateFrameMode].map(clean).join(' ').toLowerCase();
  return text.includes('synthetic');
}

function comparable(mode, basis) {
  if (mode === 'absolute' || mode === 'sideload-global') return true;
  if (mode === 'relative-from-first-node') return Boolean(basis);
  return false;
}

function modeWarnings(mode, basis) {
  if (mode === 'synthetic-disconnected-layout') return ['synthetic layout is not engineering-delta comparable'];
  if (mode === 'unknown') return ['coordinate frame is unknown'];
  if (mode === 'relative-from-first-node' && !basis) return ['relative coordinate basis is not declared'];
  if (mode === 'sideload-global' && !basis) return ['sideload global basis is not declared'];
  return [];
}

export function buildCoordinateFrameStatus(record = {}, options = {}) {
  const sourceId = clean(options.sourceId);
  const recordUid = clean(record.uid || record.id || `record:${Number(options.index || 0) + 1}`);
  const basis = basisOf(record);
  let mode = explicitMode(record);
  if (!mode && isSynthetic(record)) mode = 'synthetic-disconnected-layout';
  if (!mode && (hasGlobalFields(record) || basis)) mode = 'sideload-global';
  if (!mode && hasCoordinate(record)) mode = 'absolute';
  if (!mode && hasDeltaFields(record)) mode = 'relative-from-first-node';
  if (!mode) mode = 'unknown';
  return createCoordinateFrameStatus({ sourceId, recordUid, mode, basis, comparableForDelta: comparable(mode, basis), warnings: modeWarnings(mode, basis) });
}

export function buildCoordinateFrameStatuses(records = [], options = {}) {
  return Object.freeze((Array.isArray(records) ? records : []).map((record, index) => buildCoordinateFrameStatus(record, { ...options, index })));
}

export function buildCoordinateFrameStatusSummary(records = [], options = {}) {
  return createCoordinateFrameSummary(buildCoordinateFrameStatuses(records, options));
}
