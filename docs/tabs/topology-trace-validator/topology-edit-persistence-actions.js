/** Complete draft load/save and topology bundle construction actions. */

import { verifyTopologyExportSnapshot } from './topology-export-snapshot.js';
import { parseTopologyEditSessionDraft, TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA } from './topology-edit-session-draft.js';
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import { objectRecord } from './topology-validator-values.js';

/** Checkpoint and download the complete v2 session draft. */
export function saveTopologySessionDraft(input) {
  input.service.checkpoint(input.uiState, input.savedAt);
  const snapshot = input.service.evidence().lastSnapshot;
  downloadText(input.documentRef, `${outputStem(input.sourceName)}.topology-edit-session.v2.json`, `${JSON.stringify(snapshot, null, 2)}\n`, 'application/json;charset=utf-8');
  return snapshot;
}

/** Load complete v2 or explicitly migrate legacy TopologyEditDraft.v1. */
export async function loadTopologySessionDraftFile(file, service, uiState, updatedAt) {
  if (!file) throw new TypeError('A topology edit draft file is required.');
  const parsed = JSON.parse(await file.text());
  if (parsed?.schema === TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA) {
    return service.load(parseTopologyEditSessionDraft(JSON.stringify(parsed)), updatedAt);
  }
  if (parsed?.schema === 'TopologyEditDraft.v1') {
    const state = service.importLegacy(parsed, { kind: 'LEGACY_IMPORT', actorId: 'TOPOLOGY_DRAFT_IMPORT', issuedAt: null }, uiState, updatedAt);
    return Object.freeze({ state, uiState });
  }
  throw new TypeError(`${file.name} is not ${TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA} or TopologyEditDraft.v1.`);
}

/** Package the exact prepared inspector snapshot; no second writer pass is allowed. */
export async function buildTopologyEditBundle(input) {
  const snapshot = await verifyTopologyExportSnapshot(input.snapshot, input.draft, input.commandJournal, input.cryptoRef);
  const plan = snapshot.plan, outputs = snapshot.outputs;
  const hashes = objectRecord(plan.calculations.hashes);
  const bundle = Object.freeze({
    schema: 'TopologyEditExportBundle.v1', exportPlan: plan,
    baseCanonicalTopologyHash: hashes.baseCanonicalTopologyHash,
    topologyEditDraftHash: hashes.topologyEditDraftHash,
    topologyEditLedgerHash: hashes.topologyEditLedgerHash,
    editedCanonicalTopologyHash: hashes.editedCanonicalTopologyHash,
    commandJournal: input.commandJournal,
    files: outputs.map((row) => ({ name: row.name, mime: row.mime, text: row.text })),
  });
  return Object.freeze({ stem: snapshot.stem, outputs, plan, bundle });
}
