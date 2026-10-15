import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  scaffoldEvidencePackage, sha256File, sha256Tree, verifyEvidencePackage, writeSha256Manifest,
} from '../scripts/pipeline-gre-caesar-evidence-package.mjs';

const BASELINE = 'b75b0d0dcfd50b8b7afdfcd05c0fdc0f5cb7d186';
const OTHER_SHA = '1'.repeat(40);
const BUILD = '14.00.00.0000';

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function comparison(identityMapSha256) {
  return { ownershipPreserved: true, connectivityPreserved: true, nodeRolesPreserved: true,
    radiusPreserved: true, fittingThicknessPreserved: true, typePreserved: true,
    numMiterPreserved: true, curvatureNodesPreserved: true, numEltPreserved: true,
    numBendPreserved: true, unitsPreserved: true, codeContextPreserved: true,
    laminatePreserved: true, identityMapSha256 };
}

async function materializeFixture(root, caseId, options = {}) {
  const rejected = options.rejected === true, build = options.build || BUILD;
  const sourceCommitSha = options.sourceCommitSha || BASELINE, dir = path.join(root, caseId);
  await fs.writeFile(path.join(dir, 'native-job', 'job.txt'), `${caseId}:native\n`);
  await fs.writeFile(path.join(dir, 'imported-job', 'job.txt'), `${caseId}:imported\n`);
  await fs.writeFile(path.join(dir, 'original-export.xml'), `<PIPINGMODEL id="${caseId}"/>\n`);
  await fs.writeFile(path.join(dir, 'operator-log.md'), `# ${caseId}\noperator evidence\n`);
  await fs.writeFile(path.join(dir, 'unit-file.dat'), 'UNITS=ENGLISH\n');
  await writeJson(path.join(dir, 'identity-map.json'), { entries: [{ source: 'E1', target: 'E1' }] });
  if (!rejected) await fs.writeFile(path.join(dir, 're-export.xml'), `<PIPINGMODEL id="${caseId}"/>\n`);
  const operatorLogSha256 = await sha256File(path.join(dir, 'operator-log.md'));
  const importedJobSha256 = await sha256Tree(path.join(dir, 'imported-job'));
  const identityMapSha256 = await sha256File(path.join(dir, 'identity-map.json'));
  const importEvidence = { status: 'PROVEN', evidenceId: `import:${caseId}`,
    sourceReference: `${caseId}/operator-log.md`, caesarVersion: '14.00', caesarBuild: build,
    operatorLogSha256, importedJobSha256, result: rejected ? 'REJECTED' : 'ACCEPTED',
    cleanImport: !rejected, warnings: [], errors: rejected ? ['CAESAR_REJECTED_TOPOLOGY'] : [] };
  const roundTripEvidence = rejected
    ? { status: 'NOT_APPLICABLE', sourceReference: `${caseId}/operator-log.md` }
    : { status: 'PROVEN', evidenceId: `roundtrip:${caseId}`,
      sourceReference: `${caseId}/operator-log.md`, caesarVersion: '14.00', caesarBuild: build,
      operatorLogSha256, semanticEquivalent: true,
      reexportSha256: await sha256File(path.join(dir, 're-export.xml')),
      comparison: comparison(identityMapSha256) };
  const manifest = {
    fixtureId: `fixture:${caseId}`, fixtureCaseId: caseId,
    fixturePath: `${caseId}/original-export.xml`,
    fixtureSha256: await sha256File(path.join(dir, 'original-export.xml')), fixtureGitBlobSha1: '',
    sourceCommitSha, sourceClassification: 'CAESAR_OPERATOR_FIXTURE',
    caesarVersion: '14.00', caesarBuild: build, xmlVersion: '14.00',
    unitFileId: 'units:english', unitFilePath: 'unit-file.dat',
    unitFileSha256: await sha256File(path.join(dir, 'unit-file.dat')),
    identityMapPath: 'identity-map.json',
    nativeJobSha256: await sha256Tree(path.join(dir, 'native-job')), importedJobSha256,
    reexportSha256: rejected ? '' : roundTripEvidence.reexportSha256, operatorLogSha256,
    pipingCodeId: '36', pipingCodeName: 'ISO 14692', pipingCodeEdition: '2005',
    laminateClassification: 'CSM_AND_MULTI_FILAMENT', elementCount: 2, bendCount: 1,
    bendRecords: [{ bendRecordId: `bend:${caseId}`, ownerElementId: 'E1', ownerFromNode: 100,
      ownerToNode: 110, radius: 300, typeAttributePresent: true, typeValue: 3,
      typeLexicalValue: '3', numMiterAttributePresent: false, curvatureNodes: [] }],
    continuityRecords: [{ continuityRecordId: `continuity:${caseId}`,
      enteringElementId: 'E1', leavingElementId: 'E2', bendOwnerElementId: 'E1',
      enteringFromNode: 100, enteringToNode: 110, leavingFromNode: 120, leavingToNode: 130,
      incomingTangencyNode: 110, outgoingTangencyNode: 120, inactiveCornerNode: 115,
      inactiveCornerSerialized: false, sharedLogicalNode: false,
      observedTopologyMode: 'TANGENCY_SEPARATED_BRIDGE' }],
    importEvidence, roundTripEvidence, authorityLevel: 'CAESAR_IMPORT_AND_ROUND_TRIP',
    sourceReferences: [`${caseId}/operator-log.md`],
  };
  await writeJson(path.join(dir, 'manifest.json'), manifest);
  await writeJson(path.join(dir, 'import-result.json'),
    Object.fromEntries(Object.entries(importEvidence).reverse()));
  await writeJson(path.join(dir, 'warnings-errors.json'), {
    errors: importEvidence.errors, warnings: importEvidence.warnings });
  if (!rejected) await writeJson(path.join(dir, 'semantic-comparison.json'),
    Object.fromEntries(Object.entries(roundTripEvidence.comparison).reverse()));
  await writeSha256Manifest(dir);
}

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'p3d-gre-evidence-fix-'));
  await scaffoldEvidencePackage(root, BASELINE);
  return root;
}

const badRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bad-sha-'));
await assert.rejects(() => scaffoldEvidencePackage(badRoot, 'bad'));

const root = await makeRoot();
let report = await verifyEvidencePackage(root, BASELINE);
assert.equal(report.schema, 'PipelineGreCaesarEvidencePackage.v2');
assert.equal(report.packageRoot, '.');
assert.equal(report.counts.ADMITTED, 0);

const log = path.join(root, 'F1', 'operator-log.md');
await fs.writeFile(log, 'preserve me\n');
await scaffoldEvidencePackage(root, BASELINE);
assert.equal(await fs.readFile(log, 'utf8'), 'preserve me\n');

await materializeFixture(root, 'F1');
report = await verifyEvidencePackage(root, BASELINE);
assert.equal(report.cases.find((item) => item.caseId === 'F1').status, 'ADMITTED');
assert.deepEqual(report, await verifyEvidencePackage(root, BASELINE));
assert.equal(report.session.basisCaseId, 'F1');

await materializeFixture(root, 'F6', { rejected: true });
report = await verifyEvidencePackage(root, BASELINE);
assert.equal(report.cases.find((item) => item.caseId === 'F6').status, 'ADMITTED');

await materializeFixture(root, 'F2', { rejected: true });
report = await verifyEvidencePackage(root, BASELINE);
assert.ok(report.cases.find((item) => item.caseId === 'F2').diagnostics
  .includes('V2:PIPELINE_GRE_CAESAR_IMPORT_NOT_PROVEN'));

const ancestryRoot = await makeRoot();
await materializeFixture(ancestryRoot, 'F1', { sourceCommitSha: OTHER_SHA });
report = await verifyEvidencePackage(ancestryRoot, BASELINE);
assert.ok(report.cases.find((item) => item.caseId === 'F1').diagnostics.includes('SOURCE_COMMIT_MISMATCH'));

const sessionRoot = await makeRoot();
await materializeFixture(sessionRoot, 'F1');
await materializeFixture(sessionRoot, 'F2', { build: '14.00.00.9999' });
report = await verifyEvidencePackage(sessionRoot, BASELINE);
assert.ok(report.cases.find((item) => item.caseId === 'F2').diagnostics.includes('SESSION_CONFLICT:caesarBuild'));
assert.ok(report.diagnostics.includes('SESSION_CONFLICT:F2:caesarBuild'));

const bindingRoot = await makeRoot();
await materializeFixture(bindingRoot, 'F1');
await fs.appendFile(path.join(bindingRoot, 'F1', 'unit-file.dat'), 'TAMPER\n');
report = await verifyEvidencePackage(bindingRoot, BASELINE);
let f1 = report.cases.find((item) => item.caseId === 'F1');
assert.ok(f1.diagnostics.includes('ARTIFACT_HASH_MISMATCH:unitFileSha256'));
assert.ok(f1.diagnostics.includes('SHA256_MISMATCH:unit-file.dat'));

await materializeFixture(bindingRoot, 'F1');
await fs.appendFile(path.join(bindingRoot, 'F1', 'identity-map.json'), '\n');
report = await verifyEvidencePackage(bindingRoot, BASELINE);
f1 = report.cases.find((item) => item.caseId === 'F1');
assert.ok(f1.diagnostics.includes('ARTIFACT_HASH_MISMATCH:identityMapSha256'));

await materializeFixture(bindingRoot, 'F1');
const shaTarget = path.join(bindingRoot, 'F1', 'sha256-manifest.txt');
const lines = (await fs.readFile(shaTarget, 'utf8')).trimEnd().split('\n').reverse();
await fs.writeFile(shaTarget, `${lines.join('\n')}\n`);
report = await verifyEvidencePackage(bindingRoot, BASELINE);
assert.ok(report.cases.find((item) => item.caseId === 'F1').diagnostics
  .includes('SHA256_MANIFEST_NONCANONICAL'));

assert.equal(report.ready, false);
console.log('pipeline GRE CAESAR evidence package integrity fix: PASS');
