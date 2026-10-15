/**
 * node-compare-engine.js — node-wise compare for NodeSet graphs (Package C).
 *
 * Produces the full CompareAudit.v1 envelope (same summary keys, empty path
 * audit, registration stub) so the dashboard, alerts, pivot, floating panels,
 * connector model, and transfer planner all work unchanged.
 *
 * Matching: spatial grid bucketing (cell = positionToleranceMm) for O(n)
 * candidate search; evidence = position delta + tag + bore + support kinds.
 * Ambiguity gate mirrors the piping engine: close rivals → AMBIGUOUS with
 * candidateTargetIds, never auto-matched.
 */

import { CONTRACT_VERSIONS, DIFF_STATUS, CONFIDENCE } from '../contracts/contracts.js';
import { loadDeltaBetween } from '../tablexml/load-cases.js';
import { measureDeltaBetween } from '../tablexml/measures.js';

export const DEFAULT_NODE_COMPARE_CONFIG = Object.freeze({
  positionToleranceMm: 100,
  ambiguityGap: 8,
  highConfidenceScore: 80,
  mediumConfidenceScore: 60,
  minCandidateScore: 40,
  positionWeight: 45,
  tagWeight: 20,
  boreWeight: 15,
  supportWeight: 20,
  // Key ladder (vision doc): reference id first, then support id, then spatial.
  useReferenceKey: true,
  useIdKey: true,
});

/** Revision-context props excluded from PROPERTY_CHANGED classification. */
const METADATA_PROPS = Object.freeze(new Set(['REVISION', 'REMARKS', 'FLAGS']));
/** Measure props are reported as a delta, not as a raw property change. */
const isMeasureKey = (key) => key.startsWith('MEASURE_') || /^LC\d+_/.test(key);

function nodeCoordOf(graph, object) {
  const node = graph.nodes.find((n) => n.nodeId === object.fromNode);
  return node ? node.coordMm : [0, 0, 0];
}

function supportKinds(object) {
  return (object.packets ?? []).map((p) => p.attrs?.KIND ?? p.kind).sort();
}

export function scoreNodePair(source, target, sourceCoord, targetCoord, config) {
  const delta = Math.hypot(sourceCoord[0] - targetCoord[0], sourceCoord[1] - targetCoord[1], sourceCoord[2] - targetCoord[2]);
  const breakdown = [];
  const reasons = [];
  const conflicts = [];
  let weightTotal = 0;
  let earned = 0;
  const add = (evidence, weight, fraction, detail) => {
    if (fraction === null) return;
    weightTotal += weight;
    earned += weight * Math.max(0, Math.min(1, fraction));
    breakdown.push({ evidence, weight, earned: Number((weight * fraction).toFixed(2)), detail });
    if (fraction >= 0.9) reasons.push(`${evidence}: ${detail}`);
    if (fraction <= 0.25) conflicts.push(`${evidence}: ${detail}`);
  };

  add('position', config.positionWeight, Math.max(0, 1 - delta / config.positionToleranceMm), `Δ=${delta.toFixed(1)}mm`);

  const tagA = String(source.properties?.TAG ?? '').trim();
  const tagB = String(target.properties?.TAG ?? '').trim();
  if (tagA || tagB) add('tag', config.tagWeight, tagA && tagB ? (tagA === tagB ? 1 : 0.15) : 0.5, `"${tagA}" vs "${tagB}"`);

  const boreA = Number(source.properties?.BORE);
  const boreB = Number(target.properties?.BORE);
  if (Number.isFinite(boreA) && Number.isFinite(boreB)) {
    add('bore', config.boreWeight, Math.abs(boreA - boreB) < 0.5 ? 1 : Math.max(0, Math.min(boreA, boreB) / Math.max(boreA, boreB) - 0.3), `${boreA} vs ${boreB}`);
  }

  const kindsA = supportKinds(source);
  const kindsB = supportKinds(target);
  if (kindsA.length || kindsB.length) {
    const common = kindsA.filter((k) => kindsB.includes(k)).length;
    add('supports', config.supportWeight, common / Math.max(kindsA.length, kindsB.length, 1), `[${kindsA}] vs [${kindsB}]`);
  }

  const score = weightTotal > 0 ? Number(((earned / weightTotal) * 100).toFixed(2)) : 0;
  return { score, positionDeltaMm: Number(delta.toFixed(3)), breakdown, reasons, conflicts };
}

/** Spatial-grid candidate generation + greedy selection with ambiguity gate. */
export function matchNodes(graphA, graphB, config) {
  const coordA = new Map(graphA.objects.map((o) => [o.objectId, nodeCoordOf(graphA, o)]));
  const coordB = new Map(graphB.objects.map((o) => [o.objectId, nodeCoordOf(graphB, o)]));
  const cell = Math.max(1, config.positionToleranceMm);
  const grid = new Map();
  const keyOf = (c) => `${Math.floor(c[0] / cell)}|${Math.floor(c[1] / cell)}|${Math.floor(c[2] / cell)}`;
  for (const target of graphB.objects) {
    const key = keyOf(coordB.get(target.objectId));
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(target);
  }
  const pairs = [];
  for (const source of graphA.objects) {
    const c = coordA.get(source.objectId);
    const base = [Math.floor(c[0] / cell), Math.floor(c[1] / cell), Math.floor(c[2] / cell)];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          for (const target of grid.get(`${base[0] + dx}|${base[1] + dy}|${base[2] + dz}`) ?? []) {
            const pair = scoreNodePair(source, target, c, coordB.get(target.objectId), config);
            if (pair.score >= config.minCandidateScore) pairs.push({ sourceObjectId: source.objectId, targetObjectId: target.objectId, pair });
          }
        }
      }
    }
  }
  pairs.sort((a, b) => b.pair.score - a.pair.score);
  return pairs;
}

export function runNodeCompare(graphA, graphB, userConfig = {}, manualOverrides = []) {
  const config = { ...DEFAULT_NODE_COMPARE_CONFIG, ...userConfig };
  const objA = new Map(graphA.objects.map((o) => [o.objectId, o]));
  const objB = new Map(graphB.objects.map((o) => [o.objectId, o]));

  const leftoverSource = new Set(graphA.objects.map((o) => o.objectId));
  const leftoverTarget = new Set(graphB.objects.map((o) => o.objectId));
  const matchRecords = [];
  const ambiguousRecords = [];
  const candidateRows = [];

  // ── Tier 1/2: key ladder — reference id, then support/node id. Keys match
  //    globally (no spatial gate), so moved-but-same-reference nodes survive.
  const keyTiers = [];
  if (config.useReferenceKey) keyTiers.push(['key-ref', 'reference', (o) => String(o.properties?.REF ?? '').trim()]);
  if (config.useIdKey) keyTiers.push(['key-id', 'support id', (o) => String(o.fromNode ?? '').trim()]);
  for (const [via, label, keyFn] of keyTiers) {
    const groupByKey = (graph, leftovers) => {
      const map = new Map();
      for (const object of graph.objects) {
        if (!leftovers.has(object.objectId)) continue;
        const key = keyFn(object);
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(object);
      }
      return map;
    };
    const srcByKey = groupByKey(graphA, leftoverSource);
    const tgtByKey = groupByKey(graphB, leftoverTarget);
    for (const [key, srcList] of srcByKey) {
      const tgtList = tgtByKey.get(key);
      // Only unique 1:1 keys match here; duplicates fall through to spatial.
      if (srcList.length !== 1 || !tgtList || tgtList.length !== 1) continue;
      const source = srcList[0];
      const target = tgtList[0];
      const pair = scoreNodePair(source, target, nodeCoordOf(graphA, source), nodeCoordOf(graphB, target), config);
      pair.reasons.unshift(`${label} key equal: ${key}`);
      matchRecords.push({ sourceObjectId: source.objectId, targetObjectId: target.objectId, pair, via, gap: 100, nextBestScore: 0 });
      leftoverSource.delete(source.objectId);
      leftoverTarget.delete(target.objectId);
      candidateRows.push({
        contract: CONTRACT_VERSIONS.MatchCandidate,
        sourceObjectId: source.objectId,
        targetObjectId: target.objectId,
        score: pair.score,
        reasons: pair.reasons,
        conflicts: pair.conflicts,
        breakdown: pair.breakdown,
        origin: via,
        selected: true,
      });
    }
  }

  // ── Tier 3: spatial-grid evidence matching for the rest ────────────────
  const allPairs = matchNodes(graphA, graphB, config);
  for (const p of allPairs) {
    candidateRows.push({
      contract: CONTRACT_VERSIONS.MatchCandidate,
      sourceObjectId: p.sourceObjectId,
      targetObjectId: p.targetObjectId,
      score: p.pair.score,
      reasons: p.pair.reasons,
      conflicts: p.pair.conflicts,
      breakdown: p.pair.breakdown,
      origin: 'node-grid',
      selected: false,
    });
  }

  for (const cand of allPairs) {
    if (!leftoverSource.has(cand.sourceObjectId) || !leftoverTarget.has(cand.targetObjectId)) continue;
    const rivals = allPairs.filter((p) => p !== cand
      && ((p.sourceObjectId === cand.sourceObjectId && leftoverTarget.has(p.targetObjectId))
        || (p.targetObjectId === cand.targetObjectId && leftoverSource.has(p.sourceObjectId))));
    const nextBestScore = rivals[0]?.pair.score ?? 0;
    const gap = cand.pair.score - nextBestScore;
    if (gap < config.ambiguityGap && nextBestScore >= config.minCandidateScore) {
      const candidates = [cand, ...rivals.filter((r) => r.sourceObjectId === cand.sourceObjectId)]
        .map((p) => ({ targetObjectId: p.targetObjectId, score: p.pair.score }));
      ambiguousRecords.push({ sourceObjectId: cand.sourceObjectId, candidates, bestScore: cand.pair.score, gap: Number(gap.toFixed(2)) });
      leftoverSource.delete(cand.sourceObjectId);
      continue;
    }
    matchRecords.push({ ...cand, via: 'node-grid', gap: Number(gap.toFixed(2)), nextBestScore });
    leftoverSource.delete(cand.sourceObjectId);
    leftoverTarget.delete(cand.targetObjectId);
  }

  // Manual overrides — same semantics as the piping engine.
  for (const override of manualOverrides) {
    if (override.type === 'REJECT') {
      const idx = matchRecords.findIndex((m) => m.sourceObjectId === override.sourceObjectId && m.targetObjectId === override.targetObjectId);
      if (idx >= 0) {
        const [removed] = matchRecords.splice(idx, 1);
        leftoverSource.add(removed.sourceObjectId);
        leftoverTarget.add(removed.targetObjectId);
      }
    } else if (override.type === 'LINK' || override.type === 'ACCEPT') {
      for (let idx = matchRecords.length - 1; idx >= 0; idx -= 1) {
        const m = matchRecords[idx];
        if (m.sourceObjectId === override.sourceObjectId || m.targetObjectId === override.targetObjectId) {
          matchRecords.splice(idx, 1);
          leftoverSource.add(m.sourceObjectId);
          leftoverTarget.add(m.targetObjectId);
        }
      }
      const ambIdx = ambiguousRecords.findIndex((a) => a.sourceObjectId === override.sourceObjectId);
      if (ambIdx >= 0) ambiguousRecords.splice(ambIdx, 1);
      const source = objA.get(override.sourceObjectId);
      const target = objB.get(override.targetObjectId);
      if (source && target) {
        const pair = scoreNodePair(source, target, nodeCoordOf(graphA, source), nodeCoordOf(graphB, target), config);
        matchRecords.push({ sourceObjectId: source.objectId, targetObjectId: target.objectId, pair, via: 'manual-override', gap: 100, nextBestScore: 0 });
        leftoverSource.delete(source.objectId);
        leftoverTarget.delete(target.objectId);
      }
    }
  }
  for (const record of matchRecords) {
    const row = candidateRows.find((c) => c.sourceObjectId === record.sourceObjectId && c.targetObjectId === record.targetObjectId);
    if (row) row.selected = true;
  }

  // ── diff rows ──────────────────────────────────────────────────────────
  const diffRows = [];
  const conflictRows = [];
  let diffSeq = 0;
  let conflictSeq = 0;
  for (const record of matchRecords) {
    const source = objA.get(record.sourceObjectId);
    const target = objB.get(record.targetObjectId);
    const changed = [];
    const keys = new Set([...Object.keys(source.properties), ...Object.keys(target.properties)]);
    const ignored = new Set(config.ignoredProps ?? []);
    for (const key of keys) {
      if (METADATA_PROPS.has(key) || isMeasureKey(key) || ignored.has(key)) continue; // reported as deltas or excluded by the role-map audit
      const a = source.properties[key] ?? '';
      const b = target.properties[key] ?? '';
      if (String(a) !== String(b)) changed.push({ property: key, sourceValue: a, targetValue: b });
    }
    const supA = supportKinds(source).join('+');
    const supB = supportKinds(target).join('+');
    if (supA !== supB) changed.push({ property: 'SUPPORTS', sourceValue: supA, targetValue: supB });
    const confidence = record.via === 'manual-override' || String(record.via).startsWith('key')
      ? CONFIDENCE.HIGH
      : record.gap < config.ambiguityGap ? CONFIDENCE.NONE
        : record.pair.score >= config.highConfidenceScore ? CONFIDENCE.HIGH
          : record.pair.score >= config.mediumConfidenceScore ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
    const reasons = [...record.pair.reasons];
    const flags = [...new Set([source.properties.FLAGS, target.properties.FLAGS].filter(Boolean).flatMap((f) => String(f).split('|')))];
    if (flags.length) reasons.push(`remarks flags: ${flags.join(', ')}`);
    const loadDelta = loadDeltaBetween(source.properties, target.properties);
    const measureDelta = measureDeltaBetween(source.properties, target.properties);
    const hasMeasureChange = measureDelta && measureDelta.maxDeltaPct > 0.01;
    diffRows.push({
      diffId: `D${(diffSeq += 1)}`,
      status: (changed.length || hasMeasureChange) ? DIFF_STATUS.PROPERTY_CHANGED : DIFF_STATUS.MATCHED_UNCHANGED,
      sourceObjectId: record.sourceObjectId,
      targetObjectId: record.targetObjectId,
      score: record.pair.score,
      nextBestScore: record.nextBestScore,
      scoreGap: record.gap,
      confidence,
      via: record.via,
      reasons,
      conflicts: record.pair.conflicts,
      breakdown: record.pair.breakdown,
      changedProperties: changed,
      geometryIssue: null,
      positionDeltaMm: record.pair.positionDeltaMm,
      loadDeltaPct: loadDelta ? loadDelta.maxDeltaPct : undefined,
      measureDeltaPct: measureDelta ? measureDelta.maxDeltaPct : undefined,
      measures: measureDelta ? measureDelta.measures : undefined,
      remarkFlags: flags,
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
    diffRows.push({ diffId: `D${(diffSeq += 1)}`, status: DIFF_STATUS.MISSING_IN_TARGET, sourceObjectId: sid, targetObjectId: null, score: null, confidence: CONFIDENCE.NONE, via: 'unmatched', reasons: [], conflicts: [], changedProperties: [], geometryIssue: null });
  }
  for (const tid of leftoverTarget) {
    diffRows.push({ diffId: `D${(diffSeq += 1)}`, status: DIFF_STATUS.NEW_IN_TARGET, sourceObjectId: null, targetObjectId: tid, score: null, confidence: CONFIDENCE.NONE, via: 'unmatched', reasons: [], conflicts: [], changedProperties: [], geometryIssue: null });
  }

  const count = (status) => diffRows.filter((r) => r.status === status).length;
  const matchedRows = diffRows.filter((r) => r.sourceObjectId && r.targetObjectId);
  const scored = matchedRows.filter((r) => Number.isFinite(r.score));
  const summary = {
    sourceRawElements: graphA.rawElementCount,
    targetRawElements: graphB.rawElementCount,
    sourceCanonicalElements: graphA.canonicalElementCount,
    targetCanonicalElements: graphB.canonicalElementCount,
    consumedSourceElements: 0,
    consumedTargetElements: 0,
    sourcePaths: graphA.paths.length,
    targetPaths: graphB.paths.length,
    matchedPaths: matchedRows.length,
    ambiguousPaths: 0,
    matchedElements: matchedRows.length,
    unchangedElements: count(DIFF_STATUS.MATCHED_UNCHANGED),
    propertyChangedElements: count(DIFF_STATUS.PROPERTY_CHANGED),
    geometryChangedElements: 0,
    missingInTarget: count(DIFF_STATUS.MISSING_IN_TARGET),
    newInTarget: count(DIFF_STATUS.NEW_IN_TARGET),
    ambiguousElements: count(DIFF_STATUS.AMBIGUOUS),
    splitElements: 0,
    mergeElements: 0,
    highConfidenceElements: matchedRows.filter((r) => r.confidence === CONFIDENCE.HIGH).length,
    mediumConfidenceElements: matchedRows.filter((r) => r.confidence === CONFIDENCE.MEDIUM).length,
    lowConfidenceElements: matchedRows.filter((r) => r.confidence === CONFIDENCE.LOW).length,
    evidenceConflictElements: 0,
    conflictCount: conflictRows.length,
    averageMatchScore: scored.length ? Number((scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(2)) : 0,
    registrationAnchorCount: 0,
    registrationResidualMaxMm: null,
    registrationResidualAvgMm: null,
    maxPositionDeltaMm: Math.max(0, ...matchedRows.map((r) => r.positionDeltaMm ?? 0)),
    keyMatchedElements: matchedRows.filter((r) => String(r.via).startsWith('key')).length,
    loadChangedElements: matchedRows.filter((r) => (r.loadDeltaPct ?? 0) > 0.01).length,
    maxLoadDeltaPct: Math.max(0, ...matchedRows.map((r) => r.loadDeltaPct ?? 0)),
    measureChangedElements: matchedRows.filter((r) => (r.measureDeltaPct ?? 0) > 0.01).length,
    maxMeasureDeltaPct: Math.max(0, ...matchedRows.map((r) => r.measureDeltaPct ?? 0)),
    remarkFlaggedElements: matchedRows.filter((r) => r.remarkFlags?.length).length,
  };

  return {
    contract: CONTRACT_VERSIONS.CompareAudit,
    compareKind: 'node-wise',
    profileId: config.profileId ?? null,
    generatedAt: new Date().toISOString(),
    config,
    sourceModelId: graphA.modelId,
    targetModelId: graphB.modelId,
    sourceObjectIds: graphA.objects.map((o) => o.objectId),
    targetObjectIds: graphB.objects.map((o) => o.objectId),
    summary,
    objectDiff: { contract: CONTRACT_VERSIONS.ObjectDiff, rows: diffRows },
    conflictLedger: { contract: CONTRACT_VERSIONS.ConflictLedger, rows: conflictRows },
    matchCandidates: { contract: CONTRACT_VERSIONS.MatchCandidate, rows: candidateRows },
    pathAudit: { mappings: [], unmatchedSourcePaths: [], unmatchedTargetPaths: [], alignmentRows: [] },
    registration: {
      contract: CONTRACT_VERSIONS.RegistrationAudit,
      method: 'none (node-wise compare in shared coordinates)',
      anchorCount: 0,
      translationMm: [0, 0, 0],
      residualMaxMm: null,
      residualAvgMm: null,
      warnings: [],
      anchorPairs: [],
    },
    manualOverrides: { contract: CONTRACT_VERSIONS.ManualOverrideLedger, rows: manualOverrides },
    normalization: {
      source: { rule: graphA.normalizationRule, consumedRows: [] },
      target: { rule: graphB.normalizationRule, consumedRows: [] },
    },
  };
}
