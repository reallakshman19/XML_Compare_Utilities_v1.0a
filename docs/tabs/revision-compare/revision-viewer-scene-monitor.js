/** Owned, bounded-lifecycle DOM monitor for Revision Compare WebGL renderer evidence. */
import {
  REVISION_VIEWER_SCENE_PENDING_LIMIT_MS,
  REVISION_VIEWER_SCENE_REFRESH_MS,
  revisionViewerSceneStatus,
  timedOutRevisionViewerSceneStatus,
} from './revision-viewer-scene-status.js';
import {
  REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
  applyRevisionViewerResponsiveness,
  createRevisionViewerResponsivenessPolicy,
  readRevisionViewerMemory,
  revisionViewerResponsivenessModel,
} from './revision-viewer-responsiveness.js';
import { revisionViewerCompletedRunSnapshot } from './revision-viewer-run-comparison.js';

function timerFunction(value, fallback, label) {
  const result = value ?? fallback;
  if (typeof result !== 'function') throw new TypeError(`${label} must be a function.`);
  return result;
}
function positiveInteger(value, fallback) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function setText(root, selector, value) {
  const element = root?.querySelector?.(selector);
  if (element) element.textContent = String(value ?? '');
}
function applySceneStatus(root, model) {
  const host = root?.querySelector?.('[data-revc-scene-status]');
  if (!host) return false;
  host.setAttribute('data-status', model.status.toLowerCase());
  const state = host.querySelector('[data-revc-scene-state]');
  if (state) {
    state.textContent = model.status;
    state.setAttribute('data-status', model.status.toLowerCase());
  }
  setText(host, '[data-revc-scene-source]', model.expected.source);
  setText(host, '[data-revc-scene-target]', model.expected.target);
  setText(host, '[data-revc-scene-instances]', model.rendered.instances);
  setText(host, '[data-revc-scene-batches]', model.rendered.batches);
  setText(host, '[data-revc-scene-runtime]', model.rendered.runtimeRevision ?? '—');
  setText(host, '[data-revc-scene-selection]', model.selectedObjectId ?? 'None');
  setText(host, '[data-revc-scene-picks]', model.pickCount);
  setText(host, '[data-revc-scene-last-pick]', model.lastPickedObjectId ?? 'None');
  setText(host, '[data-revc-scene-message]', model.message);
  return true;
}
function identity(model) {
  return JSON.stringify([
    model.status, model.reason, model.expected, model.rendered,
    model.selectedObjectId, model.pickCount, model.lastPickedObjectId, model.message,
  ]);
}
function stopTimer(context) {
  if (context.timer == null) return;
  context.clearTimer(context.timer);
  context.timer = null;
}
function schedule(context, generation) {
  stopTimer(context);
  context.timer = context.setTimer(() => sample(context, generation), context.intervalMs);
}
function auditIdentity(audit) {
  return String(audit?.auditId ?? audit?.basisId ?? audit?.revADocumentId ?? 'unknown-audit');
}
function runKey(audit, evidence) {
  const backend = String(evidence?.viewerBackend ?? evidence?.requestedBackend ?? 'UNKNOWN').toUpperCase();
  return `${auditIdentity(audit)}|${backend}`;
}
function memorySample(context) {
  try { return context.memoryReader(); } catch { return Object.freeze({ available: false, usedBytes: null, limitBytes: null }); }
}
function beginRun(context, key) {
  const memory = memorySample(context);
  context.runSequence += 1;
  context.runKey = key;
  context.runId = `${key}|run:${context.runSequence}`;
  context.activeStartedAt = null;
  context.accumulatedActiveMs = 0;
  context.elapsedMs = 0;
  context.sceneRuntimeObservedMs = null;
  context.firstReadyMs = null;
  context.memoryBaselineUsedBytes = memory.available ? memory.usedBytes : null;
  context.memoryPeakUsedBytes = memory.available ? memory.usedBytes : null;
  context.memoryLimitBytes = memory.available ? memory.limitBytes : null;
  context.runSampleCount = 0;
  context.lastSceneIdentity = '';
  context.lastPerformanceIdentity = '';
  context.lastModel = null;
  context.lastPerformanceModel = null;
}
function observeMemory(context) {
  const memory = memorySample(context);
  if (!memory.available) return Object.freeze({ available: false, usedBytes: null, peakGrowthBytes: null, limitBytes: null });
  if (context.memoryBaselineUsedBytes == null) context.memoryBaselineUsedBytes = memory.usedBytes;
  context.memoryPeakUsedBytes = Math.max(context.memoryPeakUsedBytes ?? memory.usedBytes, memory.usedBytes);
  context.memoryLimitBytes = memory.limitBytes;
  return Object.freeze({
    available: true,
    usedBytes: memory.usedBytes,
    peakGrowthBytes: Math.max(0, context.memoryPeakUsedBytes - context.memoryBaselineUsedBytes),
    limitBytes: memory.limitBytes,
  });
}
function observeTiming(context, model, elapsedMs) {
  if (context.sceneRuntimeObservedMs == null && model.rendered?.runtimeRevision != null) {
    context.sceneRuntimeObservedMs = elapsedMs;
  }
  if (context.firstReadyMs == null && model.status === 'READY') context.firstReadyMs = elapsedMs;
}
function activeElapsed(context) {
  const current = context.activeStartedAt == null ? 0 : Math.max(0, context.clock() - context.activeStartedAt);
  return context.accumulatedActiveMs + current;
}
function currentModels(context) {
  const evidence = context.adapter.evidence();
  const elapsedMs = activeElapsed(context);
  let scene = revisionViewerSceneStatus(context.audit, evidence);
  if (elapsedMs >= context.pendingLimitMs) scene = timedOutRevisionViewerSceneStatus(scene, elapsedMs);
  observeTiming(context, scene, elapsedMs);
  const observations = {
    runKey: context.runKey,
    runId: context.runId,
    runSequence: context.runSequence,
    previousRun: context.previousRun,
    elapsedMs,
    sceneRuntimeObservedMs: context.sceneRuntimeObservedMs,
    firstReadyMs: context.firstReadyMs,
    memory: observeMemory(context),
  };
  return {
    scene,
    performance: revisionViewerResponsivenessModel(scene, evidence, observations, context.policy),
    elapsedMs,
  };
}
function monitorFailure(error) {
  return Object.freeze({
    status: 'FAILED', reason: 'MONITOR_FAILURE', terminal: true, requestedBackend: 'WEBGL',
    expected: { source: 0, target: 0, total: 0 },
    rendered: { instances: 0, batches: 0, runtimeRevision: null },
    selectedObjectId: null, pickCount: 0, lastPickedObjectId: null,
    message: error?.message || String(error),
  });
}
function updateDom(context, scene, performanceModel) {
  const sceneIdentity = identity(scene);
  if (sceneIdentity !== context.lastSceneIdentity) {
    applySceneStatus(context.root, scene);
    context.lastSceneIdentity = sceneIdentity;
  }
  if (!performanceModel) return;
  const performanceIdentity = JSON.stringify(performanceModel);
  if (performanceIdentity !== context.lastPerformanceIdentity) {
    applyRevisionViewerResponsiveness(context.root, performanceModel);
    context.lastPerformanceIdentity = performanceIdentity;
  }
}
function sample(context, generation) {
  if (context.destroyed || !context.active || generation !== context.generation) return;
  context.timer = null;
  let scene;
  let performanceModel = null;
  try {
    const current = currentModels(context);
    scene = current.scene;
    performanceModel = current.performance;
    context.elapsedMs = current.elapsedMs;
  } catch (error) {
    scene = monitorFailure(error);
  }
  context.sampleCount += 1;
  context.runSampleCount += 1;
  context.lastModel = scene;
  if (performanceModel) context.lastPerformanceModel = performanceModel;
  updateDom(context, scene, performanceModel);
  if (!scene.terminal) schedule(context, generation);
}
function detach(context) {
  context.generation += 1;
  if (context.active && context.activeStartedAt != null) {
    context.accumulatedActiveMs += Math.max(0, context.clock() - context.activeStartedAt);
  }
  context.active = false;
  context.activeStartedAt = null;
  stopTimer(context);
  context.root = null;
  context.audit = null;
  context.adapter = null;
  context.lastSceneIdentity = '';
  context.lastPerformanceIdentity = '';
  return true;
}
function clearRun(context) {
  context.runKey = null;
  context.runId = null;
  context.activeStartedAt = null;
  context.accumulatedActiveMs = 0;
  context.elapsedMs = 0;
  context.sceneRuntimeObservedMs = null;
  context.firstReadyMs = null;
  context.memoryBaselineUsedBytes = null;
  context.memoryPeakUsedBytes = null;
  context.memoryLimitBytes = null;
  context.lastModel = null;
  context.lastPerformanceModel = null;
  context.runSampleCount = 0;
}
function policyFor(options, intervalMs) {
  if (options.responsivenessPolicy) return createRevisionViewerResponsivenessPolicy(options.responsivenessPolicy);
  return createRevisionViewerResponsivenessPolicy({
    ...REVISION_VIEWER_DEFAULT_RESPONSIVENESS_POLICY,
    samplingResolutionMs: intervalMs,
  });
}

export function createRevisionViewerSceneMonitor(options = {}) {
  const intervalMs = positiveInteger(options.intervalMs, REVISION_VIEWER_SCENE_REFRESH_MS);
  const context = {
    intervalMs,
    pendingLimitMs: positiveInteger(options.pendingLimitMs, REVISION_VIEWER_SCENE_PENDING_LIMIT_MS),
    policy: policyFor(options, intervalMs),
    clock: timerFunction(options.clock, () => globalThis.performance?.now?.() ?? Date.now(), 'Scene monitor clock'),
    setTimer: timerFunction(options.setTimer, (callback, delay) => setTimeout(callback, delay), 'Scene monitor setTimer'),
    clearTimer: timerFunction(options.clearTimer, (timer) => clearTimeout(timer), 'Scene monitor clearTimer'),
    memoryReader: timerFunction(options.memoryReader, () => readRevisionViewerMemory(), 'Scene monitor memoryReader'),
    generation: 0, timer: null, active: false, destroyed: false,
    root: null, audit: null, adapter: null, runKey: null, runId: null, runSequence: 0,
    previousRun: null,
    activeStartedAt: null, accumulatedActiveMs: 0, elapsedMs: 0,
    sceneRuntimeObservedMs: null, firstReadyMs: null,
    memoryBaselineUsedBytes: null, memoryPeakUsedBytes: null, memoryLimitBytes: null,
    lastSceneIdentity: '', lastPerformanceIdentity: '', lastModel: null, lastPerformanceModel: null,
    sampleCount: 0, runSampleCount: 0,
  };
  return Object.freeze({
    start(root, audit, adapter) {
      if (context.destroyed) throw new Error('Revision viewer scene monitor is destroyed.');
      if (!root?.querySelector) throw new TypeError('Scene monitor root is required.');
      if (!audit?.visualModels) throw new TypeError('Scene monitor audit visual models are required.');
      if (typeof adapter?.evidence !== 'function') throw new TypeError('Scene monitor viewer adapter is required.');
      const evidence = adapter.evidence();
      const key = runKey(audit, evidence);
      detach(context);
      if (context.runKey !== key) {
        if (context.previousRun?.runKey !== key) context.previousRun = null;
        beginRun(context, key);
      }
      context.active = true;
      context.activeStartedAt = context.clock();
      context.root = root;
      context.audit = audit;
      context.adapter = adapter;
      const generation = context.generation;
      sample(context, generation);
      return true;
    },
    stop: () => detach(context),
    resetResponsiveness() {
      if (context.destroyed) throw new Error('Revision viewer scene monitor is destroyed.');
      const completedRun = revisionViewerCompletedRunSnapshot(context.runKey, context.lastPerformanceModel);
      if (completedRun) context.previousRun = completedRun;
      detach(context);
      clearRun(context);
      return true;
    },
    evidence: () => Object.freeze({
      active: context.active,
      destroyed: context.destroyed,
      runKey: context.runKey,
      runId: context.runId,
      runSequence: context.runSequence,
      previousRun: context.previousRun,
      sampleCount: context.sampleCount,
      runSampleCount: context.runSampleCount,
      status: context.lastModel?.status ?? 'INACTIVE',
      reason: context.lastModel?.reason ?? null,
      elapsedMs: context.elapsedMs,
      sceneRuntimeObservedMs: context.sceneRuntimeObservedMs,
      firstReadyMs: context.firstReadyMs,
      responsiveness: context.lastPerformanceModel,
    }),
    destroy() {
      if (context.destroyed) return false;
      detach(context);
      clearRun(context);
      context.previousRun = null;
      context.runSequence = 0;
      context.destroyed = true;
      return true;
    },
  });
}
