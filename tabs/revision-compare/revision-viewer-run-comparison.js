/** Pure, bounded comparison of the current and immediately previous WebGL responsiveness runs. */
import { deepFreeze } from './revision-contract-utils.js';

const REVISION_VIEWER_RUN_SNAPSHOT_SCHEMA = 'RevisionViewerRunSnapshot.v1';
const REVISION_VIEWER_RUN_COMPARISON_SCHEMA = 'RevisionViewerRunComparison.v1';

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}
function completed(disposition) {
  return disposition === 'QUALIFIED' || disposition === 'NOT_QUALIFIED';
}
function metricValue(model, name) {
  const metric = model?.metrics?.[name];
  if (!metric || metric.status === 'UNAVAILABLE') return null;
  return finite(metric.value);
}
function runSummary(model) {
  if (!model) return null;
  return deepFreeze({
    runId: String(model.runId ?? ''),
    runSequence: Math.max(0, Math.trunc(Number(model.runSequence) || 0)),
    policyId: String(model.policyId ?? ''),
    bandId: String(model.bandId ?? ''),
    drawableCount: Math.max(0, Math.trunc(Number(model.drawableCount) || 0)),
    disposition: String(model.disposition ?? 'PENDING'),
    sceneMs: metricValue(model, 'scene'),
    firstReadyMs: metricValue(model, 'firstReady'),
    fitSelectedMs: metricValue(model, 'fitSelected'),
    heapGrowthBytes: metricValue(model, 'memory'),
  });
}
function delta(current, previous) {
  return current == null || previous == null ? null : current - previous;
}
function unavailable(reason, previous, current) {
  return deepFreeze({
    schema: REVISION_VIEWER_RUN_COMPARISON_SCHEMA,
    available: false,
    reason,
    previous,
    current,
    deltas: { sceneMs: null, firstReadyMs: null, fitSelectedMs: null, heapGrowthBytes: null },
  });
}

export function revisionViewerCompletedRunSnapshot(runKey, model) {
  if (!runKey || !model?.runSequence || !completed(model.disposition)) return null;
  return deepFreeze({
    schema: REVISION_VIEWER_RUN_SNAPSHOT_SCHEMA,
    runKey: String(runKey),
    ...runSummary(model),
  });
}

export function revisionViewerRunComparison(previousRun, currentModel, currentRunKey) {
  const current = runSummary(currentModel);
  if (!previousRun) return unavailable('NO_PREVIOUS_COMPLETED_RUN', null, current);
  if (previousRun.runKey !== currentRunKey) return unavailable('RUN_KEY_MISMATCH', previousRun, current);
  if (!current || current.runSequence <= previousRun.runSequence) {
    return unavailable('CURRENT_RUN_NOT_NEWER', previousRun, current);
  }
  if (previousRun.policyId !== current.policyId
    || previousRun.bandId !== current.bandId
    || previousRun.drawableCount !== current.drawableCount) {
    return unavailable('POLICY_OR_SIZE_CHANGED', previousRun, current);
  }
  return deepFreeze({
    schema: REVISION_VIEWER_RUN_COMPARISON_SCHEMA,
    available: true,
    reason: 'COMPARABLE',
    previous: previousRun,
    current,
    deltas: {
      sceneMs: delta(current.sceneMs, previousRun.sceneMs),
      firstReadyMs: delta(current.firstReadyMs, previousRun.firstReadyMs),
      fitSelectedMs: delta(current.fitSelectedMs, previousRun.fitSelectedMs),
      heapGrowthBytes: delta(current.heapGrowthBytes, previousRun.heapGrowthBytes),
    },
  });
}
