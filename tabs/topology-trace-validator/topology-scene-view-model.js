/**
 * Projects TopologySvgScene.v1 into an immutable SVG view model. Topology comes
 * only from the scene contract. Parsed InputXML, CII projection, and parity
 * mismatches are overlays/evidence and never alter route continuity.
 */

import { calculateTopologyBounds, projectTopologyPoint } from './topology-svg-projections.js';
import { asArray, cleanText, deepFreeze, objectRecord, uniqueText } from './topology-validator-values.js';

function projectPoint(value, projection) { return projectTopologyPoint(value, projection); }
function branchVisible(row, branch) { return !branch || asArray(row.branchIds).map(cleanText).includes(branch); }

function sceneNode(row, projection) {
  return deepFreeze({ ...row, objectKey: `scene:node:${cleanText(row.canonicalNodeId)}`, projectedPosition: projectPoint(row.position, projection) });
}
function sceneEdge(row, projection) {
  return deepFreeze({ ...row, objectKey: `scene:edge:${cleanText(row.canonicalEdgeId)}`, projectedStart: projectPoint(row.fromPosition, projection), projectedEnd: projectPoint(row.toPosition, projection) });
}
function scenePoint(row, kind, projection, positionField = 'position') {
  return deepFreeze({ ...row, objectKey: `scene:${kind}:${cleanText(row.id)}`, projectedPosition: projectPoint(row[positionField], projection) });
}
function supportView(row, projection) {
  return deepFreeze({ ...row, objectKey: `scene:support:${cleanText(row.canonicalSupportId || row.id)}`, projectedPosition: projectPoint(row.attachmentPosition ?? row.position, projection), projectedSourcePosition: projectPoint(row.sourcePosition, projection), projectedAttachmentPosition: projectPoint(row.attachmentPosition ?? row.position, projection) });
}
function parsedEdge(row, projection) {
  return deepFreeze({ ...row, objectKey: `inputxml:edge:${cleanText(row.id)}`, projectedStart: projectPoint(row.fromPosition, projection), projectedEnd: projectPoint(row.toPosition, projection) });
}

function identityTexts(value) {
  return asArray(value).flatMap((item) => (typeof item === 'string' || typeof item === 'number') ? [cleanText(item)] : []).filter(Boolean);
}

function ciiIdentityKey(value) {
  const id = cleanText(value);
  if (!id) return '';
  if (id.startsWith('cii:')) return id;
  if (/^[A-Z0-9_&]+:[0-9]+$/.test(id)) return `cii:${id}`;
  if (/^IXPL-[0-9]{7}$/.test(id)) return `cii:projection:${id}`;
  return '';
}

function mismatchIdentityKeys(row) {
  const keys = [];
  for (const canonical of identityTexts(row.canonicalIdentity)) {
    if (canonical.startsWith('CE-')) keys.push(`scene:edge:${canonical}`);
    else if (canonical.startsWith('CN-')) keys.push(`scene:node:${canonical}`);
    else if (canonical.startsWith('CJ-')) keys.push(`scene:junction:${canonical}`);
    else if (canonical.startsWith('CB-')) keys.push(`scene:boundary:${canonical}`);
    else if (canonical.startsWith('SUP-')) keys.push(`scene:support:${canonical}`);
  }
  for (const input of identityTexts(row.inputXmlIdentity)) keys.push(`inputxml:edge:${input}`);
  for (const svg of identityTexts(row.svgIdentity)) keys.push(svg.startsWith('scene:') ? svg : `scene:edge:${svg}`);
  for (const cii of identityTexts(row.ciiIdentity)) {
    const key = ciiIdentityKey(cii); if (key) keys.push(key);
  }
  return uniqueText(keys);
}

function rowInputIds(row) {
  return uniqueText([cleanText(row.inputXmlElementId), ...asArray(row.inputXmlElementIds).map(cleanText)].filter(Boolean));
}

function buildSelectionLookup(input) {
  const byObjectKey = {};
  const register = (row, kind, links = []) => {
    const key = cleanText(row.objectKey);
    if (!key) return;
    byObjectKey[key] = deepFreeze({ objectKey: key, kind, object: row, linkedObjectKeys: Object.freeze(uniqueText(links)) });
  };
  const ciiByInput = new Map();
  for (const row of input.ciiElements) ciiByInput.set(cleanText(row.inputXmlElementId), row.objectKey);
  const sceneByInput = new Map();
  for (const row of input.edges) for (const id of rowInputIds(row)) {
    const rows = sceneByInput.get(id) || []; rows.push(row.objectKey); sceneByInput.set(id, rows);
  }

  for (const row of input.nodes) register(row, 'scene-node');
  for (const row of input.edges) {
    const ids = rowInputIds(row);
    register(row, 'scene-edge', [...ids.map((id) => `inputxml:edge:${id}`), ...ids.map((id) => ciiByInput.get(id)).filter(Boolean)]);
  }
  for (const row of input.inputEdges) register(row, 'inputxml-edge', [`scene:edge:${cleanText(row.canonicalEdgeId)}`, ciiByInput.get(cleanText(row.id))].filter(Boolean));
  for (const row of input.ciiElements) register(row, 'cii-element', [`inputxml:edge:${cleanText(row.inputXmlElementId)}`, ...asArray(sceneByInput.get(cleanText(row.inputXmlElementId)))]);
  for (const row of input.ciiRecords) register(row, 'cii-projection-record', row.linkedObjectKeys);
  for (const row of input.supports) register(row, 'scene-support', asArray(row.inputXmlRestraintIds).map((id) => `inputxml:restraint:${cleanText(id)}`));
  for (const row of input.deferredSupports) register(row, 'deferred-support');
  for (const row of input.rigids) register(row, 'scene-rigid', [`scene:edge:${cleanText(row.canonicalEdgeId)}`]);
  for (const row of input.junctions) register(row, 'scene-junction', asArray(row.participatingCanonicalEdgeIds).map((id) => `scene:edge:${cleanText(id)}`));
  for (const row of input.boundaries) register(row, 'scene-boundary', asArray(row.participatingCanonicalEdgeIds).map((id) => `scene:edge:${cleanText(id)}`));
  for (const row of input.pointFeatures) register(row, 'scene-point-feature');
  for (const row of input.mismatches) register(row, 'parity-mismatch', row.objectKeys);
  return deepFreeze({ byObjectKey });
}

function mismatchView(row) {
  return deepFreeze({ ...row, objectKey: `parity:mismatch:${cleanText(row.id)}`, objectKeys: Object.freeze(mismatchIdentityKeys(row)) });
}

export function buildTopologySceneViewModel(input) {
  const scene = objectRecord(input.scene), parsed = objectRecord(input.parsed), report = objectRecord(input.report), ciiParity = objectRecord(input.ciiParity);
  if (cleanText(scene.schema) !== 'TopologySvgScene.v1') throw new TypeError('Topology scene view model requires TopologySvgScene.v1.');
  const state = objectRecord(input.state), projection = cleanText(state.projection) || 'ISO', branch = cleanText(state.branch);
  const fullNodes = asArray(scene.nodes).map(objectRecord).map((row) => sceneNode(row, projection));
  const fullEdges = asArray(scene.edges).map(objectRecord).map((row) => sceneEdge(row, projection));
  const visibleEdges = fullEdges.filter((row) => branchVisible(row, branch));
  const visibleNodeIds = new Set(visibleEdges.flatMap((row) => [cleanText(row.fromCanonicalNodeId), cleanText(row.toCanonicalNodeId)]));
  const nodes = fullNodes.filter((row) => visibleNodeIds.has(cleanText(row.canonicalNodeId)));
  const activeEdges = branch ? visibleEdges : fullEdges;
  const unaffectedEdges = branch ? fullEdges.filter((row) => !branchVisible(row, branch)) : [];
  const supports = asArray(scene.supports).map(objectRecord).filter((row) => branchVisible(row, branch)).map((row) => supportView(row, projection));
  const deferredSupports = asArray(scene.deferredSupports).map(objectRecord).filter((row) => branchVisible(row, branch)).map((row) => scenePoint(row, 'deferred', projection));
  const rigids = asArray(scene.rigids).map(objectRecord).filter((row) => branchVisible(row, branch)).map((row) => deepFreeze({ ...row, objectKey: `scene:rigid:${cleanText(row.id)}` }));
  const junctions = asArray(scene.junctions).map(objectRecord).filter((row) => branchVisible(row, branch)).map((row) => scenePoint(row, 'junction', projection));
  const boundaries = asArray(scene.boundaries).map(objectRecord).filter((row) => branchVisible(row, branch)).map((row) => scenePoint(row, 'boundary', projection));
  const pointFeatures = asArray(scene.pointFeatures).map(objectRecord).filter((row) => branchVisible(row, branch)).map((row) => scenePoint(row, 'pointFeature', projection));
  const inputEdges = asArray(parsed.elements).map(objectRecord).map((row) => parsedEdge(row, projection));
  const ciiElements = asArray(ciiParity.elements).map(objectRecord);
  const ciiRecords = asArray(ciiParity.records).map(objectRecord);
  const mismatches = asArray(report.mismatches).map(objectRecord).map(mismatchView);
  const points = [...fullEdges.flatMap((row) => [row.projectedStart, row.projectedEnd]), ...supports.flatMap((row) => [row.projectedPosition, row.projectedSourcePosition]), ...deferredSupports.map((row) => row.projectedPosition), ...junctions.map((row) => row.projectedPosition), ...boundaries.map((row) => row.projectedPosition), ...pointFeatures.map((row) => row.projectedPosition)];
  const selectionLookup = buildSelectionLookup({ nodes: fullNodes, edges: fullEdges, inputEdges, ciiElements, ciiRecords, supports, deferredSupports, rigids, junctions, boundaries, pointFeatures, mismatches });
  return deepFreeze({
    schema: 'TopologyParitySvgViewModel.v1', projection, branch,
    canonicalTopologyHash: scene.canonicalTopologyHash, svgSceneHash: scene.svgSceneHash,
    bounds: calculateTopologyBounds(points), nodes, activeEdges, unaffectedEdges, inputEdges, ciiElements, ciiRecords,
    supports, deferredSupports, rigids, junctions, boundaries, pointFeatures, mismatches,
    selectedMismatchId: cleanText(state.selectedMismatchId), labels: state.labels === true,
    selectionLookup, summary: objectRecord(report.summary), ciiSummary: objectRecord(ciiParity.summary),
  });
}

export const _test = Object.freeze({ branchVisible, sceneNode, sceneEdge, scenePoint, supportView, parsedEdge, identityTexts, ciiIdentityKey, mismatchIdentityKeys, rowInputIds, buildSelectionLookup, mismatchView });
