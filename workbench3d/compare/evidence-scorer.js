/**
 * evidence-scorer.js — configurable element-pair evidence scoring for CanonicalTopology.v1.
 *
 * Pure scoring: given one source edge and one target edge, returns a score with
 * a full reason/evidence breakdown.
 */

export const DEFAULT_COMPARE_CONFIG = Object.freeze({
  shortElementToleranceMm: 6,
  lengthToleranceMm: 6,
  minCandidateScore: 40,
  ambiguityGap: 8,
  highConfidenceScore: 75,
  mediumConfidenceScore: 55,
  registrationResidualToleranceMm: 50,
  useDiameterEvidence: true,
  usePointFeatureEvidence: true,
  diameterRatioTolerance: 0.02,
});

function ratioScore(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio;
}

export function scoreElementPair(sourceEdge, targetEdge, config = DEFAULT_COMPARE_CONFIG, context = {}) {
  const breakdown = [];
  const reasons = [];
  const conflicts = [];
  let weightTotal = 0;
  let earnedTotal = 0;
  const add = (evidence, weight, fraction, detail) => {
    if (fraction === null) return; // evidence unavailable — weight redistributed
    weightTotal += weight;
    earnedTotal += weight * Math.max(0, Math.min(1, fraction));
    breakdown.push({ evidence, weight, earned: Number((weight * fraction).toFixed(2)), detail });
    if (fraction >= 0.9) reasons.push(`${evidence}: ${detail}`);
    if (fraction <= 0.25) conflicts.push(`${evidence}: ${detail}`);
  };

  // Kind (segmentRole)
  add('kind', 15, sourceEdge.segmentRole === targetEdge.segmentRole ? 1 : 0.2, `${sourceEdge.segmentRole} vs ${targetEdge.segmentRole}`);

  // Length ratio
  if (Number.isFinite(context.sourceLength) && Number.isFinite(context.targetLength)) {
    const lengthRatio = ratioScore(context.sourceLength, context.targetLength);
    const lengthDelta = Math.abs(context.sourceLength - context.targetLength);
    add('length', 35,
      lengthRatio === null ? null : (lengthDelta <= config.lengthToleranceMm ? 1 : Math.max(0, (lengthRatio - 0.5) * 2)),
      `Δ=${lengthDelta.toFixed(1)}mm ratio=${lengthRatio === null ? 'n/a' : lengthRatio.toFixed(3)}`);
  }

  // Diameter
  if (config.useDiameterEvidence) {
    const sDia = Number(sourceEdge.diameterMm || 0);
    const tDia = Number(targetEdge.diameterMm || 0);
    if (sDia > 0 && tDia > 0) {
      const diaRatio = ratioScore(sDia, tDia);
      add('diameter', 25,
        diaRatio === null ? null : (diaRatio >= 1 - config.diameterRatioTolerance ? 1 : Math.max(0, (diaRatio - 0.7) / 0.3)),
        `src=${sDia} tgt=${tDia}`);
    }
  }

  // Point feature signature
  if (config.usePointFeatureEvidence && context.sourcePointFeatures && context.targetPointFeatures) {
    const srcSig = context.sourcePointFeatures.map((p) => p.kind || p.type).sort().join('+');
    const tgtSig = context.targetPointFeatures.map((p) => p.kind || p.type).sort().join('+');
    if (srcSig || tgtSig) {
      add('features', 25, srcSig === tgtSig ? 1 : (srcSig && tgtSig ? 0.4 : 0.2), `src=[${srcSig}] tgt=[${tgtSig}]`);
    }
  }

  const score = weightTotal > 0 ? (earnedTotal / weightTotal) * 100 : 0;
  return { score: Number(score.toFixed(2)), breakdown, reasons, conflicts };
}
