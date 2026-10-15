/** Guided focus navigation for resolving missing Revision Compare visual metadata. */
import { deepFreeze } from './revision-contract-utils.js';
import { revisionVisualMetadataDeclarationModel } from './revision-visual-metadata-declaration.js';

const DECLARATION_SELECTOR = '[data-revc-visual-metadata]';
const APPROVAL_SELECTOR = '[data-revc-approve-basis]';
const FIELD_SELECTORS = Object.freeze([
  '[data-revc-visual-unit]',
  '[data-revc-visual-frame]',
  '[data-revc-visual-axis]',
]);
const APPROVAL_FOCUS_FRAMES = 24;

function enabled(element) {
  return Boolean(element && !element.disabled && element.getAttribute?.('aria-disabled') !== 'true');
}

function reducedMotion(root) {
  return Boolean(root?.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function scrollTo(root, element) {
  element?.scrollIntoView?.({ block: 'center', behavior: reducedMotion(root) ? 'auto' : 'smooth' });
}

function fieldValue(field) {
  return String(field?.value ?? '').trim();
}

function declarationTarget(section) {
  const fields = FIELD_SELECTORS.map((selector) => section?.querySelector?.(selector)).filter(enabled);
  return fields.find((field) => field.hasAttribute?.('data-revc-visual-missing'))
    ?? fields.find((field) => !fieldValue(field)) ?? fields[0] ?? null;
}

function defaultSchedule(root, callback) {
  return root.ownerDocument.defaultView.requestAnimationFrame(callback);
}

function waitForApproval(root, schedule, active, remaining) {
  if (!active() || focusRevisionBasisApproval(root) || remaining <= 0) return;
  schedule(() => waitForApproval(root, schedule, active, remaining - 1));
}

function navigationClick(root, schedule, active, event) {
  const button = event.target?.closest?.('button');
  if (!button) return;
  if (button.hasAttribute('data-revc-resolve-visual-metadata')) focusRevisionVisualMetadata(root);
  if (button.hasAttribute('data-revc-apply-visual-metadata')) {
    schedule(() => waitForApproval(root, schedule, active, APPROVAL_FOCUS_FRAMES));
  }
}

export function revisionVisualMetadataRecoveryModel(state, approval) {
  const declaration = revisionVisualMetadataDeclarationModel(state);
  const imported = state?.evidencePackageImport?.status === 'VERIFIED';
  const visible = !imported && approval?.status === 'BLOCKED' && declaration.status === 'REQUIRED';
  return deepFreeze({
    visible,
    missingFields: Object.freeze([...(declaration.unknownFields ?? [])]),
    targetId: 'revc-visual-metadata',
  });
}

export function focusRevisionVisualMetadata(root) {
  const section = root?.querySelector?.(DECLARATION_SELECTOR);
  if (!section) return false;
  scrollTo(root, section);
  const target = declarationTarget(section);
  target?.focus?.({ preventScroll: true });
  return Boolean(target);
}

export function focusRevisionBasisApproval(root) {
  const button = root?.querySelector?.(APPROVAL_SELECTOR);
  if (!enabled(button)) return false;
  scrollTo(root, button);
  button.focus?.({ preventScroll: true });
  return true;
}

export function bindRevisionVisualMetadataNavigation(root, options = {}) {
  if (!root?.addEventListener) throw new TypeError('Revision visual metadata navigation root is required.');
  let bound = true;
  const schedule = options.schedule ?? ((callback) => defaultSchedule(root, callback));
  const listener = (event) => navigationClick(root, schedule, () => bound, event);
  root.addEventListener('click', listener);
  return () => {
    if (!bound) return;
    bound = false;
    root.removeEventListener('click', listener);
  };
}

export const _test = Object.freeze({
  declarationTarget, enabled, fieldValue, navigationClick, reducedMotion, waitForApproval,
});
