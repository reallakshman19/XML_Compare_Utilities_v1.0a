/** Shared evidence envelope for migrating one native project into the platform. */

import { createExportPlan } from './export-plan.js';
import {
  attachProjectDocument, createProjectDocument, createProjectSession,
} from './project-session-contracts.js';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';

export const PROJECT_MIGRATION_SCHEMA = 'ProjectMigrationEvidence.v1';

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function freezeOutput(output, index) {
  if (!output || typeof output !== 'object') throw new TypeError(`Output ${index + 1} is required.`);
  return Object.freeze({
    fileId: requiredText(output.fileId, `Output ${index + 1} fileId`),
    name: requiredText(output.name, `Output ${index + 1} name`),
    mime: requiredText(output.mime, `Output ${index + 1} mime`),
    role: requiredText(output.role, `Output ${index + 1} role`),
    sourceSchema: requiredText(output.sourceSchema, `Output ${index + 1} sourceSchema`),
    text: String(output.text),
  });
}

/** Preserve exact native output text while calculating platform file evidence. */
export async function createMigrationArtifactFiles(outputs, cryptoRef) {
  if (!Array.isArray(outputs) || !outputs.length) throw new TypeError('Migration outputs are required.');
  const frozenOutputs = Object.freeze(outputs.map(freezeOutput));
  const files = await Promise.all(frozenOutputs.map(async (output, order) => Object.freeze({
    fileId: output.fileId, name: output.name, mime: output.mime, role: output.role,
    sourceSchema: output.sourceSchema, contentHash: await sha256Text(output.text, cryptoRef),
    byteLength: new TextEncoder().encode(output.text).byteLength, order,
  })));
  return Object.freeze({ outputs: frozenOutputs, files: Object.freeze(files) });
}

function documentInput(input, sourceHash) {
  return {
    documentId: `${input.projectId}:document:${sourceHash.slice(0, 20)}`, slotId: input.slotId,
    fileName: input.sourceName, sourceHash, scopedHash: sourceHash, stagedSchema: input.sourceSchema,
    rootShape: input.rootShape, unit: input.unit, verticalAxis: input.verticalAxis,
    coordinateFrame: input.coordinateFrame, stats: input.stats, scope: input.scope,
    createdAt: input.createdAt,
  };
}

/** Create a source document with a hash of the exact native input bytes. */
export async function createMigrationDocument(input) {
  const sourceHash = await sha256Text(input.sourceText, input.cryptoRef);
  return createProjectDocument(documentInput(input, sourceHash));
}

/** Attach one or more migration documents to a new immutable session. */
export function createMigrationSession(input, documents) {
  let session = createProjectSession({ sessionId: input.sessionId, createdAt: input.createdAt });
  for (const document of documents) session = attachProjectDocument(session, document, input.createdAt);
  return session;
}

function migrationEnvelope(input, document, session, plan, outputs) {
  return Object.freeze({
    schema: PROJECT_MIGRATION_SCHEMA, projectId: input.projectId,
    nativeSourceSchema: input.sourceSchema, nativeWriterId: input.writerId,
    document, session, exportPlan: plan, outputs,
  });
}

/** Build a single-document migration without replacing its parser or writer. */
export async function buildSingleDocumentMigration(input) {
  const document = await createMigrationDocument({ ...input, slotId: 'baseline' });
  const sessionId = `${input.projectId}:session:${document.sourceHash.slice(0, 20)}`;
  const session = createMigrationSession({ ...input, sessionId }, [document]);
  const artifacts = await createMigrationArtifactFiles(input.outputs, input.cryptoRef);
  const plan = createExportPlan({
    planId: `${input.projectId}:export:${document.sourceHash.slice(0, 20)}`,
    sessionId, documentId: document.documentId, writerId: input.writerId,
    createdAt: input.createdAt, hierarchy: input.hierarchy,
    calculations: input.calculations, files: artifacts.files, gate: input.gate,
  });
  return migrationEnvelope(input, document, session, plan, artifacts.outputs);
}
