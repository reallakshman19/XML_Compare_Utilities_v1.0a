import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PIPELINE_GRE_CAESAR_CASES,
  writeSha256Manifest,
} from '../scripts/pipeline-gre-caesar-evidence-package.mjs';
import {
  scaffoldOperatorEvidencePackage,
  verifyOperatorEvidencePackage,
} from '../scripts/pipeline-gre-caesar-operator-admission.mjs';

const SOURCE_SHA = '1f0b4b3f259023b2eda59a7148942de3e531b02d';
const validSession = (caseId) => ({ operatorId: 'operator-1', workstationId: 'ws-17',
  sessionId: 'session-20260727', executedAt: `2026-07-27T0${Number(caseId.slice(1))}:00:00+04:00`,
  timeZone: 'Asia/Muscat', noManualXmlEdits: true });

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, 'utf8'));
}

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function updateManifest(root, caseId, mutate) {
  const directory = path.join(root, caseId), target = path.join(directory, 'manifest.json');
  await writeJson(target, mutate(await readJson(target)));
  await writeSha256Manifest(directory);
}

async function addScreenshot(root, caseId) {
  await fs.writeFile(path.join(root, caseId, 'screenshots', 'import.png'), `${caseId}:screenshot\n`, 'utf8');
  await writeSha256Manifest(path.join(root, caseId));
}

function admittedBase(overrides = {}) {
  const cases = PIPELINE_GRE_CAESAR_CASES.map((caseId) => ({ caseId, fixtureId: `fixture:${caseId}`,
    status: 'ADMITTED', diagnostics: [], evidenceReady: true, ...(overrides[caseId] || {}) }));
  return { schema: 'PipelineGreCaesarEvidencePackage.v2', packageRoot: '.', cases,
    counts: { ADMITTED: cases.filter((item) => item.status === 'ADMITTED').length,
      REJECTED_WITH_REASON: cases.filter((item) => item.status === 'REJECTED_WITH_REASON').length, MISSING: 0 },
    ready: cases.every((item) => item.status === 'ADMITTED') };
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'p3d-gre-operator-admission-'));
let report = await scaffoldOperatorEvidencePackage(root, SOURCE_SHA);
assert.equal(report.schema, 'PipelineGreCaesarOperatorAdmission.v1');
assert.equal(report.packageRoot, '.');
assert.equal(report.ready, false);
assert.equal(report.counts.REJECTED_WITH_REASON, 7);

const f1Manifest = path.join(root, 'F1', 'manifest.json');
const scaffolded = await readJson(f1Manifest);
assert.deepEqual(scaffolded.operatorSession, { operatorId: '', workstationId: '', sessionId: '',
  executedAt: '', timeZone: '', noManualXmlEdits: false });
scaffolded.operatorSession.operatorId = 'preserved';
await writeJson(f1Manifest, scaffolded);
await writeSha256Manifest(path.join(root, 'F1'));
await scaffoldOperatorEvidencePackage(root, SOURCE_SHA);
assert.equal((await readJson(f1Manifest)).operatorSession.operatorId, 'preserved');

for (const caseId of PIPELINE_GRE_CAESAR_CASES) {
  await updateManifest(root, caseId, (manifest) => ({ ...manifest, operatorSession: validSession(caseId) }));
  await addScreenshot(root, caseId);
}
const admittedDependencies = { verifyEvidencePackage: async () => admittedBase() };
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, admittedDependencies);
assert.equal(report.ready, true);
assert.equal(report.counts.ADMITTED, 7);
assert.deepEqual(report.operatorSessionIdentity, { operatorId: 'operator-1', workstationId: 'ws-17',
  sessionId: 'session-20260727', timeZone: 'Asia/Muscat' });
assert.deepEqual(report, await verifyOperatorEvidencePackage(root, SOURCE_SHA, admittedDependencies));

await fs.rm(path.join(root, 'F1', 'screenshots', 'import.png'));
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, admittedDependencies);
const missingScreenshot = report.cases.find((item) => item.caseId === 'F1');
assert.equal(missingScreenshot.status, 'REJECTED_WITH_REASON');
assert.ok(missingScreenshot.diagnostics.includes('SCREENSHOT_EVIDENCE_MISSING'));
await addScreenshot(root, 'F1');

await updateManifest(root, 'F2', (manifest) => ({ ...manifest,
  operatorSession: { ...validSession('F2'), noManualXmlEdits: false } }));
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, admittedDependencies);
assert.ok(report.cases.find((item) => item.caseId === 'F2').diagnostics
  .includes('NO_MANUAL_XML_EDIT_ATTESTATION_MISSING'));
await updateManifest(root, 'F2', (manifest) => ({ ...manifest, operatorSession: validSession('F2') }));

await updateManifest(root, 'F3', (manifest) => ({ ...manifest,
  operatorSession: { ...validSession('F3'), executedAt: '27-07-2026 03:00' } }));
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, admittedDependencies);
assert.ok(report.cases.find((item) => item.caseId === 'F3').diagnostics
  .includes('OPERATOR_EXECUTED_AT_INVALID'));
await updateManifest(root, 'F3', (manifest) => ({ ...manifest, operatorSession: validSession('F3') }));

await updateManifest(root, 'F7', (manifest) => ({ ...manifest,
  operatorSession: { ...validSession('F7'), workstationId: 'ws-conflict' } }));
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, admittedDependencies);
const conflict = report.cases.find((item) => item.caseId === 'F7');
assert.equal(conflict.status, 'REJECTED_WITH_REASON');
assert.ok(conflict.diagnostics.includes('OPERATOR_SESSION_CONFLICT:workstationId'));
assert.ok(report.packageDiagnostics.includes('OPERATOR_SESSION_CONFLICT:F7:workstationId'));

const baseBlocked = { verifyEvidencePackage: async () => admittedBase({ F4: {
  status: 'REJECTED_WITH_REASON', diagnostics: ['BASE_DIAGNOSTIC'], evidenceReady: false } }) };
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, baseBlocked);
assert.ok(report.cases.find((item) => item.caseId === 'F4').diagnostics.includes('BASE_DIAGNOSTIC'));
assert.equal(report.ready, false);

const baseFailure = { verifyEvidencePackage: async () => { const error = new Error('absolute path');
  error.code = 'EVIDENCE_READ_FAILED'; throw error; } };
report = await verifyOperatorEvidencePackage(root, SOURCE_SHA, baseFailure);
assert.deepEqual(report.packageDiagnostics, ['BASE_VERIFIER_FAILED:EVIDENCE_READ_FAILED']);
assert.equal(report.counts.REJECTED_WITH_REASON, 7);
assert.equal(report.packageRoot, '.');

console.log('pipeline GRE CAESAR operator admission: PASS');
