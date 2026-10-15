/** Pipeline CAD adapter using the explicit P3D-CORE-050 authority path. */
import { buildSingleDocumentMigration } from '../../contracts/project-migration-contract.js';
import { buildCombinedCoordinateTable, parseTable1, table1ToTabText,
  groupPointsIntoSheets } from './pipeline-3d-model-geometry.js';
import { buildAuthoritativePipelineOutputs,
  buildPipelineNativeOutputBundle } from './pipeline-3d-model-profile-propagation.js?v=20260724-p3d-core-050-1';
import { buildPipelineApprovedCatalogProductionSourceEvidence } from './pipeline-3d-model-approved-catalog-production-input.js';

export const PIPELINE_CAD_PROJECT_ID = 'pipeline-cad';
export const PIPELINE_CAD_SOURCE_SCHEMA = 'Pipeline3DModelTables.v1';
export const PIPELINE_PROFILE_SOURCE_SCHEMA = 'Pipeline3DModelProfileRaw.v1';
function legacyOutput(input) {
  const table1Points = parseTable1(input.table1Text), sheets = groupPointsIntoSheets(table1Points);
  const combined = buildCombinedCoordinateTable({ table1Text: input.table1Text,
    table2Text: input.table2Text, table3Text: input.table3Text });
  return buildPipelineNativeOutputBundle(input, {
    table1Points, sheets, combined, warnings: [],
  }, { table2Text: input.table2Text, table3Text: input.table3Text,
    table2XText: '', table3XText: '' });
}
export function buildPipelineProjectOutputs(input = {}) {
  return input.profileRaw ? buildAuthoritativePipelineOutputs(input) : legacyOutput(input);
}
function evidenceArtifact(fileId, name, sourceSchema, text, mime = 'application/json') {
  return Object.freeze({ fileId, name, mime, role: 'ENGINEERING_EVIDENCE', sourceSchema, text });
}
export function pipelineProjectArtifacts(output) {
  const base = [
    Object.freeze({ fileId: 'pipeline-table-1', name: 'pipeline-table-1.tsv',
      mime: 'text/tab-separated-values', role: 'SOURCE_TABLE', sourceSchema: 'PipelineTable1.v1',
      text: output.table1OutputText || table1ToTabText(output.table1Points || []) }),
    Object.freeze({ fileId: 'pipeline-coordinate-table', name: 'pipeline-coordinate-tab.tsv',
      mime: 'text/tab-separated-values', role: 'COORDINATE_TABLE',
      sourceSchema: 'PipelineCoordinateTable.v1', text: output.coordinateText }),
    evidenceArtifact('pipeline-export-context', 'pipeline-export-context.json',
      'PipelineUtilityExportContext.v1', output.exportContextText),
    evidenceArtifact('pipeline-identity-ledger', 'pipeline-identity-ledger.tsv',
      'PipelineIdentityContext.v1', output.identityText, 'text/tab-separated-values'),
  ];
  const seen = new Set(base.map((item) => item.name));
  for (const item of output.artifacts || []) if (!seen.has(item.name)) {
    seen.add(item.name); base.push(item);
  }
  if (output.elasticBendText && !seen.has('pipeline-elastic-bends.tsv')) base.push(
    evidenceArtifact('pipeline-bend-ledger', 'pipeline-elastic-bends.tsv',
      'PipelineBendResolution.v3', output.elasticBendText, 'text/tab-separated-values'));
  return Object.freeze(base);
}
function pipelineSourceText(input, output) {
  return JSON.stringify({ table1Text: input.table1Text, table2Text: input.table2Text,
    table3Text: input.table3Text, profileRaw: input.profileRaw || null,
    propertySections: input.propertySections || [],
    approvedCatalogProductionInputs: buildPipelineApprovedCatalogProductionSourceEvidence(input),
    configuration: output.configurationPlan,
    identity: output.identity, exportContext: output.exportContext,
    orchestration: output.orchestration });
}
function blockerCodes(value) {
  return Array.isArray(value) ? value.map((code) => String(code || '').trim()).filter(Boolean) : [];
}
export function resolvePipelineProjectMigrationBlockers(output = {}) {
  const blockers = [...new Set([
    ...blockerCodes(output.orchestration?.blockerCodes),
    ...blockerCodes(output.exportQualification?.blockerCodes),
    ...blockerCodes(output.inputXmlDocumentPlan?.blockerCodes),
  ])];
  if (output.exportQualification
    && output.exportQualification.inputXmlAllowed !== true && blockers.length === 0) {
    blockers.push('PIPELINE_PROJECT_MIGRATION_INPUTXML_NOT_ALLOWED');
  }
  return Object.freeze(blockers);
}
export async function buildPipelineProjectMigration(input) {
  const output = buildPipelineProjectOutputs(input), plan = output.inputXmlDocumentPlan;
  const blockers = resolvePipelineProjectMigrationBlockers(output);
  const bendDiagnostics = output.elasticBends?.diagnostics || {};
  return buildSingleDocumentMigration({
    projectId: PIPELINE_CAD_PROJECT_ID, sourceName: input.sourceName,
    sourceText: pipelineSourceText(input, output),
    sourceSchema: input.profileRaw ? PIPELINE_PROFILE_SOURCE_SCHEMA : PIPELINE_CAD_SOURCE_SCHEMA,
    rootShape: input.profileRaw ? 'table1+table2a+table3a+table3b+table3c'
      : 'table1+table2+table3', unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: output.identity.branchName ? 1 : 0,
      componentCount: plan.counts?.numElt || 0, scanned: output.table1Points.length,
      matched: output.coordinateRows.length, filtered: bendDiagnostics.excludedMarkerCount || 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: input.createdAt,
    cryptoRef: input.cryptoRef, writerId: 'buildInputXmlPipingModelXml',
    outputs: pipelineProjectArtifacts(output), hierarchy: {
      branch: output.identity.branchName, lineNo: output.identity.lineNo,
      jobName: plan.metadata?.jobName || '', pipelineMode: output.exportContext.profile.resolvedMode,
      inputXmlDocumentSchema: plan.schema, configurationSchema: output.configurationPlan.schema,
      orchestrationSchema: output.orchestration.schema,
      approvedCatalogRegistryReference: output.diagnostics.approvedCatalogRegistryReference,
      approvedCatalogBindingCount: output.diagnostics.approvedCatalogBindingCount,
      tables: input.profileRaw ? ['table1', 'table2a', 'table3a', 'table3b', 'table3c']
        : ['table1', 'table2', 'table3'], coordinateRowCount: output.coordinateRows.length,
      inputXmlCoordinateRowCount: output.inputXmlCoordinateRows.length },
    calculations: { pointCount: output.table1Points.length,
      coordinateRowCount: output.coordinateRows.length,
      namedNodeCount: output.coordinateRows.filter((row) => row.nodeName).length,
      pipingElementCount: plan.counts?.numElt || 0,
      inputXmlBendCount: plan.counts?.numBend || 0,
      configurationBlockerCount: output.configurationPlan.blockerCodes.length,
      orchestrationBlockerCount: output.orchestration?.blockerCodes?.length || 0,
      migrationBlockerCount: blockers.length,
      elasticBendCandidateCount: bendDiagnostics.candidateCount || 0,
      elasticBendEmittedCount: bendDiagnostics.emittedCount || 0,
      inputXmlDocumentBlockerCount: plan.blockerCodes?.length || 0,
      approvedCatalogAdoptionActive: output.diagnostics.approvedCatalogAdoptionActive,
      approvedCatalogAdoptionReady: output.diagnostics.approvedCatalogAdoptionReady,
      approvedCatalogBindingCount: output.diagnostics.approvedCatalogBindingCount,
      exportInputXmlAllowed: output.exportQualification.inputXmlAllowed },
    gate: { status: blockers.length ? 'BLOCKED' : 'READY', blockers },
  });
}
export const pipelineCadProjectAdapter = Object.freeze({
  projectId: PIPELINE_CAD_PROJECT_ID, sourceSchema: PIPELINE_CAD_SOURCE_SCHEMA,
  writerId: 'buildInputXmlPipingModelXml', buildMigration: buildPipelineProjectMigration,
});
