/** Topology-specific adapters into shared project, command and export contracts. */

import { createExportPlan } from '../../contracts/export-plan.js';
import { attachProjectDocument, createProjectDocument, createProjectSession } from '../../contracts/project-session-contracts.js';
import { sha256Text } from '../revision-compare/revision-hash.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

function componentCount(branches) {
  return branches.reduce((total, branch) => total + asArray(objectRecord(branch).children).length, 0);
}

/** Build the exact source document/session context used by one Edit Draft. */
export async function createTopologyPlatformContext(input) {
  const sourceHash = await sha256Text(input.sourceText, input.cryptoRef);
  const documentId = `topology-document:${sourceHash.slice(0, 20)}`;
  const branches = asArray(input.sourceBranches);
  const document = createProjectDocument({
    documentId, slotId: 'baseline', fileName: input.sourceName, sourceHash, scopedHash: sourceHash,
    stagedSchema: 'TopologyEditSource.v1', rootShape: 'branches', unit: 'MM',
    verticalAxis: input.verticalAxis, coordinateFrame: 'UNKNOWN',
    stats: { branchCount: branches.length, componentCount: componentCount(branches), scanned: branches.length, matched: branches.length, filtered: 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: input.createdAt,
  });
  const empty = createProjectSession({ sessionId: `topology-session:${sourceHash.slice(0, 20)}`, createdAt: input.createdAt });
  const session = attachProjectDocument(empty, document, input.createdAt);
  return Object.freeze({ session, document });
}

function artifactSchema(output) {
  if (/json/i.test(cleanText(output.mime))) {
    const parsed = JSON.parse(String(output.text));
    return cleanText(parsed.schema) || 'UNDECLARED_JSON';
  }
  if (/xml/i.test(cleanText(output.mime)) || /\.xml$/i.test(cleanText(output.name))) return 'InputXML.CII2019';
  return 'UNDECLARED_TEXT';
}

function artifactRole(schema) {
  if (/TopologyExportLog/i.test(schema)) return 'TOPOLOGY_EXPORT_LOG';
  if (/CanonicalTopology/i.test(schema)) return 'CANONICAL_TOPOLOGY';
  if (/Ledger/i.test(schema)) return 'TRACE_LEDGER';
  if (/InputXML/i.test(schema)) return 'INPUTXML';
  return 'AUXILIARY';
}

function topologyCounts(built, commandJournal, files, auditLog) {
  const canonical = objectRecord(objectRecord(built).canonicalTopology);
  const supports = asArray(canonical.supports);
  const safeAuditLog = objectRecord(auditLog);
  const auditSummary = objectRecord(safeAuditLog.summary), findingStatuses = objectRecord(auditSummary.findingStatuses);
  const operationStatuses = objectRecord(auditSummary.operationStatuses);
  return Object.freeze({
    activeCommands: asArray(commandJournal.activeCommandIds).length, redoCommands: asArray(commandJournal.redoCommandIds).length,
    checkpoints: asArray(commandJournal.checkpoints).length, nodes: asArray(canonical.nodes).length,
    elements: asArray(canonical.edges).length, supports: supports.length,
    restraints: supports.reduce((sum, row) => sum + asArray(objectRecord(row).restraints).length, 0),
    rigidBodies: asArray(canonical.rigids).length, artifacts: files.length,
    outputBytes: files.reduce((sum, file) => sum + file.byteLength, 0),
    documentedFindings: Number(auditSummary.findings ?? 0),
    userConfirmationPending: Number(findingStatuses.USER_CONFIRMATION_PENDING ?? 0),
    knownIssues: Number(findingStatuses.KNOWN_ISSUE ?? 0) + Number(findingStatuses.USER_SKIPPED ?? 0)
      + Number(findingStatuses.UNKNOWN_FALLBACK ?? 0) + Number(auditSummary.validationWarnings ?? 0),
    automaticFixesApplied: Number(operationStatuses.AUTO_FIX_APPLIED ?? 0),
  });
}

function exportHierarchy(input, files) {
  return Object.freeze({
    project: { sessionId: input.context.session.sessionId, documentId: input.context.document.documentId, documentSlot: 'baseline' },
    editState: { journalId: input.commandJournal.journalId, activeCommandIds: input.commandJournal.activeCommandIds,
      redoCommandIds: input.commandJournal.redoCommandIds, checkpointIds: input.commandJournal.checkpoints.map((row) => row.checkpointId) },
    bundle: { schema: 'TopologyEditExportBundle.v1', writerId: 'topologyArtifactOutputs',
      artifacts: files.map((file) => ({ fileId: file.fileId, role: file.role, sourceSchema: file.sourceSchema })) },
  });
}

async function plannedFile(output, index, cryptoRef) {
  const text = String(output.text), schema = artifactSchema(output);
  return Object.freeze({
    fileId: `artifact-${String(index + 1).padStart(3, '0')}`, name: cleanText(output.name),
    mime: cleanText(output.mime), role: artifactRole(schema), sourceSchema: schema,
    contentHash: await sha256Text(text, cryptoRef), byteLength: new TextEncoder().encode(text).byteLength, order: index,
  });
}

/** Build the export authority from the exact core outputs before download. */
export async function buildTopologyExportPlan(input) {
  const files = await Promise.all(input.outputs.map((output, index) => plannedFile(output, index, input.cryptoRef)));
  const commandJournalHash = await sha256Text(JSON.stringify(input.commandJournal), input.cryptoRef);
  const outputManifestHash = await sha256Text(JSON.stringify(files.map((file) => file.contentHash)), input.cryptoRef);
  return createExportPlan({
    planId: `topology-export:${cleanText(input.draft.topologyEditDraftHash)}:${commandJournalHash.slice(0, 8)}:${outputManifestHash.slice(0, 8)}`,
    sessionId: input.context.session.sessionId, documentId: input.context.document.documentId,
    writerId: 'topologyArtifactOutputs', createdAt: input.createdAt,
    hierarchy: exportHierarchy(input, files),
    calculations: {
      hashes: { baseCanonicalTopologyHash: input.draft.baseCanonicalTopologyHash,
        topologyEditDraftHash: input.draft.topologyEditDraftHash,
        topologyEditLedgerHash: input.built.editLedger.topologyEditLedgerHash,
        editedCanonicalTopologyHash: input.built.canonicalTopology.canonicalTopologyHash,
        commandJournalHash, outputManifestHash },
      counts: topologyCounts(input.built, input.commandJournal, files, input.auditLog),
      exportPolicy: { status: 'ALWAYS_ALLOWED', documentationSchema: cleanText(objectRecord(input.auditLog).schema) },
    },
    files, gate: { status: 'READY', blockers: [] },
  });
}
