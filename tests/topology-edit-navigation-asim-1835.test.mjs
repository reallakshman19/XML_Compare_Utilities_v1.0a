/** Real ASIM-1835 coordinates with simulated, pure navigation/drag calculations. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { canonicalInteractionDistance, solveEditDrag } from '../tabs/topology-trace-validator/topology-edit-drag-solver.js';
import { viewToWorldCoordinates, worldToViewCoordinates } from '../workbench3d/viewer/workbench-navigation-state.js';
import { deriveFloatingOrigin } from '../workbench3d/viewer/scene-runtime.js';

const fixturePath = process.env.ASIM_1835_SOURCE
  || 'C:/Users/reall/Downloads/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json';
const exporterUrl = new URL('../../3D_Converters/tabs/model-converters/converters/component-topology/topology-artifact-exporter.js', import.meta.url);
const branchName = '/ASIM-1835-1/2"-P8810294-36620T3/B2';

if (!existsSync(fixturePath) || !existsSync(exporterUrl)) {
  console.log(`topology edit navigation ASIM-1835 SKIPPED: missing real fixture or exporter (${fixturePath})`);
} else {
  const sourceText = readFileSync(fixturePath, 'utf8');
  const source = JSON.parse(sourceText);
  const branches = Array.isArray(source) ? source : (source.hierarchy ?? source.branches ?? source.objects ?? []);
  const branchIndex = branches.findIndex((branch) => branch?.name === branchName || branch?.attributes?.NAME === branchName);
  assert.ok(branchIndex >= 0, `real acceptance branch ${branchName} exists`);
  const { buildComponentTopologyArtifacts } = await import(exporterUrl.href);
  const built = await buildComponentTopologyArtifacts(sourceText, {
    sourceName: 'ASIM-1835.json', jobName: 'ASIM-1835 Navigation', toleranceMm: 0.1,
    supportProjectionToleranceMm: 50, enrichmentConfig: {},
  });
  const canonical = built.canonicalTopology;
  assert.equal(canonical.nodes.length, 4406);
  assert.equal(canonical.edges.length, 4434);
  const pathPrefix = `$.objects[${branchIndex}]`;
  const scopedEdges = canonical.edges.filter((edge) => edge.sourcePaths?.some((path) => path === pathPrefix || path.startsWith(`${pathPrefix}.`)));
  const scopedNodeIds = new Set(scopedEdges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]));
  const scopedNodes = canonical.nodes.filter((node) => scopedNodeIds.has(node.id));
  assert.ok(scopedEdges.length > 50, 'largest real branch has a substantial editable route');

  const points = canonical.nodes.map((node) => [node.position.x, node.position.y, node.position.z]);
  const bounds = {
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  };
  const origin = deriveFloatingOrigin({ source: { bounds }, target: { bounds }, registrationTranslation: [0, 0, 0] }, 1000);
  const maxDistance = canonicalInteractionDistance(canonical);
  const beforeHash = canonical.canonicalTopologyHash;
  for (const node of scopedNodes.slice(0, 100)) {
    const point = [node.position.x, node.position.y, node.position.z];
    assert.deepEqual(viewToWorldCoordinates(worldToViewCoordinates(point, origin), origin), point);
    const solved = solveEditDrag({
      ray: { origin: [point[0], point[1], point[2] + 1000], direction: [0, 0, -1] },
      start: point, planeNormal: [0, 0, 1], axis: null, maxDistance, lastValid: point,
    });
    assert.equal(solved.valid, true);
    assert.deepEqual(solved.point, point);
  }
  assert.equal(canonical.canonicalTopologyHash, beforeHash, 'navigation calculations do not mutate topology');
  console.log(`topology edit navigation ASIM-1835 passed [SIMULATED interactions; REAL model] ${JSON.stringify({
    branches: branches.length, nodes: canonical.nodes.length, edges: canonical.edges.length,
    branch: branchName, scopedNodes: scopedNodes.length, scopedEdges: scopedEdges.length, floatingOrigin: origin,
  })}`);
}
