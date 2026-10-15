import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createCommandJournal } from '../contracts/command-journal.js';
import { PROJECT_MIGRATION_SCHEMA } from '../contracts/project-migration-contract.js';
import { getProjectAdapter, listProjectAdapters, validateProjectAdapterRegistry } from '../platform/project-adapter-registry.js';
import { SAMPLE_TABLE_1, SAMPLE_TABLE_2, SAMPLE_TABLE_3 } from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';
import { buildPipelineProjectMigration, buildPipelineProjectOutputs } from '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { createSequentialConstructionSession, runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import {
  buildSequentialProjectMigration,
  SEQUENTIAL_PROJECT_EXPORT_SCHEMA,
  sequentialProjectArtifacts,
} from '../tabs/sequential-sketcher/sequential-sketcher-project-adapter.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { buildConfirmedConstructionSupportProjection } from '../tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js';
import { SUPPORT_STEEL_DEFAULT_CONFIG } from '../tabs/support-steel-relationship-builder/support-steel-relationship-contracts.js';
import { SUPPORT_STEEL_SAMPLE_STEEL, SUPPORT_STEEL_SAMPLE_SUPPORT } from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';
import { buildSupportSteelProjectMigration, supportSteelProjectArtifacts } from '../tabs/support-steel-relationship-builder/support-steel-project-adapter.js';
import { buildTopologyProjectMigration } from '../tabs/topology-trace-validator/topology-project-migration.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { buildExportBundle } from '../workbench3d/apply/exporters.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { parseInputXmlRecords } from '../workbench3d/adapters/inputxml-adapter.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { buildCompareWorkbenchProjectMigration, compareWorkbenchProjectArtifacts } from '../workbench3d/project/compare-workbench-project-adapter.js';

const NOW = '2026-07-17T12:39:55.000Z';
const REAL_SOURCE = fileURLToPath(new URL('./fixtures/project-migrations/Sjson.json', import.meta.url));
const COMPARE_SOURCE = fileURLToPath(new URL('../docs/PLB314Inputxml.xml', import.meta.url));
const realSourceText = readFileSync(REAL_SOURCE, 'utf8');
const realBranches = JSON.parse(realSourceText);

assert.deepEqual(validateProjectAdapterRegistry(), []);
assert.deepEqual(listProjectAdapters().map((row) => row.projectId), [
  'topology-editor', 'pipeline-cad', 'sequential-sketcher',
  'support-steel-relationship-builder', 'compare-workbench',
]);
for (const adapter of listProjectAdapters()) assert.equal(getProjectAdapter(adapter.projectId), adapter);

const topologyHash = await sha256Text(realSourceText, globalThis.crypto);
const topologyJournal = createCommandJournal({
  journalId: 'journal:phase6', sessionId: `topology-session:${topologyHash.slice(0, 20)}`,
  documentId: `topology-document:${topologyHash.slice(0, 20)}`, createdAt: NOW,
});
const topologyOutput = `${JSON.stringify({ schema: 'CanonicalTopology.v1', sourceBranchCount: realBranches.length }, null, 2)}\n`;
const topology = await buildTopologyProjectMigration({
  sourceText: realSourceText, sourceName: 'Sjson.json', sourceBranches: realBranches,
  verticalAxis: 'Z', createdAt: NOW, cryptoRef: globalThis.crypto,
  draft: { baseCanonicalTopologyHash: 'real-source', topologyEditDraftHash: 'phase6', commands: [], redoCommands: [] },
  commandJournal: topologyJournal,
  built: { editLedger: { topologyEditLedgerHash: 'phase6-ledger' }, canonicalTopology: { canonicalTopologyHash: 'phase6-canonical', nodes: [], edges: [], supports: [], rigids: [] }, editValidation: { findings: [] } },
  outputs: [{ name: 'Sjson.canonical-topology.json', mime: 'application/json', text: topologyOutput }],
});
assert.equal(topology.schema, PROJECT_MIGRATION_SCHEMA);
assert.equal(topology.document.stats.branchCount, 13);
assert.equal(topology.exportPlan.gate.status, 'READY');
assert.equal(topology.exportPlan.files[0].contentHash, await sha256Text(topologyOutput, globalThis.crypto));

const branchInfo = Object.freeze({
  jobName: 'PIPELINE_PHASE6', issueNo: 'A', caesarVersion: '11.00',
  branchName: 'PL-XX', lineNo: 'PL-XX', boreMm: '168.3', wallThickness: '7.1',
  insulationThickness: '50', corrosionAllowance: '3', t1: '120', t2: '90', t3: '5',
  p1: '12', materialCode: '106', fluidDensity: '100', insulationDensity: '120', hydroPressure: '18',
});
const pipelineInput = {
  table1Text: SAMPLE_TABLE_1, table2Text: SAMPLE_TABLE_2, table3Text: SAMPLE_TABLE_3,
  branchInfo, sourceName: 'pipeline-sample.json', createdAt: NOW, cryptoRef: globalThis.crypto,
};
const pipelineNative = buildPipelineProjectOutputs(pipelineInput);
const pipeline = await buildPipelineProjectMigration(pipelineInput);
const pipelineOutputById = new Map(pipeline.outputs.map((row) => [row.fileId, row]));
assert.equal(pipeline.exportPlan.gate.status, 'BLOCKED');
assert.ok(pipeline.exportPlan.gate.blockers.includes('PIPELINE_CONFIGURATION_SECTION_PLAN_INVALID'));
assert.equal(pipelineOutputById.get('pipeline-coordinate-table').text, pipelineNative.coordinateText);
assert.equal(pipelineOutputById.has('pipeline-inputxml'), false);
assert.equal(pipelineOutputById.has('pipeline-inputxml-document-plan'), false);
assert.equal(pipelineNative.xmlText, '');
assert.equal(pipelineNative.inputXmlDocumentPlan.ready, false);

const realEvidence = buildSequentialEvidenceModel(realBranches);
const realIndexes = indexSequentialEvidence(realEvidence);
const realSession = runConstructionUntilBlocked(
  createSequentialConstructionSession(realEvidence.branches[0].branchId),
  realEvidence, realIndexes,
  { exactToleranceMm: 1, autoRepairToleranceMm: 25, candidateSearchRadiusMm: 250 },
).session;
const sequentialBlocked = await buildSequentialProjectMigration({
  sourceText: realSourceText, sourceName: 'Sjson.json', evidence: realEvidence,
  session: realSession, confirmedConstruction: null, supportProjection: null,
  createdAt: NOW, cryptoRef: globalThis.crypto,
});
assert.equal(sequentialBlocked.exportPlan.gate.status, 'BLOCKED');
assert.match(sequentialBlocked.exportPlan.gate.blockers.join(' '), /ROUTE_COMPLETE/);

const acceptedRecords = [{ type: 'BRANCH', name: '/PHASE6/B1', attributes: { NAME: '/PHASE6/B1', HPOS: { x: 0, y: 0, z: 0 } }, children: [
  { type: 'PIPE', name: 'P1', attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } },
  { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
]}];
const acceptedEvidence = buildSequentialEvidenceModel(acceptedRecords);
const acceptedIndexes = indexSequentialEvidence(acceptedEvidence);
const acceptedSession = runConstructionUntilBlocked(createSequentialConstructionSession('/PHASE6/B1'), acceptedEvidence, acceptedIndexes, {}).session;
const confirmed = createConfirmedSequentialConstruction(acceptedSession, acceptedIndexes);
const supportProjection = buildConfirmedConstructionSupportProjection(confirmed, acceptedIndexes, { projectionToleranceMm: 50, onCenterlineToleranceMm: 0.001, ambiguityToleranceMm: 1 });
const sequentialInput = {
  sourceText: JSON.stringify(acceptedRecords), sourceName: 'accepted.json', evidence: acceptedEvidence,
  session: acceptedSession, confirmedConstruction: confirmed, supportProjection,
  createdAt: NOW, cryptoRef: globalThis.crypto,
};
const sequentialReady = await buildSequentialProjectMigration(sequentialInput);
assert.equal(sequentialReady.exportPlan.gate.status, 'READY');
assert.equal(sequentialReady.document.unit, 'MM');
assert.equal(sequentialReady.document.coordinateFrame, 'PLANT');
assert.equal(sequentialReady.document.verticalAxis, 'Z');
assert.deepEqual(sequentialReady.outputs.map((row) => row.text), sequentialProjectArtifacts(sequentialInput).map((row) => row.text));
const sequentialEnvelope = JSON.parse(sequentialReady.outputs[0].text);
assert.equal(sequentialEnvelope.schema, SEQUENTIAL_PROJECT_EXPORT_SCHEMA);
assert.equal(sequentialEnvelope.stagedSchema, 'sequential-sketcher-source-array/v1');
assert.equal(sequentialEnvelope.sourceSchema, 'SequentialBranchSketch.v1');
assert.equal(sequentialEnvelope.unit, 'MM');
assert.equal(sequentialEnvelope.coordinateFrame, 'PLANT');
assert.equal(sequentialEnvelope.verticalAxis, 'Z');
assert.deepEqual(sequentialEnvelope.branches, acceptedRecords);
assert.equal(sequentialEnvelope.confirmedConstruction.schema, 'ConfirmedSequentialConstruction.v1');

const supportBundle = buildSupportSteelRelationshipBundle({
  supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT, steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
  config: SUPPORT_STEEL_DEFAULT_CONFIG,
});
const supportInput = {
  bundle: supportBundle, supportSourceText: JSON.stringify(SUPPORT_STEEL_SAMPLE_SUPPORT),
  steelSourceText: JSON.stringify(SUPPORT_STEEL_SAMPLE_STEEL), sourceName: 'support-steel-sample.json',
  createdAt: NOW, cryptoRef: globalThis.crypto,
};
const support = await buildSupportSteelProjectMigration(supportInput);
assert.equal(support.exportPlan.gate.status, 'READY');
assert.equal(support.outputs.length, 8);
assert.deepEqual(support.outputs.map((row) => row.text), supportSteelProjectArtifacts(supportBundle).map((row) => row.text));

const sourceXml = readFileSync(COMPARE_SOURCE, 'utf8');
const targetXml = sourceXml.replace('FROM_NODE="110.000000"', 'FROM_NODE="111.000000"');
const sourceParsed = parseInputXmlRecords(sourceXml);
const targetParsed = parseInputXmlRecords(targetXml);
const sourceGraph = buildCanonicalGraph('source', sourceParsed.records, { shortElementToleranceMm: 6 });
const targetGraph = buildCanonicalGraph('target', targetParsed.records, { shortElementToleranceMm: 6 });
const compareAudit = runCompare(sourceGraph, targetGraph, { shortElementToleranceMm: 6 });
const compareInput = {
  sourceXml, targetXml, sourceName: 'rev-a.xml', targetName: 'rev-b.xml',
  sourceSchema: sourceParsed.schema, targetSchema: targetParsed.schema,
  sourceGraph, targetGraph, compareAudit, transferPlan: null, rollbackLedger: null,
  outputXml: null, outputName: null, verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
  createdAt: NOW, cryptoRef: globalThis.crypto,
};
const compare = await buildCompareWorkbenchProjectMigration(compareInput);
const nativeBundle = buildExportBundle(compareInput);
assert.equal(compare.session.documents.baseline.fileName, 'rev-a.xml');
assert.equal(compare.session.documents.candidate.fileName, 'rev-b.xml');
assert.deepEqual(compare.outputs.map((row) => row.text), nativeBundle.map((row) => row.content));
assert.deepEqual(compareWorkbenchProjectArtifacts(compareInput).map((row) => row.text), nativeBundle.map((row) => row.content));

for (const relative of [
  '../contracts/project-migration-contract.js', '../platform/project-adapter-registry.js',
  '../tabs/topology-trace-validator/topology-project-migration.js',
  '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js',
  '../tabs/sequential-sketcher/sequential-sketcher-project-adapter.js',
  '../tabs/support-steel-relationship-builder/support-steel-project-adapter.js',
  '../workbench3d/project/compare-workbench-project-adapter.js',
]) {
  const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${relative} exceeds 300 lines`);
  assert.doesNotMatch(source, /export\s+default/, `${relative} must use named exports`);
}

console.log('[REAL DATA] Phase 6 project adapters preserve gates, hierarchy, and exact output bytes.');
