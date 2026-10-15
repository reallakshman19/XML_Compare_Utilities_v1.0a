import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyPipelineGreCaesarTopologySourcePair } from
  '../scripts/pipeline-gre-caesar-topology-source-pair.mjs';

const SOURCE_SHA = '21a42436f25e1eae85e8b3da99246a0ac1b87289';
const session = { caesarVersion: '14.00', caesarBuild: '14.00.00.0000', xmlVersion: '14.00',
  unitFileId: 'units:metric', unitFileSha256: 'a'.repeat(64), pipingCodeId: '36',
  pipingCodeName: 'ISO 14692', pipingCodeEdition: '2017', laminateClassification: 'GRE' };

function bendRecord(ownerToNode) {
  return { bendRecordId: 'bend:1', ownerElementId: 'E1', ownerFromNode: 100,
    ownerToNode, radius: 300, typeAttributePresent: true, typeValue: 3,
    typeLexicalValue: '3', numMiterAttributePresent: true, numMiterValue: -1.0101,
    numMiterLexicalValue: '-1.0101', fittingThicknessAttributePresent: true,
    fittingThicknessValue: 12, fittingThicknessLexicalValue: '12', curvatureNodes: [] };
}

function continuity(caseId, ownerToNode, leavingFromNode) {
  const f6 = caseId === 'F6';
  return { continuityRecordId: `continuity:${caseId}`, enteringElementId: 'E1',
    leavingElementId: 'E2', bendOwnerElementId: 'E1', enteringFromNode: 100,
    enteringToNode: ownerToNode, leavingFromNode, leavingToNode: 130,
    incomingTangencyNode: ownerToNode, outgoingTangencyNode: leavingFromNode,
    inactiveCornerNode: 115, inactiveCornerSerialized: false,
    sharedLogicalNode: !f6, observedTopologyMode: f6
      ? 'TANGENCY_SEPARATED_BRIDGE' : 'CONSECUTIVE_SHARED_LOGICAL_NODE' };
}

function manifest(caseId, ownerToNode, leavingFromNode, overrides = {}) {
  return { fixtureId: `fixture:${caseId}`, fixtureCaseId: caseId, sourceCommitSha: SOURCE_SHA,
    ...session, bendRecords: [bendRecord(ownerToNode)],
    continuityRecords: [continuity(caseId, ownerToNode, leavingFromNode)], ...overrides };
}

function xml(ownerToNode, leavingFromNode, { bend = '', extra = '', duplicate = false } = {}) {
  const bendAttrs = bend || 'RADIUS="300" TYPE="3" NUM_MITER="-1.0101" FITTINGTHICKNESS="12"';
  const duplicateElement = duplicate
    ? '<PIPINGELEMENT ID="E1" FROM_NODE="140" TO_NODE="150"/>' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CAESARII VERSION="14.00">\n<PIPINGMODEL JOBNAME="PAIR">\n` +
    `<PIPINGELEMENT ID="E1" FROM_NODE="100" TO_NODE="${ownerToNode}"><BEND ${bendAttrs}/></PIPINGELEMENT>\n` +
    `<PIPINGELEMENT ID="E2" FROM_NODE="${leavingFromNode}" TO_NODE="130"/>\n${extra}${duplicateElement}\n` +
    '</PIPINGMODEL>\n</CAESARII>\n';
}

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeCase(root, caseId, ownerToNode, leavingFromNode, options = {}) {
  const directory = path.join(root, caseId);
  await fs.mkdir(directory, { recursive: true });
  await writeJson(path.join(directory, 'manifest.json'),
    manifest(caseId, ownerToNode, leavingFromNode, options.manifestOverrides));
  await fs.writeFile(path.join(directory, 'original-export.xml'),
    xml(ownerToNode, leavingFromNode, options.xmlOptions), 'utf8');
}

async function validRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'p3d-gre-source-pair-'));
  await writeCase(root, 'F6', 110, 120);
  await writeCase(root, 'F7', 110, 110);
  return root;
}

function pairCode(report, code) {
  return report.diagnostics.includes(code);
}

function caseCode(report, caseId, code) {
  return report.cases.find((item) => item.caseId === caseId).diagnostics.includes(code);
}

let root = await validRoot();
let report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(report.schema, 'PipelineGreCaesarTopologySourcePair.v1');
assert.equal(report.packageRoot, '.');
assert.equal(report.ready, true, JSON.stringify(report));
assert.deepEqual(report, await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA));
assert.equal(report.cases.every((item) => item.status === 'ADMITTED'), true);

root = await validRoot();
await fs.writeFile(path.join(root, 'F7', 'original-export.xml'),
  xml(110, 110, { bend: 'RADIUS="300" TYPE="4" NUM_MITER="-1.0101" FITTINGTHICKNESS="12"' }), 'utf8');
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(report.ready, false);
assert.equal(pairCode(report, 'BEND_FIELD_PROFILE_MISMATCH'), true);
assert.equal(caseCode(report, 'F7', 'BEND_ATTRIBUTE_VALUE_MISMATCH:TYPE'), true);

root = await validRoot();
await writeCase(root, 'F6', 110, 110);
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(caseCode(report, 'F6', 'F6_TANGENCY_RELATION_INVALID'), true);

root = await validRoot();
await fs.writeFile(path.join(root, 'F6', 'original-export.xml'),
  xml(110, 120, { extra: '<PIPINGELEMENT ID="E3" FROM_NODE="110" TO_NODE="120"/>\n' }), 'utf8');
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(caseCode(report, 'F6', 'F6_BRIDGE_ELEMENT_SERIALIZED'), true);

root = await validRoot();
await fs.writeFile(path.join(root, 'F6', 'original-export.xml'),
  xml(110, 120, { extra: '<PIPINGELEMENT ID="E3" FROM_NODE="115" TO_NODE="140"/>\n' }), 'utf8');
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(caseCode(report, 'F6', 'INACTIVE_CORNER_SERIALIZED'), true);

root = await validRoot();
const f6Manifest = manifest('F6', 110, 120);
f6Manifest.bendRecords[0].typeLexicalValue = '03';
await writeJson(path.join(root, 'F6', 'manifest.json'), f6Manifest);
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(caseCode(report, 'F6', 'BEND_ATTRIBUTE_LEXICAL_MISMATCH:TYPE'), true);

root = await validRoot();
await fs.writeFile(path.join(root, 'F7', 'original-export.xml'), xml(110, 110, { duplicate: true }), 'utf8');
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(report.cases.find((item) => item.caseId === 'F7').status, 'REJECTED_WITH_REASON');
assert.equal(report.cases.find((item) => item.caseId === 'F7').diagnostics
  .some((item) => item.includes('ELEMENT_ID_DUPLICATE')), true);

root = await validRoot();
await writeCase(root, 'F7', 110, 110, { manifestOverrides: { sourceCommitSha: 'b'.repeat(40) } });
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(caseCode(report, 'F7', 'SOURCE_COMMIT_MISMATCH'), true);

root = await validRoot();
await writeCase(root, 'F7', 110, 110, { manifestOverrides: {
  continuityRecords: [{ ...continuity('F7', 110, 110), observedTopologyMode: 'CAESAR_FAR_POINT_SHARED_NODE' }],
} });
report = await verifyPipelineGreCaesarTopologySourcePair(root, SOURCE_SHA);
assert.equal(caseCode(report, 'F7', 'F7_TOPOLOGY_MODE_INVALID'), true);

console.log('pipeline GRE CAESAR topology source pair: PASS');
