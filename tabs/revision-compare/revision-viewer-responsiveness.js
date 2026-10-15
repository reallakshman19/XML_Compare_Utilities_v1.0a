/** Product responsiveness policy and visible observations for Revision Compare WebGL. */
import { deepFreeze } from './revision-contract-utils.js';
import { revisionViewerRunComparison } from './revision-viewer-run-comparison.js';

export const REVISION_VIEWER_RESPONSIVENESS_SCHEMA = 'RevisionViewerResponsiveness.v1';
const MIB = 1024 * 1024;

export const REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY = deepFreeze({
  policyId: 'revision-webgl-responsiveness/v1',
  samplingResolutionMs: 250,
  bands: [
    { bandId: 'FINE', maximumDrawablesExclusive: 3000, sceneObservedMaxMs: 1500, firstReadyMaxMs: 2000, fitSelectedMaxMs: 75, heapGrowthMaxBytes: 128 * MIB },
    { bandId: 'BALANCED', maximumDrawablesExclusive: 12000, sceneObservedMaxMs: 3500, firstReadyMaxMs: 4500, fitSelectedMaxMs: 125, heapGrowthMaxBytes: 256 * MIB },
    { bandId: 'COARSE', maximumDrawablesExclusive: null, sceneObservedMaxMs: 7000, firstReadyMaxMs: 9000, fitSelectedMaxMs: 250, heapGrowthMaxBytes: 512 * MIB },
  ],
});

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${label} must be positive.`);
  return number;
}
function band(value, index) {
  const maximum = value.maximumDrawablesExclusive == null ? null : positive(value.maximumDrawablesExclusive, `bands[${index}].maximumDrawablesExclusive`);
  return Object.freeze({
    bandId: String(value.bandId ?? '').trim().toUpperCase(),
    maximumDrawablesExclusive: maximum,
    sceneObservedMaxMs: positive(value.sceneObservedMaxMs, `bands[${index}].sceneObservedMaxMs`),
    firstReadyMaxMs: positive(value.firstReadyMaxMs, `bands[${index}].firstReadyMaxMs`),
    fitSelectedMaxMs: positive(value.fitSelectedMaxMs, `bands[${index}].fitSelectedMaxMs`),
    heapGrowthMaxBytes: positive(value.heapGrowthMaxBytes, `bands[${index}].heapGrowthMaxBytes`),
  });
}
function validateBandOrder(bands) {
  let previous = 0;
  bands.slice(0, -1).forEach((item, index) => {
    if (item.maximumDrawablesExclusive <= previous) throw new RangeError(`bands[${index}].maximumDrawablesExclusive must increase.`);
    previous = item.maximumDrawablesExclusive;
  });
}
export function createRevisionViewerResponsivenessPolicy(value = REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY) {
  if (!Array.isArray(value?.bands) || !value.bands.length) throw new TypeError('Responsiveness policy bands are required.');
  const bands = value.bands.map(band);
  if (!bands.every((item) => item.bandId)) throw new TypeError('Every responsiveness band requires a bandId.');
  if (bands.at(-1).maximumDrawablesExclusive != null) throw new TypeError('The final responsiveness band must be unbounded.');
  validateBandOrder(bands);
  return deepFreeze({
    policyId: String(value.policyId ?? '').trim() || 'revision-webgl-responsiveness/custom',
    samplingResolutionMs: positive(value.samplingResolutionMs, 'samplingResolutionMs'),
    bands,
  });
}
function selectBand(policy, drawableCount) {
  return policy.bands.find((item) => item.maximumDrawablesExclusive == null || drawableCount < item.maximumDrawablesExclusive);
}
function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}
function nonNegativeInteger(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}
function timingMetric(value, limit, elapsed, terminalFailure) {
  const measured = finite(value);
  if (measured != null) return { status: measured <= limit ? 'PASS' : 'FAIL', value: measured, limit };
  const current = finite(elapsed);
  if (terminalFailure || (current != null && current > limit)) return { status: 'FAIL', value: current, limit };
  return { status: 'PENDING', value: null, limit };
}
function fitMetric(evidence, limit) {
  const count = nonNegativeInteger(evidence?.fitSelectedCount);
  const value = finite(evidence?.lastFitSelectedMs);
  if (!count || value == null) return { status: 'PENDING', value: null, limit, count };
  return { status: value <= limit ? 'PASS' : 'FAIL', value, limit, count };
}
function memoryMetric(observation, limit) {
  if (!observation?.available) return { status: 'UNAVAILABLE', value: null, limit, usedBytes: null };
  const value = finite(observation.peakGrowthBytes) ?? 0;
  return { status: value <= limit ? 'PASS' : 'FAIL', value, limit, usedBytes: finite(observation.usedBytes) };
}
function disposition(scene, metrics) {
  if (scene.requestedBackend !== 'WEBGL') return 'INACTIVE';
  const statuses = [metrics.scene.status, metrics.firstReady.status, metrics.fitSelected.status, metrics.memory.status];
  if (statuses.includes('FAIL')) return 'NOT_QUALIFIED';
  if (scene.status !== 'READY' || statuses.slice(0, 3).includes('PENDING')) return 'PENDING';
  return 'QUALIFIED';
}
function messageFor(result) {
  if (result.disposition === 'INACTIVE') return 'Select 3D (WebGL) to measure responsiveness.';
  if (result.disposition === 'NOT_QUALIFIED') return 'One or more observed responsiveness limits were exceeded.';
  if (result.disposition === 'QUALIFIED' && result.metrics.memory.status === 'UNAVAILABLE') return 'Timing limits passed; browser heap telemetry is unavailable and was not inferred.';
  if (result.disposition === 'QUALIFIED') return 'Observed WebGL responsiveness is within the active product policy.';
  if (result.metrics.fitSelected.status === 'PENDING' && result.sceneStatus === 'READY') return 'Select a difference and use Fit selected to complete the disposition.';
  return 'Waiting for the WebGL scene to become ready.';
}
function policyDisclosure(policy) {
  const bands = policy.bands.map((item) => {
    const drawables = item.maximumDrawablesExclusive == null ? 'unbounded' : `< ${item.maximumDrawablesExclusive}`;
    return `${item.bandId}: drawables ${drawables}, scene ≤ ${item.sceneObservedMaxMs} ms, first ready ≤ ${item.firstReadyMaxMs} ms, fit selected dispatch ≤ ${item.fitSelectedMaxMs} ms, heap growth ≤ ${Math.round(item.heapGrowthMaxBytes / MIB)} MiB`;
  }).join('; ');
  return `Product responsiveness policy ${policy.policyId}. Sampling resolution ${policy.samplingResolutionMs} ms. ${bands}. Run deltas are current minus previous; negative timing or heap deltas mean lower observed cost. Rerun measurement clears only runtime timing observations and requests the current audit from the existing renderer again. Completed runs may be downloaded as deterministic audit-bound product-runtime observation receipts; those receipts are not engineering acceptance, design validation, or certification. Fit selected measures synchronous command dispatch, not frame-paint completion. Memory is sampled only when the browser exposes performance.memory; unavailable memory is advisory, does not block timing qualification, and is never inferred. These observations do not alter renderer, engineering, topology, comparison, persistence, or export authority.`;
}
export function revisionViewerResponsivenessModel(scene, viewerEvidence, observations = {}, policyValue) {
  const policy = createRevisionViewerResponsivenessPolicy(policyValue);
  const drawableCount = nonNegativeInteger(scene?.expected?.total);
  const activeBand = selectBand(policy, drawableCount);
  const terminalFailure = ['FAILED', 'BLOCKED'].includes(scene?.status);
  const metrics = deepFreeze({
    scene: timingMetric(observations.sceneRuntimeObservedMs, activeBand.sceneObservedMaxMs, observations.elapsedMs, terminalFailure),
    firstReady: timingMetric(observations.firstReadyMs, activeBand.firstReadyMaxMs, observations.elapsedMs, terminalFailure),
    fitSelected: fitMetric(viewerEvidence, activeBand.fitSelectedMaxMs),
    memory: memoryMetric(observations.memory, activeBand.heapGrowthMaxBytes),
  });
  const result = {
    schema: REVISION_VIEWER_RESPONSIVENESS_SCHEMA,
    policyId: policy.policyId,
    runKey: String(observations.runKey ?? ''),
    runId: String(observations.runId ?? ''),
    runSequence: nonNegativeInteger(observations.runSequence),
    sceneStatus: scene?.status ?? 'INACTIVE',
    bandId: activeBand.bandId,
    drawableCount,
    canRerun: scene?.requestedBackend === 'WEBGL' && drawableCount > 0,
    canDownloadReceipt: false,
    disposition: disposition(scene ?? {}, metrics),
    metrics,
    comparison: null,
    message: '',
    disclosure: policyDisclosure(policy),
  };
  result.canDownloadReceipt = ['QUALIFIED', 'NOT_QUALIFIED'].includes(result.disposition);
  result.message = messageFor(result);
  result.comparison = revisionViewerRunComparison(observations.previousRun, result, result.runKey);
  return deepFreeze(result);
}
export function readRevisionViewerMemory(performanceRef = globalThis.performance) {
  const memory = performanceRef?.memory;
  const usedBytes = finite(memory?.usedJSHeapSize);
  const limitBytes = finite(memory?.jsHeapSizeLimit);
  if (usedBytes == null) return deepFreeze({ available: false, usedBytes: null, limitBytes: null });
  return deepFreeze({ available: true, usedBytes, limitBytes });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
function formatMs(value) { return finite(value) == null ? 'Pending' : `${Math.round(Number(value))} ms`; }
function formatMemory(value) { return finite(value) == null ? 'Unavailable' : `${(Number(value) / MIB).toFixed(1)} MiB`; }
function signed(value, unit, divisor = 1) {
  if (value == null) return 'Pending';
  const number = Number(value) / divisor;
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${divisor === 1 ? Math.round(number) : number.toFixed(1)} ${unit}`;
}
function fact(label, value, attribute, status = '') {
  return `<div><dt>${escapeHtml(label)}</dt><dd ${attribute} ${status ? `data-status="${escapeHtml(status.toLowerCase())}"` : ''}>${escapeHtml(value)}</dd></div>`;
}
function rerunControl(model) {
  const rerunDisabled = model.canRerun ? '' : 'disabled';
  const receiptDisabled = model.canDownloadReceipt ? '' : 'disabled';
  return `<div class="revc-performance-actions"><strong data-revc-performance-disposition data-status="${escapeHtml(model.disposition.toLowerCase())}">${escapeHtml(model.disposition)}</strong><button type="button" data-revc-rerun-responsiveness ${rerunDisabled}>Rerun measurement</button><button type="button" data-revc-download-responsiveness-receipt ${receiptDisabled}>Download receipt</button></div>`;
}
function comparisonBody(comparison) {
  if (!comparison?.available) return `<p>${comparison?.reason === 'NO_PREVIOUS_COMPLETED_RUN' ? 'Complete and rerun a measurement to compare runs.' : 'The previous and current runs are not comparable.'}</p>`;
  const previous = comparison.previous;
  const current = comparison.current;
  return `<header><b>Run ${previous.runSequence} → Run ${current.runSequence}</b><em>${escapeHtml(previous.disposition)} → ${escapeHtml(current.disposition)}</em></header><dl>${fact('Scene Δ', signed(comparison.deltas.sceneMs, 'ms'), 'data-revc-run-delta-scene')}${fact('First ready Δ', signed(comparison.deltas.firstReadyMs, 'ms'), 'data-revc-run-delta-ready')}${fact('Fit dispatch Δ', signed(comparison.deltas.fitSelectedMs, 'ms'), 'data-revc-run-delta-fit')}${fact('Heap growth Δ', signed(comparison.deltas.heapGrowthBytes, 'MiB', MIB), 'data-revc-run-delta-memory')}</dl>`;
}
function comparisonMarkup(comparison) {
  return `<section class="revc-run-comparison" data-revc-run-comparison data-state="${comparison?.available ? 'available' : 'unavailable'}">${comparisonBody(comparison)}</section>`;
}
export function revisionViewerResponsivenessMarkup(model) {
  const metric = model.metrics;
  const run = model.runSequence ? `Run ${model.runSequence}` : 'Not started';
  return `<section class="revc-performance-status" data-revc-performance-status data-status="${escapeHtml(model.disposition.toLowerCase())}"><header><div><span>WEBGL PERFORMANCE</span><b>Observed responsiveness</b><span class="revc-info-icon" tabindex="0" role="img" aria-label="Responsiveness policy and authority boundary" title="${escapeHtml(model.disclosure)}">ⓘ</span></div>${rerunControl(model)}</header><dl>${fact('Measurement run', run, 'data-revc-performance-run')}${fact('Size band', model.bandId, 'data-revc-performance-band')}${fact('Drawables', model.drawableCount, 'data-revc-performance-drawables')}${fact('Scene completion', `${formatMs(metric.scene.value)} / ${metric.scene.limit} ms`, 'data-revc-performance-scene', metric.scene.status)}${fact('First ready', `${formatMs(metric.firstReady.value)} / ${metric.firstReady.limit} ms`, 'data-revc-performance-ready', metric.firstReady.status)}${fact('Fit selected dispatch', `${formatMs(metric.fitSelected.value)} / ${metric.fitSelected.limit} ms`, 'data-revc-performance-fit', metric.fitSelected.status)}${fact('Fit samples', metric.fitSelected.count, 'data-revc-performance-fit-count')}${fact('Heap used', formatMemory(metric.memory.usedBytes), 'data-revc-performance-heap')}${fact('Peak heap growth', `${formatMemory(metric.memory.value)} / ${formatMemory(metric.memory.limit)}`, 'data-revc-performance-memory', metric.memory.status)}</dl>${comparisonMarkup(model.comparison)}<p data-revc-performance-message>${escapeHtml(model.message)}</p></section>`;
}
function setText(root, selector, value) {
  const element = root?.querySelector?.(selector);
  if (element) element.textContent = String(value);
}
function setMetric(root, selector, value, status) {
  const element = root?.querySelector?.(selector);
  if (!element) return;
  element.textContent = String(value);
  element.setAttribute('data-status', status.toLowerCase());
}
function applyComparison(host, comparison) {
  const comparisonHost = host.querySelector('[data-revc-run-comparison]');
  if (!comparisonHost) return;
  comparisonHost.setAttribute('data-state', comparison?.available ? 'available' : 'unavailable');
  comparisonHost.innerHTML = comparisonBody(comparison);
}
export function applyRevisionViewerResponsiveness(root, model) {
  let host = root?.querySelector?.('[data-revc-performance-status]');
  if (!host) {
    root?.querySelector?.('[data-revc-scene-status]')?.insertAdjacentHTML?.('afterend', revisionViewerResponsivenessMarkup(model));
    host = root?.querySelector?.('[data-revc-performance-status]');
  }
  if (!host) return false;
  host.setAttribute('data-status', model.disposition.toLowerCase());
  const dispositionNode = host.querySelector('[data-revc-performance-disposition]');
  if (dispositionNode) {
    dispositionNode.textContent = model.disposition;
    dispositionNode.setAttribute('data-status', model.disposition.toLowerCase());
  }
  const rerun = host.querySelector('[data-revc-rerun-responsiveness]');
  if (rerun) rerun.disabled = !model.canRerun;
  const receipt = host.querySelector('[data-revc-download-responsiveness-receipt]');
  if (receipt) receipt.disabled = !model.canDownloadReceipt;
  const metric = model.metrics;
  setText(host, '[data-revc-performance-run]', model.runSequence ? `Run ${model.runSequence}` : 'Not started');
  setText(host, '[data-revc-performance-band]', model.bandId);
  setText(host, '[data-revc-performance-drawables]', model.drawableCount);
  setMetric(host, '[data-revc-performance-scene]', `${formatMs(metric.scene.value)} / ${metric.scene.limit} ms`, metric.scene.status);
  setMetric(host, '[data-revc-performance-ready]', `${formatMs(metric.firstReady.value)} / ${metric.firstReady.limit} ms`, metric.firstReady.status);
  setMetric(host, '[data-revc-performance-fit]', `${formatMs(metric.fitSelected.value)} / ${metric.fitSelected.limit} ms`, metric.fitSelected.status);
  setText(host, '[data-revc-performance-fit-count]', metric.fitSelected.count);
  setText(host, '[data-revc-performance-heap]', formatMemory(metric.memory.usedBytes));
  setMetric(host, '[data-revc-performance-memory]', `${formatMemory(metric.memory.value)} / ${formatMemory(metric.memory.limit)}`, metric.memory.status);
  applyComparison(host, model.comparison);
  setText(host, '[data-revc-performance-message]', model.message);
  return true;
}
export const REVISION_VIEWER_RESPONSIVENESS_CSS = `
.revc-view-column{grid-template-rows:auto auto auto auto minmax(0,1fr)}
.revc-performance-status{display:grid;gap:7px;padding:8px 10px;border-bottom:1px solid #203550;background:#081827}.revc-performance-status>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.revc-performance-status>header>div{display:flex;align-items:center;gap:7px}.revc-performance-status>header span:first-child{color:#60a5fa;font:700 10px/1.2 ui-monospace,monospace;letter-spacing:.08em}.revc-performance-status>header b{font-size:11px}.revc-performance-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.revc-performance-actions strong{font:700 10px/1.2 ui-monospace,monospace}.revc-performance-actions button{padding:4px 7px;border:1px solid #35587b;border-radius:4px;background:#0b1d2e;color:#dbeafe;font-size:10px;cursor:pointer}.revc-performance-actions button:disabled{opacity:.45;cursor:not-allowed}.revc-performance-status>dl{margin:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#203550}.revc-performance-status dl div{min-width:0;padding:6px 7px;background:#0b1d2e}.revc-performance-status dt{font-size:8px;text-transform:uppercase;color:#7893ac}.revc-performance-status dd{margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d6e4f2;font:10px/1.3 ui-monospace,monospace}.revc-performance-status>p{margin:0;color:#9fb4c9;font-size:10px}.revc-run-comparison{display:grid;gap:5px;padding:6px 7px;border:1px solid #203550;background:#071421}.revc-run-comparison>header{display:flex;justify-content:space-between;gap:8px}.revc-run-comparison>header b{font-size:10px;color:#bfdbfe}.revc-run-comparison>header em{font:9px/1.2 ui-monospace,monospace;color:#9fb4c9}.revc-run-comparison>dl{margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#203550}.revc-run-comparison>p{margin:0;color:#7893ac;font-size:10px}.revc-performance-status [data-status=qualified],.revc-performance-status [data-status=pass]{color:#5eead4}.revc-performance-status [data-status=pending],.revc-performance-status [data-status=unavailable],.revc-performance-status [data-status=inactive]{color:#fbbf24}.revc-performance-status [data-status=not_qualified],.revc-performance-status [data-status=fail]{color:#fb7185}@media(max-width:1100px){.revc-performance-status>dl{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.revc-performance-status>dl,.revc-run-comparison>dl{grid-template-columns:repeat(2,minmax(0,1fr))}.revc-performance-status>header{align-items:flex-start;flex-direction:column}}
`;