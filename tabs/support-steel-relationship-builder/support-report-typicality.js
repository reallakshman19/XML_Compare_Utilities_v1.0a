export const SUPPORT_REPORT_TYPICALITY_AUDIT_SCHEMA = 'SupportReportTypicalityAudit.v1';

export const PS_TYPICAL_V1_PROVISIONAL = Object.freeze({
  profileId: 'PS_TYPICAL_V1_PROVISIONAL',
  structural: Object.freeze({
    geometryEnvelopeToleranceMm: 25,
    pairDistanceMedianToleranceMm: 10,
    pairDistanceP95ToleranceMm: 25,
    pairDistanceMaxToleranceMm: 50,
  }),
});

export function buildSupportReportTypicalityAudit(leftEvidence, rightEvidence, options = {}) {
  const profile = options.profile || PS_TYPICAL_V1_PROVISIONAL;
  const leftFamilies = extractStructuralFamilyFeatures(leftEvidence);
  const rightFamilies = extractStructuralFamilyFeatures(rightEvidence);
  const familyComparisons = [];

  for (const left of leftFamilies) {
    for (const right of rightFamilies) {
      familyComparisons.push(compareStructuralFamilyFeatures(left, right, profile));
    }
  }

  const matches = leftFamilies.map((left) => selectFamilyMatch(
    left.familyId,
    familyComparisons.filter((item) => item.leftFamilyId === left.familyId),
  ));

  return Object.freeze({
    schema: SUPPORT_REPORT_TYPICALITY_AUDIT_SCHEMA,
    profileId: profile.profileId,
    leftFamilyCount: leftFamilies.length,
    rightFamilyCount: rightFamilies.length,
    leftFamilies,
    rightFamilies,
    familyComparisons: Object.freeze(familyComparisons),
    matches: Object.freeze(matches),
  });
}

export function extractStructuralFamilyFeatures(evidence = {}) {
  const familyIds = collectFamilyIds(evidence);
  return Object.freeze(familyIds.map((familyId) => familyFeatures(evidence, familyId)));
}

export function compareStructuralFamilyFeatures(left, right, profile = PS_TYPICAL_V1_PROVISIONAL) {
  const structural = profile.structural || {};
  const locationCount = exactSignal('STRUCT_LOCATION_COUNT_EQUAL', left.locationCount, right.locationCount);
  const uniqueMemberCount = exactSignal('STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL',
    left.numericPrimarySupportMemberCount, right.numericPrimarySupportMemberCount);
  const memberMultiplicity = exactSignal('STRUCT_MEMBER_MULTIPLICITY_EQUAL', left.memberMultiplicitySpectrum, right.memberMultiplicitySpectrum);
  const pipeClasses = exactSignal('STRUCT_PIPE_CLASS_POPULATION_EQUAL', left.normalizedPipeClassPopulation, right.normalizedPipeClassPopulation);
  const rawPointCount = exactSignal('STRUCT_RAW_CLASH_POINT_COUNT_EQUAL', left.rawClashPointCount, right.rawClashPointCount);
  const envelope = envelopeSignal(left.geometryEnvelopeMm, right.geometryEnvelopeMm, envelopeToleranceMm(structural));
  const pairDistance = pairDistanceSignal(left.pairDistanceSpectrumMm, right.pairDistanceSpectrumMm, structural);
  const signals = Object.freeze([locationCount, uniqueMemberCount, memberMultiplicity, pipeClasses, rawPointCount, envelope, pairDistance]);
  const accepted = locationCount.result === 'PASS'
    && uniqueMemberCount.result === 'PASS'
    && memberMultiplicity.result === 'PASS'
    && pipeClasses.result === 'PASS'
    && envelope.result === 'PASS'
    && pairDistance.result !== 'FAIL';
  const familyName = familyNameEvidence(left.familyId, right.familyId);

  return Object.freeze({
    auditId: familyAuditId(left.familyId, right.familyId),
    leftFamilyId: left.familyId,
    rightFamilyId: right.familyId,
    result: accepted ? 'TYPICAL' : 'NOT_TYPICAL',
    reasonCode: accepted ? 'TYPICAL_ACCEPTED' : rejectionReason(signals),
    geometryCostMm: geometryCost(envelope, pairDistance),
    familyNameEvidence: familyName,
    signals,
  });
}

export function supportTypeMultiset(value) {
  const tokens = Array.isArray(value) ? value : String(value ?? '').split(',');
  const counts = new Map();
  for (const raw of tokens) {
    const normalized = normalizeSupportTypeToken(raw);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return Object.freeze(Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))));
}

export function compareSupportTypeMultisets(left, right) {
  const leftCanonical = supportTypeMultiset(left);
  const rightCanonical = supportTypeMultiset(right);
  const missingFromRight = multisetDelta(leftCanonical, rightCanonical);
  const extraInRight = multisetDelta(rightCanonical, leftCanonical);
  const exact = !missingFromRight.length && !extraInRight.length;
  return Object.freeze({
    leftRaw: Object.freeze(rawSupportTypes(left)),
    rightRaw: Object.freeze(rawSupportTypes(right)),
    leftCanonical,
    rightCanonical,
    missingFromRight: Object.freeze(missingFromRight),
    extraInRight: Object.freeze(extraInRight),
    result: exact ? 'EXACT' : 'PARTIAL',
    reasonCodes: Object.freeze(exact
      ? ['SUPPORT_TYPE_MULTISET_EXACT']
      : [
        ...(missingFromRight.length ? ['SUPPORT_TYPE_MEMBER_MISSING'] : []),
        ...(extraInRight.length ? ['SUPPORT_TYPE_MEMBER_EXTRA'] : []),
      ]),
  });
}

export function normalizePipeClass(fullLineTag) {
  const text = clean(fullLineTag).replace(/^\/+/, '').replace(/\/B(?:RANCH)?[-_A-Z0-9.]*$/iu, '').toUpperCase();
  const sizeMatch = text.match(/-(\d+(?:\.\d+)?)"-/u);
  if (!sizeMatch) return text;
  const tail = text.slice((sizeMatch.index || 0) + sizeMatch[0].length);
  const grammar = /^([A-Z]+)-?(\d[A-Z0-9]*)(?:-(.*))?$/u.exec(tail);
  if (!grammar) return fallbackPipeClass(sizeMatch[1], tail);
  const service = grammar[1] || '';
  const lineSerial = grammar[2] || '';
  const engineering = (grammar[3] || '').split('-').filter(Boolean);
  if (engineering.length && /^\d{1,2}$/u.test(engineering[engineering.length - 1])) engineering.pop();
  const specification = engineering.shift() || '';
  const qualifiers = engineering.filter((part) => !isRevisionSequence(part));
  if (!service || !lineSerial || !specification) return fallbackPipeClass(sizeMatch[1], tail);
  return [sizeMatch[1], service, specification, ...qualifiers].filter(Boolean).join('|');
}

export function familyNameEvidence(leftFamilyId, rightFamilyId) {
  const left = token(leftFamilyId);
  const right = token(rightFamilyId);
  if (!left || !right) return nameEvidence('NONE', left, right, 0);
  if (left === right) return nameEvidence('EXACT', left, right, 100);
  if (left.length === right.length) {
    const differenceCount = [...left].reduce((count, char, index) => count + (char === right[index] ? 0 : 1), 0);
    if (differenceCount === 1) return nameEvidence('ONE_POSITION_DIFFERENT', left, right, 90);
  }
  for (const [length, rank] of [[4, 80], [3, 65], [2, 45], [1, 20]]) {
    if (left.length >= length && right.length >= length && left.slice(-length) === right.slice(-length)) {
      return nameEvidence(`SAME_TRAILING_${length}`, left, right, rank);
    }
  }
  const leftPrefix = /^([A-Z]+)/u.exec(left)?.[1] || '';
  const rightPrefix = /^([A-Z]+)/u.exec(right)?.[1] || '';
  if (leftPrefix && leftPrefix === rightPrefix) return nameEvidence('PREFIX_ONLY', left, right, 10);
  return nameEvidence('NONE', left, right, 0);
}

function familyFeatures(evidence, familyId) {
  const groups = (evidence.groups || []).filter((group) => token(group.secondarySupportFamilyId) === familyId);
  const rawClashes = (evidence.rawClashes || []).filter((clash) => (clash.familyIds || []).map(token).includes(familyId));
  const rawPoints = rawClashes.map((clash) => clash.clashPointGlobalMm).filter(validPoint);
  const points = groups.map((group) => group.representativeClashPointGlobalMm).filter(validPoint);
  const memberIds = unique(groups.flatMap((group) => group.primarySupportMemberIds || []).map(token).filter((value) => /\.\d+$/u.test(value)));
  const memberMultiplicitySpectrum = groups.map((group) => unique((group.primarySupportMemberIds || [])
    .map(token).filter((value) => /\.\d+$/u.test(value))).length).sort((a, b) => a - b);
  const normalizedPipeClassPopulation = groups.map((group) => normalizePipeClass(group.fullLineTag)).sort();
  return Object.freeze({
    familyId,
    locationCount: groups.length,
    numericPrimarySupportMemberCount: memberIds.length,
    numericPrimarySupportMemberIds: Object.freeze(memberIds.sort()),
    memberMultiplicitySpectrum: Object.freeze(memberMultiplicitySpectrum),
    normalizedPipeClassPopulation: Object.freeze(normalizedPipeClassPopulation),
    rawClashPointCount: rawPoints.length,
    structuralGeometryPointCount: points.length,
    structuralGeometrySource: 'CANONICAL_LOCATION_REPRESENTATIVES',
    geometryEnvelopeMm: geometryEnvelope(points),
    pairDistanceSpectrumMm: Object.freeze(pairDistanceSpectrum(points)),
    sourceClashGuids: Object.freeze(unique(rawClashes.map((clash) => clash.guid).filter(Boolean)).sort()),
  });
}

function collectFamilyIds(evidence) {
  return unique((evidence.groups || []).map((group) => token(group.secondarySupportFamilyId)).filter(Boolean)).sort();
}

function envelopeToleranceMm(structural = {}) {
  const millimetres = Number(structural.geometryEnvelopeToleranceMm);
  return Number.isFinite(millimetres) && millimetres >= 0 ? millimetres : 0;
}

function envelopeSignal(left, right, toleranceMm) {
  const leftSpan = left?.span || null;
  const rightSpan = right?.span || null;
  if (!leftSpan || !rightSpan) return signal('STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE', leftSpan, rightSpan, null, toleranceMm, 'FAIL');
  const residual = Math.max(
    Math.abs(leftSpan.x - rightSpan.x),
    Math.abs(leftSpan.y - rightSpan.y),
    Math.abs(leftSpan.z - rightSpan.z),
  );
  return signal('STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE', leftSpan, rightSpan,
    residual, toleranceMm, residual <= toleranceMm ? 'PASS' : 'FAIL');
}

function pairDistanceSignal(left, right, thresholds) {
  const threshold = Object.freeze({
    median: Number(thresholds.pairDistanceMedianToleranceMm),
    p95: Number(thresholds.pairDistanceP95ToleranceMm),
    max: Number(thresholds.pairDistanceMaxToleranceMm),
  });
  const policy = Object.freeze({ median: 'HARD', p95: 'ADVISORY', max: 'HARD' });
  if (!left.length && !right.length) {
    return Object.freeze({
      ...signal('STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE', 0, 0, null, threshold, 'UNAVAILABLE'),
      policy,
      p95Result: 'UNAVAILABLE',
    });
  }
  if (!left.length || left.length !== right.length) {
    return Object.freeze({
      ...signal('STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE', left.length, right.length, null, threshold, 'FAIL'),
      policy,
      p95Result: 'UNAVAILABLE',
    });
  }
  const residuals = left.map((value, index) => Math.abs(value - right[index])).sort((a, b) => a - b);
  const stats = Object.freeze({
    median: quantile(residuals, 0.5),
    p95: quantile(residuals, 0.95),
    max: residuals[residuals.length - 1] || 0,
  });
  const pass = stats.median <= threshold.median && stats.max <= threshold.max;
  return Object.freeze({
    ...signal('STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE', left.length, right.length, stats, threshold, pass ? 'PASS' : 'FAIL'),
    policy,
    p95Result: stats.p95 <= threshold.p95 ? 'PASS' : 'ADVISORY_EXCEEDED',
  });
}

function exactSignal(reasonCode, left, right) {
  return signal(reasonCode, left, right, null, 'EXACT', stable(left) === stable(right) ? 'PASS' : 'FAIL');
}
function signal(reasonCode, left, right, residual, threshold, result) {
  return Object.freeze({ reasonCode, left, right, residual, threshold, result });
}
function rejectionReason(signals) {
  const failed = signals.find((item) => item.result === 'FAIL' && item.reasonCode !== 'STRUCT_RAW_CLASH_POINT_COUNT_EQUAL');
  if (!failed) return 'TYPICAL_REJECTED_TOPOLOGY';
  if (failed.reasonCode.includes('GEOMETRY') || failed.reasonCode.includes('DISTANCE')) return 'TYPICAL_REJECTED_GEOMETRY';
  return 'TYPICAL_REJECTED_TOPOLOGY';
}
function geometryCost(envelope, pairDistance) {
  const envelopeCost = Number(envelope.residual) || 0;
  const pair = pairDistance.residual || {};
  return envelopeCost + (Number(pair.median) || 0) + (Number(pair.p95) || 0);
}
function selectFamilyMatch(leftFamilyId, comparisons) {
  const accepted = comparisons.filter((item) => item.result === 'TYPICAL').sort(familyComparisonRank);
  if (accepted.length === 1) return acceptedMatch(leftFamilyId, accepted[0], 'TYPICAL_ACCEPTED');
  if (accepted.length > 1) {
    const strongestRank = accepted[0].familyNameEvidence?.rank || 0;
    const strongest = accepted.filter((item) => (item.familyNameEvidence?.rank || 0) === strongestRank);
    if (strongestRank >= 65 && strongest.length === 1) return acceptedMatch(leftFamilyId, strongest[0], 'TYPICAL_ACCEPTED_FAMILY_ID_TIEBREAK');
    return ambiguousMatch(leftFamilyId, accepted, 'TYPICAL_AMBIGUOUS');
  }

  const review = comparisons.filter(reviewCandidate).sort(familyComparisonRank);
  if (review.length) {
    const strongestRank = review[0].familyNameEvidence?.rank || 0;
    const strongest = review.filter((item) => (item.familyNameEvidence?.rank || 0) === strongestRank);
    if (strongestRank >= 65 && strongest.length === 1) {
      return reviewMatch(leftFamilyId, strongest[0]);
    }
    if (strongestRank >= 65) return ambiguousMatch(leftFamilyId, strongest, 'TYPICAL_REVIEW_AMBIGUOUS');
  }

  const rejected = [...comparisons].sort(rejectedComparisonRank);
  const best = rejected[0] || null;
  return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: best?.auditId || '',
    result: 'NO_MATCH',
    reasonCode: best?.reasonCode || 'TYPICAL_REJECTED_TOPOLOGY',
    bestCandidateFamilyId: best?.rightFamilyId || '',
    bestCandidateAuditId: best?.auditId || '',
    bestCandidateFamilyNameEvidence: best?.familyNameEvidence || null,
    failedReasonCodes: Object.freeze(requiredSignals(best).filter((item) => item.result === 'FAIL').map((item) => item.reasonCode)),
  });
}

function reviewCandidate(comparison) {
  if (!comparison || comparison.result !== 'NOT_TYPICAL' || (comparison.familyNameEvidence?.rank || 0) < 65) return false;
  const failed = requiredSignals(comparison).filter((item) => item.result === 'FAIL');
  const memberTopologyCodes = new Set([
    'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL',
    'STRUCT_MEMBER_MULTIPLICITY_EQUAL',
  ]);
  return failed.length > 0 && failed.every((item) => memberTopologyCodes.has(item.reasonCode));
}
function reviewMatch(leftFamilyId, comparison) {
  const failedReasonCodes = requiredSignals(comparison)
    .filter((item) => item.result === 'FAIL')
    .map((item) => item.reasonCode);
  const reasonCode = failedReasonCodes.length === 1 && failedReasonCodes[0] === 'STRUCT_MEMBER_MULTIPLICITY_EQUAL'
    ? 'TYPICAL_REVIEW_MEMBER_MULTIPLICITY_CHANGED'
    : failedReasonCodes.length === 1 && failedReasonCodes[0] === 'STRUCT_UNIQUE_PRIMARY_MEMBER_COUNT_EQUAL'
      ? 'TYPICAL_REVIEW_UNIQUE_MEMBER_COUNT_CHANGED'
      : 'TYPICAL_REVIEW_MEMBER_TOPOLOGY_CHANGED';
  return Object.freeze({
    leftFamilyId,
    rightFamilyId: comparison.rightFamilyId,
    auditId: comparison.auditId,
    result: 'REVIEW',
    reasonCode,
    familyNameEvidence: comparison.familyNameEvidence,
    failedReasonCodes: Object.freeze(failedReasonCodes),
  });
}
function acceptedMatch(leftFamilyId, comparison, reasonCode) {
  return Object.freeze({
    leftFamilyId,
    rightFamilyId: comparison.rightFamilyId,
    auditId: comparison.auditId,
    result: 'TYPICAL',
    reasonCode,
    familyNameEvidence: comparison.familyNameEvidence,
  });
}
function ambiguousMatch(leftFamilyId, comparisons, reasonCode) {
  return Object.freeze({
    leftFamilyId,
    rightFamilyId: '',
    auditId: '',
    result: 'AMBIGUOUS',
    reasonCode,
    candidateFamilyIds: Object.freeze(comparisons.map((item) => item.rightFamilyId)),
    candidateAuditIds: Object.freeze(comparisons.map((item) => item.auditId)),
  });
}
function familyComparisonRank(a, b) {
  return (b.familyNameEvidence?.rank || 0) - (a.familyNameEvidence?.rank || 0)
    || a.geometryCostMm - b.geometryCostMm
    || a.rightFamilyId.localeCompare(b.rightFamilyId);
}
function rejectedComparisonRank(a, b) {
  return requiredPassCount(b) - requiredPassCount(a)
    || (b.familyNameEvidence?.rank || 0) - (a.familyNameEvidence?.rank || 0)
    || a.geometryCostMm - b.geometryCostMm
    || a.rightFamilyId.localeCompare(b.rightFamilyId);
}
function requiredPassCount(comparison) {
  return requiredSignals(comparison).filter((item) => item.result === 'PASS' || item.result === 'UNAVAILABLE').length;
}
function requiredSignals(comparison) {
  return (comparison?.signals || []).filter((item) => item.reasonCode !== 'STRUCT_RAW_CLASH_POINT_COUNT_EQUAL');
}
function nameEvidence(className, left, right, rank) {
  return Object.freeze({ class: className, rank, left, right, wildcardMask: wildcardMask(left, right) });
}
function wildcardMask(left, right) {
  const max = Math.max(left.length, right.length);
  const a = left.padStart(max, '*');
  const b = right.padStart(max, '*');
  return [...a].map((char, index) => char === b[index] ? char : '?').join('');
}
function fallbackPipeClass(size, tail) {
  const parts = String(tail || '').split('-').filter(Boolean);
  const first = parts.shift() || '';
  const compact = /^([A-Z]+)(\d[A-Z0-9]*)$/u.exec(first);
  const service = compact?.[1] || first.match(/^([A-Z]+)/u)?.[1] || '';
  if (compact) parts.unshift(compact[2]);
  if (parts.length && /^\d{1,2}$/u.test(parts[parts.length - 1])) parts.pop();
  const lineSerialIndex = parts.findIndex((part) => /^\d{6,}[A-Z0-9]*$/u.test(part));
  if (lineSerialIndex >= 0) parts.splice(lineSerialIndex, 1);
  const specification = parts.shift() || '';
  return [size, service, specification, ...parts.filter((part) => !isRevisionSequence(part))].filter(Boolean).join('|');
}
function isRevisionSequence(value) { return /^\d{1,2}$/u.test(String(value || '')); }

function geometryEnvelope(points) {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const min = Object.freeze({ x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) });
  const max = Object.freeze({ x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) });
  return Object.freeze({ min, max, span: Object.freeze({ x: max.x - min.x, y: max.y - min.y, z: max.z - min.z }) });
}
function pairDistanceSpectrum(points) {
  const distances = [];
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      const a = points[left];
      const b = points[right];
      distances.push(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
  }
  return distances.sort((a, b) => a - b);
}
function multisetDelta(left, right) {
  return Object.keys(left).sort().flatMap((type) => {
    const count = Math.max(0, Number(left[type] || 0) - Number(right[type] || 0));
    return count ? [Object.freeze({ type, count })] : [];
  });
}
function rawSupportTypes(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  return values.map((item) => clean(item)).filter(Boolean);
}
function normalizeSupportTypeToken(value) { return clean(value).toUpperCase().replace(/\s+/g, ' '); }
function validPoint(point) { return point && [point.x, point.y, point.z].every(Number.isFinite); }
function quantile(sorted, ratio) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}
function familyAuditId(left, right) { return `TYP-${left}--${right}`.replace(/[^A-Z0-9-]+/gi, '-'); }
function stable(value) { return JSON.stringify(value); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function unique(values) { return [...new Set(values || [])]; }

export const _test = Object.freeze({
  envelopeToleranceMm,
  familyNameEvidence,
  pairDistanceSignal,
  reviewCandidate,
});