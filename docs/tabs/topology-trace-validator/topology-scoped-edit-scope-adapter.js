/** Certified Topology selection and structural semantics over EngineeringScope.v1. */
import { immutableJson } from '../../contracts/contract-values.js';
import {
  ENGINEERING_SCOPE_BOUNDARY_POLICY,
  ENGINEERING_SCOPE_KIND,
  createEngineeringScope,
  createEngineeringScopeRequest,
} from '../../core/engineering-scope/engineering-scope-contracts.js';
import { semanticHash } from './topology-validator-values.js';
import { assertTopologyScopedEditReadModel, _test as readModelTest } from './topology-scoped-edit-read-model.js';
import { assertTopologyScopedEditSceneAncestry } from './topology-scoped-edit-scene-adapter.js';

export const TOPOLOGY_SCOPED_EDIT_SCOPE_RESOLUTION_V1 = 'TopologyScopedEditScopeResolution.v1';
export const TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED = 'TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED';
export const STALE_TOPOLOGY_SCOPE_AUTHORITY = 'STALE_TOPOLOGY_SCOPE_AUTHORITY';
export const TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION = Object.freeze({
  UNKNOWN_ENTITY: 'TOPOLOGY_SCOPE_UNKNOWN_ENTITY',
  NO_EDITABLE_ENTITY: 'TOPOLOGY_SCOPE_NO_EDITABLE_ENTITY',
  SELECTION_EVIDENCE_MISMATCH: 'TOPOLOGY_SELECTION_EVIDENCE_MISMATCH',
  BUDGET_EXCEEDED: 'TOPOLOGY_SCOPE_BUDGET_EXCEEDED',
  PROPAGATE_UNSUPPORTED: 'TOPOLOGY_SCOPE_PROPAGATE_UNSUPPORTED',
});
export const TOPOLOGY_SCOPED_EDIT_SCOPE_SUPPORT = Object.freeze({
  SELECTION: Object.freeze({ status: 'SUPPORTED', resolver: 'stable-id graph closure',
    closurePolicy: 'depth-limited editable closure plus P3.1A boundary context' }),
  STRUCTURAL: Object.freeze({ status: 'SUPPORTED', resolver: 'stable-id connected component',
    closurePolicy: 'full source-proven graph closure intersected with P3.1A authority' }),
  SECTIONAL: Object.freeze({ status: 'UNSUPPORTED', resolver: null,
    failureCode: TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED }),
});
function fail(code, message, Constructor = RangeError, evidence = {}) {
  const error = new Constructor(message); error.code = code; Object.assign(error, evidence); throw error;
}
function sceneIndex(scene) {
  const entries = scene.entities.map((entity) => [entity.id, entity]);
  if (new Set(entries.map(([id]) => id)).size !== entries.length) throw new TypeError('Scene IDs must be unique.');
  return new Map(entries);
}
function graphOf(scene, index) {
  const graph = new Map([...index.keys()].map((id) => [id, new Set()]));
  for (const entity of scene.entities) for (const ref of entity.domainRef.references ?? []) {
    if (!index.has(ref)) fail(TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION.UNKNOWN_ENTITY,
      `Scene relationship ${entity.id} references unknown entity ${ref}.`);
    graph.get(entity.id).add(ref); graph.get(ref).add(entity.id);
  }
  return graph;
}
function requireIds(ids, index, label) {
  for (const id of ids) if (!index.has(id)) fail(TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION.UNKNOWN_ENTITY,
    `${label} references unknown scene entity ${id}.`);
  return ids;
}
function expandDepth(seedIds, graph, depth) {
  const visited = new Set(seedIds); let frontier = [...seedIds].sort();
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next = new Set();
    for (const id of frontier) for (const ref of [...graph.get(id)].sort()) if (!visited.has(ref)) next.add(ref);
    frontier = [...next].sort(); frontier.forEach((id) => visited.add(id));
  }
  return visited;
}
function connected(seedIds, graph) {
  const visited = new Set(seedIds), queue = [...seedIds].sort();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const ref of [...graph.get(queue[cursor])].sort()) if (!visited.has(ref)) {
      visited.add(ref); queue.push(ref);
    }
  }
  return visited;
}
function classification(readModel) {
  return { editable: new Set(readModel.commandScopeBasis.editableEntityIds),
    boundary: new Set(readModel.commandScopeBasis.boundaryEntityIds),
    excluded: new Set(readModel.commandScopeBasis.excludedEntityIds) };
}
function selectionClosure(readModel, request, graph, index) {
  const seeds = requireIds(request.selection.entityIds, index, 'Selection scope');
  const evidence = new Set(readModel.selectionSnapshot.entityIds);
  if (evidence.size && seeds.some((id) => !evidence.has(id))) fail(
    TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION.SELECTION_EVIDENCE_MISMATCH,
    'Selection request is not contained in the current authority-bound selection snapshot.');
  const closure = expandDepth(seeds, graph, request.selection.closureDepth);
  const classes = classification(readModel);
  const editable = new Set([...closure].filter((id) => classes.editable.has(id)));
  for (const id of [...editable]) for (const ref of graph.get(id)) if (classes.boundary.has(ref)) closure.add(ref);
  return { closure, editable, classes };
}
function structuralClosure(readModel, request, graph, index) {
  const seeds = requireIds(request.structural.identifiers, index, 'Structural scope');
  const closure = connected(seeds, graph), classes = classification(readModel);
  return { closure, editable: new Set([...closure].filter((id) => classes.editable.has(id))), classes };
}
function resolvedSets(scene, result) {
  const editable = [...result.editable].sort();
  if (!editable.length) fail(TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION.NO_EDITABLE_ENTITY,
    'Topology scope contains no P3.1A-authorized editable entity.');
  const boundary = [...result.closure].filter((id) => result.classes.boundary.has(id)).sort();
  const occupied = new Set([...editable, ...boundary]);
  const excluded = scene.entities.map((entity) => entity.id).filter((id) => !occupied.has(id)).sort();
  return { editable, boundary, excluded };
}
function enforceBudget(request, sets, authorityId) {
  const resolvedCount = sets.editable.length + sets.boundary.length;
  if (resolvedCount > request.elementBudget) fail(TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION.BUDGET_EXCEEDED,
    `Resolved ${request.kind} scope exceeds elementBudget ${request.elementBudget}.`, RangeError,
    { requestedBudget: request.elementBudget, resolvedCount, scopeKind: request.kind, authorityId });
}
function stats(sets, budget) {
  const mounted = sets.editable.length + sets.boundary.length;
  return { matched: sets.editable.length, boundary: sets.boundary.length, mounted,
    budget, consumed: mounted, remaining: budget - mounted };
}
function assertPartition(scene, sets) {
  const all = scene.entities.map((entity) => entity.id).sort();
  const combined = [...sets.editable, ...sets.boundary, ...sets.excluded].sort();
  if (new Set(combined).size !== combined.length || JSON.stringify(all) !== JSON.stringify(combined)) {
    throw new TypeError('Topology scope partition must be complete and pairwise disjoint.');
  }
}
function resolveCertified(input, requestInput) {
  const request = createEngineeringScopeRequest(requestInput);
  if (request.boundaryPolicy === ENGINEERING_SCOPE_BOUNDARY_POLICY.PROPAGATE) fail(
    TOPOLOGY_SCOPED_EDIT_SCOPE_REJECTION.PROPAGATE_UNSUPPORTED,
    'Topology P3.1B does not permit propagating boundary mutation.');
  if (request.kind === ENGINEERING_SCOPE_KIND.SECTIONAL) fail(TOPOLOGY_SECTIONAL_SCOPE_UNSUPPORTED,
    'Topology has no source-proven engineering sectional scope.');
  if (input.scene.revision.value !== input.readModel.authorityId) fail(STALE_TOPOLOGY_SCOPE_AUTHORITY,
    'Engineering scene revision does not match current Topology authority.');
  const scene = assertTopologyScopedEditSceneAncestry(input.scene, input.readModel);
  const index = sceneIndex(scene), graph = graphOf(scene, index);
  const result = request.kind === ENGINEERING_SCOPE_KIND.SELECTION
    ? selectionClosure(input.readModel, request, graph, index)
    : structuralClosure(input.readModel, request, graph, index);
  const sets = resolvedSets(scene, result);
  enforceBudget(request, sets, input.readModel.authorityId); assertPartition(scene, sets);
  const scope = createEngineeringScope({ schema: 'EngineeringScope.v1', request, kind: request.kind,
    boundaryPolicy: request.boundaryPolicy, elementBudget: request.elementBudget,
    entityIds: sets.editable, boundaryIds: sets.boundary, stats: stats(sets, request.elementBudget) });
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_SCOPE_RESOLUTION_V1,
    authorityId: input.readModel.authorityId, sceneId: scene.sceneId,
    canonicalTopologyHash: input.readModel.canonicalTopologyHash,
    canonicalContentHash: input.readModel.canonicalContentHash,
    requestHash: semanticHash(request), scope, editableEntityIds: sets.editable,
    boundaryEntityIds: sets.boundary, excludedEntityIds: sets.excluded },
  'Topology scoped-edit scope resolution');
}
async function resolverWithCore(input, core, dependencies = {}) {
  const readModel = await readModelTest.assertWithCore(input.readModel, core, dependencies);
  const scene = assertTopologyScopedEditSceneAncestry(input.scene, readModel);
  const certified = Object.freeze({ readModel, scene });
  return Object.freeze((request) => resolveCertified(certified, request));
}
export async function createTopologyScopedEditScopeResolver(input = {}, dependencies = {}) {
  const readModel = await assertTopologyScopedEditReadModel(input.readModel, dependencies);
  const scene = assertTopologyScopedEditSceneAncestry(input.scene, readModel);
  const certified = Object.freeze({ readModel, scene });
  return Object.freeze((request) => resolveCertified(certified, request));
}
export async function resolveTopologyScopedEditScope(input = {}, dependencies = {}) {
  const resolver = await createTopologyScopedEditScopeResolver(input, dependencies);
  return resolver(input.request);
}
export const _test = Object.freeze({ resolveCertified, resolverWithCore });
