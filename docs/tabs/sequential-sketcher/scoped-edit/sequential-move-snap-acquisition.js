/** Deterministic explicit acquisition of reviewable Sequential move snap candidates. */
import {
  createEngineeringSnapCandidate,
  validateEngineeringScene,
} from '../../../core/engineering-scene/index.js';
import { rankEngineeringSvgSnapCandidates } from '../../../core/engineering-svg/engineering-svg-snap-ranking.js';
import { sameSequentialContractValue } from './sequential-command-contracts.js';
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';
import {
  SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA,
  createSequentialMoveSnapAcquisition,
  createSequentialMoveSnapProfile,
  normalizeSequentialSnapPoint,
} from './sequential-move-snap-contracts.js';
import { deriveSequentialMoveSnapIntersectionCandidates } from './sequential-move-snap-intersections.js';
import { deriveSequentialMoveSnapSourceCandidates } from './sequential-move-snap-sources.js';
import { createSequentialMoveConstraint } from './sequential-single-entity-move-geometry.js';
import { validateSequentialSingleEntityMoveTarget } from './sequential-single-entity-move-target.js';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function finiteScreenPoint(value, label) {
  const point = { x: Number(value?.x), y: Number(value?.y) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must contain finite x and y values.`);
  }
  return point;
}

function projectWorld(projectPoint, worldPoint) {
  const projected = projectPoint([worldPoint.x, worldPoint.y, worldPoint.z]);
  if (projected == null) return null;
  return finiteScreenPoint(projected, 'Projected snap point');
}

function engineeringCandidate(raw, rawScreen, screenPoint, context) {
  const distance = Math.hypot(screenPoint.x - rawScreen.x, screenPoint.y - rawScreen.y);
  return createEngineeringSnapCandidate({
    ...raw,
    screenPoint,
    screenDistance: distance,
    metadata: {
      ...raw.metadata,
      profileFingerprint: context.profile.profileFingerprint,
      topologyFingerprint: context.snapshot.topologyFingerprint,
      geometryFingerprint: context.snapshot.geometryFingerprint,
    },
  });
}

function projectCandidates(rawCandidates, rawScreen, projectPoint, context) {
  const candidates = [];
  const unprojectableCandidateIds = [];
  rawCandidates.forEach((raw) => {
    const screenPoint = projectWorld(projectPoint, raw.worldPoint);
    if (!screenPoint) { unprojectableCandidateIds.push(raw.id); return; }
    candidates.push(engineeringCandidate(raw, rawScreen, screenPoint, context));
  });
  return { candidates, unprojectableCandidateIds };
}

function acquisitionContext(input) {
  const target = validateSequentialSingleEntityMoveTarget(input.target, {
    readModel: input.readModel,
    scene: input.scene,
  });
  const snapshot = createSequentialEditableTopologySnapshot(input.readModel);
  const scene = assertSequentialScopedEditSceneAncestry(
    validateEngineeringScene(input.scene), input.readModel,
  );
  const profile = createSequentialMoveSnapProfile(input.profile);
  const constraint = createSequentialMoveConstraint(input.constraint);
  return { target, snapshot, scene, profile, constraint };
}

function rawCandidateProjection(context, rawWorldPoint) {
  const source = deriveSequentialMoveSnapSourceCandidates({
    snapshot: context.snapshot,
    scene: context.scene,
    target: context.target,
    rawWorldPoint,
    constraint: context.constraint,
    profile: context.profile,
  });
  const intersections = deriveSequentialMoveSnapIntersectionCandidates({
    segments: source.segments,
    rawWorldPoint,
    constraint: context.constraint,
    profile: context.profile,
  });
  const candidates = [...source.candidates, ...intersections]
    .sort((left, right) => left.id.localeCompare(right.id));
  const ids = candidates.map((row) => row.id);
  if (new Set(ids).size !== ids.length) throw new RangeError('Raw snap candidate IDs are not unique.');
  return { source, candidates };
}

export function acquireSequentialMoveSnapCandidates(input = {}) {
  const context = acquisitionContext(input);
  const rawWorldPoint = normalizeSequentialSnapPoint(input.rawWorldPoint, context.profile);
  const rawScreenPoint = finiteScreenPoint(input.rawScreenPoint, 'Raw snap screen point');
  const projectPoint = requiredFunction(input.projectPoint, 'projectPoint');
  const raw = rawCandidateProjection(context, rawWorldPoint);
  const projected = projectCandidates(raw.candidates, rawScreenPoint, projectPoint, context);
  const ranked = rankEngineeringSvgSnapCandidates(projected.candidates, {
    aperture: context.profile.aperturePx,
    enabledModes: context.profile.enabledModes,
    excludeSourceEntityIds: context.target.geometryPartIds,
    constraint: context.constraint,
    screenTolerance: context.profile.screenTolerancePx,
    worldTolerance: context.profile.worldTolerance,
  });
  return createSequentialMoveSnapAcquisition({
    targetId: context.target.moveTargetId,
    topologyFingerprint: context.snapshot.topologyFingerprint,
    geometryFingerprint: context.snapshot.geometryFingerprint,
    sceneRevision: context.scene.revision,
    constraint: context.constraint,
    rawWorldPoint,
    rawScreenPoint,
    profile: context.profile,
    candidates: ranked.candidates,
    suggestedCandidateId: ranked.candidate?.id || null,
    rankingEvidence: ranked.evidence,
    derivationEvidence: {
      rawCandidateCount: raw.candidates.length,
      projectedCandidateCount: projected.candidates.length,
      unprojectableCandidateIds: projected.unprojectableCandidateIds.sort(),
      segmentCount: raw.source.segments.length,
      anchorCount: raw.source.anchors.length,
    },
  });
}

export function validateSequentialMoveSnapAcquisition(acquisition, input = {}) {
  if (acquisition?.schema !== SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA) {
    throw new TypeError(`Snap acquisition must use ${SEQUENTIAL_MOVE_SNAP_ACQUISITION_SCHEMA}.`);
  }
  const rebuilt = acquireSequentialMoveSnapCandidates({
    ...input,
    rawWorldPoint: acquisition.rawWorldPoint,
    rawScreenPoint: acquisition.rawScreenPoint,
    constraint: acquisition.constraint,
    profile: acquisition.profile,
  });
  if (!sameSequentialContractValue(rebuilt, acquisition)) {
    const error = new RangeError('Snap acquisition differs from current topology, scene or view evidence.');
    error.code = 'SEQUENTIAL_MOVE_SNAP_ACQUISITION_STALE';
    throw error;
  }
  return rebuilt;
}
