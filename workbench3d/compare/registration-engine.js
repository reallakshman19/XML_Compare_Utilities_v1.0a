/**
 * registration-engine.js — coordinate registration from matched path anchors.
 *
 * Order of evidence (per plan): topology/path anchors first, then a rigid
 * transform estimate, then residual check. No global ICP. Piping revisions
 * share orientation, so the estimate is a best-fit translation from matched
 * anchor centroids; residuals are reported honestly so a rotated model shows
 * a loud warning instead of a silent bad overlay.
 *
 * Output: RegistrationAudit.v1
 */

import { CONTRACT_VERSIONS } from '../contracts/contracts.js';
import { DEFAULT_COMPARE_CONFIG } from './evidence-scorer.js';

export function buildRegistration(graphA, graphB, pathMappings, config = DEFAULT_COMPARE_CONFIG) {
  const nodeA = new Map(graphA.nodes.map((n) => [n.nodeId, n.coordMm]));
  const nodeB = new Map(graphB.nodes.map((n) => [n.nodeId, n.coordMm]));
  const pathsA = new Map(graphA.paths.map((p) => [p.pathId, p]));
  const pathsB = new Map(graphB.paths.map((p) => [p.pathId, p]));

  const anchorPairs = [];
  for (const mapping of pathMappings) {
    if (mapping.status !== 'MATCH') continue;
    const pathA = pathsA.get(mapping.sourcePathId);
    const pathB = pathsB.get(mapping.targetPathId);
    if (!pathA || !pathB) continue;
    for (const [aNode, bNode] of [[pathA.startNode, pathB.startNode], [pathA.endNode, pathB.endNode]]) {
      const a = nodeA.get(aNode);
      const b = nodeB.get(bNode);
      if (a && b) anchorPairs.push({ sourceNode: aNode, targetNode: bNode, source: a, target: b });
    }
  }

  if (!anchorPairs.length) {
    return {
      contract: CONTRACT_VERSIONS.RegistrationAudit,
      method: 'none',
      anchorCount: 0,
      translationMm: [0, 0, 0],
      residualMaxMm: null,
      residualAvgMm: null,
      warnings: ['No matched path anchors available; source rendered without registration.'],
      anchorPairs: [],
    };
  }

  const centroid = (points) => points
    .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
    .map((v) => v / points.length);
  const cA = centroid(anchorPairs.map((p) => p.source));
  const cB = centroid(anchorPairs.map((p) => p.target));
  const translation = [cB[0] - cA[0], cB[1] - cA[1], cB[2] - cA[2]];

  let residualMax = 0;
  let residualSum = 0;
  for (const pair of anchorPairs) {
    const moved = [pair.source[0] + translation[0], pair.source[1] + translation[1], pair.source[2] + translation[2]];
    pair.residualMm = Number(Math.hypot(moved[0] - pair.target[0], moved[1] - pair.target[1], moved[2] - pair.target[2]).toFixed(3));
    residualMax = Math.max(residualMax, pair.residualMm);
    residualSum += pair.residualMm;
  }
  const warnings = [];
  if (residualMax > config.registrationResidualToleranceMm) {
    warnings.push(`Registration residual ${residualMax.toFixed(1)} mm exceeds tolerance ${config.registrationResidualToleranceMm} mm — models may be rotated or topologically different.`);
  }

  return {
    contract: CONTRACT_VERSIONS.RegistrationAudit,
    method: 'anchor-centroid-translation',
    anchorCount: anchorPairs.length,
    translationMm: translation.map((v) => Number(v.toFixed(3))),
    residualMaxMm: Number(residualMax.toFixed(3)),
    residualAvgMm: Number((residualSum / anchorPairs.length).toFixed(3)),
    warnings,
    anchorPairs: anchorPairs.map((p) => ({ sourceNode: p.sourceNode, targetNode: p.targetNode, residualMm: p.residualMm })),
  };
}
