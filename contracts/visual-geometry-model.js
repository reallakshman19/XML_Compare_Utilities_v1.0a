/** Serializable VisualGeometryModel.v2 with revision and primitive identity. */

import { contractVector3, deepFreezeContractValue, requiredContractText } from './contract-values.js';

export const VISUAL_GEOMETRY_MODEL_SCHEMA = 'VisualGeometryModel.v2';

function normalizeSegment(segment, index) {
  if (!segment || typeof segment !== 'object') throw new TypeError(`Segment ${index + 1} is required.`);
  const objectId = requiredContractText(segment.objectId, `Segment ${index + 1} objectId`);
  return {
    ...segment, primitiveId: String(segment.primitiveId ?? `segment:${objectId}:${index}`), objectId,
    start: contractVector3(segment.start, `Segment ${index + 1} start`),
    end: contractVector3(segment.end, `Segment ${index + 1} end`),
  };
}

function normalizeMarker(marker, index) {
  if (!marker || typeof marker !== 'object') throw new TypeError(`Marker ${index + 1} is required.`);
  const objectId = String(marker.objectId ?? '').trim();
  const identity = objectId || requiredContractText(marker.nodeId, `Marker ${index + 1} objectId or nodeId`);
  return {
    ...marker, primitiveId: String(marker.primitiveId ?? `marker:${identity}:${index}`),
    objectId: objectId || null, position: contractVector3(marker.position, `Marker ${index + 1} position`),
  };
}

function normalizeBounds(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Visual bounds are required.');
  return Object.freeze({ min: contractVector3(value.min, 'Visual bounds min'), max: contractVector3(value.max, 'Visual bounds max') });
}

/** Validate identity, coordinates, metadata and primitive uniqueness. */
export function validateVisualGeometryModelV2(model) {
  const errors = [];
  if (model?.contract !== VISUAL_GEOMETRY_MODEL_SCHEMA || model?.schema !== VISUAL_GEOMETRY_MODEL_SCHEMA) errors.push(`contract and schema must be ${VISUAL_GEOMETRY_MODEL_SCHEMA}`);
  for (const key of ['modelId', 'documentId', 'revisionId', 'unit', 'coordinateFrame', 'verticalAxis']) if (!String(model?.[key] ?? '').trim()) errors.push(`${key} is required`);
  if (!Array.isArray(model?.origin) || model.origin.length !== 3 || model.origin.some((part) => !Number.isFinite(part))) errors.push('origin must be a finite XYZ vector');
  if (!Array.isArray(model?.segments) || !Array.isArray(model?.markers)) errors.push('segments and markers arrays are required');
  const ids = new Set();
  for (const primitive of [...(model?.segments ?? []), ...(model?.markers ?? [])]) {
    if (!String(primitive.primitiveId ?? '').trim()) errors.push('primitiveId is required');
    else if (ids.has(primitive.primitiveId)) errors.push(`duplicate primitiveId ${primitive.primitiveId}`);
    ids.add(primitive.primitiveId);
  }
  for (const segment of model?.segments ?? []) {
    for (const key of ['start', 'end']) if (!Array.isArray(segment[key]) || segment[key].length !== 3 || segment[key].some((part) => !Number.isFinite(part))) errors.push(`${segment.primitiveId} ${key} must be a finite XYZ vector`);
  }
  for (const marker of model?.markers ?? []) {
    if (!Array.isArray(marker.position) || marker.position.length !== 3 || marker.position.some((part) => !Number.isFinite(part))) errors.push(`${marker.primitiveId} position must be a finite XYZ vector`);
  }
  return Object.freeze(errors);
}

/** Upgrade legacy segment/marker geometry into an immutable v2 model. */
export function createVisualGeometryModelV2(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Visual geometry input is required.');
  const model = deepFreezeContractValue({
    contract: VISUAL_GEOMETRY_MODEL_SCHEMA, schema: VISUAL_GEOMETRY_MODEL_SCHEMA,
    modelId: requiredContractText(input.modelId, 'modelId'), documentId: requiredContractText(input.documentId, 'documentId'),
    revisionId: requiredContractText(input.revisionId, 'revisionId'), unit: requiredContractText(input.unit, 'unit'),
    coordinateFrame: requiredContractText(input.coordinateFrame, 'coordinateFrame'),
    verticalAxis: requiredContractText(input.verticalAxis, 'verticalAxis').toUpperCase(),
    origin: contractVector3(input.origin, 'origin'),
    segments: input.segments.map(normalizeSegment), markers: input.markers.map(normalizeMarker),
    bounds: normalizeBounds(input.bounds),
  });
  const errors = validateVisualGeometryModelV2(model);
  if (errors.length) throw new TypeError(`Invalid VisualGeometryModel.v2: ${errors.join('; ')}`);
  return model;
}
