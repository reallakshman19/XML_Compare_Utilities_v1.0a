/*
 * CII v14 Find & Replace review adapter.
 *
 * Consumes the existing compare-review projection rather than raw candidate
 * rankings. This preserves the identity-review gate: raw alignment candidates
 * never become editable proposals by themselves.
 */

function isScalar(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}

function textValue(value) {
  if (value == null) return '';
  return String(value);
}

function scopedIdentity(row) {
  return row?.source || row?.target || null;
}

function blockersFor(row, change) {
  const blockers = [];
  if (!row?.identityBound) blockers.push('IDENTITY_NOT_BOUND');
  if (!['ACCEPTED', 'LOCKED'].includes(row?.decision)) blockers.push('IDENTITY_NOT_APPROVED');
  if (change?.evidenceStatus !== 'QUALIFIED') blockers.push('CHANGE_EVIDENCE_NOT_QUALIFIED');
  if (!isScalar(change?.sourceValue) || !isScalar(change?.targetValue)) blockers.push('NON_SCALAR_CHANGE_NOT_SUPPORTED');
  if (textValue(change?.sourceValue) === textValue(change?.targetValue)) blockers.push('NO_EFFECTIVE_TEXT_CHANGE');
  return blockers;
}

export function buildFindReplaceOperationsFromCompareReview(compareReview) {
  const operations = [];
  for (const row of compareReview?.rows || []) {
    for (const change of row?.changes || []) {
      if (!change?.changed) continue;
      const blockers = blockersFor(row, change);
      operations.push(Object.freeze({
        source: 'CII_COMPARE_REVIEW',
        scope: 'ELEMENT',
        entity: row.kind || change.identityKind || null,
        id: scopedIdentity(row),
        correspondenceId: row.correspondenceId || change.correspondenceId || null,
        field: `${change.category || 'UNKNOWN'} :: ${change.property || 'UNKNOWN'}`,
        category: change.category || null,
        property: change.property || null,
        before: change.sourceValue ?? null,
        after: change.targetValue ?? null,
        findText: textValue(change.sourceValue),
        replaceText: textValue(change.targetValue),
        authority: change.authority || null,
        evidenceStatus: change.evidenceStatus || 'UNRESOLVED',
        identityConfidence: row.confidence || change.identityConfidence || 'UNRESOLVED',
        reviewDecision: row.decision || 'REVIEW',
        status: blockers.length ? 'BLOCKED' : 'PROPOSED',
        blockers: Object.freeze(blockers),
      }));
    }
  }
  return Object.freeze(operations);
}
