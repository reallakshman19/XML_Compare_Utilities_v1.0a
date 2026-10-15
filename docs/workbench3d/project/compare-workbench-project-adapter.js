/** Compare Workbench adapter preserving dual revisions and native bundle bytes. */

import { createExportPlan } from '../../contracts/export-plan.js';
import {
  PROJECT_MIGRATION_SCHEMA, createMigrationArtifactFiles,
  createMigrationDocument, createMigrationSession,
} from '../../contracts/project-migration-contract.js';
import { sha256Text } from '../../tabs/revision-compare/revision-hash.js';
import { buildExportBundle } from '../apply/exporters.js';

export const COMPARE_WORKBENCH_PROJECT_ID = 'compare-workbench';

function artifactRole(filename) {
  if (/compare-audit/i.test(filename)) return 'COMPARE_AUDIT';
  if (/transfer-plan|transfer-preview/i.test(filename)) return 'TRANSFER_PLAN';
  if (/rollback/i.test(filename)) return 'ROLLBACK_LEDGER';
  if (/\.xml$/i.test(filename)) return 'TRANSFERRED_INPUTXML';
  return 'COMPARE_REPORT';
}

/** Delegate to the established bundle writer and normalize only metadata names. */
export function compareWorkbenchProjectArtifacts(input) {
  return Object.freeze(buildExportBundle(input).map((file, index) => Object.freeze({
    fileId: `compare-artifact-${String(index + 1).padStart(3, '0')}`,
    name: file.filename, mime: file.type, role: artifactRole(file.filename),
    sourceSchema: artifactRole(file.filename), text: file.content,
  })));
}

function documentInput(input, slotId, name, text, schema, stats) {
  return {
    projectId: COMPARE_WORKBENCH_PROJECT_ID, slotId, sourceName: name,
    sourceText: text, sourceSchema: schema, rootShape: 'PIPINGMODEL',
    unit: 'MM', verticalAxis: input.verticalAxis, coordinateFrame: input.coordinateFrame,
    stats, scope: { wildcard: '', selectedIds: [] }, createdAt: input.createdAt,
    cryptoRef: input.cryptoRef,
  };
}

function graphStats(graph) {
  return {
    branchCount: graph?.paths?.length || 0, componentCount: graph?.objects?.length || 0,
    scanned: graph?.objects?.length || 0, matched: graph?.objects?.length || 0,
    filtered: graph?.consumedRows?.length || 0,
  };
}

function compareCalculations(input) {
  return {
    sourceObjects: input.sourceGraph?.objects?.length || 0,
    targetObjects: input.targetGraph?.objects?.length || 0,
    diffRows: input.compareAudit?.objectDiff?.rows?.length || 0,
    conflicts: input.compareAudit?.conflictLedger?.rows?.length || 0,
    transferRows: input.transferPlan?.rows?.length || 0,
    approvedTransfers: input.transferPlan?.rows?.filter((row) => row.approval === 'APPROVED').length || 0,
  };
}

/** Build a two-document session and one exact native compare/export plan. */
export async function buildCompareWorkbenchProjectMigration(input) {
  const baseline = await createMigrationDocument(documentInput(input, 'baseline', input.sourceName, input.sourceXml, input.sourceSchema, graphStats(input.sourceGraph)));
  const candidate = await createMigrationDocument(documentInput(input, 'candidate', input.targetName, input.targetXml, input.targetSchema, graphStats(input.targetGraph)));
  const sessionHash = await sha256Text(`${baseline.sourceHash}:${candidate.sourceHash}`, input.cryptoRef);
  const sessionId = `${COMPARE_WORKBENCH_PROJECT_ID}:session:${sessionHash.slice(0, 20)}`;
  const session = createMigrationSession({ sessionId, createdAt: input.createdAt }, [baseline, candidate]);
  const artifacts = await createMigrationArtifactFiles(compareWorkbenchProjectArtifacts(input), input.cryptoRef);
  const calculations = compareCalculations(input);
  const exportPlan = createExportPlan({
    planId: `${COMPARE_WORKBENCH_PROJECT_ID}:export:${sessionHash.slice(0, 20)}`,
    sessionId, documentId: candidate.documentId, writerId: 'buildExportBundle', createdAt: input.createdAt,
    hierarchy: { baselineDocumentId: baseline.documentId, candidateDocumentId: candidate.documentId, auditSchema: input.compareAudit?.contract || 'UNAVAILABLE', transferSchema: input.transferPlan?.contract || 'UNAVAILABLE' },
    calculations, files: artifacts.files, gate: { status: 'READY', blockers: [] },
  });
  return Object.freeze({
    schema: PROJECT_MIGRATION_SCHEMA, projectId: COMPARE_WORKBENCH_PROJECT_ID,
    nativeSourceSchema: `${input.sourceSchema}+${input.targetSchema}`,
    nativeWriterId: 'buildExportBundle', document: candidate, documents: Object.freeze({ baseline, candidate }),
    session, exportPlan, outputs: artifacts.outputs,
  });
}

export const compareWorkbenchProjectAdapter = Object.freeze({
  projectId: COMPARE_WORKBENCH_PROJECT_ID, sourceSchema: 'CanonicalObjectGraph.v1 pair',
  writerId: 'buildExportBundle', buildMigration: buildCompareWorkbenchProjectMigration,
});
