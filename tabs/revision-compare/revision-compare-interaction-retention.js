/** Non-authoritative DOM focus, caret and scroll retention across workspace rerenders. */
import { deepFreeze } from './revision-contract-utils.js';

const SCROLL_SELECTORS = Object.freeze(['.revc-body', '.revc-review-side']);
const STATIC_FOCUS = Object.freeze([
  Object.freeze({ selector: '[data-revc-queue-search]', kind: 'queueSearch' }),
  Object.freeze({ selector: '[data-revc-review-search]', kind: 'reviewSearch' }),
  Object.freeze({ selector: '[data-revc-decision-rationale]', kind: 'decisionRationale' }),
  Object.freeze({ selector: '[data-revc-review-note]', kind: 'reviewNote' }),
]);

function enabled(element) {
  return Boolean(element && !element.disabled && element.getAttribute?.('aria-disabled') !== 'true');
}

function selectionSnapshot(element) {
  if (!Number.isInteger(element?.selectionStart) || !Number.isInteger(element?.selectionEnd)) return null;
  return deepFreeze({
    start: element.selectionStart,
    end: element.selectionEnd,
    direction: element.selectionDirection ?? 'none',
  });
}

function keyedFocus(element) {
  if (element.matches?.('[data-revc-search]')) return { kind: 'scopeSearch', value: element.dataset.revcSearch };
  if (element.matches?.('[data-revc-branch-id]')) return { kind: 'branch', value: element.dataset.revcBranchId };
  if (element.matches?.('[data-revc-group]')) {
    return { kind: 'group', value: element.dataset.revcGroup, secondary: element.dataset.revcInclude };
  }
  const fixed = STATIC_FOCUS.find((item) => element.matches?.(item.selector));
  return fixed ? { kind: fixed.kind } : null;
}

function focusSnapshot(root) {
  const element = root?.ownerDocument?.activeElement;
  if (!element || !root.contains?.(element)) return null;
  const key = keyedFocus(element);
  if (!key) return null;
  return deepFreeze({ ...key, selection: selectionSnapshot(element) });
}

function scrollSnapshot(root) {
  return Object.freeze(SCROLL_SELECTORS.flatMap((selector) => {
    const element = root?.querySelector?.(selector);
    return element ? [deepFreeze({ selector, top: element.scrollTop, left: element.scrollLeft })] : [];
  }));
}

function findStatic(root, kind) {
  const item = STATIC_FOCUS.find((entry) => entry.kind === kind);
  return item ? root.querySelector(item.selector) : null;
}

function findKeyed(root, focus) {
  if (focus.kind === 'scopeSearch') {
    return [...root.querySelectorAll('[data-revc-search]')].find((item) => item.dataset.revcSearch === focus.value);
  }
  if (focus.kind === 'branch') {
    return [...root.querySelectorAll('[data-revc-branch-id]')].find((item) => item.dataset.revcBranchId === focus.value);
  }
  if (focus.kind === 'group') {
    return [...root.querySelectorAll('[data-revc-group]')].find((item) => item.dataset.revcGroup === focus.value
      && item.dataset.revcInclude === focus.secondary);
  }
  return findStatic(root, focus.kind);
}

function restoreSelection(element, selection) {
  if (!selection || typeof element?.setSelectionRange !== 'function') return;
  const length = String(element.value ?? '').length;
  element.setSelectionRange(Math.min(selection.start, length), Math.min(selection.end, length), selection.direction);
}

function restoreFocus(root, focus) {
  if (!focus) return false;
  const element = findKeyed(root, focus);
  if (!enabled(element)) return false;
  element.focus?.({ preventScroll: true });
  restoreSelection(element, focus.selection);
  return true;
}

function restoreScroll(root, scroll) {
  for (const position of scroll ?? []) {
    const element = root?.querySelector?.(position.selector);
    if (!element) continue;
    if (typeof element.scrollTo === 'function') element.scrollTo({ top: position.top, left: position.left, behavior: 'auto' });
    else { element.scrollTop = position.top; element.scrollLeft = position.left; }
  }
}

function rerenderEvent(event) {
  const target = event.target;
  if (event.type === 'input') {
    if (event.isComposing && target.matches?.('[data-revc-search]')) return false;
    return target.matches?.('[data-revc-search], [data-revc-queue-search], [data-revc-review-search]');
  }
  if (event.type === 'change') return target.matches?.('[data-revc-branch-id]');
  return event.type === 'click' && target.closest?.('[data-revc-group]');
}

function dispatchScopeChange(root, event) {
  if (event.type !== 'input' || event.isComposing || !event.target.matches?.('[data-revc-search]')) return;
  const EventConstructor = root.ownerDocument.defaultView.Event;
  event.target.dispatchEvent(new EventConstructor('change', { bubbles: true }));
}

function captureEvent(state, event) {
  if (!state.bound || !rerenderEvent(event)) return;
  state.snapshot = captureRevisionCompareInteraction(state.root);
  dispatchScopeChange(state.root, event);
}

function restoreMutation(state) {
  if (!state.bound || !state.snapshot) return;
  const snapshot = state.snapshot;
  state.snapshot = null;
  restoreRevisionCompareInteraction(state.root, snapshot);
}

export function captureRevisionCompareInteraction(root) {
  return deepFreeze({ focus: focusSnapshot(root), scroll: scrollSnapshot(root) });
}

export function restoreRevisionCompareInteraction(root, snapshot) {
  if (!snapshot) return false;
  const focused = restoreFocus(root, snapshot.focus);
  restoreScroll(root, snapshot.scroll);
  return focused;
}

export function bindRevisionCompareInteractionRetention(root, options = {}) {
  if (!root?.addEventListener) throw new TypeError('Revision Compare interaction-retention root is required.');
  const Observer = options.MutationObserver ?? root.ownerDocument.defaultView.MutationObserver;
  if (typeof Observer !== 'function') throw new TypeError('MutationObserver is required for interaction retention.');
  const state = { root, bound: true, snapshot: null, observer: null };
  const listener = (event) => captureEvent(state, event);
  for (const type of ['input', 'change', 'click']) root.addEventListener(type, listener, true);
  state.observer = new Observer(() => restoreMutation(state));
  state.observer.observe(root, { childList: true, subtree: true });
  return () => {
    if (!state.bound) return;
    state.bound = false;
    state.snapshot = null;
    state.observer.disconnect();
    for (const type of ['input', 'change', 'click']) root.removeEventListener(type, listener, true);
  };
}

export const _test = Object.freeze({
  captureEvent, dispatchScopeChange, enabled, findKeyed, focusSnapshot, keyedFocus,
  rerenderEvent, restoreFocus, restoreMutation, restoreSelection, scrollSnapshot,
});
