import {
  loadWorkbenchViewportState,
  saveWorkbenchViewportState,
} from '../../core/workbench-viewport/index.js';

export const UNIVERSAL_VIEWPORT_STATE_SCHEMA = 'universal-viewport-state/v2';
export const UNIVERSAL_VIEWPORT_UI_STORAGE_KEY = 'xmlBuilderViewportUiV1';
export const UNIVERSAL_VIEWPORT_MODES = Object.freeze(['tree', 'pivot', 'side-by-side', 'diagnostics']);

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const signatureText = (value) => text(value) || 'sample';

function normalizeMode(value) {
  return UNIVERSAL_VIEWPORT_MODES.includes(value) ? value : 'tree';
}

function normalizeFilters(value = {}, dimensions = []) {
  return Object.fromEntries(dimensions.map((name) => [name, text(value?.[name])]));
}

function normalizeAnchor(value = {}) {
  return { id: text(value?.id), offset: finite(value?.offset) };
}

export function treeViewIdentity(node = {}) {
  return text(node.nodeId) || `tree:${text(node.levelId || node.level)}:${text(node.key || node.path)}`;
}

export function pivotViewIdentity(row = {}, index = 0) {
  const parts = [row.path, row.level, row.key, row.block, row.field, row.source]
    .map(text).join('|');
  return `pivot:${parts || index}`;
}

function levelToken(value) {
  return text(value).toLowerCase().replace(/block$/, '');
}

export function createUniversalSelectionIndex(tree = {}, pivot = {}) {
  const treeItems = freeze(arr(tree.nodes).map((node, index) => freeze({
    id: treeViewIdentity(node), node, index,
  })));
  const pivotItems = freeze(arr(pivot.rows).map((row, index) => freeze({
    id: pivotViewIdentity(row, index), row, index,
  })));
  const treeByMatch = new Map();
  for (const item of treeItems) {
    const key = `${levelToken(item.node.levelId || item.node.level)}|${text(item.node.key)}`;
    if (!treeByMatch.has(key)) treeByMatch.set(key, item.id);
  }
  const pivotByTree = {};
  const treeByPivot = {};
  for (const item of pivotItems) {
    const key = `${levelToken(item.row.level)}|${text(item.row.key)}`;
    const treeId = treeByMatch.get(key) || '';
    treeByPivot[item.id] = treeId;
    if (treeId) (pivotByTree[treeId] ||= []).push(item.id);
  }
  return freeze({
    treeItems,
    pivotItems,
    treeItemById: freeze(Object.fromEntries(treeItems.map((item) => [item.id, item]))),
    pivotItemById: freeze(Object.fromEntries(pivotItems.map((item) => [item.id, item]))),
    treeByPivot: freeze(treeByPivot),
    pivotByTree: freeze(Object.fromEntries(Object.entries(pivotByTree)
      .map(([key, values]) => [key, freeze(values)]))),
  });
}

function uiKey(signature) {
  return `${UNIVERSAL_VIEWPORT_UI_STORAGE_KEY}/${encodeURIComponent(signatureText(signature))}`;
}

function readUi(signature, storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(uiKey(signature)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function createUniversalViewportState(input = {}) {
  const signature = signatureText(input.signature);
  const stored = readUi(signature, input.storage || globalThis.localStorage);
  return {
    schema: UNIVERSAL_VIEWPORT_STATE_SCHEMA,
    signature,
    mode: normalizeMode(stored.mode),
    selectedTreeId: text(stored.selectedTreeId),
    selectedPivotId: text(stored.selectedPivotId),
    searchText: text(stored.searchText),
    treeFilters: normalizeFilters(stored.treeFilters, ['level']),
    pivotFilters: normalizeFilters(stored.pivotFilters, ['level', 'block', 'source']),
    treeScrollAnchor: normalizeAnchor(stored.treeScrollAnchor),
    pivotScrollAnchor: normalizeAnchor(stored.pivotScrollAnchor),
    selectionIndex: createUniversalSelectionIndex(input.tree, input.pivot),
  };
}

export function persistUniversalViewportUiState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(uiKey(state.signature), JSON.stringify({
      mode: normalizeMode(state.mode),
      selectedTreeId: text(state.selectedTreeId),
      selectedPivotId: text(state.selectedPivotId),
      searchText: text(state.searchText),
      treeFilters: normalizeFilters(state.treeFilters, ['level']),
      pivotFilters: normalizeFilters(state.pivotFilters, ['level', 'block', 'source']),
      treeScrollAnchor: normalizeAnchor(state.treeScrollAnchor),
      pivotScrollAnchor: normalizeAnchor(state.pivotScrollAnchor),
    }));
  } catch {
    // Best-effort view-only persistence.
  }
}

export function viewportIdentity(signature, surfaceId) {
  return freeze({ namespace: 'xml-builder', modeId: signatureText(signature), surfaceId });
}

export function loadUniversalSurfaceState(signature, surfaceId, storage) {
  return loadWorkbenchViewportState(viewportIdentity(signature, surfaceId), storage);
}

export function saveUniversalSurfaceState(state, storage) {
  return saveWorkbenchViewportState(state, storage);
}

export function selectTreeIdentity(state, treeId) {
  state.selectedTreeId = text(treeId);
  state.selectedPivotId = state.selectionIndex.pivotByTree[state.selectedTreeId]?.[0] || '';
  return state;
}

export function selectPivotIdentity(state, pivotId) {
  state.selectedPivotId = text(pivotId);
  state.selectedTreeId = state.selectionIndex.treeByPivot[state.selectedPivotId] || '';
  return state;
}

export function selectedUniversalRecord(state) {
  const pivot = state.selectionIndex.pivotItemById[state.selectedPivotId];
  if (pivot) return freeze({ kind: 'pivot', ...pivot.row });
  const tree = state.selectionIndex.treeItemById[state.selectedTreeId];
  return tree ? freeze({ kind: 'tree', ...tree.node }) : null;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const _test = freeze({ normalizeMode, normalizeFilters, normalizeAnchor, levelToken, readUi, uiKey, signatureText });
