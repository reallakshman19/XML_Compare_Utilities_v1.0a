/** RC-004 decision actions over immutable audit and ledger evidence. */
import { createDecisionLedgerExport, parseDecisionLedgerJson } from './revision-decision-manifest.js';
import {
  acceptDecisionCandidate, confirmDecisionNoMatch, decisionLedgerMatchesAudit,
  deferDecision, revokeDecision,
} from './revision-decision-ledger.js';
import { candidatePreview, stepCandidatePreview } from './revision-decision-projection.js';
import {
  selectWorkspaceDifference, setWorkspaceDecisionImportError, setWorkspaceDecisionLedger,
  setWorkspaceDecisionPreview, startWorkspaceNewDecisionLedger, toggleWorkspaceDecisionFilter,
  setWorkspaceDecisionUnresolvedOnly,
} from './revision-workspace-state.js';

function selectedRow(state, differenceId = state.compare.selectedDifferenceId) {
  return state.compare.audit?.differenceRows.find((row) => row.differenceId === differenceId) ?? null;
}
function currentPreview(state) {
  const { audit } = state.compare; const { ledger, preview } = state.decision;
  return audit && decisionLedgerMatchesAudit(ledger, audit) ? candidatePreview(audit, ledger, preview.differenceId, preview.candidateIndex) : null;
}
function syncViewer(context, state) {
  const id = state.compare.selectedDifferenceId; context.viewerAdapter.selectDifference(id);
  const preview = currentPreview(state);
  if (preview?.candidate && preview.differenceId === id) context.viewerAdapter.previewPair(id, preview.targetDifferenceId);
  else context.viewerAdapter.clearPreview();
}
function commitDecision(context, state) { context.commit(state); syncViewer(context, state); return state; }
export function selectDecisionDifference(context, differenceId) {
  const state = context.readState(); const row = selectedRow(state, differenceId);
  let next = selectWorkspaceDifference(state, differenceId);
  next = setWorkspaceDecisionPreview(next, row?.matchCertainty === 'AMBIGUOUS' ? differenceId : null, 0);
  return commitDecision(context, next);
}
export function previewDecisionCandidate(context, candidateIndex) {
  const state = context.readState(); const id = state.compare.selectedDifferenceId;
  if (selectedRow(state, id)?.matchCertainty !== 'AMBIGUOUS') return state;
  return commitDecision(context, setWorkspaceDecisionPreview(state, id, candidateIndex));
}
export function stepDecisionCandidate(context, direction) {
  const state = context.readState(); const preview = stepCandidatePreview(state.compare.audit, state.decision.ledger, currentPreview(state), direction);
  if (!preview) return state;
  return commitDecision(context, setWorkspaceDecisionPreview(state, preview.differenceId, preview.candidateIndex));
}
function rationale(context) { return context.root.querySelector('[data-revc-decision-rationale]')?.value ?? ''; }
async function mutateDecision(context, operation) {
  const state = context.readState(); const id = state.compare.selectedDifferenceId;
  if (!id) throw new Error('Select one ambiguous source before recording a decision.');
  const ledger = await operation(state, id, rationale(context));
  if (ledger === state.decision.ledger) return state;
  return commitDecision(context, setWorkspaceDecisionLedger(state, ledger));
}
export function acceptSelectedCandidate(context) {
  return mutateDecision(context, (state, id, text) => {
    const preview = currentPreview(state); if (!preview?.candidate || preview.differenceId !== id) throw new Error('Select one persisted candidate before acceptance.');
    return acceptDecisionCandidate(state.decision.ledger, state.compare.audit, id, preview.candidate.targetRecordId, text, context.now(), context.cryptoRef);
  });
}
export function confirmSelectedNoMatch(context) {
  return mutateDecision(context, (state, id, text) => confirmDecisionNoMatch(state.decision.ledger, state.compare.audit, id, text, context.now(), context.cryptoRef));
}
export function deferSelectedDecision(context) {
  return mutateDecision(context, (state, id, text) => deferDecision(state.decision.ledger, state.compare.audit, id, text, context.now(), context.cryptoRef));
}
export function revokeSelectedDecision(context) {
  return mutateDecision(context, (state, id, text) => revokeDecision(state.decision.ledger, state.compare.audit, id, text, context.now(), context.cryptoRef));
}
export async function importDecisionLedger(context, file) {
  const state = context.readState(); const audit = state.compare.audit;
  if (!audit) throw new Error('Run the exact comparison audit before importing a decision ledger.');
  try {
    const text = file.text ? await file.text() : new TextDecoder().decode(await file.arrayBuffer());
    const ledger = await parseDecisionLedgerJson(text, audit, context.now(), context.cryptoRef);
    const next = setWorkspaceDecisionLedger(setWorkspaceDecisionImportError(context.readState(), null), ledger);
    commitDecision(context, next); context.options?.showToast?.('Decision ledger imported.', 'success');
  } catch (error) {
    context.commit(setWorkspaceDecisionImportError(context.readState(), error)); context.report(error);
  }
}
export function startNewDecisionLedger(context) {
  let next = startWorkspaceNewDecisionLedger(context.readState(), context.now());
  const first = next.compare.audit.differenceRows.find((row) => row.matchCertainty === 'AMBIGUOUS')?.differenceId ?? next.compare.selectedDifferenceId;
  next = selectWorkspaceDifference(next, first); next = setWorkspaceDecisionPreview(next, first, 0); return commitDecision(context, next);
}
export function downloadDecisionLedger(context) {
  const ledger = createDecisionLedgerExport(context.readState().decision.ledger);
  context.downloadArtifact(context.root, `${ledger.ledgerId}.json`, ledger);
}
export function toggleDecisionStateFilter(context, value) { return context.commit(toggleWorkspaceDecisionFilter(context.readState(), value)); }
export function setUnresolvedAmbiguityFilter(context, enabled) { return context.commit(setWorkspaceDecisionUnresolvedOnly(context.readState(), enabled)); }
export const _test = Object.freeze({ currentPreview, selectedRow, syncViewer });
