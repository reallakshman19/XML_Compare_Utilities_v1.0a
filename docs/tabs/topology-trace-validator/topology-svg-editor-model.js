/** Mutable support-only draft kept separate from immutable topology artifacts. */
import { asArray, cleanText, cloneJson, deepFreeze, objectRecord, strictPoint } from './topology-validator-values.js';

export const TOPOLOGY_SVG_EDITOR_DRAFT_SCHEMA = 'TopologySvgEditorDraft.v1';
export const TOPOLOGY_EDIT_PATCH_SCHEMA = 'TopologyEditPatch.v1';

function clonePoint(point) { return { x: Number(point.x), y: Number(point.y), z: Number(point.z) }; }
function samePoint(a, b) { return a && b && a.x === b.x && a.y === b.y && a.z === b.z; }
function cloneEntity(entity) {
  return { ...entity, originalPosition: clonePoint(entity.originalPosition), position: clonePoint(entity.position) };
}

function supportEntities(viewModel) {
  return asArray(objectRecord(viewModel).sourceEntities).map(objectRecord).flatMap((component) => {
    if (cleanText(component.componentCategory) !== 'SUPPORT') return [];
    const position = strictPoint(objectRecord(component.positions).POS);
    if (!position) return [];
    return [cloneEntity({
      objectKey: cleanText(component.objectKey), sourceEntityId: cleanText(component.sourceEntityId),
      sourcePath: cleanText(component.sourcePath), componentCategory: 'SUPPORT',
      name: cleanText(component.name), ref: cleanText(component.ref),
      originalPosition: position, position,
    })];
  });
}

export class TopologySvgEditorModel extends EventTarget {
  constructor(viewModel, baseHashes = {}) {
    super();
    this.schema = TOPOLOGY_SVG_EDITOR_DRAFT_SCHEMA;
    this.baseHashes = cloneJson(baseHashes);
    this.revision = 0;
    this.entities = new Map(supportEntities(viewModel).map((entity) => [entity.objectKey, entity]));
  }

  snapshot() {
    return { revision: this.revision, entities: [...this.entities.values()].map(cloneEntity) };
  }

  restore(snapshot, reason = 'restore') {
    this.revision = Number(snapshot?.revision) || 0;
    this.entities = new Map(asArray(snapshot?.entities).map(cloneEntity).map((entity) => [entity.objectKey, entity]));
    this.dispatchEvent(new CustomEvent('draftChanged', { detail: { reason, revision: this.revision } }));
  }

  entity(objectKey) { return this.entities.get(cleanText(objectKey)) ?? null; }
  supports() { return Object.freeze([...this.entities.values()].map((entity) => deepFreeze(cloneEntity(entity)))); }
  dirtyEntities() { return this.supports().filter((entity) => !samePoint(entity.originalPosition, entity.position)); }
  get dirtyCount() { return this.dirtyEntities().length; }
  get isDirty() { return this.dirtyCount > 0; }

  moveSupport(objectKey, position, reason = 'move-support') {
    const key = cleanText(objectKey), entity = this.entities.get(key), point = strictPoint(position);
    if (!entity || entity.componentCategory !== 'SUPPORT') throw new RangeError(`Editable support is not available: ${key}`);
    if (!point) throw new TypeError('Support position must contain finite X, Y and Z values.');
    const before = cloneEntity(entity);
    entity.position = clonePoint(point);
    this.revision += 1;
    this.dispatchEvent(new CustomEvent('draftChanged', {
      detail: { reason, objectKey: key, before, after: cloneEntity(entity), revision: this.revision },
    }));
    return deepFreeze(cloneEntity(entity));
  }

  revert() {
    for (const entity of this.entities.values()) entity.position = clonePoint(entity.originalPosition);
    this.revision += 1;
    this.dispatchEvent(new CustomEvent('draftChanged', { detail: { reason: 'revert-draft', revision: this.revision } }));
  }

  patch() {
    const operations = this.dirtyEntities().map((entity, index) => deepFreeze({
      operationId: `edit-${String(index + 1).padStart(4, '0')}`,
      type: 'MOVE_SUPPORT', objectKey: entity.objectKey, sourceEntityId: entity.sourceEntityId,
      sourcePath: entity.sourcePath, before: { position: clonePoint(entity.originalPosition) },
      after: { position: clonePoint(entity.position) },
    }));
    return deepFreeze({
      schema: TOPOLOGY_EDIT_PATCH_SCHEMA, baseHashes: cloneJson(this.baseHashes),
      revision: this.revision, operationCount: operations.length, operations,
    });
  }

  evidence() {
    return deepFreeze({ schema: this.schema, baseHashes: cloneJson(this.baseHashes), revision: this.revision,
      dirtyCount: this.dirtyCount, entities: this.supports(), patch: this.patch() });
  }
}

export const _test = Object.freeze({ clonePoint, samePoint, cloneEntity, supportEntities });
