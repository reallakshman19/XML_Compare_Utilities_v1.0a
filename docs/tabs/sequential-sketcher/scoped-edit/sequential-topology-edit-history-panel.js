/** Explicit topology split undo/redo controls backed by the structural journal cursor. */
export const SEQUENTIAL_TOPOLOGY_EDIT_HISTORY_PANEL_SCHEMA =
  'SequentialTopologyEditHistoryPanel.v1';
function markup() {
  return `<section data-ssk-topology-history hidden><span data-ssk-topology-history-state></span>
<button type="button" data-ssk-topology-undo>Undo split</button>
<button type="button" data-ssk-topology-redo>Redo split</button></section>`;
}
function render(state) {
  const journal = state.boundary.readJournal(); state.panel.hidden = !state.active;
  state.panel.querySelector('[data-ssk-topology-history-state]').textContent =
    `Split history ${journal.cursor}/${journal.entries.length}`;
  state.panel.querySelector('[data-ssk-topology-undo]').disabled = journal.cursor === 0;
  state.panel.querySelector('[data-ssk-topology-redo]').disabled = journal.cursor >= journal.entries.length;
}
export function createSequentialTopologyEditHistoryPanel(options = {}) {
  const host = options.root.querySelector('[data-ssk-visual-stack]');
  if (!host) throw new Error('Topology history requires the visual stack.');
  if (!options.root.querySelector('[data-ssk-topology-history]')) host.insertAdjacentHTML('beforeend', markup());
  const state = { panel: options.root.querySelector('[data-ssk-topology-history]'),
    boundary: options.boundary, active: false, onChanged: options.onChanged, onClick: null };
  if (!state.boundary?.undo || typeof state.onChanged !== 'function') {
    throw new TypeError('Topology history requires boundary and change callback.');
  }
  state.panel.style.cssText = 'position:absolute;left:12px;bottom:12px;z-index:13;padding:8px;border:1px solid rgba(148,163,184,.4);border-radius:8px;background:rgba(7,16,31,.95);color:#e2e8f0';
  state.onClick = (event) => {
    if (event.target.closest?.('[data-ssk-topology-undo]')) state.boundary.undo();
    else if (event.target.closest?.('[data-ssk-topology-redo]')) state.boundary.redo();
    else return;
    event.preventDefault(); state.onChanged(); render(state);
  };
  state.panel.addEventListener('click', state.onClick); render(state);
  return Object.freeze({ schema: SEQUENTIAL_TOPOLOGY_EDIT_HISTORY_PANEL_SCHEMA,
    setActive(value) { state.active = value === true; render(state); }, refresh: () => render(state),
    getState() { const journal = state.boundary.readJournal(); return Object.freeze({
      active: state.active, cursor: journal.cursor, entryCount: journal.entries.length }); },
    destroy() { state.panel.removeEventListener('click', state.onClick);
      state.panel.remove(); return true; } });
}
