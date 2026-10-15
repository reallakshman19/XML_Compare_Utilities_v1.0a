import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  freezeJsonValue,
  validateEngineeringScene,
} from '../engineering-scene/index.js';
import { engineeringRevisionTokensEqual } from './engineering-svg-command-gateway.js';
import {
  createEngineeringDifferenceGeometry,
  engineeringDeltaMagnitude,
  engineeringGeometriesEqual,
  engineeringGeometryCentroid,
  engineeringPointDelta,
} from './engineering-svg-geometry-analysis.js';

export const ENGINEERING_SVG_OVERLAY_MODE = Object.freeze({
  AUTHORITATIVE_ONLY: 'authoritative-only',
  DRAFT_ONLY: 'draft-only',
  ORIGINAL_AND_DRAFT: 'original-and-draft',
  DIFFERENCES_ONLY: 'differences-only',
});

function overlayId(type, sourceId) {
  return `@esvg/overlay/${type}/${encodeURIComponent(sourceId)}`;
}

function overlayMetadata(entity, type, state, sourceId, extra = {}) {
  return {
    ...(entity.metadata || {}),
    engineeringSvgOverlay: { type, state, sourceEntityId: sourceId, ...extra },
  };
}

function classifyEntry(entry) {
  if (entry.original == null && entry.draft != null) return 'added';
  if (entry.original != null && entry.draft == null) return 'removed';
  if (entry.original == null && entry.draft == null) return 'unchanged';
  return engineeringGeometriesEqual(entry.original, entry.draft) ? 'unchanged' : 'changed';
}

function assertDraftMatchesScene(scene, draft) {
  if (!draft?.operationId) return;
  if (!engineeringRevisionTokensEqual(scene.revision, draft.baseRevision)) {
    throw new Error('Draft base revision does not match the authoritative scene.');
  }
}

function sourceEntityFor(id, entry, byId) {
  const source = byId.get(id) || null;
  const state = classifyEntry(entry);
  if (state === 'added') {
    if (source) throw new Error(`Added draft entity "${id}" already exists in the authoritative scene.`);
    if (!entry.entity) throw new TypeError(`Added draft entity "${id}" requires an entity descriptor.`);
    return createEngineeringSceneEntity({ ...entry.entity, id, geometry: entry.draft });
  }
  if (!source) throw new Error(`Draft entity "${id}" is missing from the authoritative scene.`);
  if (entry.original != null && !engineeringGeometriesEqual(source.geometry, entry.original)) {
    throw new Error(`Draft original geometry for "${id}" does not match the authoritative scene.`);
  }
  return source;
}

function authoritativeVisibility(mode, state) {
  if (mode === ENGINEERING_SVG_OVERLAY_MODE.AUTHORITATIVE_ONLY) return true;
  if (mode === ENGINEERING_SVG_OVERLAY_MODE.DIFFERENCES_ONLY) return false;
  if (state === 'changed' || state === 'removed') return false;
  return true;
}

function authoritativeEntity(entity, mode, state = null) {
  return createEngineeringSceneEntity({
    ...entity,
    visible: authoritativeVisibility(mode, state),
    metadata: state ? overlayMetadata(entity, 'authoritative', state, entity.id) : entity.metadata,
  });
}

function derivedEntity(source, type, state, geometry) {
  const layer = type === 'difference' ? 'difference' : type;
  return createEngineeringSceneEntity({
    ...source,
    id: overlayId(type, source.id),
    geometry,
    layer,
    selectable: type === 'draft' && source.selectable,
    domainRef: { owner: 'engineering-svg-core', sourceEntityId: source.id, overlayType: type },
    metadata: overlayMetadata(source, type, state, source.id),
  });
}

function differenceEntity(source, original, draft) {
  const start = engineeringGeometryCentroid(original);
  const end = engineeringGeometryCentroid(draft);
  const delta = engineeringPointDelta(start, end);
  const magnitude = engineeringDeltaMagnitude(delta);
  if (magnitude === 0) return null;
  return createEngineeringSceneEntity({
    id: overlayId('difference', source.id),
    kind: 'difference-vector',
    domainType: 'ENGINEERING_DIFFERENCE_VECTOR',
    geometry: createEngineeringDifferenceGeometry(original, draft),
    domainRef: { owner: 'engineering-svg-core', sourceEntityId: source.id, overlayType: 'difference' },
    propertySetIds: [],
    editCapabilities: [],
    layer: 'difference',
    renderOrder: source.renderOrder,
    visible: true,
    selectable: false,
    metadata: overlayMetadata(source, 'difference', 'changed', source.id, { delta, magnitude }),
  });
}

function overlaysFor(mode, source, state, entry) {
  if (mode === ENGINEERING_SVG_OVERLAY_MODE.AUTHORITATIVE_ONLY || state === 'unchanged') return [];
  const showComparison = [
    ENGINEERING_SVG_OVERLAY_MODE.ORIGINAL_AND_DRAFT,
    ENGINEERING_SVG_OVERLAY_MODE.DIFFERENCES_ONLY,
  ].includes(mode);
  const overlays = [];
  if (showComparison && ['changed', 'removed'].includes(state)) {
    overlays.push(derivedEntity(source, 'ghost', state, entry.original));
  }
  if (['changed', 'added'].includes(state)) overlays.push(derivedEntity(source, 'draft', state, entry.draft));
  if (showComparison && state === 'changed') {
    const difference = differenceEntity(source, entry.original, entry.draft);
    if (difference) overlays.push(difference);
  }
  return overlays;
}

function assertDerivedIdsAvailable(authoritativeIds, entities) {
  const ids = new Set(authoritativeIds);
  entities.forEach((entity) => {
    if (ids.has(entity.id)) throw new Error(`Engineering SVG overlay ID collision: "${entity.id}".`);
    ids.add(entity.id);
  });
}

export function composeEngineeringSvgDraftScene(sceneValue, draftValue, modeValue = 'original-and-draft') {
  const scene = validateEngineeringScene(sceneValue);
  const mode = Object.values(ENGINEERING_SVG_OVERLAY_MODE).includes(modeValue) ? modeValue : null;
  if (!mode) throw new TypeError(`Unsupported engineering SVG overlay mode "${modeValue}".`);
  const draft = freezeJsonValue(draftValue || { operationId: null, geometry: {}, properties: {} });
  assertDraftMatchesScene(scene, draft);
  const entries = Object.entries(draft.geometry || {}).sort(([left], [right]) => left.localeCompare(right));
  const byId = new Map(scene.entities.map((entity) => [entity.id, entity]));
  const states = new Map(entries.map(([id, entry]) => [id, classifyEntry(entry)]));
  const authoritative = scene.entities.map((entity) => authoritativeEntity(entity, mode, states.get(entity.id) || null));
  const derived = entries.flatMap(([id, entry]) => {
    const state = states.get(id);
    const source = sourceEntityFor(id, entry, byId);
    return overlaysFor(mode, source, state, entry);
  });
  assertDerivedIdsAvailable(scene.entities.map((entity) => entity.id), derived);
  return createEngineeringScene({
    ...scene,
    revision: createEngineeringRevisionToken({ authoritative: scene.revision.value, draft, mode }),
    entities: [...authoritative, ...derived],
    metadata: { ...scene.metadata, engineeringSvgOverlay: { operationId: draft.operationId, mode } },
  });
}

export function engineeringSvgOverlayEntityId(type, sourceId) {
  return overlayId(type, sourceId);
}
