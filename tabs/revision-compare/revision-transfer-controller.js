/** Workspace-owned transfer review orchestration, indexed candidates and retained downloads. */
import { deepFreeze } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { createRevisionCompareTransferSelection } from './revision-transfer-contracts.js';
import {
  createRevisionCompareTransferCandidateCache,
} from './revision-transfer-candidate-index.js';
import {
  deriveRevisionCompareTransferCandidates, deriveRevisionCompareTransferCandidatesScanning,
} from './revision-transfer-candidates.js';
import {
  applyRevisionCompareTransferDraftAction, createRevisionCompareTransferReviewState,
  reconcileRevisionCompareTransferDraft, replaceRevisionCompareTransferDraft,
  revisionCompareTransferDraftCounts, updateRevisionCompareTransferPresentation,
} from './revision-transfer-review-state.js';
import { queryRevisionCompareTransferCandidates } from './revision-transfer-query.js';

const ARTIFACT_INDEX = Object.freeze({ patched: 0, audit: 1, proof: 2, manifest: 3 });
const ARTIFACT_SCHEMA = 'RevisionCompareTransferArtifact.v1';
function candidateMap(candidates) { return new Map(candidates.map((candidate) => [candidate.differenceId, candidate])); }
function selectedFields(pair, candidate) {
  const byKey = new Map(candidate.fields.map((field) => [field.fieldKey, field]));
  return pair.fieldKeys.map((key) => byKey.get(key)).filter((field) => field?.eligible && field.policy.classification === 'ALLOWED');
}
export function createRevisionCompareTransferSelectionFromDraft(draft, candidates) {
  const indexed = candidateMap(candidates); const items = [];
  for (const pair of draft?.pairs ?? []) {
    const candidate = indexed.get(pair.differenceId); if (!candidate) continue;
    const fields = selectedFields(pair, candidate); if (!fields.length) continue;
    items.push({
      differenceId: candidate.differenceId, sourceRecordId: candidate.sourceRecordId,
      targetRecordId: candidate.targetRecordId, fields: fields.map((field) => ({
        propertyKey: field.propertyKey, revAEvidencePath: field.revAEvidencePath,
        revBEvidencePath: field.revBEvidencePath, targetFieldPath: field.targetFieldPath,
      })),
    });
  }
  return items.length ? createRevisionCompareTransferSelection({ selectionRevision: draft.revision, items }) : null;
}
export function createRevisionCompareTransferDraft() { return createRevisionCompareTransferReviewState().draft; }
export function updateRevisionCompareTransferDraft(draft, candidates, change) {
  return applyRevisionCompareTransferDraftAction(draft, candidates, change);
}
export { deriveRevisionCompareTransferCandidates, deriveRevisionCompareTransferCandidatesScanning, reconcileRevisionCompareTransferDraft, revisionCompareTransferDraftCounts };
function artifactFor(state, kind) { return state?.transfer?.artifacts?.[ARTIFACT_INDEX[kind]] ?? null; }
export async function validateRevisionCompareTransferArtifact(artifact, cryptoRef) {
  if (artifact?.descriptorSchema !== ARTIFACT_SCHEMA) throw new TypeError('A retained RevisionCompareTransferArtifact.v1 descriptor is required.');
  const hash = await sha256Text(artifact.text, cryptoRef);
  if (hash !== artifact.contentSha256) throw new Error('Transfer artifact text SHA-256 does not match its retained descriptor.');
  const size = new TextEncoder().encode(artifact.text).byteLength;
  if (size !== artifact.sizeBytes) throw new Error('Transfer artifact byte length does not match its retained descriptor.');
  return artifact;
}
export async function downloadRevisionCompareTransferArtifact(root, artifact, options = {}) {
  const cryptoRef = options.cryptoRef ?? root.ownerDocument.defaultView.crypto;
  await validateRevisionCompareTransferArtifact(artifact, cryptoRef);
  const windowRef = root.ownerDocument.defaultView; const URLRef = options.URLRef ?? windowRef.URL;
  const BlobRef = options.BlobRef ?? windowRef.Blob; const url = URLRef.createObjectURL(new BlobRef([artifact.text], { type: artifact.mimeType }));
  const anchor = root.ownerDocument.createElement('a'); anchor.href = url; anchor.download = artifact.filename;
  try { root.appendChild(anchor); anchor.click(); } finally { anchor.remove(); URLRef.revokeObjectURL(url); }
  return artifact;
}
function currentReview(state) { return state?.transferReview ?? createRevisionCompareTransferReviewState(); }
function reconciledReview(state, candidates) {
  const review = currentReview(state); const draft = reconcileRevisionCompareTransferDraft(review.draft, candidates);
  return draft === review.draft ? review : replaceRevisionCompareTransferDraft(review, draft);
}
function attribute(target, name) { return Boolean(target?.hasAttribute?.(name)); }
function sortPatch(value) {
  const [sortKey, sortDirection] = String(value ?? '').split(':'); return { sortKey, sortDirection, page: 1 };
}
function presentationPatch(target) {
  if (attribute(target, 'data-revc-transfer-search')) return { search: target.value, page: 1 };
  if (attribute(target, 'data-revc-transfer-eligibility-filter')) return { eligibilityFilter: target.value, page: 1 };
  if (attribute(target, 'data-revc-transfer-policy-filter')) return { policyFilter: target.value, page: 1 };
  if (attribute(target, 'data-revc-transfer-property-group-filter')) return { propertyGroupFilter: target.value, page: 1 };
  if (attribute(target, 'data-revc-transfer-match-filter')) return { matchFilter: target.value, page: 1 };
  if (attribute(target, 'data-revc-transfer-selected-only')) return { selectedOnly: target.checked, page: 1 };
  if (attribute(target, 'data-revc-transfer-sort')) return sortPatch(target.value);
  if (attribute(target, 'data-revc-transfer-page')) return { page: Number(target.value) };
  if (attribute(target, 'data-revc-transfer-page-size')) return { pageSize: Number(target.value), page: 1 };
  return null;
}
export function createRevisionCompareTransferController(options) {
  const deps = options.dependencies; let destroyed = false;
  const cache = createRevisionCompareTransferCandidateCache((state, index) => deriveRevisionCompareTransferCandidates(state, index));
  function model(state = options.readState()) {
    const cached = cache.get(state); const review = reconciledReview(state, cached.candidates);
    const query = queryRevisionCompareTransferCandidates(cached.candidates, review.draft, review.presentation);
    return deepFreeze({ candidates: cached.candidates, index: cached.index, cache: cache.evidence(), review,
      draft: review.draft, presentation: query.presentation, query, counts: revisionCompareTransferDraftCounts(review.draft) });
  }
  function reconcileState(state = options.readState()) {
    const current = model(state); return current.review === currentReview(state) ? state : deps.reconcileReview(state, current.review);
  }
  function commit(next) { if (!destroyed && next !== options.readState()) { options.writeState(next); options.render(next); } }
  function commitDraft(action) {
    const state = options.readState(); const current = model(state);
    const draft = applyRevisionCompareTransferDraftAction(current.draft, current.candidates, action); if (draft === current.draft) return;
    const review = replaceRevisionCompareTransferDraft(current.review, draft);
    const selection = createRevisionCompareTransferSelectionFromDraft(draft, current.candidates);
    commit(deps.setReviewDraft(state, review, selection));
  }
  function commitPresentation(patch) {
    const state = options.readState(); const current = model(state);
    let review = updateRevisionCompareTransferPresentation(current.review, patch);
    const query = queryRevisionCompareTransferCandidates(current.candidates, review.draft, review.presentation);
    if (query.presentation.page !== review.presentation.page) review = updateRevisionCompareTransferPresentation(review, { page: query.presentation.page });
    commit(deps.setPresentation(state, review));
  }
  function handleChange(target) {
    const pair = target?.dataset?.revcTransferPair; const field = target?.dataset?.revcTransferField;
    if (pair) commitDraft({ kind: 'PAIR', differenceId: pair, checked: target.checked });
    else if (field) commitDraft({ kind: 'FIELD', differenceId: target.dataset.revcTransferDifferenceId, fieldKey: field, checked: target.checked });
    else { const patch = presentationPatch(target); if (patch) commitPresentation(patch); }
  }
  function handleInput(target) { if (attribute(target, 'data-revc-transfer-search')) commitPresentation({ search: target.value, page: 1 }); }
  async function createPlan() {
    const current = model(); const selection = createRevisionCompareTransferSelectionFromDraft(current.draft, current.candidates);
    if (!selection) throw new Error('Select at least one eligible pair and field before creating a transfer plan.');
    const captured = options.readState(); const started = deps.startPlan(captured, selection); const generation = started.transfer.requestGeneration; commit(started);
    try { const plan = await deps.createPlan(captured, selection, { cryptoRef: options.cryptoRef }); commit(deps.completePlan(options.readState(), generation, plan)); options.showToast?.('Transfer plan created.', 'success'); }
    catch (error) { commit(deps.failPlan(options.readState(), generation, error)); throw error; }
  }
  async function apply() {
    const before = options.readState(); const createdAt = options.now(); const started = deps.startApply(before, createdAt);
    if (started === before) return; const generation = started.transfer.applyGeneration; commit(started);
    try { const application = await deps.createApplication(started, { createdAt, cryptoRef: options.cryptoRef }); commit(deps.completeApply(options.readState(), generation, application)); options.showToast?.('Transfer applied to a cloned Rev B target.', 'success'); }
    catch (error) { commit(deps.failApply(options.readState(), generation, error)); throw error; }
  }
  async function download(kind) {
    const state = options.readState(); if (state.transfer.status !== 'APPLIED') throw new Error('Only a current APPLIED transfer exposes downloadable artifacts.');
    return downloadRevisionCompareTransferArtifact(options.root, artifactFor(state, kind), { cryptoRef: options.cryptoRef });
  }
  function pageAction(button) {
    if (!button?.dataset?.revcTransferPageAction) return false;
    const current = model().query.presentation; const delta = button.dataset.revcTransferPageAction === 'NEXT' ? 1 : -1;
    commitPresentation({ page: current.page + delta }); return true;
  }
  async function handleClick(button) {
    try {
      if (attribute(button, 'data-revc-transfer-select-visible')) commitDraft({ kind: 'SELECT_VISIBLE', entries: model().query.entries });
      else if (attribute(button, 'data-revc-transfer-clear-visible')) commitDraft({ kind: 'CLEAR_VISIBLE', entries: model().query.entries });
      else if (attribute(button, 'data-revc-transfer-clear-all')) commitDraft({ kind: 'CLEAR_ALL' });
      else if (pageAction(button)) return;
      else if (attribute(button, 'data-revc-create-transfer-plan')) await createPlan();
      else if (attribute(button, 'data-revc-apply-transfer')) await apply();
      else for (const [kind, selector] of Object.entries({ patched: 'data-revc-download-patched-json', audit: 'data-revc-download-transfer-audit', proof: 'data-revc-download-transfer-proof', manifest: 'data-revc-download-transfer-manifest' })) if (attribute(button, selector)) await download(kind);
    } catch (error) { options.reportFailure(error); }
  }
  return Object.freeze({ model, reconcileState, handleChange, handleInput, handleClick, destroy: () => { destroyed = true; cache.clear(); } });
}
export const _test = Object.freeze({ artifactFor, attribute, candidateMap, currentReview, presentationPatch, reconciledReview, selectedFields, sortPatch });
