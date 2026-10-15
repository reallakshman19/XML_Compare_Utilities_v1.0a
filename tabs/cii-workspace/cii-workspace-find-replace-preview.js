/*
 * CII v14 Find & Replace Preview Adapter
 *
 * Preview owns review state only. It never mutates XML/CII content and never
 * calls Writer1/Writer2.
 */

const REVIEWABLE = new Set(['PROPOSED', 'APPROVED', 'REJECTED']);
const ALLOWED = new Set(['PROPOSED', 'APPROVED', 'REJECTED', 'BLOCKED']);

function normalizedStatus(candidate) {
  const status = String(candidate?.status || 'PROPOSED').toUpperCase();
  return ALLOWED.has(status) ? status : 'BLOCKED';
}

function freezeRow(candidate, index) {
  return Object.freeze({
    ...candidate,
    sequence: index + 1,
    scope: candidate?.scope || 'UNKNOWN',
    entity: candidate?.entity || null,
    id: candidate?.id || null,
    field: candidate?.field || null,
    before: candidate?.before ?? null,
    after: candidate?.after ?? null,
    status: normalizedStatus(candidate),
    blockers: Object.freeze([...(candidate?.blockers || [])]),
  });
}

export function buildFindReplacePreview(candidates = []) {
  return Object.freeze((candidates || []).map(freezeRow));
}

export function setFindReplaceRowDecision(rows = [], sequence, decision) {
  const next = String(decision || '').toUpperCase();
  if (!['APPROVED', 'REJECTED', 'PROPOSED'].includes(next)) throw new TypeError('Unsupported Find & Replace decision');
  let found = false;
  const updated = (rows || []).map((row, index) => {
    if (row.sequence !== sequence) return row;
    found = true;
    if (!REVIEWABLE.has(row.status)) return row;
    return freezeRow({ ...row, status: next }, index);
  });
  if (!found) throw new RangeError(`Find & Replace preview row not found: ${sequence}`);
  return Object.freeze(updated);
}

export function summarizeFindReplacePreview(rows = []) {
  const count = (status) => (rows || []).filter((row) => row.status === status).length;
  return Object.freeze({
    total: (rows || []).length,
    proposed: count('PROPOSED'),
    approved: count('APPROVED'),
    rejected: count('REJECTED'),
    blocked: count('BLOCKED'),
    readyForTransaction: count('APPROVED') > 0 && count('PROPOSED') === 0 && count('BLOCKED') === 0,
  });
}
