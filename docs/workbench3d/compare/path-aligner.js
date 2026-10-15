/**
 * path-aligner.js — anchor-to-anchor path matching and dynamic element alignment.
 *
 * Candidate generation is separate from candidate selection:
 *  - scoreAllPathPairs() produces every path-pair score (nothing hidden)
 *  - matchPaths() selects greedily and flags AMBIGUOUS when the next-best
 *    candidate is inside the ambiguity gap
 *  - alignPathElements() runs Needleman-Wunsch DP over the two element
 *    sequences and post-classifies SPLIT / MERGE runs
 */

import { scoreElementPair, DEFAULT_COMPARE_CONFIG } from './evidence-scorer.js';
import { PATH_OPS } from '../contracts/contracts.js';

function pathObjects(graph, path) {
  const byId = new Map(graph.objects.map((o) => [o.objectId, o]));
  return path.elementIds.map((id) => byId.get(id)).filter(Boolean);
}

function ratio(a, b) {
  if (!a || !b) return 0;
  return Math.min(a, b) / Math.max(a, b);
}

export function scorePathPair(pathA, pathB) {
  let score = 0;
  score += 30 * ratio(pathA.totalLengthMm, pathB.totalLengthMm);
  score += 25 * ratio(pathA.elementCount, pathB.elementCount);
  const anchorsA = [pathA.startAnchorType, pathA.endAnchorType];
  const anchorsB = [pathB.startAnchorType, pathB.endAnchorType];
  const sameOrder = anchorsA[0] === anchorsB[0] && anchorsA[1] === anchorsB[1];
  const flipped = anchorsA[0] === anchorsB[1] && anchorsA[1] === anchorsB[0];
  score += sameOrder ? 25 : flipped ? 20 : 5;
  score += 20 * ratio(pathA.packetSequence.length + 1, pathB.packetSequence.length + 1)
    * (pathA.packetSequence === pathB.packetSequence ? 1 : 0.5);
  return Number(score.toFixed(2));
}

export function scoreAllPathPairs(graphA, graphB) {
  const rows = [];
  for (const pathA of graphA.paths) {
    for (const pathB of graphB.paths) {
      rows.push({ sourcePathId: pathA.pathId, targetPathId: pathB.pathId, score: scorePathPair(pathA, pathB) });
    }
  }
  return rows.sort((a, b) => b.score - a.score);
}

export function matchPaths(graphA, graphB, config = DEFAULT_COMPARE_CONFIG) {
  const allPairs = scoreAllPathPairs(graphA, graphB);
  const usedSource = new Set();
  const usedTarget = new Set();
  const mappings = [];
  for (const pair of allPairs) {
    if (usedSource.has(pair.sourcePathId) || usedTarget.has(pair.targetPathId)) continue;
    if (pair.score < 35) continue;
    const nextBest = allPairs.find((p) => p !== pair
      && (p.sourcePathId === pair.sourcePathId || p.targetPathId === pair.targetPathId)
      && !usedSource.has(p.sourcePathId === pair.sourcePathId ? '' : p.sourcePathId)
      && !usedTarget.has(p.targetPathId === pair.targetPathId ? '' : p.targetPathId));
    const nextBestScore = nextBest?.score ?? 0;
    const gap = Number((pair.score - nextBestScore).toFixed(2));
    const ambiguous = gap < config.ambiguityGap && nextBestScore >= 35;
    usedSource.add(pair.sourcePathId);
    usedTarget.add(pair.targetPathId);
    mappings.push({
      sourcePathId: pair.sourcePathId,
      targetPathId: pair.targetPathId,
      score: pair.score,
      nextBestScore,
      scoreGap: gap,
      status: ambiguous ? PATH_OPS.AMBIGUOUS : PATH_OPS.MATCH,
    });
  }
  const unmatchedSourcePaths = graphA.paths.filter((p) => !usedSource.has(p.pathId)).map((p) => p.pathId);
  const unmatchedTargetPaths = graphB.paths.filter((p) => !usedTarget.has(p.pathId)).map((p) => p.pathId);
  return { mappings, unmatchedSourcePaths, unmatchedTargetPaths, allPairs };
}

/**
 * Needleman-Wunsch alignment of two element sequences.
 * Returns ops rows: { op, sourceObjectId, targetObjectId, pair } where pair is
 * the evidence-scored result for MATCH rows.
 */
export function alignPathElements(graphA, pathA, graphB, pathB, config = DEFAULT_COMPARE_CONFIG) {
  const src = pathObjects(graphA, pathA);
  const tgt = pathObjects(graphB, pathB);
  const context = { sourcePathLength: pathA.totalLengthMm, targetPathLength: pathB.totalLengthMm };
  const GAP = -12;
  const n = src.length;
  const m = tgt.length;
  const score = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const move = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(''));
  const pairCache = new Map();
  const pairScore = (i, j) => {
    const key = `${i}:${j}`;
    if (!pairCache.has(key)) pairCache.set(key, scoreElementPair(src[i], tgt[j], config, context));
    return pairCache.get(key);
  };
  for (let i = 1; i <= n; i += 1) { score[i][0] = i * GAP; move[i][0] = 'U'; }
  for (let j = 1; j <= m; j += 1) { score[0][j] = j * GAP; move[0][j] = 'L'; }
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const diag = score[i - 1][j - 1] + (pairScore(i - 1, j - 1).score - 50) / 5;
      const up = score[i - 1][j] + GAP;
      const left = score[i][j - 1] + GAP;
      if (diag >= up && diag >= left) { score[i][j] = diag; move[i][j] = 'D'; }
      else if (up >= left) { score[i][j] = up; move[i][j] = 'U'; }
      else { score[i][j] = left; move[i][j] = 'L'; }
    }
  }
  const ops = [];
  let i = n; let j = m;
  while (i > 0 || j > 0) {
    const dir = move[i][j] || (i > 0 ? 'U' : 'L');
    if (dir === 'D') {
      const pair = pairScore(i - 1, j - 1);
      ops.unshift({
        op: pair.score >= config.minCandidateScore ? PATH_OPS.MATCH : PATH_OPS.POSSIBLE_MATCH,
        sourceObjectId: src[i - 1].objectId,
        targetObjectId: tgt[j - 1].objectId,
        pair,
      });
      i -= 1; j -= 1;
    } else if (dir === 'U') {
      ops.unshift({ op: PATH_OPS.DELETE_SOURCE, sourceObjectId: src[i - 1].objectId, targetObjectId: null, pair: null });
      i -= 1;
    } else {
      ops.unshift({ op: PATH_OPS.INSERT_TARGET, sourceObjectId: null, targetObjectId: tgt[j - 1].objectId, pair: null });
      j -= 1;
    }
  }
  classifySplitMerge(ops, graphA, graphB, config);
  return ops;
}

/**
 * Post-pass: a DELETE_SOURCE whose length equals the sum of adjacent
 * INSERT_TARGET rows (within tolerance) is a SPLIT; the inverse is a MERGE.
 */
function classifySplitMerge(ops, graphA, graphB, config) {
  const objA = new Map(graphA.objects.map((o) => [o.objectId, o]));
  const objB = new Map(graphB.objects.map((o) => [o.objectId, o]));
  for (let k = 0; k < ops.length; k += 1) {
    if (ops[k].op !== PATH_OPS.DELETE_SOURCE) continue;
    const source = objA.get(ops[k].sourceObjectId);
    let sum = 0;
    const inserts = [];
    for (let r = k + 1; r < ops.length && ops[r].op === PATH_OPS.INSERT_TARGET; r += 1) {
      sum += objB.get(ops[r].targetObjectId)?.lengthMm ?? 0;
      inserts.push(ops[r]);
      if (Math.abs(sum - (source?.lengthMm ?? -1)) <= config.lengthToleranceMm && inserts.length >= 2) {
        ops[k].op = PATH_OPS.SPLIT;
        for (const row of inserts) { row.op = PATH_OPS.SPLIT; row.splitOf = ops[k].sourceObjectId; }
        break;
      }
    }
  }
  for (let k = 0; k < ops.length; k += 1) {
    if (ops[k].op !== PATH_OPS.INSERT_TARGET) continue;
    const target = objB.get(ops[k].targetObjectId);
    let sum = 0;
    const deletes = [];
    for (let r = k + 1; r < ops.length && ops[r].op === PATH_OPS.DELETE_SOURCE; r += 1) {
      sum += objA.get(ops[r].sourceObjectId)?.lengthMm ?? 0;
      deletes.push(ops[r]);
      if (Math.abs(sum - (target?.lengthMm ?? -1)) <= config.lengthToleranceMm && deletes.length >= 2) {
        ops[k].op = PATH_OPS.MERGE;
        for (const row of deletes) { row.op = PATH_OPS.MERGE; row.mergedInto = ops[k].targetObjectId; }
        break;
      }
    }
  }
}
