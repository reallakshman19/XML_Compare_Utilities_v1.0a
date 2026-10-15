/** Pure presentation helpers for prepared support adjustments and history transitions. */
function pointText(value) {
  return value ? `(${value.x}, ${value.y}, ${value.z})` : '(none)';
}
function moveReview(prepared) {
  const entry = prepared.candidate.entry;
  return [
    `Prepared ID: ${prepared.preparedId}`,
    `Adjustment ID: ${entry.adjustmentId}`,
    `Support: ${entry.supportId}`,
    `Carrier: ${entry.carrierId}`,
    `From: ${pointText(entry.fromPosition)}`,
    `To: ${pointText(entry.toPosition)}`,
    `Position status: ${entry.resolvedPosition.positionStatus}`,
    `Authority ID: ${prepared.expectedAuthority.authorityId}`,
    `Next register: ${prepared.candidate.register.headFingerprint}`,
    'Apply prepared is the only publication action.',
  ].join('\n');
}
function historyReview(prepared) {
  const candidate = prepared.candidate;
  const entry = candidate.affectedEntry;
  const undo = candidate.action === 'UNDO_SUPPORT_ADJUSTMENT';
  const fromPoint = undo ? entry?.toPosition : entry?.fromPosition;
  const toPoint = undo ? entry?.fromPosition : entry?.toPosition;
  return [
    `Prepared ID: ${prepared.preparedId}`,
    `Action: ${candidate.action}`,
    `Affected adjustment: ${entry?.adjustmentId || '(none)'}`,
    `Support: ${entry?.supportId || '(none)'}`,
    `Carrier: ${entry?.carrierId || '(none)'}`,
    `Effective from: ${pointText(fromPoint)}`,
    `Effective to: ${pointText(toPoint)}`,
    `Current register: ${candidate.expectedCurrentRegisterHeadFingerprint}`,
    `Next register: ${candidate.history.currentRegister.headFingerprint}`,
    `Current history: ${candidate.expectedHistoryFingerprint}`,
    `Next history: ${candidate.history.historyFingerprint}`,
    `Authority ID: ${prepared.expectedAuthority.authorityId}`,
    `Issued at: ${candidate.provenance.issuedAt}`,
    'Apply prepared is the only publication action.',
  ].join('\n');
}

export function sequentialSupportPreparedReviewText(prepared) {
  if (!prepared) return 'No support operation is prepared.';
  if (prepared.schema === 'SequentialPreparedSupportAdjustment.v1') return moveReview(prepared);
  if (prepared.schema === 'SequentialPreparedSupportAdjustmentHistory.v1') {
    return historyReview(prepared);
  }
  return 'Prepared support operation uses an unsupported schema.';
}
export function sequentialSupportHistorySummary(historyState) {
  if (!historyState) return 'Support adjustment history is unavailable.';
  return `History: ${historyState.currentAdjustmentCount} applied · ${historyState.undoCount} undo · ${historyState.redoCount} redo`;
}
export function sequentialSupportPreparedKind(prepared) {
  if (prepared?.schema === 'SequentialPreparedSupportAdjustment.v1') return 'MOVE';
  if (prepared?.schema === 'SequentialPreparedSupportAdjustmentHistory.v1') return 'HISTORY';
  return null;
}

export const _test = Object.freeze({ pointText, moveReview, historyReview });
