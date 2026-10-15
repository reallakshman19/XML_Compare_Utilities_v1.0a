/** Complete persistent TopologyEditSessionDraft.v2 authority. */

import { immutableJson, isIsoTimestamp } from '../../contracts/contract-values.js';
import { validateCommandJournal } from '../../contracts/command-journal.js';
import { validateProjectDocument, validateProjectSession } from '../../contracts/project-session-contracts.js';

export const TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA = 'TopologyEditSessionDraft.v2';

/** Validate complete project/journal/base/UI identity without replaying. */
export function validateTopologyEditSessionDraft(draft) {
  const errors = [];
  if (draft?.schema !== TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA) errors.push(`schema must be ${TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA}`);
  if (!isIsoTimestamp(draft?.savedAt)) errors.push('savedAt must be an exact ISO timestamp');
  errors.push(...validateProjectSession(draft?.projectSession).map((error) => `projectSession: ${error}`));
  errors.push(...validateProjectDocument(draft?.projectDocument).map((error) => `projectDocument: ${error}`));
  errors.push(...validateCommandJournal(draft?.commandJournal).map((error) => `commandJournal: ${error}`));
  if (draft?.baseDraft?.schema !== 'TopologyEditDraft.v1') errors.push('baseDraft must be TopologyEditDraft.v1');
  if (draft?.baseDraft?.commands?.length || draft?.baseDraft?.redoCommands?.length) errors.push('baseDraft must not contain applied or redo commands');
  const documentId = draft?.projectDocument?.documentId;
  if (draft?.projectSession?.documents?.baseline?.documentId !== documentId) errors.push('projectSession baseline document mismatch');
  if (draft?.commandJournal?.documentId !== documentId) errors.push('commandJournal document mismatch');
  if (!draft?.uiState || typeof draft.uiState !== 'object') errors.push('uiState is required');
  return Object.freeze(errors);
}

/** Create an immutable complete draft; derived geometry/attributes/remarks are replayed. */
export function createTopologyEditSessionDraft(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Topology edit session draft input is required.');
  const draft = immutableJson({
    schema: TOPOLOGY_EDIT_SESSION_DRAFT_SCHEMA, savedAt: input.savedAt,
    projectSession: input.context.session, projectDocument: input.context.document,
    baseDraft: input.baseDraft, commandJournal: input.commandJournal, uiState: input.uiState,
  }, 'Topology edit session draft');
  const errors = validateTopologyEditSessionDraft(draft);
  if (errors.length) throw new TypeError(`Invalid TopologyEditSessionDraft.v2: ${errors.join('; ')}`);
  return draft;
}

/** Serialize the complete draft for download or crash recovery. */
export function serializeTopologyEditSessionDraft(draft) {
  const errors = validateTopologyEditSessionDraft(draft);
  if (errors.length) throw new TypeError(`Cannot serialize TopologyEditSessionDraft.v2: ${errors.join('; ')}`);
  return `${JSON.stringify(draft, null, 2)}\n`;
}

/** Parse, deeply freeze and validate one complete draft. */
export function parseTopologyEditSessionDraft(text) {
  const draft = immutableJson(JSON.parse(String(text)), 'Persisted topology edit session draft');
  const errors = validateTopologyEditSessionDraft(draft);
  if (errors.length) throw new TypeError(`Invalid persisted TopologyEditSessionDraft.v2: ${errors.join('; ')}`);
  return draft;
}

/** Refuse replay when the loaded source differs from the persisted basis. */
export function assertTopologyDraftBasis(draft, context) {
  const expected = context.document.sourceHash, actual = draft.projectDocument.sourceHash;
  if (actual !== expected) throw new Error(`Draft source hash ${actual} does not match loaded source ${expected}.`);
  if (draft.projectDocument.documentId !== context.document.documentId) throw new Error('Draft document identity does not match the loaded source.');
}
