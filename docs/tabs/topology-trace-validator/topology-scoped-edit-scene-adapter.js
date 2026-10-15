/** Deterministic EngineeringScene.v1 projection of one certified Topology read model. */
import { createEngineeringRevisionToken } from '../../core/engineering-scene/engineering-revision-contracts.js';
import { createEngineeringScene } from '../../core/engineering-scene/engineering-scene-contracts.js';
import { createPointGeometry, createSegmentGeometry } from '../../core/engineering-scene/engineering-geometry-contracts.js';
import { validateEngineeringScene } from '../../core/engineering-scene/engineering-contract-validation.js';
import { asArray, cleanText, objectRecord, semanticStringify } from './topology-validator-values.js';
import { assertTopologyScopedEditReadModel, _test as readModelTest } from './topology-scoped-edit-read-model.js';

export const TOPOLOGY_SCOPED_EDIT_SCENE_KINDS = Object.freeze([
  'node', 'edge', 'support', 'junction', 'boundary', 'bend', 'pointFeature',
]);
export const TOPOLOGY_SCOPED_EDIT_SCENE_EXCLUDED_KINDS = Object.freeze({
  rigids: 'Canonical rigid assignments have no independent producer-owned entity id.',
});
export const TOPOLOGY_SCOPED_EDIT_SCENE_REJECTION = Object.freeze({
  ANCESTRY_MISMATCH: 'TOPOLOGY_SCENE_ANCESTRY_MISMATCH',
});
const COLLECTION_KIND = Object.freeze({ nodes: 'node', edges: 'edge', supports: 'support',
  junctions: 'junction', boundaries: 'boundary', bends: 'bend', pointFeatures: 'pointFeature' });
const KIND_RANK = Object.freeze(Object.fromEntries(TOPOLOGY_SCOPED_EDIT_SCENE_KINDS
  .map((kind, index) => [kind, index + 1])));
function fail(message) {
  const error = new TypeError(message); error.code = TOPOLOGY_SCOPED_EDIT_SCENE_REJECTION.ANCESTRY_MISMATCH; throw error;
}
function same(left, right) { return semanticStringify(left) === semanticStringify(right); }
function sortedTexts(values) { return [...new Set(asArray(values).map(cleanText).filter(Boolean))].sort(); }
function rowId(row, collection) {
  const id = cleanText(row.id);
  if (!id) throw new TypeError(`Topology ${collection} entity requires a stable producer-owned id.`);
  return id;
}
function point(row, collection) {
  try { return createPointGeometry(objectRecord(row.position)); }
  catch (error) { error.message = `Topology ${collection} ${cleanText(row.id)}: ${error.message}`; throw error; }
}
function explicitReferences(collection, row) {
  if (collection === 'edges') return [row.fromNodeId, row.toNodeId];
  if (collection === 'supports') return [row.nodeId];
  if (collection === 'junctions' || collection === 'boundaries') return [row.nodeId, ...asArray(row.participatingEdgeIds)];
  if (collection === 'bends') return [row.nodeId, ...asArray(row.edgeIds)];
  if (collection === 'pointFeatures') return [row.nodeId, row.edgeId];
  return [];
}
function canonicalRows(canonical) {
  return Object.entries(COLLECTION_KIND).flatMap(([collection, kind]) => asArray(canonical[collection])
    .map(objectRecord).map((row) => ({ collection, kind, row, id: rowId(row, collection) })));
}
function relationshipIndex(rows) {
  const ids = new Set(rows.map((item) => item.id));
  if (ids.size !== rows.length) throw new TypeError('Topology scene entity ids must be globally unique.');
  const graph = new Map([...ids].map((id) => [id, new Set()]));
  for (const item of rows) for (const ref of explicitReferences(item.collection, item.row)
    .map(cleanText).filter((id) => ids.has(id))) {
    graph.get(item.id).add(ref); graph.get(ref).add(item.id);
  }
  return graph;
}
function edgeGeometry(row, nodes) {
  const from = nodes.get(cleanText(row.fromNodeId)), to = nodes.get(cleanText(row.toNodeId));
  if (!from || !to) throw new TypeError(`Topology edge ${row.id} references a missing node.`);
  try { return createSegmentGeometry(objectRecord(from.position), objectRecord(to.position)); }
  catch (error) { error.message = `Topology edge ${row.id}: ${error.message}`; throw error; }
}
function geometryFor(item, nodeIndex) {
  return item.collection === 'edges' ? edgeGeometry(item.row, nodeIndex) : point(item.row, item.collection);
}
function domainRef(readModel, item, graph) {
  return { authorityId: readModel.authorityId, canonicalTopologyHash: readModel.canonicalTopologyHash,
    canonicalContentHash: readModel.canonicalContentHash, canonicalId: item.id, collection: item.collection,
    references: [...graph.get(item.id)].sort(), sourceEntityIds: sortedTexts(item.row.sourceEntityIds),
    sourcePaths: sortedTexts(item.row.sourcePaths), branchIds: sortedTexts(item.row.branchIds) };
}
function metadata(item) {
  const row = item.row;
  return { sourceTypes: sortedTexts(row.sourceTypes), segmentRole: cleanText(row.segmentRole),
    topologyOperation: cleanText(row.topologyOperation), relationship: cleanText(row.relationship),
    sourceRelationship: cleanText(row.sourceRelationship), attachmentAuthority: cleanText(row.attachmentAuthority),
    positionAuthority: cleanText(row.positionAuthority), connectionAuthority: row.connectionAuthority ?? null,
    inputXmlNodeIds: sortedTexts(row.inputXmlNodeIds ?? [row.inputXmlNodeId]),
    inputXmlElementIds: sortedTexts(row.inputXmlElementIds ?? [row.inputXmlElementId]) };
}
function entitySpec(readModel, item, graph, nodeIndex, renderOrder) {
  return { id: item.id, kind: item.kind, domainType: `TopologyCanonical${item.kind}.v1`,
    geometry: geometryFor(item, nodeIndex), domainRef: domainRef(readModel, item, graph),
    propertySetIds: [], editCapabilities: [], layer: 'authoritative', renderOrder,
    visible: true, selectable: true, contributesToFit: true, metadata: metadata(item) };
}
function sortedRows(rows) {
  return [...rows].sort((left, right) => KIND_RANK[left.kind] - KIND_RANK[right.kind]
    || left.id.localeCompare(right.id));
}
function projectCertifiedScene(readModel) {
  const canonical = readModel.canonicalTopology, rows = sortedRows(canonicalRows(canonical));
  const graph = relationshipIndex(rows);
  const nodeIndex = new Map(asArray(canonical.nodes).map((row) => [cleanText(row.id), row]));
  const entities = rows.map((item, index) => entitySpec(readModel, item, graph, nodeIndex,
    (KIND_RANK[item.kind] * 1_000_000) + index));
  const scene = createEngineeringScene({
    sceneId: `topology-scoped-edit:${readModel.documentId}:${readModel.authorityId}`,
    revision: createEngineeringRevisionToken(readModel.authorityId), coordinateSystem: readModel.coordinateSystem,
    entities, capabilities: { readOnly: true, dryRunAppend: true, productionMutation: false },
    metadata: { authorityId: readModel.authorityId, canonicalTopologyHash: readModel.canonicalTopologyHash,
      canonicalContentHash: readModel.canonicalContentHash, artifactsHash: readModel.artifactsHash,
      producerProfileHash: readModel.producerProfileHash, producerOptionsHash: readModel.producerOptionsHash,
      includedKinds: TOPOLOGY_SCOPED_EDIT_SCENE_KINDS,
      excludedKinds: TOPOLOGY_SCOPED_EDIT_SCENE_EXCLUDED_KINDS,
      candidateEntityIds: rows.map((row) => row.id) },
  });
  return validateEngineeringScene(scene);
}
export function assertTopologyScopedEditSceneAncestry(scene, readModel) {
  validateEngineeringScene(scene);
  const expected = projectCertifiedScene(readModel);
  const ids = scene.entities.map((entity) => entity.id);
  if (scene.sceneId !== expected.sceneId || scene.revision.value !== readModel.authorityId
    || scene.metadata?.authorityId !== readModel.authorityId
    || scene.metadata?.canonicalTopologyHash !== readModel.canonicalTopologyHash
    || scene.metadata?.canonicalContentHash !== readModel.canonicalContentHash
    || scene.metadata?.artifactsHash !== readModel.artifactsHash
    || scene.metadata?.producerProfileHash !== readModel.producerProfileHash
    || scene.metadata?.producerOptionsHash !== readModel.producerOptionsHash
    || !same(scene.metadata?.candidateEntityIds, expected.metadata.candidateEntityIds)
    || new Set(ids).size !== expected.entities.length || !same(scene, expected)) {
    fail('EngineeringScene does not exactly match the deterministic certified Topology projection.');
  }
  return expected;
}
async function createWithCore(readModel, core, dependencies = {}) {
  const certified = await readModelTest.assertWithCore(readModel, core, dependencies);
  return assertTopologyScopedEditSceneAncestry(projectCertifiedScene(certified), certified);
}
export async function buildTopologyScopedEditEngineeringScene(readModel, dependencies = {}) {
  const certified = await assertTopologyScopedEditReadModel(readModel, dependencies);
  return assertTopologyScopedEditSceneAncestry(projectCertifiedScene(certified), certified);
}
export const _test = Object.freeze({ projectCertifiedScene, createWithCore });
