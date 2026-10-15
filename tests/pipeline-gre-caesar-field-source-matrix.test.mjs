import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyPipelineGreCaesarFieldSourceMatrix } from '../scripts/pipeline-gre-caesar-field-source-matrix.mjs';

const SOURCE_SHA = 'd19ac20c57fdaaafcb2e9fe72467f7daf2f7c5cc';
const HASH = 'a'.repeat(64);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function xml({ angle = 90, curvature = false, thickness = 12, radius = 300 } = {}) {
  const radians = angle * Math.PI / 180;
  const dx = Math.cos(radians) * 1000, dy = Math.sin(radians) * 1000;
  const midpoint = curvature ? ` ANGLE1="${angle / 2}" NODE1="115"` : '';
  return `<?xml version="1.0"?>\n<CAESARII><PIPINGMODEL JOBNAME="FIELD-MATRIX">\n`
    + `<PIPINGELEMENT ID="E1" FROM_NODE="100" TO_NODE="110" DELTA_X="1000" DELTA_Y="0" DELTA_Z="0" WALL_THICK="12">`
    + `<BEND RADIUS="${radius}" TYPE="3" NUM_MITER="0" FITTINGTHICKNESS="${thickness}"${midpoint}/></PIPINGELEMENT>\n`
    + `<PIPINGELEMENT ID="E2" FROM_NODE="110" TO_NODE="120" DELTA_X="${dx}" DELTA_Y="${dy}" DELTA_Z="0" WALL_THICK="12"/>\n`
    + `</PIPINGMODEL></CAESARII>\n`;
}

function manifest(caseId, xmlText, { edition, codeId, codeName, angle = 90, curvature = false, thickness = 12 } = {}) {
  return { fixtureId: `fixture:${caseId}`, fixtureCaseId: caseId,
    fixturePath: `${caseId}/original-export.xml`, fixtureSha256: sha256(Buffer.from(xmlText, 'utf8')),
    sourceCommitSha: SOURCE_SHA, caesarVersion: '14.00', caesarBuild: '14.00.0.1234', xmlVersion: '14.00',
    unitFileId: 'MM-N', unitFileSha256: HASH, pipingCodeId: codeId, pipingCodeName: codeName,
    pipingCodeEdition: edition, laminateClassification: 'GRE-LAMINATE-A', elementCount: 2, bendCount: 1,
    bendRecords: [{ bendRecordId: `${caseId}:bend`, ownerElementId: 'E1', ownerFromNode: 100, ownerToNode: 110,
      radius: 300, typeAttributePresent: true, typeValue: 3, typeLexicalValue: '3',
      numMiterAttributePresent: true, numMiterValue: 0, numMiterLexicalValue: '0',
      fittingThicknessAttributePresent: true, fittingThicknessValue: thickness,
      curvatureNodes: curvature ? [{ angle: angle / 2, node: 115, role: 'USER_MIDPOINT' }] : [] }],
    continuityRecords: [{ continuityRecordId: `${caseId}:continuity`, enteringElementId: 'E1', leavingElementId: 'E2',
      bendOwnerElementId: 'E1', enteringFromNode: 100, enteringToNode: 110, leavingFromNode: 110,
      leavingToNode: 120, incomingTangencyNode: 110, outgoingTangencyNode: 110, inactiveCornerNode: 999,
      inactiveCornerSerialized: false, sharedLogicalNode: true, observedTopologyMode: 'CONSECUTIVE_SHARED_LOGICAL_NODE' }] };
}

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createPackage() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gre-field-source-matrix-'));
  const specs = {
    F1: { angle: 90, edition: 'ISO 14692-2005', codeId: '36', codeName: 'ISO 14692' },
    F2: { angle: 90, edition: 'ISO 14692-2017', codeId: '36', codeName: 'ISO 14692' },
    F3: { angle: 60, edition: 'REV-A', codeId: 'PROJECT-GRE', codeName: 'Project GRE Code' },
    F4: { angle: 60, curvature: true, edition: 'REV-A', codeId: 'PROJECT-GRE', codeName: 'Project GRE Code' },
    F5: { angle: 60, thickness: 15, edition: 'REV-A', codeId: 'PROJECT-GRE', codeName: 'Project GRE Code' },
  };
  for (const [caseId, spec] of Object.entries(specs)) {
    const directory = path.join(root, caseId); await fs.mkdir(directory, { recursive: true });
    const xmlText = xml(spec); await fs.writeFile(path.join(directory, 'original-export.xml'), xmlText, 'utf8');
    await writeJson(path.join(directory, 'manifest.json'), manifest(caseId, xmlText, spec));
  }
  return root;
}

async function mutateManifest(root, caseId, mutate) {
  const target = path.join(root, caseId, 'manifest.json');
  const value = JSON.parse(await fs.readFile(target, 'utf8'));
  await writeJson(target, mutate(value));
}

async function mutateXml(root, caseId, mutate) {
  const xmlPath = path.join(root, caseId, 'original-export.xml');
  const next = mutate(await fs.readFile(xmlPath, 'utf8'));
  await fs.writeFile(xmlPath, next, 'utf8');
  await mutateManifest(root, caseId, (value) => ({ ...value, fixtureSha256: sha256(Buffer.from(next, 'utf8')) }));
}

let root = await createPackage();
let report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.equal(report.schema, 'PipelineGreCaesarFieldSourceMatrix.v1');
assert.equal(report.packageRoot, '.');
assert.equal(report.ready, true, report.diagnostics.join(', '));
assert.deepEqual(report, await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA));
assert.ok(Math.abs(report.cases.find((item) => item.caseId === 'F3').turnAngleDeg - 60) < 1e-7);

root = await createPackage();
await mutateManifest(root, 'F2', (value) => ({ ...value, pipingCodeEdition: 'ISO 14692-2005' }));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.diagnostics.includes('ISO_EDITION_CONTROL_INVALID'));

root = await createPackage();
await mutateXml(root, 'F2', (value) => value.replace('DELTA_X="1000"', 'DELTA_X="900"'));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.diagnostics.includes('F1_F2_ELEMENT_PROFILE_MISMATCH'));

root = await createPackage();
await mutateXml(root, 'F4', (value) => value.replace(' ANGLE1="30" NODE1="115"', ''));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.equal(report.ready, false);
assert.ok(report.cases.find((item) => item.caseId === 'F4').diagnostics.some((item) => item.startsWith('CURVATURE_NODE_MISSING')));

root = await createPackage();
await mutateManifest(root, 'F4', (value) => ({ ...value, bendRecords: [{ ...value.bendRecords[0],
  curvatureNodes: [{ angle: 70, node: 115, role: 'USER_MIDPOINT' }] }] }));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.diagnostics.includes('F4_USER_MIDPOINT_INVALID') || report.cases.find((item) => item.caseId === 'F4').status === 'REJECTED_WITH_REASON');

root = await createPackage();
await mutateXml(root, 'F5', (value) => value.replace('FITTINGTHICKNESS="15"', 'FITTINGTHICKNESS="12"'));
await mutateManifest(root, 'F5', (value) => ({ ...value, bendRecords: [{ ...value.bendRecords[0], fittingThicknessValue: 12 }] }));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.diagnostics.includes('F5_FITTING_THICKNESS_CONTROL_INVALID'));

root = await createPackage();
await mutateXml(root, 'F5', (value) => value.replace('RADIUS="300"', 'RADIUS="400"'));
await mutateManifest(root, 'F5', (value) => ({ ...value, bendRecords: [{ ...value.bendRecords[0], radius: 400 }] }));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.diagnostics.includes('F3_F5_NON_TARGET_BEND_MISMATCH'));

root = await createPackage();
await mutateManifest(root, 'F3', (value) => ({ ...value, sourceCommitSha: 'b'.repeat(40) }));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.cases.find((item) => item.caseId === 'F3').diagnostics.includes('SOURCE_COMMIT_MISMATCH'));

root = await createPackage();
await mutateXml(root, 'F1', (value) => `<!DOCTYPE x [<!ENTITY y "z">]>\n${value}`);
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.cases.find((item) => item.caseId === 'F1').diagnostics.includes('FIELD_MATRIX_INPUT_INVALID:XML_DTD_PROHIBITED'));

root = await createPackage();
await mutateXml(root, 'F1', (value) => value.replace('ID="E2"', 'ID="E1"'));
report = await verifyPipelineGreCaesarFieldSourceMatrix(root, SOURCE_SHA);
assert.ok(report.cases.find((item) => item.caseId === 'F1').diagnostics.includes('FIELD_MATRIX_INPUT_INVALID:ELEMENT_ID_DUPLICATE'));

console.log('pipeline GRE CAESAR field source matrix: PASS');
