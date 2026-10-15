import assert from 'node:assert/strict';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';
import { locateSupportOnCarrier } from '../tabs/sequential-sketcher/support/sj-pipe-support-geometry.js';
import {
  appendSequentialSupportAdjustment,
  createSequentialSupportAdjustmentRegister,
} from '../tabs/sequential-sketcher/support/sequential-support-adjustment-register.js';
import {
  applySequentialSupportAdjustmentRegister,
  assertSequentialAdjustedSupportProjection,
} from '../tabs/sequential-sketcher/support/sequential-support-adjusted-projection.js';

const BRANCH = '/SSK/3I/PROJECTION';
const AT = '2026-07-28T06:56:00.000Z';
const records = [{
  type: 'BRANCH', name: BRANCH, attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
  children: [
    { type: 'PIPE', name: 'P1', attributes: { NAME: 'P1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 1000, y: 0, z: 0 } } },
    { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1/DATUM', TYPE: 'ATTA', OWNER: BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'REST' } },
    { type: 'SUPPORT', name: 'SUPPORT FAMILY', attributes: { NAME: '/PS-1.1', TYPE: 'ATTA', OWNER: BRANCH, POS: { x: 250, y: 0, z: 0 }, CMPSUPTYPE: 'SH-100', DTXR: 'PIPE SHOE' } },
    { type: 'CAP', name: 'C1', attributes: { NAME: 'C1', APOS: { x: 1000, y: 0, z: 0 } } },
  ],
}];
const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const session = runConstructionUntilBlocked(
  createSequentialConstructionSession(BRANCH), evidence, indexes, { commandIssuedAt: AT },
).session;
const confirmed = createConfirmedSequentialConstruction(session, indexes);
const base = buildConfirmedConstructionSupportProjection(confirmed, indexes, {});
const baseJson = JSON.stringify(base);
const bundle = base.branchBundles[0];
const glyph = base.supportGlyphs[0];
const carrier = bundle.carriers.find((row) => row.carrierId === glyph.carrierId);
const requested = Object.freeze({ x: 300, y: 0, z: 0 });
const located = locateSupportOnCarrier({
  supportPosGlobal: requested, carrier,
  projectionToleranceMm: 0.001, onCenterlineToleranceMm: 0.001,
  plantUp: bundle.coordinateSystem.plantUp,
});
assert.equal(located.positionStatus, 'ON_CENTERLINE');

const empty = createSequentialSupportAdjustmentRegister({
  constructionFingerprint: base.constructionFingerprint,
});
const appended = appendSequentialSupportAdjustment(empty, {
  supportId: glyph.glyphId, familyId: glyph.familyId, carrierId: glyph.carrierId,
  fromPosition: glyph.centerlinePointGlobal, toPosition: requested,
  resolvedPosition: { ...located, supportPosGlobal: requested },
  targetId: 'TARGET-3I', operationId: 'OP-3I', actorId: 'operator-3i',
  reason: 'Approved same-carrier adjustment.', evidenceNote: 'Carrier checked.', appliedAt: AT,
});
const effective = applySequentialSupportAdjustmentRegister(base, appended.register);
assert.equal(JSON.stringify(base), baseJson, 'effective projection must not mutate base projection');
assert.equal(effective.supportGlyphs[0].centerlinePointGlobal.x, 300);
assert.equal(effective.supportGlyphs[0].supportAdjustmentId, appended.entry.adjustmentId);
const effectiveBundle = effective.branchBundles[0];
assert.equal(effectiveBundle.supportGlyphs[0].centerlinePointGlobal.x, 300);
assert.equal(effectiveBundle.resolvedSupportFamilies[0].position.centerlinePointGlobal.x, 300);
assert.equal(effectiveBundle.resolvedSupportFamilies[0].position.supportPosGlobal.x, 300);
const effectiveCarrier = effectiveBundle.carriers.find((row) => row.carrierId === glyph.carrierId);
assert.equal(effectiveCarrier.supportFamilies[0].position.centerlinePointGlobal.x, 300);
assert.equal(effective.adjustmentAuthority.adjustmentCount, 1);
assert.equal(effective.adjustmentAuthority.registerHeadFingerprint, appended.register.headFingerprint);
assert.equal(effective.audit.baseProjectionMutated, false);
assert.deepEqual(assertSequentialAdjustedSupportProjection(base, appended.register, effective), effective);

const tampered = {
  ...effective,
  supportGlyphs: effective.supportGlyphs.map((row) => ({
    ...row, centerlinePointGlobal: { ...row.centerlinePointGlobal, x: 301 },
  })),
};
assert.throws(() => assertSequentialAdjustedSupportProjection(base, appended.register, tampered),
  /differs from independent/);
const stale = appendSequentialSupportAdjustment(empty, {
  ...appended.entry,
  fromPosition: { x: 200, y: 0, z: 0 },
  appliedAt: AT,
}).register;
assert.throws(() => applySequentialSupportAdjustmentRegister(base, stale), /stale support point/);

console.log('Sequential SSK-TS-3I adjusted support projection: ok');
