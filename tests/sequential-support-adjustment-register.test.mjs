import assert from 'node:assert/strict';
import {
  appendSequentialSupportAdjustment,
  assertSequentialSupportAdjustmentRegister,
  createSequentialSupportAdjustmentRegister,
  latestSequentialSupportAdjustment,
} from '../tabs/sequential-sketcher/support/sequential-support-adjustment-register.js';

const CONSTRUCTION = 'CONSTRUCTION-3I';
const AT = '2026-07-28T06:55:00.000Z';
function resolved(x) {
  return Object.freeze({
    supportPosGlobal: Object.freeze({ x, y: 0, z: 0 }),
    centerlinePointGlobal: Object.freeze({ x, y: 0, z: 0 }),
    carrierStationMm: x,
    carrierFraction: x / 1000,
    distanceToCarrierMm: 0,
    offsetFromCenterline: Object.freeze({ x: 0, y: 0, z: 0 }),
    positionStatus: 'ON_CENTERLINE',
    localFrame: Object.freeze({
      tangent: Object.freeze({ x: 1, y: 0, z: 0 }),
      normal: Object.freeze({ x: 0, y: 0, z: 1 }),
      binormal: Object.freeze({ x: 0, y: -1, z: 0 }),
    }),
    fittingLocation: null,
  });
}
function input(from, to, suffix = '1') {
  return {
    supportId: 'SUPPORT-3I', familyId: 'FAMILY-3I', carrierId: 'PIPE-3I',
    fromPosition: { x: from, y: 0, z: 0 }, toPosition: { x: to, y: 0, z: 0 },
    resolvedPosition: resolved(to), targetId: `TARGET-${suffix}`, operationId: `OP-${suffix}`,
    actorId: 'operator-3i', reason: 'Approved same-carrier adjustment.',
    evidenceNote: 'Carrier and coordinates independently verified.', appliedAt: AT,
  };
}

const left = createSequentialSupportAdjustmentRegister({ constructionFingerprint: CONSTRUCTION });
const right = createSequentialSupportAdjustmentRegister({ constructionFingerprint: CONSTRUCTION });
assert.deepEqual(left, right);
assert(Object.isFrozen(left));
assert.equal(left.entries.length, 0);
assert.match(left.headFingerprint, /^fnv1a32-canonical-json-v1:SSUPPORTADJUSTMENTREGISTER:/);

const firstLeft = appendSequentialSupportAdjustment(left, input(250, 300));
const firstRight = appendSequentialSupportAdjustment(right, input(250, 300));
assert.deepEqual(firstLeft, firstRight, 'register append must be deterministic');
assert.equal(firstLeft.register.entries.length, 1);
assert.equal(firstLeft.entry.toPosition.x, 300);
assert.equal(latestSequentialSupportAdjustment(firstLeft.register, 'SUPPORT-3I').adjustmentId,
  firstLeft.entry.adjustmentId);
assert.deepEqual(assertSequentialSupportAdjustmentRegister(firstLeft.register, CONSTRUCTION),
  firstLeft.register);
assert.equal(left.entries.length, 0, 'append must not mutate the caller-owned register');

const second = appendSequentialSupportAdjustment(firstLeft.register, input(300, 350, '2'));
assert.equal(second.register.entries.length, 2);
assert.notEqual(second.register.headFingerprint, firstLeft.register.headFingerprint);
assert.equal(second.entry.fromPosition.x, 300);
assert.throws(() => appendSequentialSupportAdjustment(firstLeft.register, input(275, 350, 'stale')),
  /current adjusted point/);
assert.throws(() => assertSequentialSupportAdjustmentRegister(second.register, 'OTHER'), /stale/);
assert.throws(() => appendSequentialSupportAdjustment(left, {
  ...input(250, 300), appliedAt: 'not-a-time',
}), /ISO timestamp/);

console.log('Sequential SSK-TS-3I support adjustment register: ok');
