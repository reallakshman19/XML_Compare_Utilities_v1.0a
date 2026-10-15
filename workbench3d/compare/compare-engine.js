import { CONTRACT_VERSIONS, DIFF_STATUS, CONFIDENCE } from '../contracts/contracts.js';
import { scoreElementPair, DEFAULT_COMPARE_CONFIG } from './evidence-scorer.js';
import { extractBasisPairs, extractAnchorPairs } from './topology-identity.js';

/**
 * Fields compared on matched pairs. 'PROPERTIES' expands to the union of both
 * sides' property-block keys; pass an explicit key list in
 * config.compareFields to narrow the comparison to selected fields.
 */
export const DEFAULT_COMPARE_FIELDS = Object.freeze([
  'NAME', 'ELEMENT_LENGTH', 'RESTRAINTS', 'PROPERTIES',
]);

function getEdgeMidpoint(edge, nodesById) {
  const n1 = nodesById.get(edge.fromNodeId)?.position;
  const n2 = nodesById.get(edge.toNodeId)?.position;
  if (!n1 || !n2) return [0, 0, 0];
  return [(n1.x + n2.x) / 2, (n1.y + n2.y) / 2, (n1.z + n2.z) / 2];
}

function getEdgeLength(edge, nodesById) {
  if (Number.isFinite(edge.lengthMm)) return edge.lengthMm;
  const n1 = nodesById.get(edge.fromNodeId)?.position;
  const n2 = nodesById.get(edge.toNodeId)?.position;
  if (!n1 || !n2) return 0;
  return Math.hypot(n1.x - n2.x, n1.y - n2.y, n1.z - n2.z);
}

function scorePair(source, target, config, topoA, topoB, nodesA, nodesB) {
  const context = {
    sourceLength: getEdgeLength(source, nodesA),
    targetLength: getEdgeLength(target, nodesB),
    sourcePointFeatures: topoA.pointFeatures.filter((f) => f.nodeId === source.fromNodeId || f.nodeId === source.toNodeId),
    targetPointFeatures: topoB.pointFeatures.filter((f) => f.nodeId === target.fromNodeId || f.nodeId === target.toNodeId),
  };
  return scoreElementPair(source, target, config, context);
}

/**
 * Spatial fallback candidate scoring over the leftover pool.
 * Every leftover×leftover pair above the score floor is a candidate so the
 * ambiguity gate can see score-identical rivals even when they sit far apart;
 * `withinTolerance` marks which candidates may actually be accepted. Large
 * pools fall back to a proximity grid to stay O(n).
 */
function matchEdges(topoA, topoB, config, nodesA, nodesB, leftoverSource, leftoverTarget) {
  const coordA = new Map(topoA.edges.map(e => [e.id, getEdgeMidpoint(e, nodesA)]));
  const coordB = new Map(topoB.edges.map(e => [e.id, getEdgeMidpoint(e, nodesB)]));
  const tolerance = config.positionToleranceMm || 100;
  const sources = topoA.edges.filter((e) => leftoverSource.has(e.id));
  const targets = topoB.edges.filter((e) => leftoverTarget.has(e.id));
  const pairs = [];

  const consider = (source, target) => {
    const pair = scorePair(source, target, config, topoA, topoB, nodesA, nodesB);
    if (pair.score < config.minCandidateScore) return;
    const a = coordA.get(source.id);
    const b = coordB.get(target.id);
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    pairs.push({ sourceObjectId: source.id, targetObjectId: target.id, pair, withinTolerance: dist <= tolerance });
  };

  if (sources.length * targets.length <= 250000) {
    for (const source of sources) for (const target of targets) consider(source, target);
  } else {
    const cell = Math.max(1, tolerance);
    const grid = new Map();
    const keyOf = (c) => `${Math.floor(c[0]/cell)}|${Math.floor(c[1]/cell)}|${Math.floor(c[2]/cell)}`;
    for (const target of targets) {
      const key = keyOf(coordB.get(target.id));
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(target);
    }
    for (const source of sources) {
      const c = coordA.get(source.id);
      const base = [Math.floor(c[0]/cell), Math.floor(c[1]/cell), Math.floor(c[2]/cell)];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const target of grid.get(`${base[0]+dx}|${base[1]+dy}|${base[2]+dz}`) || []) consider(source, target);
      }
    }
  }
  pairs.sort((a, b) => b.pair.score - a.pair.score);
  return pairs;
}

/** node id → edges touching it. */
function adjacencyIndex(topo) {
  const byNode = new Map();
  for (const edge of topo.edges) {
    for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
      if (!byNode.has(nodeId)) byNode.set(nodeId, []);
      byNode.get(nodeId).push(edge);
    }
  }
  return byNode;
}

/**
 * Derived matching: starting from confirmed pairs, walk outward — unmatched
 * neighbours of a matched source edge are scored against unmatched neighbours
 * of its matched target edge. Robust against global reroutes because only
 * local evidence (kind, length, diameter, features) is used.
 */
function propagateFromBasis(seeds, topoA, topoB, config, nodesA, nodesB, leftoverSource, leftoverTarget, claim) {
  const adjA = adjacencyIndex(topoA);
  const adjB = adjacencyIndex(topoB);
  const edgesA = new Map(topoA.edges.map(e => [e.id, e]));
  const edgesB = new Map(topoB.edges.map(e => [e.id, e]));
  const queue = [...seeds];

  while (queue.length) {
    const { sourceObjectId, targetObjectId } = queue.shift();
    const source = edgesA.get(sourceObjectId);
    const target = edgesB.get(targetObjectId);
    if (!source || !target) continue;

    const neighboursA = [source.fromNodeId, source.toNodeId].flatMap((n) => adjA.get(n) ?? [])
      .filter((e) => leftoverSource.has(e.id));
    const neighboursB = [target.fromNodeId, target.toNodeId].flatMap((n) => adjB.get(n) ?? [])
      .filter((e) => leftoverTarget.has(e.id));
    if (!neighboursA.length || !neighboursB.length) continue;

    const scored = [];
    for (const a of neighboursA) {
      for (const b of neighboursB) {
        const pair = scorePair(a, b, config, topoA, topoB, nodesA, nodesB);
        if (pair.score >= config.minCandidateScore) scored.push({ sourceObjectId: a.id, targetObjectId: b.id, pair });
      }
    }
    scored.sort((x, y) => y.pair.score - x.pair.score);
    for (const cand of scored) {
      if (!leftoverSource.has(cand.sourceObjectId) || !leftoverTarget.has(cand.targetObjectId)) continue;
      // Local ambiguity gate: identical siblings at the same junction must not
      // be auto-paired — leave them for review instead of guessing.
      const rival = scored.find((p) => p !== cand
        && (p.sourceObjectId === cand.sourceObjectId || p.targetObjectId === cand.targetObjectId)
        && leftoverSource.has(p.sourceObjectId) && leftoverTarget.has(p.targetObjectId));
      if (rival && cand.pair.score - rival.pair.score < config.ambiguityGap) continue;
      claim({ ...cand, via: 'derived-adjacency' });
      queue.push(cand);
    }
  }
}

/**
 * Accept either CanonicalTopology.v1 ({ edges, nodes, pointFeatures }) or the
 * older CanonicalObjectGraph.v1 ({ objects, nodes:[{nodeId, coordMm}] }) and
 * normalize to the edge shape the engine works on. Object ids are preserved,
 * so audits reference the caller's ids either way.
 */
function normalizeTopology(topo) {
  if (Array.isArray(topo?.edges)) return topo;
  const edges = (topo?.objects ?? []).map((object, rawIndex) => ({
    ...object,
    id: object.objectId,
    fromNodeId: object.fromNode,
    toNodeId: object.toNode,
    segmentRole: object.kind,
    diameterMm: Number(object.diameterMm ?? object.properties?.DIAMETER ?? 0),
    lengthMm: Number.isFinite(object.lengthMm) ? object.lengthMm : undefined,
    name: object.name ?? object.properties?.NAME ?? '',
    ref: '',
    rawIndex: Number.isInteger(object.rawIndex) ? object.rawIndex : rawIndex,
    properties: object.properties ?? {},
    packets: object.packets ?? [],
  }));
  const nodes = (topo?.nodes ?? []).map((node) => ({
    id: node.nodeId ?? node.id,
    position: node.coordMm
      ? { x: node.coordMm[0], y: node.coordMm[1], z: node.coordMm[2] }
      : node.position ?? { x: 0, y: 0, z: 0 },
  }));
  return { ...topo, edges, nodes, pointFeatures: topo?.pointFeatures ?? [], supports: topo?.supports ?? [] };
}

export function runCompare(rawTopoA, rawTopoB, userConfig = {}, manualOverrides = []) {
  const topoA = normalizeTopology(rawTopoA);
  const topoB = normalizeTopology(rawTopoB);
  const config = { ...DEFAULT_COMPARE_CONFIG, positionToleranceMm: 100, compareFields: DEFAULT_COMPARE_FIELDS, ...userConfig };
  const edgesA = new Map(topoA.edges.map(e => [e.id, e]));
  const edgesB = new Map(topoB.edges.map(e => [e.id, e]));
  const nodesA = new Map(topoA.nodes.map(n => [n.id, n]));
  const nodesB = new Map(topoB.nodes.map(n => [n.id, n]));

  const leftoverSource = new Set(topoA.edges.map(e => e.id));
  const leftoverTarget = new Set(topoB.edges.map(e => e.id));
  const matchRecords = [];
  const ambiguousRecords = [];
  const candidateRows = [];

  // Rejected pairs (manual REJECT overrides) may never re-match automatically.
  const rejectedPairs = new Set((manualOverrides ?? [])
    .filter((o) => o.type === 'REJECT')
    .map((o) => `${o.sourceObjectId}|${o.targetObjectId}`));

  const claim = (record) => {
    if (rejectedPairs.has(`${record.sourceObjectId}|${record.targetObjectId}`)) return false;
    if (!leftoverSource.has(record.sourceObjectId) || !leftoverTarget.has(record.targetObjectId)) return false;
    matchRecords.push(record);
    leftoverSource.delete(record.sourceObjectId);
    leftoverTarget.delete(record.targetObjectId);
    return true;
  };

  // Phase 1 — manual basis connections (always win; REJECTs only exclude).
  for (const override of manualOverrides ?? []) {
    if (override.type === 'REJECT') continue;
    if (!edgesA.has(override.sourceObjectId) || !edgesB.has(override.targetObjectId)) continue;
    const pair = scorePair(edgesA.get(override.sourceObjectId), edgesB.get(override.targetObjectId), config, topoA, topoB, nodesA, nodesB);
    claim({ sourceObjectId: override.sourceObjectId, targetObjectId: override.targetObjectId, pair, via: 'manual', basis: true, basisDetail: override.detail ?? 'manual connection' });
  }

  // Phase 2 — automatic basis connections from source identity (highest confidence).
  const basisPairs = extractBasisPairs(topoA, topoB);
  for (const basis of basisPairs) {
    const pair = scorePair(edgesA.get(basis.sourceObjectId), edgesB.get(basis.targetObjectId), config, topoA, topoB, nodesA, nodesB);
    claim({ ...basis, pair, basis: true, basisDetail: basis.detail });
  }

  // Phase 3 — derived matches propagated outward from the basis network.
  propagateFromBasis(matchRecords.slice(), topoA, topoB, config, nodesA, nodesB, leftoverSource, leftoverTarget, claim);

  // Phase 4 — spatial fallback for whatever identity and adjacency missed.
  const allPairs = matchEdges(topoA, topoB, config, nodesA, nodesB, leftoverSource, leftoverTarget);

  for (const p of allPairs) {
    candidateRows.push({
      contract: CONTRACT_VERSIONS.MatchCandidate,
      sourceObjectId: p.sourceObjectId,
      targetObjectId: p.targetObjectId,
      score: p.pair.score,
      reasons: p.pair.reasons,
      conflicts: p.pair.conflicts,
      breakdown: p.pair.breakdown,
      origin: 'spatial-grid',
      selected: false,
    });
  }

  // Alternate spatial acceptance with adjacency propagation: every confirmed
  // pair unlocks its topological neighbours (path-order disambiguation), so a
  // score tie against a far-away twin resolves once a neighbouring element is
  // pinned down. Only pairs that stay tied after propagation become AMBIGUOUS.
  const rivalsOf = (cand) => allPairs.filter((p) => p !== cand
    && ((p.sourceObjectId === cand.sourceObjectId && leftoverTarget.has(p.targetObjectId))
      || (p.targetObjectId === cand.targetObjectId && leftoverSource.has(p.sourceObjectId))));

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const cand of allPairs) {
      if (!cand.withinTolerance) continue;
      if (!leftoverSource.has(cand.sourceObjectId) || !leftoverTarget.has(cand.targetObjectId)) continue;
      const rivals = rivalsOf(cand);
      const nextBestScore = rivals[0]?.pair.score ?? 0;
      const gap = cand.pair.score - nextBestScore;
      if (gap < config.ambiguityGap && nextBestScore >= config.minCandidateScore) continue; // still tied — try again after propagation
      if (claim({ ...cand, via: 'spatial-grid', gap, nextBestScore })) {
        progressed = true;
        propagateFromBasis([cand], topoA, topoB, config, nodesA, nodesB, leftoverSource, leftoverTarget, claim);
      }
    }
  }

  for (const cand of allPairs) {
    if (!cand.withinTolerance) continue;
    if (!leftoverSource.has(cand.sourceObjectId) || !leftoverTarget.has(cand.targetObjectId)) continue;
    const rivals = rivalsOf(cand);
    const nextBestScore = rivals[0]?.pair.score ?? 0;
    const gap = cand.pair.score - nextBestScore;
    const candidates = [cand, ...rivals.filter(r => r.sourceObjectId === cand.sourceObjectId)]
      .map(p => ({ targetObjectId: p.targetObjectId, score: p.pair.score }));
    ambiguousRecords.push({ sourceObjectId: cand.sourceObjectId, candidates, bestScore: cand.pair.score, gap });
    leftoverSource.delete(cand.sourceObjectId);
  }

  const diffRows = [];
  const conflictRows = [];
  let diffSeq = 0;
  let conflictSeq = 0;

  for (const record of matchRecords) {
    const source = edgesA.get(record.sourceObjectId);
    const target = edgesB.get(record.targetObjectId);
    const changed = compareFields(source, target, nodesA, nodesB, config);
    const geometryIssue = geometryChanged(source, target, nodesA, nodesB, config);

    diffRows.push({
      diffId: `D${++diffSeq}`,
      status: geometryIssue ? DIFF_STATUS.GEOMETRY_CHANGED
        : changed.length ? DIFF_STATUS.PROPERTY_CHANGED : DIFF_STATUS.MATCHED_UNCHANGED,
      sourceObjectId: record.sourceObjectId,
      targetObjectId: record.targetObjectId,
      score: record.basis ? 100 : record.pair.score,
      confidence: record.basis ? CONFIDENCE.HIGH
        : record.pair.score >= config.highConfidenceScore ? CONFIDENCE.HIGH
          : record.pair.score >= config.mediumConfidenceScore ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
      basis: Boolean(record.basis),
      via: record.via,
      reasons: record.basis ? [record.basisDetail, ...record.pair.reasons] : record.pair.reasons,
      conflicts: record.pair.conflicts,
      breakdown: record.pair.breakdown,
      changedProperties: changed,
      geometryIssue,
    });
  }

  for (const amb of ambiguousRecords) {
    const diffId = `D${(diffSeq += 1)}`;
    diffRows.push({
      diffId,
      status: DIFF_STATUS.AMBIGUOUS,
      sourceObjectId: amb.sourceObjectId,
      targetObjectId: null,
      score: amb.bestScore,
      nextBestScore: Number((amb.bestScore - amb.gap).toFixed(2)),
      scoreGap: amb.gap,
      confidence: CONFIDENCE.NONE,
      via: 'ambiguity-gate',
      reasons: [],
      conflicts: [`ambiguous: ${amb.candidates.length} candidate(s) within gap ${amb.gap}`],
      candidateTargetIds: amb.candidates.map((c) => c.targetObjectId),
      changedProperties: [],
      geometryIssue: null,
    });
    conflictRows.push({
      conflictId: `C${(conflictSeq += 1)}`,
      diffId,
      kind: 'AMBIGUOUS_MATCH',
      sourceObjectId: amb.sourceObjectId,
      targetObjectId: null,
      detail: `Candidates: ${amb.candidates.map((c) => `${c.targetObjectId} (${c.score})`).join(', ')}`,
      resolution: 'OPEN',
    });
  }

  for (const sid of leftoverSource) {
    diffRows.push({ diffId: `D${++diffSeq}`, status: DIFF_STATUS.MISSING_IN_TARGET, sourceObjectId: sid, targetObjectId: null, score: null, confidence: CONFIDENCE.NONE, via: 'unmatched', reasons: [], conflicts: [], changedProperties: [], geometryIssue: null });
  }
  for (const tid of leftoverTarget) {
    diffRows.push({ diffId: `D${++diffSeq}`, status: DIFF_STATUS.NEW_IN_TARGET, sourceObjectId: null, targetObjectId: tid, score: null, confidence: CONFIDENCE.NONE, via: 'unmatched', reasons: [], conflicts: [], changedProperties: [], geometryIssue: null });
  }

  const count = (status) => diffRows.filter((r) => r.status === status).length;
  const matchedRows = diffRows.filter((r) => r.sourceObjectId && r.targetObjectId);
  const registration = buildRegistrationFromBasis(topoA, topoB, matchRecords, nodesA, nodesB, config);

  // Legacy dashboard fields: raw/consumed counts and path tallies come from
  // the caller's graph when present (CanonicalObjectGraph inputs).
  const pathIdOf = (edge) => edge.pathId ?? edge.ownerBranchId ?? null;
  const pathsOf = (topo, raw) => raw?.paths?.length ?? new Set(topo.edges.map(pathIdOf).filter(Boolean)).size;
  const matchedSourceIds = new Set(matchedRows.map((r) => r.sourceObjectId));
  const edgeByIdA = new Map(topoA.edges.map((e) => [e.id, e]));
  const matchedPathIds = new Set([...matchedSourceIds].map((id) => pathIdOf(edgeByIdA.get(id) ?? {})).filter(Boolean));

  return {
    contract: CONTRACT_VERSIONS.CompareAudit,
    compareKind: 'topology-edge',
    sourceObjectIds: topoA.edges.map(e => e.id),
    targetObjectIds: topoB.edges.map(e => e.id),
    summary: {
      sourceRawElements: rawTopoA.rawElementCount ?? topoA.edges.length,
      targetRawElements: rawTopoB.rawElementCount ?? topoB.edges.length,
      sourceCanonicalElements: topoA.edges.length,
      targetCanonicalElements: topoB.edges.length,
      consumedSourceElements: rawTopoA.consumedRows?.length ?? 0,
      consumedTargetElements: rawTopoB.consumedRows?.length ?? 0,
      sourcePaths: pathsOf(topoA, rawTopoA),
      targetPaths: pathsOf(topoB, rawTopoB),
      matchedPaths: matchedPathIds.size,
      matchedElements: matchedRows.length,
      basisElements: diffRows.filter((r) => r.basis).length,
      highConfidenceElements: matchedRows.filter((r) => r.confidence === CONFIDENCE.HIGH).length,
      mediumConfidenceElements: matchedRows.filter((r) => r.confidence === CONFIDENCE.MEDIUM).length,
      lowConfidenceElements: matchedRows.filter((r) => r.confidence === CONFIDENCE.LOW).length,
      evidenceConflictElements: matchedRows.filter((r) => (r.conflicts ?? []).length > 0).length,
      averageMatchScore: matchedRows.length
        ? Number((matchedRows.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / matchedRows.length).toFixed(2))
        : 0,
      registrationAnchorCount: registration.anchorPairs.length,
      registrationResidualMaxMm: registration.residualMaxMm,
      splitElements: count(DIFF_STATUS.SPLIT),
      mergeElements: count(DIFF_STATUS.MERGE),
      unchangedElements: count(DIFF_STATUS.MATCHED_UNCHANGED),
      propertyChangedElements: count(DIFF_STATUS.PROPERTY_CHANGED),
      geometryChangedElements: count(DIFF_STATUS.GEOMETRY_CHANGED),
      missingInTarget: count(DIFF_STATUS.MISSING_IN_TARGET),
      newInTarget: count(DIFF_STATUS.NEW_IN_TARGET),
      ambiguousElements: count(DIFF_STATUS.AMBIGUOUS),
      ambiguousPaths: 0,
      conflictCount: conflictRows.length,
    },
    objectDiff: { contract: CONTRACT_VERSIONS.ObjectDiff, rows: diffRows },
    conflictLedger: { contract: CONTRACT_VERSIONS.ConflictLedger, rows: conflictRows },
    matchCandidates: { contract: CONTRACT_VERSIONS.MatchCandidate, rows: candidateRows },
    pathAudit: { mappings: [], unmatchedSourcePaths: [], unmatchedTargetPaths: [], alignmentRows: [] },
    normalization: {
      source: { rule: rawTopoA.normalizationRule ?? 'none', consumedRows: rawTopoA.consumedRows ?? [] },
      target: { rule: rawTopoB.normalizationRule ?? 'none', consumedRows: rawTopoB.consumedRows ?? [] },
    },
    registration,
  };
}

/**
 * Registration from identity evidence: matched support tags plus the node
 * endpoints of basis/high-confidence matches anchor a best-fit translation.
 * Residuals stay honest — a reroute shows large residuals, never a silent
 * bad overlay.
 */
function buildRegistrationFromBasis(topoA, topoB, matchRecords, nodesA, nodesB, config) {
  const pairs = [];
  const seen = new Set();
  const addPair = (sourceNode, targetNode, tag) => {
    const key = `${sourceNode}->${targetNode}`;
    if (seen.has(key)) return;
    const a = nodesA.get(sourceNode)?.position;
    const b = nodesB.get(targetNode)?.position;
    if (!a || !b) return;
    seen.add(key);
    pairs.push({ sourceNode, targetNode, tag: tag ?? null, source: [a.x, a.y, a.z], target: [b.x, b.y, b.z] });
  };

  for (const anchor of extractAnchorPairs(topoA, topoB)) addPair(anchor.sourceNode, anchor.targetNode, anchor.tag);
  const edgesA = new Map(topoA.edges.map((e) => [e.id, e]));
  const edgesB = new Map(topoB.edges.map((e) => [e.id, e]));
  for (const record of matchRecords) {
    if (!record.basis && !(record.pair?.score >= config.highConfidenceScore)) continue;
    const source = edgesA.get(record.sourceObjectId);
    const target = edgesB.get(record.targetObjectId);
    if (!source || !target) continue;
    addPair(source.fromNodeId, target.fromNodeId);
    addPair(source.toNodeId, target.toNodeId);
  }

  if (!pairs.length) {
    return {
      contract: CONTRACT_VERSIONS.RegistrationAudit,
      method: 'none', anchorCount: 0, translationMm: [0, 0, 0],
      residualMaxMm: null, residualAvgMm: null,
      warnings: ['No identity anchors available; source rendered without registration.'],
      anchorPairs: [],
    };
  }

  const centroid = (points) => points
    .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
    .map((v) => v / points.length);
  const cA = centroid(pairs.map((p) => p.source));
  const cB = centroid(pairs.map((p) => p.target));
  const translation = [cB[0] - cA[0], cB[1] - cA[1], cB[2] - cA[2]];

  let residualMax = 0;
  let residualSum = 0;
  for (const pair of pairs) {
    pair.residualMm = Number(Math.hypot(
      pair.source[0] + translation[0] - pair.target[0],
      pair.source[1] + translation[1] - pair.target[1],
      pair.source[2] + translation[2] - pair.target[2],
    ).toFixed(3));
    residualMax = Math.max(residualMax, pair.residualMm);
    residualSum += pair.residualMm;
  }
  const warnings = [];
  const tolerance = config.registrationResidualToleranceMm ?? 50;
  if (residualMax > tolerance) {
    warnings.push(`Registration residual ${residualMax.toFixed(1)} mm exceeds tolerance ${tolerance} mm — the route was re-run or partially rerouted; basis connectors remain trustworthy, spatial overlay is approximate.`);
  }

  return {
    contract: CONTRACT_VERSIONS.RegistrationAudit,
    method: 'identity-anchor-translation',
    anchorCount: pairs.length,
    translationMm: translation.map((v) => Number(v.toFixed(3))),
    residualMaxMm: Number(residualMax.toFixed(3)),
    residualAvgMm: Number((residualSum / pairs.length).toFixed(3)),
    warnings,
    anchorPairs: pairs.map((p) => ({ sourceNode: p.sourceNode, targetNode: p.targetNode, tag: p.tag, residualMm: p.residualMm })),
  };
}

/** Length/direction change on a matched pair (position-independent). */
function geometryChanged(source, target, nodesA, nodesB, config) {
  const sLen = getEdgeLength(source, nodesA);
  const tLen = getEdgeLength(target, nodesB);
  if (Number.isFinite(sLen) && Number.isFinite(tLen) && Math.abs(sLen - tLen) > (config.lengthToleranceMm ?? 6)) {
    return `length Δ=${Math.abs(sLen - tLen).toFixed(1)}mm`;
  }
  const direction = (edge, nodes) => {
    const a = nodes.get(edge.fromNodeId)?.position;
    const b = nodes.get(edge.toNodeId)?.position;
    if (!a || !b) return null;
    const v = [b.x - a.x, b.y - a.y, b.z - a.z];
    const len = Math.hypot(v[0], v[1], v[2]);
    return len > 1e-6 ? v.map((x) => x / len) : null;
  };
  const dirA = direction(source, nodesA);
  const dirB = direction(target, nodesB);
  if (dirA && dirB) {
    const dot = Math.abs(dirA[0] * dirB[0] + dirA[1] * dirB[1] + dirA[2] * dirB[2]);
    if (dot < 0.985) return `direction differs (cos=${dot.toFixed(3)})`;
  }
  return null;
}

/** Compare the selected field set on a matched pair. */
function compareFields(source, target, nodesA, nodesB, config) {
  const fields = config.compareFields ?? DEFAULT_COMPARE_FIELDS;
  const changed = [];
  const push = (property, sourceValue, targetValue) => changed.push({ property, sourceValue, targetValue });

  if (source.segmentRole !== target.segmentRole) push('segmentRole', source.segmentRole, target.segmentRole);

  const sDia = Number(source.diameterMm || 0);
  const tDia = Number(target.diameterMm || 0);
  if (sDia && tDia && Math.abs(sDia - tDia) > 1e-4) push('diameterMm', source.diameterMm, target.diameterMm);

  const expanded = fields.includes('PROPERTIES')
    ? [...fields.filter((f) => f !== 'PROPERTIES'),
       ...new Set([...Object.keys(source.properties ?? {}), ...Object.keys(target.properties ?? {})])]
    : fields;
  for (const field of [...new Set(expanded)]) {
    if (field === 'ELEMENT_LENGTH') {
      const sLen = getEdgeLength(source, nodesA);
      const tLen = getEdgeLength(target, nodesB);
      if (Number.isFinite(sLen) && Number.isFinite(tLen) && Math.abs(sLen - tLen) > (config.lengthToleranceMm ?? 6)) {
        push('ELEMENT_LENGTH', `${sLen.toFixed(1)}mm`, `${tLen.toFixed(1)}mm`);
      }
      continue;
    }
    if (field === 'NAME') {
      const sName = source.name ?? '';
      const tName = target.name ?? '';
      if ((sName || tName) && sName !== tName) push('NAME', sName, tName);
      continue;
    }
    if (field === 'RESTRAINTS') {
      const signature = (edge) => (edge.packets ?? []).filter((p) => p.kind === 'RESTRAINT')
        .map((p) => p.attrs?.TYPE ?? '').sort().join('+');
      const sSig = signature(source);
      const tSig = signature(target);
      if ((sSig || tSig) && sSig !== tSig) push('RESTRAINTS', sSig || '(none)', tSig || '(none)');
      continue;
    }
    const sValue = source.properties?.[field];
    const tValue = target.properties?.[field];
    if (sValue == null && tValue == null) continue;
    if (String(sValue ?? '') === String(tValue ?? '')) continue;
    const sNum = Number(sValue);
    const tNum = Number(tValue);
    if (Number.isFinite(sNum) && Number.isFinite(tNum) && Math.abs(sNum - tNum) < 1e-4) continue;
    push(field, sValue ?? '', tValue ?? '');
  }
  return changed;
}
