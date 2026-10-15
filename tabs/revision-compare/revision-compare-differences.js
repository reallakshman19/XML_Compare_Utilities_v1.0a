/** Property, geometry and final difference-row construction for RC-002. */
import { deepFreeze } from './revision-contract-utils.js';

export const REVISION_DIFFERENCE_ROW_SCHEMA = 'RevisionDifferenceRow.v1';
function scalarEqual(left, right) { return Object.is(left, right) || String(left) === String(right); }
function sortedKeys(left, right) { return [...new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})])].sort(); }

export function compareEngineeringProperties(source, target) {
  const changes = [];
  for (const key of sortedKeys(source.engineeringProperties, target.engineeringProperties)) {
    const left = source.engineeringProperties?.[key]; const right = target.engineeringProperties?.[key];
    if (scalarEqual(left?.value, right?.value)) continue;
    changes.push(deepFreeze({
      propertyKey: key, revAValue: left?.value ?? null, revBValue: right?.value ?? null,
      revAEvidencePath: left?.sourcePath ?? null, revBEvidencePath: right?.sourcePath ?? null,
      normalizationRule: left?.normalizationRule ?? right?.normalizationRule ?? 'trim-preserve-scalar',
    }));
  }
  return Object.freeze(changes);
}
function pointDistance(left, right) { return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]); }
function geometryUnavailable(source, target) { return source.geometry.availability !== 'AVAILABLE' || target.geometry.availability !== 'AVAILABLE'; }

export function compareSupportedGeometry(source, target, tolerance = 0.001) {
  if (geometryUnavailable(source, target)) {
    return deepFreeze({ status: 'UNAVAILABLE', changed: false, maximumPointDelta: null, reason: 'Supported geometry is unavailable on one or both records.', revAEvidencePaths: source.geometry.evidencePaths, revBEvidencePaths: target.geometry.evidencePaths });
  }
  if (source.geometry.points.length !== target.geometry.points.length) {
    return deepFreeze({ status: 'AVAILABLE', changed: true, maximumPointDelta: null, reason: 'Supported geometry point counts differ.', revAEvidencePaths: source.geometry.evidencePaths, revBEvidencePaths: target.geometry.evidencePaths });
  }
  const deltas = source.geometry.points.map((point, index) => pointDistance(point, target.geometry.points[index]));
  const maximum = deltas.length ? Math.max(...deltas) : 0;
  return deepFreeze({
    status: 'AVAILABLE', changed: maximum > tolerance, maximumPointDelta: maximum,
    reason: maximum > tolerance ? `Maximum supported point delta ${maximum}.` : 'Supported geometry is unchanged.',
    revAEvidencePaths: source.geometry.evidencePaths, revBEvidencePaths: target.geometry.evidencePaths,
  });
}
function differenceId(sourceId, targetId) { return `difference:${sourceId ?? 'none'}:${targetId ?? 'none'}`; }
function visualRefs(source, target) { return deepFreeze({ sourceObjectId: source?.visualPrimitive?.objectId ?? null, targetObjectId: target?.visualPrimitive?.objectId ?? null }); }
function identitySummary(record) { return record?.identityEvidence?.[0]?.value || record?.recordId || 'Unavailable'; }

export function matchedDifferenceRow(match, config) {
  const properties = compareEngineeringProperties(match.source, match.target);
  const geometry = compareSupportedGeometry(match.source, match.target, config.geometryTolerance);
  const reasons = []; if (properties.length) reasons.push('PROPERTIES'); if (geometry.changed) reasons.push('GEOMETRY');
  const category = reasons.length ? 'CHANGED' : 'UNCHANGED';
  return deepFreeze({
    schema: REVISION_DIFFERENCE_ROW_SCHEMA,
    differenceId: differenceId(match.source.recordId, match.target.recordId), differenceCategory: category,
    matchCertainty: match.certainty, sourceRecordId: match.source.recordId, targetRecordId: match.target.recordId,
    changeReasons: Object.freeze(reasons), changedProperties: properties, geometryDelta: geometry,
    evidenceSummary: deepFreeze({ primary: match.certainty === 'EXACT' ? 'Unique supported identity.' : 'Bounded inferred candidate accepted.', revAIdentity: identitySummary(match.source), revBIdentity: identitySummary(match.target) }),
    candidateEvidenceId: match.evidenceId ?? null, visualRefs: visualRefs(match.source, match.target),
    context: deepFreeze({ branchId: match.source.branchId, componentType: match.source.componentType, revAIdentity: identitySummary(match.source), revBIdentity: identitySummary(match.target) }),
  });
}
export function unmatchedDifferenceRow(record, side, certainty = 'NOT_APPLICABLE', candidateEvidenceId = null) {
  const removed = side === 'A';
  return deepFreeze({
    schema: REVISION_DIFFERENCE_ROW_SCHEMA,
    differenceId: differenceId(removed ? record.recordId : null, removed ? null : record.recordId),
    differenceCategory: removed ? 'REMOVED' : 'ADDED', matchCertainty: certainty,
    sourceRecordId: removed ? record.recordId : null, targetRecordId: removed ? null : record.recordId,
    changeReasons: Object.freeze([removed ? 'REV_A_ONLY' : 'REV_B_ONLY']), changedProperties: Object.freeze([]),
    geometryDelta: deepFreeze({ status: record.geometry.availability, changed: false, maximumPointDelta: null, reason: 'No accepted counterpart.' }),
    evidenceSummary: deepFreeze({ primary: certainty === 'AMBIGUOUS' ? 'Bounded candidates require a later decision.' : 'No accepted counterpart in approved scope.', revAIdentity: removed ? identitySummary(record) : null, revBIdentity: removed ? null : identitySummary(record) }),
    candidateEvidenceId, visualRefs: visualRefs(removed ? record : null, removed ? null : record),
    context: deepFreeze({ branchId: record.branchId, componentType: record.componentType, revAIdentity: removed ? identitySummary(record) : null, revBIdentity: removed ? null : identitySummary(record) }),
  });
}
export function buildDifferenceRows(exact, inferred, config) {
  const rows = [];
  exact.matches.forEach((match) => rows.push(matchedDifferenceRow(match, config)));
  inferred.matches.forEach((match) => rows.push(matchedDifferenceRow(match, config)));
  inferred.ambiguous.forEach((entry) => rows.push(unmatchedDifferenceRow(entry.source, 'A', 'AMBIGUOUS', entry.evidenceId)));
  inferred.unmatched.forEach((record) => rows.push(unmatchedDifferenceRow(record, 'A')));
  inferred.remainingTargets.forEach((record) => rows.push(unmatchedDifferenceRow(record, 'B')));
  return Object.freeze(rows.sort((a, b) => a.differenceId.localeCompare(b.differenceId)));
}
