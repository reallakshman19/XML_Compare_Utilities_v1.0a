/** Deterministic exact and bounded inferred matching for RC-002. */
import { cleanText, deepFreeze } from './revision-contract-utils.js';

export const DEFAULT_REVISION_COMPARE_CONFIG = deepFreeze({
  engineVersion: 'rc-002.1', candidateLimit: 8, inferredThreshold: 4, winnerGap: 1.5,
  geometryTolerance: 0.001,
});

function propertyValue(record, key) { return record.engineeringProperties?.[key]?.value; }
function evidenceKey(record, evidence) { return `${record.componentType}|${evidence.kind}|${evidence.value}`; }
function sortedRecords(records) { return [...records].sort((a, b) => a.recordId.localeCompare(b.recordId)); }
function identityIndex(records) {
  const index = new Map();
  for (const record of records) {
    for (const evidence of record.identityEvidence) {
      const key = evidenceKey(record, evidence);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(record.recordId);
    }
  }
  for (const values of index.values()) values.sort();
  return index;
}
function uniqueIdentityTargets(record, sourceIndex, targetIndex) {
  const targets = new Set();
  for (const evidence of record.identityEvidence) {
    const key = evidenceKey(record, evidence);
    const sourceIds = sourceIndex.get(key) ?? []; const targetIds = targetIndex.get(key) ?? [];
    if (sourceIds.length === 1 && targetIds.length === 1) targets.add(targetIds[0]);
  }
  return [...targets].sort();
}

export function matchExactIdentities(recordsA, recordsB) {
  const aIndex = identityIndex(recordsA); const bIndex = identityIndex(recordsB);
  const byB = new Map(recordsB.map((record) => [record.recordId, record]));
  const usedTargets = new Set(); const matches = []; const unmatchedA = [];
  for (const source of sortedRecords(recordsA)) {
    const targets = uniqueIdentityTargets(source, aIndex, bIndex).filter((id) => !usedTargets.has(id));
    const target = targets.length === 1 ? byB.get(targets[0]) : null;
    if (!target || target.componentType !== source.componentType) { unmatchedA.push(source); continue; }
    usedTargets.add(target.recordId);
    matches.push(deepFreeze({ source, target, certainty: 'EXACT', evidence: 'unique-supported-identity' }));
  }
  const unmatchedB = sortedRecords(recordsB).filter((record) => !usedTargets.has(record.recordId));
  return deepFreeze({ matches: Object.freeze(matches), unmatchedA: Object.freeze(unmatchedA), unmatchedB: Object.freeze(unmatchedB), usedTargets });
}

function normalizedToken(value) { return cleanText(value).toUpperCase(); }
function supportedTag(record) { return record.identityEvidence.find((item) => /TAG|NAME/.test(item.kind))?.value ?? ''; }
function bucketKeys(record) {
  const base = `${record.branchId}|${record.componentType}`;
  const size = normalizedToken(propertyValue(record, 'nominalSize')); const tag = supportedTag(record);
  return [tag ? `${base}|TAG:${tag}` : '', size ? `${base}|SIZE:${size}` : '', base].filter(Boolean);
}
function candidateIndex(records) {
  const index = new Map();
  for (const record of records) {
    for (const key of bucketKeys(record)) {
      if (!index.has(key)) index.set(key, new Map());
      index.get(key).set(record.recordId, record);
    }
  }
  return index;
}
function candidateRecords(source, index, usedTargets, limit) {
  const found = new Map();
  outer: for (const key of bucketKeys(source)) {
    for (const [id, record] of index.get(key) ?? []) {
      if (!usedTargets.has(id)) found.set(id, record);
      if (found.size >= limit) break outer;
    }
  }
  return [...found.values()].sort((a, b) => a.recordId.localeCompare(b.recordId));
}
function sharedIdentityCount(source, target) {
  const targetValues = new Set(target.identityEvidence.map((item) => `${item.kind}|${item.value}`));
  return source.identityEvidence.filter((item) => targetValues.has(`${item.kind}|${item.value}`)).length;
}
function sameProperty(source, target, key) {
  const left = normalizedToken(propertyValue(source, key)); const right = normalizedToken(propertyValue(target, key));
  return Boolean(left && right && left === right);
}
function firstPoint(record) { return record.geometry?.availability === 'AVAILABLE' ? record.geometry.points[0] : null; }
function pointDistance(left, right) {
  if (!left || !right) return null;
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
function scoreCandidate(source, target, config) {
  const reasons = []; let score = 0; const shared = sharedIdentityCount(source, target);
  if (shared) { score += Math.min(4, shared * 2); reasons.push(`shared identity evidence (${shared})`); }
  if (sameProperty(source, target, 'nominalSize')) { score += 2; reasons.push('same nominal size'); }
  if (supportedTag(source) && supportedTag(source) === supportedTag(target)) { score += 2; reasons.push('same supported tag/name'); }
  if (sameProperty(source, target, 'supportType')) { score += 1; reasons.push('same support type'); }
  const distance = pointDistance(firstPoint(source), firstPoint(target));
  if (distance !== null && distance <= config.geometryTolerance) { score += 1; reasons.push('coincident supported geometry'); }
  return deepFreeze({ targetRecordId: target.recordId, score, reasons: Object.freeze(reasons), geometryDistance: distance });
}
function rankedCandidates(source, candidates, config) {
  return Object.freeze(candidates.map((target) => scoreCandidate(source, target, config))
    .sort((a, b) => b.score - a.score || a.targetRecordId.localeCompare(b.targetRecordId)));
}
function decision(ranked, config) {
  if (!ranked.length) return { acceptedCandidateId: null, basis: 'no-bounded-candidates', rejectionReasons: ['No candidates in indexed bounded buckets.'] };
  const winner = ranked[0]; const runner = ranked[1]; const gap = runner ? winner.score - runner.score : winner.score;
  if (winner.score < config.inferredThreshold) return { acceptedCandidateId: null, basis: `winner score ${winner.score} below ${config.inferredThreshold}`, rejectionReasons: ['Winner threshold not satisfied.'], gap };
  if (runner && gap < config.winnerGap) return { acceptedCandidateId: null, basis: `winner gap ${gap} below ${config.winnerGap}`, rejectionReasons: ['Uniqueness gap not satisfied.'], gap };
  return { acceptedCandidateId: winner.targetRecordId, basis: runner ? `winner gap ${gap}` : 'single passing candidate', rejectionReasons: [], gap };
}
function candidateEvidence(source, ranked, decisionValue, config, reachedCap) {
  return deepFreeze({
    schema: 'RevisionCandidateEvidence.v1', candidateEvidenceId: `candidate:${source.recordId}`, sourceRecordId: source.recordId,
    candidateRecordIds: Object.freeze(ranked.map((item) => item.targetRecordId)), candidateCount: ranked.length,
    candidateLimit: config.candidateLimit, rankedEvidence: ranked, acceptedCandidateId: decisionValue.acceptedCandidateId,
    rejectionReasons: Object.freeze(decisionValue.rejectionReasons),
    thresholds: deepFreeze({ inferredThreshold: config.inferredThreshold, winnerGap: config.winnerGap }),
    scoreGapOrDecisionBasis: decisionValue.basis, reachedCandidateLimit: reachedCap,
  });
}

export function matchBoundedCandidates(recordsA, recordsB, alreadyUsed, config = DEFAULT_REVISION_COMPARE_CONFIG) {
  const byTarget = new Map(recordsB.map((record) => [record.recordId, record]));
  const index = candidateIndex(recordsB); const usedTargets = new Set(alreadyUsed);
  const matches = []; const ambiguous = []; const unmatched = []; const evidence = [];
  let pairsEvaluated = 0; let maximumCandidates = 0; let recordsAtCap = 0;
  for (const source of sortedRecords(recordsA)) {
    const candidates = candidateRecords(source, index, usedTargets, config.candidateLimit);
    const reachedCap = candidates.length === config.candidateLimit;
    const ranked = rankedCandidates(source, candidates, config); pairsEvaluated += ranked.length;
    maximumCandidates = Math.max(maximumCandidates, ranked.length); if (reachedCap) recordsAtCap += 1;
    const selected = decision(ranked, config); const rowEvidence = candidateEvidence(source, ranked, selected, config, reachedCap);
    evidence.push(rowEvidence);
    if (selected.acceptedCandidateId && !usedTargets.has(selected.acceptedCandidateId)) {
      const target = byTarget.get(selected.acceptedCandidateId); usedTargets.add(target.recordId);
      matches.push(deepFreeze({ source, target, certainty: 'INFERRED', evidenceId: rowEvidence.candidateEvidenceId }));
    } else if (ranked.length) ambiguous.push(deepFreeze({ source, evidenceId: rowEvidence.candidateEvidenceId }));
    else unmatched.push(source);
  }
  const remainingTargets = sortedRecords(recordsB).filter((record) => !usedTargets.has(record.recordId));
  return deepFreeze({
    matches: Object.freeze(matches), ambiguous: Object.freeze(ambiguous), unmatched: Object.freeze(unmatched),
    remainingTargets: Object.freeze(remainingTargets), candidateEvidence: Object.freeze(evidence), usedTargets,
    performance: deepFreeze({ candidatePairsEvaluated: pairsEvaluated, maximumCandidatesForOneRecord: maximumCandidates, recordsAtCandidateCap: recordsAtCap }),
  });
}
