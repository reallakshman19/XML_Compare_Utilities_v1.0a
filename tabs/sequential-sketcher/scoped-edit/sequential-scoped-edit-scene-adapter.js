/** Deterministic EngineeringScene.v1 projection of certified Sequential read authority. */
import {
  createEngineeringScene,
  validateEngineeringScene,
} from '../../../core/engineering-scene/index.js';
import { buildSequentialEngineeringSvgScene } from '../sequential-engineering-svg-scene.js';
import { sameSequentialContractValue } from './sequential-command-contracts.js';
import {
  applySequentialGeometryEditJournalToScene,
} from './sequential-geometry-edit-projection.js';
import {
  isSequentialEffectiveGeometryReadModel,
} from './sequential-effective-geometry-read-model.js';
import {
  isSequentialEffectiveTopologyReadModel,
} from './sequential-effective-topology-read-model.js';
import {
  applySequentialTopologyEditJournalToScene,
} from './sequential-topology-edit-projection.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';

export const SEQUENTIAL_SCOPED_EDIT_SCENE_REJECTION = Object.freeze({
  ANCESTRY_MISMATCH: 'SEQUENTIAL_SCENE_ANCESTRY_MISMATCH',
});

function fail(message) {
  const error = new TypeError(message);
  error.code = SEQUENTIAL_SCOPED_EDIT_SCENE_REJECTION.ANCESTRY_MISMATCH;
  throw error;
}
function scopedEditScene(sceneInput) {
  const scene = validateEngineeringScene(sceneInput);
  return createEngineeringScene({
    ...scene,
    entities: scene.entities.map((entity) => (
      entity.domainRef?.category === 'support'
        ? { ...entity, editCapabilities: ['MOVE_DRAFT'] }
        : entity
    )),
    capabilities: {
      ...scene.capabilities,
      editing: false,
      supportMoveDraftPreview: true,
    },
  });
}
function baseProject(readModel) {
  const built = buildSequentialEngineeringSvgScene(readModel.ownerSnapshot, {
    sceneId: readModel.sceneId,
    visibleProjection: readModel.ownerSnapshot.visibleProjection,
  });
  return scopedEditScene(built.scene);
}
function project(readModel) {
  if (isSequentialEffectiveTopologyReadModel(readModel)) {
    const base = project(readModel.topologyBaseReadModel);
    return applySequentialTopologyEditJournalToScene(
      base,
      readModel.topologyEditJournal,
      { revision: readModel.revision, sceneId: readModel.sceneId },
    );
  }
  if (!isSequentialEffectiveGeometryReadModel(readModel)) return baseProject(readModel);
  const base = baseProject(readModel.baseReadModel);
  return applySequentialGeometryEditJournalToScene(
    base,
    readModel.geometryEditJournal,
    { revision: readModel.revision, sceneId: readModel.sceneId },
  );
}
export function assertSequentialScopedEditSceneAncestry(sceneInput, readModelInput) {
  const readModel = assertSequentialScopedEditReadModel(readModelInput);
  const scene = validateEngineeringScene(sceneInput);
  const expected = project(readModel);
  if (scene.sceneId !== readModel.sceneId
    || !sameSequentialContractValue(scene.revision, readModel.revision)
    || !sameSequentialContractValue(scene, expected)) {
    fail('EngineeringScene does not match the deterministic Sequential read-model projection.');
  }
  return expected;
}
export function buildSequentialScopedEditEngineeringScene(readModelInput) {
  const readModel = assertSequentialScopedEditReadModel(readModelInput);
  return assertSequentialScopedEditSceneAncestry(project(readModel), readModel);
}

export const _test = Object.freeze({ scopedEditScene, project });
