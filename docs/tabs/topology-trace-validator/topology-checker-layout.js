/**
 * Modeless topology-checker panel layout manager.
 * Pointer drag/resize state is persisted in localStorage. Docked layouts use
 * deterministic CSS classes; reset removes the saved record.
 */

const STORAGE_KEY = 'xml-compare.topology-checker.layout.v1';
const DEFAULT_LAYOUT = Object.freeze({ mode: 'float', left: 40, top: 54, width: 620, height: 720, collapsed: false });

/** @param {Storage|null} storage @returns {Record<string,unknown>} */
function readLayout(storage) {
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_LAYOUT };
  const parsed = JSON.parse(raw);
  const mode = ['float', 'right', 'bottom'].includes(parsed.mode) ? parsed.mode : DEFAULT_LAYOUT.mode;
  return {
    mode, left: finite(parsed.left, DEFAULT_LAYOUT.left), top: finite(parsed.top, DEFAULT_LAYOUT.top),
    width: finite(parsed.width, DEFAULT_LAYOUT.width), height: finite(parsed.height, DEFAULT_LAYOUT.height),
    collapsed: parsed.collapsed === true,
  };
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }

/** @param {HTMLElement} panel @param {Record<string,unknown>} state @returns {void} */
function applyLayout(panel, state) {
  panel.dataset.layout = state.mode;
  panel.classList.toggle('is-collapsed', state.collapsed);
  panel.style.removeProperty('inset'); panel.style.removeProperty('right'); panel.style.removeProperty('bottom');
  if (state.mode === 'right') Object.assign(panel.style, { top: '0px', right: '0px', width: `${state.width}px`, height: '100%' });
  else if (state.mode === 'bottom') Object.assign(panel.style, { left: '0px', bottom: '0px', width: '100%', height: `${state.height}px` });
  else Object.assign(panel.style, { left: `${state.left}px`, top: `${state.top}px`, width: `${state.width}px`, height: `${state.height}px` });
  const collapseIcon = panel.querySelector('[data-ttv-checker-collapse] img');
  if (collapseIcon) collapseIcon.src = new URL(`../../vendor/lucide/icons/${state.collapsed ? 'chevron-down' : 'chevron-up'}.svg`, import.meta.url).href;
}

/** @param {HTMLElement} panel @param {Storage|null} storage @returns {Readonly<Record<string,Function>>} */
export function wireTopologyCheckerLayout(panel, storage) {
  let state = readLayout(storage), move = null;
  const persist = () => storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  const render = () => applyLayout(panel, state);
  const begin = (event, kind) => {
    if (kind === 'drag' && (event.target.closest('button') || state.mode !== 'float')) return;
    move = { kind, x: event.clientX, y: event.clientY, ...state };
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const update = (event) => {
    if (!move) return;
    const dx = event.clientX - move.x, dy = event.clientY - move.y;
    if (move.kind === 'drag') state = { ...state, left: Math.max(0, move.left + dx), top: Math.max(0, move.top + dy) };
    else if (state.mode === 'float') state = { ...state, width: Math.max(440, move.width + dx), height: Math.max(360, move.height + dy) };
    else if (state.mode === 'right') state = { ...state, width: Math.max(440, move.width - dx) };
    else state = { ...state, height: Math.max(300, move.height - dy) };
    render();
  };
  const end = () => { if (move) persist(); move = null; };
  const header = panel.querySelector('[data-ttv-checker-drag]'), resize = panel.querySelector('[data-ttv-checker-resize]');
  header.addEventListener('pointerdown', (event) => begin(event, 'drag'));
  resize.addEventListener('pointerdown', (event) => begin(event, 'resize'));
  panel.addEventListener('pointermove', update); panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
  render();
  return Object.freeze({
    setMode: (mode) => { state = mode === 'reset' ? { ...DEFAULT_LAYOUT } : { ...state, mode }; render(); persist(); },
    toggleCollapsed: () => { state = { ...state, collapsed: !state.collapsed }; render(); persist(); return state.collapsed; },
    reset: () => { storage?.removeItem(STORAGE_KEY); state = { ...DEFAULT_LAYOUT }; render(); },
    destroy: () => { header.replaceWith(header.cloneNode(true)); resize.replaceWith(resize.cloneNode(true)); },
  });
}

export const _test = Object.freeze({ STORAGE_KEY, DEFAULT_LAYOUT, readLayout, finite, applyLayout });
