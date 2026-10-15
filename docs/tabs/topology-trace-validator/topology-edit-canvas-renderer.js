/** Render the branch-scoped Draft view without changing full command/export authority. */

import { scopeCanonicalForDraft, scopeValidationForDraft } from './topology-edit-scope-model.js';

export function renderTopologyEditCanvas(input) {
  if (!input.baseArtifacts || !input.canonical) {
    input.elements.svgHost.innerHTML = '<div class="ttv-empty">Load and build topology before editing.</div>';
    return;
  }
  const original = scopeCanonicalForDraft(input.baseArtifacts.canonicalTopology, input.editScope);
  const draft = scopeCanonicalForDraft(input.canonical, input.editScope);
  const validation = scopeValidationForDraft(input.validation, draft);
  input.canvasRuntime.render(input.elements.svgHost, {
    original, draft, validation, selection: input.selection, verticalAxis: input.verticalAxis,
    supportScale: input.supportScale, ghost: input.ghostModel,
    sourceBranches: input.editScope?.sourceBranches ?? input.sourceBranches,
    platformDocument: input.platformDocument, callbacks: input.callbacks,
  }).catch(input.onError);
}

