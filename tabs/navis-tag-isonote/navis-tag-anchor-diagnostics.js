export const NAVIS_ANCHOR_DIAGNOSTICS_SCHEMA = 'navis-anchor-consistency-diagnostics/v1';

function text(value) { return String(value ?? '').trim(); }
function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function fixed(value, digits = 6) {
  const parsed = finite(value);
  return parsed == null ? null : Number(parsed.toFixed(digits));
}
function anchorLabel(anchor = {}) {
  const tagId = text(anchor.resolvedTagId || anchor.tagId);
  const support = text(anchor.resolvedSupportIdentity || anchor.supportIdentity).replace(/^\/+/, '');
  return tagId && support ? `Tag ${tagId} ↔ /${support}` : text(anchor.anchorId);
}
function validAnchors(anchor = {}) {
  const source = Array.isArray(anchor.hypotheses) ? anchor.hypotheses : anchor.attempts || [];
  return source.filter((item) => item?.valid && item.anchorId).slice().sort((a, b) => a.anchorId.localeCompare(b.anchorId));
}
function axisSpread(anchors, key) {
  const values = anchors.map((anchor) => finite(anchor[key])).filter((value) => value != null);
  if (!values.length) return { min: null, max: null, span: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min: fixed(min), max: fixed(max), span: fixed(max - min) };
}
function pairwiseRows(anchors) {
  const rows = [];
  for (let leftIndex = 0; leftIndex < anchors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < anchors.length; rightIndex += 1) {
      const left = anchors[leftIndex];
      const right = anchors[rightIndex];
      const deltaE = finite(right.deltaEMm) - finite(left.deltaEMm);
      const deltaN = finite(right.deltaNMm) - finite(left.deltaNMm);
      const deltaEl = finite(right.deltaElMm) - finite(left.deltaElMm);
      rows.push(Object.freeze({
        leftAnchorId: left.anchorId,
        leftAnchorLabel: anchorLabel(left),
        rightAnchorId: right.anchorId,
        rightAnchorLabel: anchorLabel(right),
        deltaEMm: fixed(deltaE),
        deltaNMm: fixed(deltaN),
        deltaElMm: fixed(deltaEl),
        separationMm: fixed(Math.hypot(deltaE, deltaN, deltaEl)),
      }));
    }
  }
  return Object.freeze(rows.sort((a, b) => b.separationMm - a.separationMm || a.leftAnchorId.localeCompare(b.leftAnchorId) || a.rightAnchorId.localeCompare(b.rightAnchorId)));
}
function candidateRows(candidateLedger = []) {
  return (candidateLedger || []).filter((row) => row?.anchorBasisId);
}
function loopRows(anchorLoopLedger = []) {
  return (anchorLoopLedger || []).filter((row) => row?.anchorBasisId);
}
function legacyCounts(anchor, rows) {
  let evaluationCount = 0;
  let inToleranceEvaluationCount = 0;
  for (const row of rows) {
    for (const evaluation of row.anchorEvaluations || []) {
      if (evaluation.anchorId !== anchor.anchorId) continue;
      evaluationCount += 1;
      if (evaluation.withinTolerance) inToleranceEvaluationCount += 1;
    }
  }
  return { evaluationCount, inToleranceEvaluationCount };
}
function equivalentTieRows(rows) {
  return rows.filter((row) => Number(row.equivalentAnchorCount) > 1 && (!row.crossLoopRank || Number(row.crossLoopRank) === 1));
}
function usageFor(anchor, rows, allLoopRows) {
  const scopedLoopRows = allLoopRows.filter((row) => row.anchorBasisId === anchor.anchorId);
  const legacy = scopedLoopRows.length ? null : legacyCounts(anchor, rows);
  const winners = rows.filter((row) => row.anchorBasisId === anchor.anchorId);
  return Object.freeze({
    anchorBasisId: anchor.anchorId,
    anchorBasisLabel: anchorLabel(anchor),
    tagId: text(anchor.resolvedTagId || anchor.tagId),
    supportIdentity: text(anchor.resolvedSupportIdentity || anchor.supportIdentity),
    deltaEMm: fixed(anchor.deltaEMm),
    deltaNMm: fixed(anchor.deltaNMm),
    deltaElMm: fixed(anchor.deltaElMm),
    evaluationCount: scopedLoopRows.length || legacy?.evaluationCount || 0,
    inToleranceEvaluationCount: scopedLoopRows.filter((row) => row.withinTolerance).length || legacy?.inToleranceEvaluationCount || 0,
    anchorLoopWinnerCount: scopedLoopRows.filter((row) => row.anchorLoopWinner && row.withinTolerance).length,
    bestBasisCount: winners.length,
    selectedDecisionCount: winners.filter((row) => row.accepted).length,
    nearestRejectedCount: winners.filter((row) => row.ledgerKind === 'NEAREST_REJECTED').length,
    equivalentBestTieCount: equivalentTieRows(winners).length,
  });
}
function diagnosticCodes(anchors, usageRows, rows, spread, allLoopRows) {
  const codes = [];
  if (!anchors.length) return Object.freeze(['NO_VALID_ANCHORS']);
  codes.push(anchors.length === 1 ? 'SINGLE_VALID_ANCHOR' : 'MULTIPLE_VALID_ANCHORS');
  if (allLoopRows.length) codes.push('INDEPENDENT_ANCHOR_LOOPS');
  if ([spread.e.span, spread.n.span, spread.el.span].some((value) => Number(value) > 0)) codes.push('DISTINCT_ANCHOR_TRANSLATIONS');
  if (usageRows.some((row) => row.bestBasisCount === 0)) codes.push('VALID_ANCHOR_UNUSED_AS_BEST_BASIS');
  if (equivalentTieRows(rows).length) codes.push('EQUIVALENT_BEST_ANCHOR_TIES_PRESENT');
  if (usageRows.filter((row) => row.bestBasisCount > 0).length > 1) codes.push('BEST_BASIS_DISTRIBUTED_ACROSS_ANCHORS');
  return Object.freeze(codes);
}
function summaryText(summary) {
  if (!summary.validAnchorCount) return 'No valid anchor transform is available.';
  if (summary.validAnchorCount === 1) return `One valid anchor matching loop is available and contributed ${summary.candidateWinnerCount} cross-loop candidate relationships.`;
  return `${summary.validAnchorCount} independent anchor matching loops were executed. ${summary.usedAsBestBasisCount} anchors contributed cross-loop candidates; maximum transform separation is ${summary.maxPairwiseSeparationMm} mm; ${summary.equivalentBestCandidateCount} support relationships had mathematically equivalent cross-loop winners.`;
}

export function buildAnchorConsistencyDiagnostics(anchor = {}, candidateLedger = [], anchorLoopLedger = []) {
  const anchors = validAnchors(anchor);
  const rows = candidateRows(candidateLedger);
  const loops = loopRows(anchorLoopLedger);
  const usage = Object.freeze(anchors.map((item) => usageFor(item, rows, loops)));
  const pairwise = pairwiseRows(anchors);
  const spread = Object.freeze({
    e: Object.freeze(axisSpread(anchors, 'deltaEMm')),
    n: Object.freeze(axisSpread(anchors, 'deltaNMm')),
    el: Object.freeze(axisSpread(anchors, 'deltaElMm')),
  });
  const summary = {
    validAnchorCount: anchors.length,
    distinctTransformCount: new Set(anchors.map((item) => [fixed(item.deltaEMm), fixed(item.deltaNMm), fixed(item.deltaElMm)].join('|'))).size,
    usedAsBestBasisCount: usage.filter((row) => row.bestBasisCount > 0).length,
    unusedAsBestBasisCount: usage.filter((row) => row.bestBasisCount === 0).length,
    candidateWinnerCount: usage.reduce((sum, row) => sum + row.bestBasisCount, 0),
    anchorLoopWinnerCount: usage.reduce((sum, row) => sum + row.anchorLoopWinnerCount, 0),
    selectedDecisionCount: usage.reduce((sum, row) => sum + row.selectedDecisionCount, 0),
    equivalentBestCandidateCount: equivalentTieRows(rows).length,
    maxPairwiseSeparationMm: pairwise[0]?.separationMm ?? 0,
  };
  const codes = diagnosticCodes(anchors, usage, rows, spread, loops);
  return Object.freeze({
    schema: NAVIS_ANCHOR_DIAGNOSTICS_SCHEMA,
    authorityEffect: 'NONE',
    policy: text(anchor.policy) || 'NONE',
    matchingLoopPolicy: loops[0]?.anchorLoopPolicy || '',
    summary: Object.freeze({ ...summary, summaryText: summaryText(summary) }),
    transformSpread: spread,
    anchorUsage: usage,
    pairwiseComparisons: pairwise,
    diagnosticCodes: codes,
  });
}

export const _test = Object.freeze({ anchorLabel, axisSpread, equivalentTieRows, pairwiseRows, validAnchors });
