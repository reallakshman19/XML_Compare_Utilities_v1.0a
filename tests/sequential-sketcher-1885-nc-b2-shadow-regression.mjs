import assert from 'node:assert/strict';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';

const SOURCE_COMMIT = 'd5fda9c95fda9bba9b6b05171628ba16778a7667';
const SOURCE_URL = `https://raw.githubusercontent.com/reallaksh19/3D_Converters/${SOURCE_COMMIT}/Benchmarks/1885_NC/1885_NC.json`;
const B2 = '/ASIM-1885-6"-S8811951-91261M7-HC-01/B2';
const PRIMARY_IDS = ['/88-UZV-11951', '/88-FI-11046', '/88-HCV-11953'];

function text(value) { return String(value ?? '').trim(); }
function branchId(record) { return text(record?.attributes?.NAME || record?.name); }

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'sequential-sketcher-b2-shadow-regression' } });
assert.equal(response.ok, true, `Unable to fetch pinned 1885_NC fixture: ${response.status}`);
const records = await response.json();
const rawB2 = records.find((record) => branchId(record) === B2);
assert.ok(rawB2, `Pinned fixture must contain ${B2}`);

const evidence = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidence);
const branch = indexes.branches.get(B2);
assert.ok(branch);
assert.equal(branch.shadowCarrierCount, 3);
assert.equal(branch.sourceRouteComponentCount - branch.components.length, 3);

const primaryComponents = PRIMARY_IDS.map((sourceComponentId) => branch.components.find((component) => component.sourceComponentId === sourceComponentId));
assert.ok(primaryComponents.every(Boolean));
assert.ok(primaryComponents.every((component) => component.shadowCarrierEvidence));
assert.ok(primaryComponents.every((component) => /^PIPE\s+AUTO\b/iu.test(component.shadowCarrierEvidence.sourceName)));
assert.ok(primaryComponents.every((component) => component.shadowCarrierEvidence.orientation === 'SAME_DIRECTION'));

const activeSourceIds = new Set(branch.components.map((component) => component.sourceComponentId));
for (const component of primaryComponents) {
  const shadow = component.shadowCarrierEvidence;
  assert.equal(activeSourceIds.has(shadow.sourceComponentId), false, 'shadow pipe must not remain an active component');
  assert.equal(indexes.componentReferences.get(shadow.sourceName)[0].componentId, component.componentId);
  if (shadow.attributes?.REF) assert.equal(indexes.componentReferences.get(shadow.attributes.REF)[0].componentId, component.componentId);
}

const result = runConstructionUntilBlocked(
  createSequentialConstructionSession(B2),
  evidence,
  indexes,
  { exactToleranceMm: 1, autoRepairToleranceMm: 25, candidateSearchRadiusMm: 250 },
  3000,
);
assert.notEqual(result.session.state, 'FAILED');
assert.equal(result.session.strokeLedger.some((stroke) => stroke.sourceComponentId?.startsWith('PIPE AUTO')), false);
for (const sourceComponentId of PRIMARY_IDS) {
  const commands = result.session.strokeLedger.filter((stroke) => stroke.sourceComponentId === sourceComponentId);
  if (result.session.confirmedComponentIds.includes(branch.components.find((component) => component.sourceComponentId === sourceComponentId).componentId)) {
    assert.equal(commands.length, 1, `${sourceComponentId} must be drawn exactly once`);
    assert.ok(['DRAW_INSTRUMENT', 'DRAW_VALVE'].includes(commands[0].op));
    assert.ok(commands[0].shadowCarrierEvidence);
  }
}

const blockedCandidates = result.session.currentDecisionRequest?.candidates || [];
assert.equal(blockedCandidates.some((candidate) => candidate.targetSourceComponentId?.startsWith('PIPE AUTO')), false);
assert.equal(new Set(blockedCandidates.map((candidate) => candidate.targetComponentId)).size, blockedCandidates.length,
  'blocked candidates must not contain shadow/primary duplicates');

console.log('sequential 1885 NC B2 shadow regression passed');
