/**
 * Builds an editable continuation draft from immutable staged source records.
 * Input and output use plain JSON-compatible values; no source record is mutated.
 */
export const SEQUENTIAL_CONTINUATION_DRAFT_SCHEMA = 'SequentialContinuationDraft.v1';

function text(value) { return String(value ?? '').trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function point(value) {
  if (!value || typeof value !== 'object') return null;
  const x = number(value.x); const y = number(value.y); const z = number(value.z);
  return x === null || y === null || z === null ? null : Object.freeze({ x, y, z });
}
function distance(left, right) {
  return left && right ? Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z) : null;
}
function token(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }
function endpoint(branch, role) {
  if (!branch) return null;
  return role === 'TAIL' ? point(branch.attributes?.TPOS) : point(branch.attributes?.HPOS);
}
function nearestEndpoint(branch, sourcePoint) {
  const head = endpoint(branch, 'HEAD'); const tail = endpoint(branch, 'TAIL');
  if (!sourcePoint) return head ? 'HEAD' : tail ? 'TAIL' : 'HEAD';
  const headGap = distance(sourcePoint, head); const tailGap = distance(sourcePoint, tail);
  if (headGap === null) return 'TAIL';
  if (tailGap === null) return 'HEAD';
  return headGap <= tailGap ? 'HEAD' : 'TAIL';
}
function childSourcePoint(child) {
  const attrs = child?.attributes || {};
  return point(attrs.BPOS || attrs.LPOS || attrs.APOS || attrs.POS);
}
function reviewStatus(queue, id) {
  return queue?.rows?.find((row) => row.branchId === id)?.reviewStatus || 'NOT_ANALYZED';
}
function baseConnector(input) {
  const target = input.targetBranch || null;
  const targetEndpoint = input.targetEndpoint || (input.role === 'HEAD' ? 'TAIL' : 'HEAD');
  const targetPoint = endpoint(target, targetEndpoint);
  const gapMm = distance(input.sourcePoint, targetPoint);
  const targetBranchId = target ? branchId(target) : null;
  return Object.freeze({
    schema: 'SequentialContinuationConnector.v1',
    connectorId: `CONT-${token(`${input.branchId}|${input.role}|${input.childIndex ?? ''}`)}`,
    branchId: input.branchId,
    sourceRecordIndex: input.sourceRecordIndex,
    sourceChildIndex: input.childIndex ?? null,
    role: input.role,
    sourcePoint: input.sourcePoint,
    originalReference: input.reference || null,
    externalReference: input.reference || '',
    targetBranchId,
    targetEndpoint,
    targetPoint,
    gapMm,
    status: target ? (gapMm === null ? 'INTERNAL_POSITION_MISSING' : 'INTERNAL') : 'EXTERNAL_SHEET',
    reviewStatus: input.reviewStatus,
    edited: false,
    reason: '',
  });
}
function connectorInputs(records, queue) {
  const branches = records.filter((record) => String(record?.type || '').toUpperCase() === 'BRANCH');
  const byId = new Map(branches.map((record) => [branchId(record), record]));
  const inputs = [];
  for (let sourceRecordIndex = 0; sourceRecordIndex < records.length; sourceRecordIndex += 1) {
    const record = records[sourceRecordIndex];
    const id = branchId(record);
    if (!id || String(record?.type || '').toUpperCase() !== 'BRANCH') continue;
    const attrs = record.attributes || {};
    for (const [role, key, sourcePoint] of [
      ['HEAD', 'HREF', point(attrs.HPOS)], ['TAIL', 'TREF', point(attrs.TPOS)],
    ]) {
      const reference = text(attrs[key]);
      const targetBranch = byId.get(reference) || null;
      inputs.push({ branchId: id, sourceRecordIndex, role, reference, sourcePoint,
        targetBranch, targetEndpoint: role === 'HEAD' ? 'TAIL' : 'HEAD',
        reviewStatus: reviewStatus(queue, id) });
    }
    for (let childIndex = 0; childIndex < (record.children || []).length; childIndex += 1) {
      const child = record.children[childIndex]; const reference = text(child?.attributes?.CREF);
      if (!reference) continue;
      const sourcePoint = childSourcePoint(child); const targetBranch = byId.get(reference) || null;
      inputs.push({ branchId: id, sourceRecordIndex, childIndex, role: 'BRANCH',
        reference, sourcePoint, targetBranch,
        targetEndpoint: nearestEndpoint(targetBranch, sourcePoint),
        reviewStatus: reviewStatus(queue, id) });
    }
  }
  return { inputs, branches, byId };
}
function applyOverride(connector, override, byId) {
  if (!override) return connector;
  const external = override.targetBranchId === '__EXTERNAL__' || !override.targetBranchId;
  const target = external ? null : byId.get(override.targetBranchId);
  const targetEndpoint = override.targetEndpoint === 'TAIL' ? 'TAIL' : 'HEAD';
  const targetPoint = endpoint(target, targetEndpoint);
  const gapMm = distance(connector.sourcePoint, targetPoint);
  const externalReference = text(override.externalReference ?? connector.externalReference);
  const edited = (target ? branchId(target) : null) !== connector.targetBranchId
    || targetEndpoint !== connector.targetEndpoint
    || externalReference !== connector.externalReference;
  return Object.freeze({
    ...connector,
    targetBranchId: target ? branchId(target) : null,
    externalReference,
    targetEndpoint,
    targetPoint,
    gapMm,
    status: target ? (gapMm === null ? 'INTERNAL_POSITION_MISSING' : 'INTERNAL') : 'EXTERNAL_SHEET',
    edited,
    reason: text(override.reason),
  });
}
function summary(connectors) {
  const internal = connectors.filter((row) => row.status === 'INTERNAL');
  return Object.freeze({
    connectorCount: connectors.length,
    internalCount: internal.length,
    externalCount: connectors.filter((row) => row.status === 'EXTERNAL_SHEET').length,
    editedCount: connectors.filter((row) => row.edited).length,
    maximumGapMm: internal.reduce((max, row) => Math.max(max, row.gapMm || 0), 0),
  });
}

export function sequentialSourceFingerprint(records) {
  return `SRC-${token(JSON.stringify(records))}`;
}

export function buildSequentialContinuationDraft(records, queue, overrides = {}) {
  if (!Array.isArray(records)) throw new TypeError('Sequential source records must be an array.');
  if (queue?.schema !== 'SequentialBlockedBranchReviewQueue.v1') {
    throw new Error('Build the blocked review queue before editing continuation connectors.');
  }
  const { inputs, branches, byId } = connectorInputs(records, queue);
  const connectors = inputs.map((input) => {
    const base = baseConnector(input);
    return applyOverride(base, overrides[base.connectorId], byId);
  });
  return Object.freeze({
    schema: SEQUENTIAL_CONTINUATION_DRAFT_SCHEMA,
    sourceFingerprint: sequentialSourceFingerprint(records),
    queueGeneratedAt: queue.generatedAt,
    branchIds: Object.freeze(branches.map(branchId)),
    connectors: Object.freeze(connectors),
    summary: summary(connectors),
  });
}

export function continuationOverride(connector, patch = {}) {
  return Object.freeze({
    targetBranchId: text(patch.targetBranchId || connector.targetBranchId || '__EXTERNAL__'),
    targetEndpoint: patch.targetEndpoint === 'TAIL' ? 'TAIL' : 'HEAD',
    externalReference: text(patch.externalReference ?? connector.externalReference),
    reason: text(patch.reason ?? connector.reason),
  });
}

export function assertSequentialContinuationDraftCurrent(draft, records, queue) {
  if (draft?.schema !== SEQUENTIAL_CONTINUATION_DRAFT_SCHEMA) throw new Error('Continuation draft is not available.');
  if (draft.sourceFingerprint !== sequentialSourceFingerprint(records)) {
    throw new Error('CONTINUATION_DRAFT_STALE: source records changed after the queue draft was built.');
  }
  if (!queue || queue.generatedAt !== draft.queueGeneratedAt) {
    throw new Error('CONTINUATION_DRAFT_STALE: rebuild the review queue before constructing geometry.');
  }
  return true;
}
