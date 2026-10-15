/** Read-only EngineeringScope.v1 resolution for the certified Sequential scene. */
import {
  ENGINEERING_SCOPE_BOUNDARY_POLICY,
  ENGINEERING_SCOPE_KIND,
  createEngineeringScope,
  createEngineeringScopeRequest,
} from '../../../core/engineering-scope/engineering-scope-contracts.js';
import { freezeJsonValue } from '../../../core/engineering-scene/engineering-json-value.js';
import { sameSequentialContractValue } from './sequential-command-contracts.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { assertSequentialScopedEditSceneAncestry } from './sequential-scoped-edit-scene-adapter.js';

export const SEQUENTIAL_SCOPED_EDIT_SCOPE_RESOLUTION_V1 = 'SequentialScopedEditScopeResolution.v1';
export const SEQUENTIAL_SCOPED_EDIT_SECTIONAL_UNSUPPORTED = 'SEQUENTIAL_SECTIONAL_SCOPE_UNSUPPORTED';
export const SEQUENTIAL_SCOPED_EDIT_SCOPE_REJECTION = Object.freeze({
  STALE_AUTHORITY: 'STALE_SEQUENTIAL_SCOPE_AUTHORITY',
  UNKNOWN_ENTITY: 'SEQUENTIAL_SCOPE_UNKNOWN_ENTITY',
  BUDGET_EXCEEDED: 'SEQUENTIAL_SCOPE_BUDGET_EXCEEDED',
  PROPAGATE_UNSUPPORTED: 'SEQUENTIAL_SCOPE_PROPAGATE_UNSUPPORTED',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}

function tokens(entity) {
  const ref = entity.domainRef || {};
  const metadata = entity.metadata?.sequential || {};
  const values = [
    ref.componentId, ref.connectionId, ref.repairId, ref.candidateId,
    ref.portId, ref.supportId, ref.familyId, ref.carrierId,
    metadata.component?.componentId, metadata.connection?.connectionId,
  ];
  for (const connection of metadata.connections || []) {
    values.push(connection.connectionId, connection.fromPortId, connection.toPortId,
      connection.targetComponentId);
  }
  return new Set(values.map((value) => String(value || '').trim()).filter(Boolean));
}

function graph(scene) {
  const rows = scene.entities.map((entity) => ({ entity, tokens: tokens(entity) }));
  const result = new Map(rows.map(({ entity }) => [entity.id, new Set()]));
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      const related = [...rows[left].tokens].some((token) => rows[right].tokens.has(token));
      if (!related) continue;
      result.get(rows[left].entity.id).add(rows[right].entity.id);
      result.get(rows[right].entity.id).add(rows[left].entity.id);
    }
  }
  return result;
}

function requireIds(values, index, label) {
  for (const id of values) {
    if (!index.has(id)) fail(
      SEQUENTIAL_SCOPED_EDIT_SCOPE_REJECTION.UNKNOWN_ENTITY,
      `${label} references unknown Sequential scene entity ${id}.`,
    );
  }
  return values;
}

function expand(seedIds, relationships, depth = Number.POSITIVE_INFINITY) {
  const visited = new Set(seedIds);
  let frontier = [...seedIds].sort();
  for (let level = 0; frontier.length && level < depth; level += 1) {
    const next = new Set();
    for (const id of frontier) {
      for (const related of [...relationships.get(id)].sort()) {
        if (!visited.has(related)) next.add(related);
      }
    }
    frontier = [...next].sort();
    frontier.forEach((id) => visited.add(id));
  }
  return visited;
}

function selectionSets(request, relationships, index) {
  const seeds = requireIds(request.selection.entityIds, index, 'Selection scope');
  const selected = expand(seeds, relationships, request.selection.closureDepth);
  const boundary = new Set();
  for (const id of selected) {
    for (const related of relationships.get(id)) if (!selected.has(related)) boundary.add(related);
  }
  return { selected, boundary };
}

function structuralSets(request, relationships, index) {
  const seeds = requireIds(request.structural.identifiers, index, 'Structural scope');
  return { selected: expand(seeds, relationships), boundary: new Set() };
}

function stats(entityIds, boundaryIds, budget) {
  const mounted = entityIds.length + boundaryIds.length;
  return { matched: entityIds.length, boundary: boundaryIds.length, mounted,
    budget, consumed: mounted, remaining: budget - mounted };
}

function resolveCertified(readModel, scene, requestInput) {
  const request = createEngineeringScopeRequest(requestInput);
  if (request.boundaryPolicy === ENGINEERING_SCOPE_BOUNDARY_POLICY.PROPAGATE) {
    fail(SEQUENTIAL_SCOPED_EDIT_SCOPE_REJECTION.PROPAGATE_UNSUPPORTED,
      'Sequential read-only scope does not permit propagating mutation.');
  }
  if (request.kind === ENGINEERING_SCOPE_KIND.SECTIONAL) {
    fail(SEQUENTIAL_SCOPED_EDIT_SECTIONAL_UNSUPPORTED,
      'Sequential construction has no qualified sectional edit scope.');
  }
  if (!sameSequentialContractValue(scene.revision, readModel.revision)) {
    fail(SEQUENTIAL_SCOPED_EDIT_SCOPE_REJECTION.STALE_AUTHORITY,
      'Sequential scene revision does not match the certified read model.');
  }
  const index = new Map(scene.entities.map((entity) => [entity.id, entity]));
  const relationships = graph(scene);
  const sets = request.kind === ENGINEERING_SCOPE_KIND.SELECTION
    ? selectionSets(request, relationships, index)
    : structuralSets(request, relationships, index);
  const entityIds = [...sets.selected].sort();
  const boundaryIds = [...sets.boundary].sort();
  const mounted = entityIds.length + boundaryIds.length;
  if (mounted > request.elementBudget) fail(
    SEQUENTIAL_SCOPED_EDIT_SCOPE_REJECTION.BUDGET_EXCEEDED,
    `Resolved Sequential scope ${mounted} exceeds elementBudget ${request.elementBudget}.`,
  );
  const scope = createEngineeringScope({ schema: 'EngineeringScope.v1', request,
    kind: request.kind, boundaryPolicy: request.boundaryPolicy,
    elementBudget: request.elementBudget, entityIds, boundaryIds,
    stats: stats(entityIds, boundaryIds, request.elementBudget) });
  return freezeJsonValue({ schema: SEQUENTIAL_SCOPED_EDIT_SCOPE_RESOLUTION_V1,
    authorityId: readModel.authorityId, sceneId: scene.sceneId, scope,
    entityIds, boundaryIds,
    excludedEntityIds: scene.entities.map((entity) => entity.id)
      .filter((id) => !sets.selected.has(id) && !sets.boundary.has(id)).sort() });
}

export function createSequentialScopedEditScopeResolver(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  const scene = assertSequentialScopedEditSceneAncestry(input.scene, readModel);
  return Object.freeze((request) => resolveCertified(readModel, scene, request));
}

export function resolveSequentialScopedEditScope(input = {}) {
  return createSequentialScopedEditScopeResolver(input)(input.request);
}

export const _test = Object.freeze({ graph, expand, resolveCertified });
