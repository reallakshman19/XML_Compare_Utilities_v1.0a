import assert from 'assert';
import {
  ciiDeltaTransferOutcome, ciiEngineeringChangesMarkup, ciiEngineeringDeltaMarkup,
  ciiEngineeringValueText, ciiTransferPreviewMarkup,
} from '../tabs/cii-workspace/cii-workspace-review-presentation.js';

const vector = { x: 100, y: -25.5, z: 3 };
assert.strictEqual(ciiEngineeringValueText(vector), 'X 100 · Y -25.5 · Z 3');
assert.strictEqual(ciiEngineeringValueText([1, 2, 3]), '1, 2, 3');
const restraint = ciiEngineeringValueText([{ typeCode: 1, stiffness: 1000, gap: 3, friction: 0.3 }]);
assert(restraint.includes('type Code 1') && restraint.includes('gap 3') && restraint.includes('friction 0.3'));
assert(!restraint.includes('{') && !restraint.includes('"typeCode"'), 'structured engineering values must not be rendered as JSON');

const delta = {
  deltaId: 'delta:c1:PROCESS:P1', correspondenceId: 'c1', sourceIdentity: '100', targetIdentity: '5100',
  identityConfidence: 'HIGH', category: 'PROCESS', property: 'P1', sourceValue: 10, targetValue: 20,
  delta: 10, semanticChange: 'CHANGED', changed: true, evidenceStatus: 'QUALIFIED', authority: 'FIXED_FIELD_P1', limitations: [],
};
function operation(overrides = {}) {
  return {
    engineeringDeltaId: delta.deltaId, action: 'COPY', family: 'PROCESS', property: 'P1', custody: 'ELEMENT',
    sourceEvidence: { identity: '100', value: 10 }, before: 20, proposed: 10, status: 'PREVIEW_READY', blockers: [],
    matchAuthority: { correspondenceId: 'c1', status: 'REVIEWED', candidateStatus: 'HIGH' },
    ...overrides,
  };
}
function current(overrides = {}) {
  return {
    review: { reviewedCorrespondenceIds: ['c1'], lockedCorrespondenceIds: [], rejectedCorrespondenceIds: [] },
    compareReview: { rows: [{ correspondenceId: 'c1', source: '100', target: '5100' }], summary: { review: { accepted: 1, locked: 0, rejected: 0, pending: 0 } } },
    engineeringDeltas: { changedRows: [delta] },
    transferPlan: {
      status: 'PREVIEW_READY', blockers: [], operations: [operation()],
      summary: { operationCount: 1, protectedCount: 0, blockedCount: 0, byAction: { COPY: 1 } },
    },
    writerReadiness: { ready: true, status: 'READY', blockers: [] },
    ...overrides,
  };
}

const ready = ciiDeltaTransferOutcome(current(), delta, 'APPROVED');
assert.deepStrictEqual(ready, { state: 'WILL APPLY', effective: 10, proposed: 10, willApply: true });

const writerBlocked = ciiDeltaTransferOutcome(current({ writerReadiness: { ready: false, status: 'BLOCKED', blockers: ['UNSUPPORTED_FIELD'] } }), delta, 'APPROVED');
assert.strictEqual(writerBlocked.state, 'WRITER 1B BLOCKED');
assert.strictEqual(writerBlocked.effective, 20, 'blocked Writer must not make proposal look applied');
assert.strictEqual(writerBlocked.proposed, 10);

const protectedCurrent = current({
  transferPlan: { status: 'PREVIEW_READY', blockers: [], operations: [operation({ status: 'PROTECTED' })], summary: { operationCount: 1, protectedCount: 1, blockedCount: 0, byAction: { KEEP: 1 } } },
  writerReadiness: { ready: false, status: 'BLOCKED', blockers: ['PROTECTED_OPERATION'] },
});
const protectedOutcome = ciiDeltaTransferOutcome(protectedCurrent, delta, 'APPROVED');
assert.strictEqual(protectedOutcome.state, 'PROTECTED');
assert.strictEqual(protectedOutcome.effective, 20);

const pending = ciiDeltaTransferOutcome(current(), delta, 'PENDING');
assert.strictEqual(pending.state, 'PENDING APPROVAL');
assert.strictEqual(pending.effective, 20);
const rebuild = ciiDeltaTransferOutcome(current({ review: { reviewedCorrespondenceIds: [], lockedCorrespondenceIds: [], rejectedCorrespondenceIds: [] } }), delta, 'APPROVED');
assert.strictEqual(rebuild.state, 'REBUILD PREVIEW', 'live approval must not impersonate a bound Transfer Preview operation');
assert.strictEqual(rebuild.effective, 20);

const deltaMarkup = ciiEngineeringDeltaMarkup(current(), () => 'APPROVED');
assert(deltaMarkup.includes('SOURCE candidate'));
assert(deltaMarkup.includes('Current TARGET'));
assert(deltaMarkup.includes('Effective TARGET after apply'));
assert(deltaMarkup.includes('WILL APPLY'));
assert(deltaMarkup.includes('TARGET − SOURCE = 10'));
assert(deltaMarkup.includes('FIXED_FIELD_P1'));
assert(!deltaMarkup.includes('{"'), 'Delta Grid must not dump structured JSON');

const blockedMarkup = ciiTransferPreviewMarkup(current({ writerReadiness: { ready: false, status: 'BLOCKED', blockers: ['UNSUPPORTED_FIELD'] } }));
assert(blockedMarkup.includes('Effective TARGET remains the current TARGET'));
assert(blockedMarkup.includes('WRITER 1B BLOCKED'));
assert(blockedMarkup.includes('Proposal: 10'));
assert(blockedMarkup.includes('<b>20</b>'), 'blocked effective TARGET must remain current TARGET');

const readyMarkup = ciiTransferPreviewMarkup(current());
assert(readyMarkup.includes('Effective TARGET after apply'));
assert(readyMarkup.includes('WILL APPLY'));
assert(!readyMarkup.includes('{"'));

const changesMarkup = ciiEngineeringChangesMarkup([{
  ...delta, category: 'GEOMETRY', property: 'Node location (native basis)', sourceValue: { x: 0, y: 0, z: 0 },
  targetValue: { x: 1, y: 2, z: 3 }, delta: { distanceMm: Math.sqrt(14), basis: 'NATIVE' },
}]);
assert(changesMarkup.includes('X 0 · Y 0 · Z 0'));
assert(changesMarkup.includes('X 1 · Y 2 · Z 3'));
assert(changesMarkup.includes('distance Mm'));
assert(!changesMarkup.includes('{"'));

console.log('CII Compare Review / Delta / Transfer presentation checks passed.');
