/** Prepared topology export bytes and ExportPlan shared by inspector and writer. */

import { validateExportPlan } from '../../contracts/export-plan.js';
import { buildTopologyExportPlan } from './topology-platform-adapter.js';
import { outputStem } from './topology-edit-controller-helpers.js';
import { asArray, cleanText } from './topology-validator-values.js';
import { sha256Text } from '../revision-compare/revision-hash.js';
import { topologyExportAuditOutput, topologyExportAuditStateKey } from './topology-export-audit-log.js';

export const TOPOLOGY_EXPORT_SNAPSHOT_SCHEMA = 'TopologyExportSnapshot.v1';

/** Identify every journal projection that can change exported evidence. */
export function topologyExportStateKey(draft, journal, auditRevision) {
  if (draft?.schema !== 'TopologyEditDraft.v1') throw new TypeError('Export state requires TopologyEditDraft.v1.');
  if (journal?.schema !== 'CommandJournal.v1') throw new TypeError('Export state requires CommandJournal.v1.');
  const checkpoints = asArray(journal.checkpoints).map((row) => cleanText(row.checkpointId)).join(',');
  return [draft.topologyEditDraftHash, journal.nextSequence, asArray(journal.activeCommandIds).join(','),
    asArray(journal.redoCommandIds).join(','), checkpoints, cleanText(auditRevision)].join('|');
}

function freezeOutputs(outputs) {
  return Object.freeze(outputs.map((row) => Object.freeze({ name: cleanText(row.name), mime: cleanText(row.mime), text: String(row.text) })));
}

/** Prepare exact output bytes and their immutable inspection plan once. */
export async function prepareTopologyExportSnapshot(input) {
  if (typeof input.core?.topologyArtifactOutputs !== 'function') throw new TypeError('Topology export preparation requires topologyArtifactOutputs().');
  const stem = outputStem(input.options.sourceName);
  const auditRevision = topologyExportAuditStateKey(input);
  const audit = topologyExportAuditOutput(stem, input);
  const outputs = freezeOutputs([...input.core.topologyArtifactOutputs(input.built, { stem }), audit.output]);
  const plan = await buildTopologyExportPlan({
    context: input.context, draft: input.draft, built: input.built, outputs,
    commandJournal: input.commandJournal, createdAt: input.createdAt, cryptoRef: input.cryptoRef, auditLog: audit.log,
  });
  const snapshot = Object.freeze({
    schema: TOPOLOGY_EXPORT_SNAPSHOT_SCHEMA,
    stateKey: topologyExportStateKey(input.draft, input.commandJournal, auditRevision),
    auditRevision, stem, plan, outputs,
  });
  return assertTopologyExportSnapshot(snapshot, input.draft, input.commandJournal);
}

/** Refuse stale, malformed or plan/output-divergent snapshots. */
export function assertTopologyExportSnapshot(snapshot, draft, commandJournal) {
  if (snapshot?.schema !== TOPOLOGY_EXPORT_SNAPSHOT_SCHEMA) throw new TypeError(`Export snapshot must be ${TOPOLOGY_EXPORT_SNAPSHOT_SCHEMA}.`);
  if (snapshot.stateKey !== topologyExportStateKey(draft, commandJournal, snapshot.auditRevision)) throw new Error('Export snapshot is stale for the active journal projection.');
  const errors = validateExportPlan(snapshot.plan);
  if (errors.length) throw new TypeError(`Export snapshot plan is invalid: ${errors.join('; ')}`);
  if (snapshot.outputs.length !== snapshot.plan.files.length) throw new Error('Export snapshot output count differs from its plan.');
  snapshot.outputs.forEach((output, index) => {
    const file = snapshot.plan.files[index];
    if (output.name !== file.name || output.mime !== file.mime) throw new Error(`Export snapshot output ${index + 1} differs from its planned file.`);
  });
  return snapshot;
}

/** Recompute every planned byte length/hash immediately before serialization. */
export async function verifyTopologyExportSnapshot(snapshot, draft, commandJournal, cryptoRef) {
  const checked = assertTopologyExportSnapshot(snapshot, draft, commandJournal);
  for (let index = 0; index < checked.outputs.length; index += 1) {
    const output = checked.outputs[index], file = checked.plan.files[index];
    const byteLength = new TextEncoder().encode(output.text).byteLength;
    if (byteLength !== file.byteLength) throw new Error(`Export bytes for ${file.fileId} differ from the inspected byte length.`);
    const contentHash = await sha256Text(output.text, cryptoRef);
    if (contentHash !== file.contentHash) throw new Error(`Export bytes for ${file.fileId} differ from the inspected SHA-256.`);
  }
  return checked;
}
