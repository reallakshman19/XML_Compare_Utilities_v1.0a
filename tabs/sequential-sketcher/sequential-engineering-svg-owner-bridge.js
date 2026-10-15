import { freezeJsonValue } from '../../core/engineering-scene/index.js';
import { classifySequentialEngineeringSvgAuthority } from './sequential-engineering-svg-authority.js';
import { createSequentialEngineeringSvgIndexProjection } from './sequential-engineering-svg-index-projection.js';
import { assertSequentialSupportAdjustmentRegister } from './support/sequential-support-adjustment-register.js';
import { applySequentialSupportAdjustmentRegister } from './support/sequential-support-adjusted-projection.js';

export const SEQUENTIAL_ENGINEERING_SVG_OWNER_BRIDGE_SCHEMA =
  'SequentialEngineeringSvgOwnerBridge.v1';
export const SEQUENTIAL_ENGINEERING_SVG_OWNER_SNAPSHOT_SCHEMA =
  'SequentialEngineeringSvgOwnerSnapshot.v1';
export const SEQUENTIAL_ENGINEERING_SVG_OWNER_EVENT_SCHEMA =
  'SequentialEngineeringSvgOwnerEvent.v1';

const PRE_SESSION_REASONS = new Set(['source-inspected', 'source-reloaded']);
const SESSION_REASONS = new Set([
  'branch-opened', 'branch-restored', 'construction-advanced', 'decision-required',
  'decision-applied', 'route-complete', 'support-refreshed', 'projection-changed',
  'selection-changed',
]);
const ALLOWED_REASONS = new Set([...PRE_SESSION_REASONS, ...SESSION_REASONS]);

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function selection(value) {
  const text = String(value || '').trim();
  return text || null;
}
function buildSnapshot(state) {
  if (!state?.session) return null;
  const indexProjection = createSequentialEngineeringSvgIndexProjection(state.indexes);
  const authority = classifySequentialEngineeringSvgAuthority({ ...state, indexProjection });
  return freezeJsonValue({
    schema: SEQUENTIAL_ENGINEERING_SVG_OWNER_SNAPSHOT_SCHEMA,
    revision: authority.revision,
    sessionFingerprint: authority.sessionFingerprint,
    confirmedConstructionFingerprint: authority.confirmedConstructionFingerprint,
    supportConstructionFingerprint: authority.supportConstructionFingerprint,
    supportProjectionFingerprint: authority.supportProjectionFingerprint,
    supportAdjustmentRegisterFingerprint: authority.supportAdjustmentRegisterFingerprint,
    session: authority.session,
    evidenceModel: authority.evidenceModel,
    indexProjection,
    confirmedConstruction: authority.confirmedConstruction,
    baseSupportProjection: state.baseSupportProjection || null,
    supportAdjustmentRegister: state.supportAdjustmentRegister || null,
    supportProjection: state.supportProjection || null,
    visibleProjection: String(state.visibleProjection || 'ISO'),
    constructionCandidateSelection: selection(state.constructionCandidateSelection),
    engineeringSceneSelection: selection(state.engineeringSceneSelection),
    reviewQueueSelection: selection(state.reviewQueueSelection),
    inspectorSelection: selection(state.inspectorSelection),
  });
}
function validateEnvelope(reason, snapshot) {
  if (!ALLOWED_REASONS.has(reason)) {
    throw new TypeError(`Unsupported Sequential owner event reason: ${reason}`);
  }
  if (PRE_SESSION_REASONS.has(reason) && snapshot !== null) {
    throw new Error(`${reason} must publish a null pre-session snapshot.`);
  }
  if (SESSION_REASONS.has(reason) && snapshot === null) {
    throw new Error(`${reason} requires a valid session-bearing snapshot.`);
  }
}
function installPrivatePublisher(registerPublisher, publish) {
  if (registerPublisher == null) return;
  requiredFunction(registerPublisher, 'Sequential owner publisher registrar')(publish);
}

export function createSequentialAdjustedEngineeringSvgOwnerSnapshot(snapshot, registerValue) {
  if (snapshot?.schema !== SEQUENTIAL_ENGINEERING_SVG_OWNER_SNAPSHOT_SCHEMA) {
    throw new TypeError(`Adjusted owner snapshot requires ${SEQUENTIAL_ENGINEERING_SVG_OWNER_SNAPSHOT_SCHEMA}.`);
  }
  const base = snapshot.baseSupportProjection || snapshot.supportProjection;
  if (!base) throw new RangeError('Adjusted owner snapshot requires a base support projection.');
  const register = assertSequentialSupportAdjustmentRegister(
    registerValue,
    base.constructionFingerprint,
  );
  const supportProjection = applySequentialSupportAdjustmentRegister(base, register);
  const material = {
    ...snapshot,
    baseSupportProjection: base,
    supportAdjustmentRegister: register,
    supportProjection,
  };
  const authority = classifySequentialEngineeringSvgAuthority(material);
  return freezeJsonValue({
    ...material,
    revision: authority.revision,
    sessionFingerprint: authority.sessionFingerprint,
    confirmedConstructionFingerprint: authority.confirmedConstructionFingerprint,
    supportConstructionFingerprint: authority.supportConstructionFingerprint,
    supportProjectionFingerprint: authority.supportProjectionFingerprint,
    supportAdjustmentRegisterFingerprint: authority.supportAdjustmentRegisterFingerprint,
  });
}

export function createSequentialEngineeringSvgOwnerBridge(options = {}) {
  const readOwnerState = requiredFunction(options.readOwnerState, 'Sequential owner-state reader');
  const listeners = new Set();
  let destroyed = false;
  function getSnapshot() {
    return destroyed ? null : buildSnapshot(readOwnerState());
  }
  function subscribe(listener) {
    requiredFunction(listener, 'Sequential owner-state listener');
    if (destroyed) throw new Error('Sequential owner bridge is destroyed.');
    listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
    };
  }
  function publishSettledTransition(reason) {
    if (destroyed) return null;
    const normalizedReason = String(reason || '').trim();
    const snapshot = getSnapshot();
    validateEnvelope(normalizedReason, snapshot);
    const event = freezeJsonValue({
      schema: SEQUENTIAL_ENGINEERING_SVG_OWNER_EVENT_SCHEMA,
      reason: normalizedReason,
      snapshot,
    });
    const failures = [];
    for (const listener of [...listeners]) {
      try { listener(event); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, 'Sequential owner-state publication failed.');
    return event;
  }
  function destroy() {
    if (destroyed) return false;
    destroyed = true;
    listeners.clear();
    return true;
  }
  installPrivatePublisher(options.registerPublisher, publishSettledTransition);
  return Object.freeze({
    schema: SEQUENTIAL_ENGINEERING_SVG_OWNER_BRIDGE_SCHEMA,
    getSnapshot,
    subscribe,
    destroy,
  });
}
