import { buildWorkbenchViewportShellModel } from '../../core/workbench-viewport/index.js';
import { selectedUniversalRecord } from './universal-viewport-state.js';

export const UNIVERSAL_VIEWPORT_SHELL_MODEL_SCHEMA = 'universal-viewport-shell-model/v2';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];

function activeHost(hosts, mode) {
  return mode === 'pivot' ? hosts.pivot : hosts.tree;
}

function hiddenSelection(state, projections = {}) {
  const treeHidden = Boolean(state.selectedTreeId && projections.tree && !projections.tree.selectedVisible);
  const pivotHidden = Boolean(state.selectedPivotId && projections.pivot && !projections.pivot.selectedVisible);
  return freeze({ treeHidden, pivotHidden, any: treeHidden || pivotHidden });
}

function inspector(record, context, hidden) {
  if (!record) return freeze({ status: context.status, path: '—', level: '—', key: '—', block: '—', field: '—', value: '—', source: '—', hidden: false });
  return freeze({
    status: context.status,
    path: record.path || record.label || '—',
    level: record.level || record.levelId || '—',
    key: record.key || '—',
    block: record.block || '—',
    field: record.field || '—',
    value: record.value || '—',
    source: record.source || '—',
    hidden: hidden.any,
  });
}

export function createUniversalViewportShellModel(input = {}) {
  const state = input.state;
  const host = activeHost(input.hosts, state.mode);
  const projections = input.projections || {};
  const hidden = hiddenSelection(state, projections);
  const shell = buildWorkbenchViewportShellModel(host, {
    labels: { fit: 'Auto Fit', range: 'Custom Range', 'scale-ratio': 'Scale' },
    surfaces: [
      freeze({ id: 'tree', label: 'Tree' }),
      freeze({ id: 'pivot', label: 'Pivot' }),
    ],
    extensionActions: [
      { id: 'zoom-x-in', label: 'X +' },
      { id: 'zoom-x-out', label: 'X −' },
      { id: 'zoom-y-in', label: 'Y +' },
      { id: 'zoom-y-out', label: 'Y −' },
    ],
  });
  return freeze({
    schema: UNIVERSAL_VIEWPORT_SHELL_MODEL_SCHEMA,
    shell,
    mode: state.mode,
    modes: freeze([
      freeze({ id: 'tree', label: 'Tree' }),
      freeze({ id: 'pivot', label: 'Pivot' }),
      freeze({ id: 'side-by-side', label: 'Side by Side' }),
      freeze({ id: 'diagnostics', label: 'Diagnostics' }),
    ]),
    contextStatus: input.context.status,
    contextSignature: input.context.signature,
    diagnostics: input.context.diagnostics,
    exportLocked: true,
    inspector: inspector(selectedUniversalRecord(state), input.context, hidden),
    hiddenSelection: hidden,
    search: freeze({
      text: state.searchText || '',
      treeCount: projections.tree?.count ?? state.selectionIndex.treeItems.length,
      treeTotal: projections.tree?.total ?? state.selectionIndex.treeItems.length,
      pivotCount: projections.pivot?.count ?? state.selectionIndex.pivotItems.length,
      pivotTotal: projections.pivot?.total ?? state.selectionIndex.pivotItems.length,
    }),
    filters: freeze({
      tree: freeze({ ...state.treeFilters }),
      pivot: freeze({ ...state.pivotFilters }),
      options: freeze(input.filterOptions || {}),
    }),
    namedViews: freeze({
      selectedId: input.selectedNamedViewId || '',
      items: freeze(arr(input.namedViews)),
      diagnostics: freeze(arr(input.namedViewDiagnostics)),
    }),
  });
}

export const _test = freeze({ activeHost, hiddenSelection, inspector });
