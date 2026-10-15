import { deepFreeze } from './cii-workspace-contracts.js';

export function evaluateCiiAnchorPathGate(sourcePath, targetPath, alignment, subdivision, pathScore, options = {}) {
  if (subdivision?.compatible) return deepFreeze({ status: 'SUPPORTED', blockers: Object.freeze([]), pathScore, lengthDivergenceRatio: 0 });
  const sourceLength = Number(sourcePath?.totalLengthMm || 0); const targetLength = Number(targetPath?.totalLengthMm || 0);
  const lengthDivergenceRatio = Math.abs(sourceLength - targetLength) / Math.max(sourceLength, targetLength, 1);
  const blockers = [];
  if (subdivision && !subdivision.compatible) blockers.push('SUBDIVISION_SEMANTICS_INCOMPATIBLE');
  if (Number(pathScore) < Number(options.minAnchorPathScore ?? 45)) blockers.push('ANCHOR_PATH_SCORE_BELOW_MINIMUM');
  if (lengthDivergenceRatio > Number(options.maxAnchorPathLengthDivergence ?? 0.20)) blockers.push('ANCHOR_PATH_LENGTH_DIVERGENCE');
  const ops = new Set((alignment?.operations || []).map((item) => item.op));
  if (ops.has('DELETE_REFERENCE') && ops.has('INSERT_TARGET') && Number(pathScore) < Number(options.rerouteAutoScore ?? 75)) {
    blockers.push('REROUTED_SPAN_REQUIRES_REVIEW');
  }
  return deepFreeze({
    status: blockers.length ? 'UNRESOLVED' : 'SUPPORTED', blockers: Object.freeze([...new Set(blockers)]),
    pathScore: Number(Number(pathScore || 0).toFixed(1)), lengthDivergenceRatio: Number(lengthDivergenceRatio.toFixed(4)),
  });
}

export function applyCiiPathGateToRows(rows, pathGate) {
  if (pathGate?.status !== 'UNRESOLVED') return rows;
  return rows.map((row) => {
    if (!['HIGH', 'REVIEW'].includes(row.status)) return row;
    return deepFreeze({ ...row, status: 'REVIEW', evidence: deepFreeze({ ...(row.evidence || {}), pathGate }) });
  });
}
