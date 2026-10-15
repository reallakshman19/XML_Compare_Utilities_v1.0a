export const PipelineCadShortcut = Object.freeze({
  SELECT: 'select',
  ADD_NODE: 'add-node',
  ADD_MARKER: 'add-marker',
  DELETE_SELECTION: 'delete-selection',
  PAN: 'pan',
  FIT: 'fit',
  RELOAD: 'reload',
  UNDO: 'undo',
  REDO: 'redo',
  TOGGLE_GRID_SNAP: 'toggle-grid-snap',
  TOGGLE_STATION_SNAP: 'toggle-station-snap',
  TOGGLE_OBJECT_SNAP: 'toggle-object-snap',
});

export function isPipelineCadEditableTarget(target) {
  const tagName = String(target?.tagName || '').toLowerCase();
  return Boolean(target?.isContentEditable || ['input', 'textarea', 'select', 'button'].includes(tagName));
}

export function resolvePipelineCadShortcut(event, graphName) {
  if (!event || isPipelineCadEditableTarget(event.target)) return null;
  const key = String(event.key || '').toLowerCase();
  const modifier = Boolean(event.ctrlKey || event.metaKey);
  if (modifier && key === 'z') return event.shiftKey ? PipelineCadShortcut.REDO : PipelineCadShortcut.UNDO;
  if (modifier && key === 'y') return PipelineCadShortcut.REDO;
  if (modifier || event.altKey) return null;
  if (key === 'f3') return PipelineCadShortcut.TOGGLE_OBJECT_SNAP;
  if (key === 'v') return PipelineCadShortcut.SELECT;
  if (key === 'n') return PipelineCadShortcut.ADD_NODE;
  if (key === 'm' && graphName === 'table3x') return PipelineCadShortcut.ADD_MARKER;
  if (key === 'delete' || key === 'backspace' || key === 'x') return PipelineCadShortcut.DELETE_SELECTION;
  if (key === 'h') return PipelineCadShortcut.PAN;
  if (key === 'f') return PipelineCadShortcut.FIT;
  if (key === 'r') return PipelineCadShortcut.RELOAD;
  if (key === 'g') return PipelineCadShortcut.TOGGLE_GRID_SNAP;
  if (key === 's') return PipelineCadShortcut.TOGGLE_STATION_SNAP;
  return null;
}

export function pipelineCadShortcutLabel(action) {
  return Object.freeze({
    [PipelineCadShortcut.SELECT]: 'Select (V)',
    [PipelineCadShortcut.ADD_NODE]: 'Add node (N)',
    [PipelineCadShortcut.ADD_MARKER]: 'Add marker (M)',
    [PipelineCadShortcut.DELETE_SELECTION]: 'Delete selection (Delete)',
    [PipelineCadShortcut.PAN]: 'Pan (H)',
    [PipelineCadShortcut.FIT]: 'Fit (F)',
    [PipelineCadShortcut.RELOAD]: 'Reload graph (R)',
    [PipelineCadShortcut.UNDO]: 'Undo (Ctrl/Cmd+Z)',
    [PipelineCadShortcut.REDO]: 'Redo (Ctrl/Cmd+Shift+Z)',
    [PipelineCadShortcut.TOGGLE_GRID_SNAP]: 'Toggle grid snap (G)',
    [PipelineCadShortcut.TOGGLE_STATION_SNAP]: 'Toggle station snap (S)',
    [PipelineCadShortcut.TOGGLE_OBJECT_SNAP]: 'Toggle Object Snap (F3)',
  })[action] || '';
}
