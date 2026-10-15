import assert from 'node:assert/strict';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const B3 = '/ASIM-1885-6"-S8811951-91261M7-HC-01/B3';
const B2 = '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2';

function text(value) { return String(value ?? '').trim(); }
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-support-regression' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
const selected = [B3, B2].map((id) => records.find((record) => branchId(record) === id));
assert.ok(selected.every(Boolean), 'B3 and its referenced OLET owner branch B2 must exist');

const evidence = buildSequentialEvidenceModel(selected);
const indexes = indexSequentialEvidence(evidence);
const result = runConstructionUntilBlocked(
  createSequentialConstructionSession(B3),
  evidence,
  indexes,
  { exactToleranceMm: 1, autoRepairToleranceMm: 25, candidateSearchRadiusMm: 250 },
);
assert.equal(result.session.state, 'ROUTE_COMPLETE');
const confirmed = createConfirmedSequentialConstruction(result.session, indexes);
const projection = buildConfirmedConstructionSupportProjection(confirmed, indexes, {
  projectionToleranceMm: 50,
  onCenterlineToleranceMm: 0.001,
  ambiguityToleranceMm: 1,
});

assert.equal(projection.branchBundles.length, 1);
assert.equal(projection.supportGlyphs.length, 1);
assert.equal(projection.supportGlyphs[0].familyId, '/PS-12245');
assert.equal(projection.supportGlyphs[0].label, 'PS-12245');
assert.equal(projection.unresolvedSupportFamilies.length, 0);

const resolvedFamilies = projection.branchBundles
  .flatMap((bundle) => bundle.carriers)
  .flatMap((carrier) => carrier.supportFamilies);
assert.equal(resolvedFamilies.length, 1);
assert.equal(resolvedFamilies[0].familyId, '/PS-12245');
assert.equal(resolvedFamilies[0].members.length, 5);
assert.deepEqual(resolvedFamilies[0].members.map((member) => member.semanticRole), [
  'DATUM',
  'STRUCTURAL_REFERENCE',
  'PIPE_SHOE',
  'WEAR_PLATE',
  'GUIDE_MEMBER',
]);

const excluded = projection.diagnostics.filter((row) => row.code === 'NON_SEMANTIC_ATTACHMENT_EXCLUDED');
assert.equal(excluded.length, 2);
assert.deepEqual(excluded.map((row) => row.memberId).sort(), [
  '=1006649732/51286',
  '=1006649732/51305',
]);
assert.ok(excluded.every((row) => row.attributes?.DTXR === '---'));
assert.ok(excluded.every((row) => row.attributes?.CMPSUPTYPE === ''));
assert.equal(projection.diagnostics.some((row) => row.code === 'SUPPORT_FAMILY_MEMBER_POSITION_DIVERGENCE'), false);
assert.equal(projection.diagnostics.some((row) => row.code === 'LOCAL_FRAME_UNRESOLVED'), false);

console.log('sequential 1885 NC B3 support regression passed');
