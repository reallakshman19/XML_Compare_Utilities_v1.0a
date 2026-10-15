export const SUPPORT_STEEL_STALE_PREVIEW_MESSAGE = 'Inputs changed. Rebuild relationships to refresh exports.';

export function supportSteelBuildInputSnapshot(combinedSourceText, rules) {
  return JSON.stringify({
    combinedSourceText: String(combinedSourceText ?? ''),
    rules: { ...(rules || {}) },
  });
}

export function markSupportSteelPreviewFresh(state, buildInputSnapshot) {
  state.buildInputSnapshot = buildInputSnapshot;
  state.previewStale = false;
  return state;
}

export function syncSupportSteelPreviewFreshness(state, currentInputSnapshot) {
  if (!state?.bundle || !state.buildInputSnapshot) return false;
  const stale = state.buildInputSnapshot !== currentInputSnapshot;
  const changed = state.previewStale !== stale;
  state.previewStale = stale;
  return changed;
}

export function supportSteelPreviewExportReady(state) {
  return Boolean(state?.bundle && !state.previewStale);
}
