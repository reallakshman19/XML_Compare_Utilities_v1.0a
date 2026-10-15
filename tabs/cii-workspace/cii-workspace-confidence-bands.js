import { deepFreeze } from './cii-workspace-contracts.js';

function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }

export function ciiOdConfidenceBand(diameterEvidence) {
  const relativeDelta = finite(diameterEvidence?.relativeDelta);
  const available = diameterEvidence?.available !== false && relativeDelta != null;
  if (!available) return deepFreeze({ confidence: 'REVIEW', available: false, relativeDelta: null, percentError: null, reason: 'OD_UNAVAILABLE' });
  const percentError = 100 * relativeDelta;
  const confidence = relativeDelta < 0.10 ? 'HIGH' : (relativeDelta <= 0.50 ? 'MEDIUM' : 'REVIEW');
  return deepFreeze({
    confidence, available: true, relativeDelta, percentError: Number(percentError.toFixed(3)),
    reason: confidence === 'HIGH' ? 'OD_ERROR_LT_10_PERCENT' : (confidence === 'MEDIUM' ? 'OD_ERROR_10_TO_50_PERCENT' : 'OD_ERROR_GT_50_PERCENT'),
  });
}

function namePoints(nameEvidence) {
  const ratio = finite(nameEvidence?.matchRatio);
  if (ratio == null || nameEvidence?.available === false) return { available: false, points: 0, label: 'N/A' };
  if (nameEvidence?.kind === 'EXACT') return { available: true, points: ratio, label: 'EXACT' };
  if (nameEvidence?.kind === 'CANONICAL') return { available: true, points: 0.9 * ratio, label: 'CANONICAL' };
  if (nameEvidence?.kind === 'PARTIAL') return { available: true, points: 0.5 * ratio, label: 'PARTIAL' };
  return { available: true, points: 0, label: 'NO MATCH' };
}

export function ciiCorroborationBand({ m1, m2, od, nodeName } = {}) {
  const axes = [];
  if (m1?.available !== false) axes.push({ key: 'M1', points: m1?.pass ? 1 : 0, label: m1?.pass ? 'PASS' : 'FAIL' });
  axes.push({ key: 'M2', points: m2?.pass ? 1 : (m2?.partial ? 0.5 : 0), label: m2?.pass ? 'PASS' : (m2?.partial ? 'PARTIAL' : 'FAIL') });
  const odBand = od?.confidence ? od : ciiOdConfidenceBand(od);
  if (odBand.available) axes.push({ key: 'OD', points: odBand.confidence === 'HIGH' ? 1 : (odBand.confidence === 'MEDIUM' ? 0.5 : 0), label: odBand.confidence });
  const name = namePoints(nodeName);
  if (name.available) axes.push({ key: 'NAME', points: name.points, label: name.label });
  const max = axes.length; const score = axes.reduce((sum, axis) => sum + axis.points, 0);
  const ratio = max ? score / max : 0;
  const level = ratio >= 0.85 ? 4 : ratio >= 0.65 ? 3 : ratio >= 0.45 ? 2 : ratio > 0 ? 1 : 0;
  return deepFreeze({
    level, score: Number(score.toFixed(2)), max, ratio: Number(ratio.toFixed(3)),
    label: ['RED', 'AMBER', 'LIGHT_GREEN', 'GREEN', 'DEEP_GREEN'][level],
    axes: deepFreeze(axes.map((axis) => deepFreeze(axis))),
  });
}
