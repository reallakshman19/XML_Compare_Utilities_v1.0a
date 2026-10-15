export const UNIVERSAL_NAMED_VIEW_SCHEMA = 'xml-builder-viewport-named-view/v1';
export const UNIVERSAL_NAMED_VIEWS_SCHEMA = 'xml-builder-viewport-named-views/v1';
export const UNIVERSAL_NAMED_VIEWS_STORAGE_KEY = 'xmlBuilderViewportNamedViewsV1';
export const UNIVERSAL_NAMED_VIEW_MAX_NAME = 80;

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLocaleLowerCase();

function storageKey(signature) {
  return `${UNIVERSAL_NAMED_VIEWS_STORAGE_KEY}/${encodeURIComponent(text(signature) || 'sample')}`;
}

function normalizeTransform(value = {}) {
  return freeze({
    zoomX: positive(value.zoomX, 1), zoomY: positive(value.zoomY, 1),
    panX: finite(value.panX), panY: finite(value.panY),
    scaleMode: text(value.scaleMode) || 'auto-fit',
    customRange: normalizeRange(value.customRange),
    crosshair: value.crosshair !== false,
  });
}

function normalizeRange(value) {
  if (!value || typeof value !== 'object') return null;
  const range = { minX: Number(value.minX), maxX: Number(value.maxX), minY: Number(value.minY), maxY: Number(value.maxY) };
  return Object.values(range).every(Number.isFinite) && range.maxX > range.minX && range.maxY > range.minY ? freeze(range) : null;
}

function normalizeAnchor(value = {}) {
  return freeze({ id: text(value.id), offset: finite(value.offset) });
}

function normalizeFilters(value = {}, dimensions = []) {
  return freeze(Object.fromEntries(dimensions.map((name) => [name, text(value?.[name])] )));
}

function validateName(value) {
  const name = text(value).replace(/\s+/g, ' ');
  if (!name) throw new TypeError('Named view name is required.');
  if (name.length > UNIVERSAL_NAMED_VIEW_MAX_NAME) throw new TypeError(`Named view name must be ${UNIVERSAL_NAMED_VIEW_MAX_NAME} characters or fewer.`);
  return name;
}

export function createUniversalNamedViewSnapshot(input = {}) {
  return freeze({
    mode: ['tree', 'pivot', 'side-by-side', 'diagnostics'].includes(input.mode) ? input.mode : 'tree',
    searchText: text(input.searchText),
    treeFilters: normalizeFilters(input.treeFilters, ['level']),
    pivotFilters: normalizeFilters(input.pivotFilters, ['level', 'block', 'source']),
    treeTransform: normalizeTransform(input.treeTransform),
    pivotTransform: normalizeTransform(input.pivotTransform),
    treeScrollAnchor: normalizeAnchor(input.treeScrollAnchor),
    pivotScrollAnchor: normalizeAnchor(input.pivotScrollAnchor),
    selectedTreeId: text(input.selectedTreeId),
    selectedPivotId: text(input.selectedPivotId),
  });
}

function normalizeView(value = {}, fallbackOrder = 0) {
  const name = validateName(value.name);
  return freeze({
    schema: UNIVERSAL_NAMED_VIEW_SCHEMA,
    id: text(value.id) || `view-${fallbackOrder + 1}`,
    name,
    order: Math.max(0, Math.floor(finite(value.order, fallbackOrder))),
    ...createUniversalNamedViewSnapshot(value),
  });
}

function readCollection(signature, storage) {
  const diagnostics = [];
  try {
    const raw = storage?.getItem?.(storageKey(signature));
    if (!raw) return { views: [], diagnostics };
    const parsed = JSON.parse(raw);
    if (parsed?.schema !== UNIVERSAL_NAMED_VIEWS_SCHEMA || !Array.isArray(parsed.views)) throw new TypeError('Unsupported named-view storage schema.');
    const views = parsed.views.map((view, index) => normalizeView(view, index)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return { views, diagnostics };
  } catch (error) {
    diagnostics.push(freeze({ severity: 'warn', code: 'XMLB_NAMED_VIEWS_STORAGE_INVALID', message: error instanceof Error ? error.message : String(error) }));
    return { views: [], diagnostics };
  }
}

function writeCollection(signature, views, storage) {
  const payload = { schema: UNIVERSAL_NAMED_VIEWS_SCHEMA, views };
  storage?.setItem?.(storageKey(signature), JSON.stringify(payload));
}

export function createUniversalNamedViewStore(options = {}) {
  const signature = text(options.signature) || 'sample';
  const storage = options.storage || globalThis.localStorage;
  const initial = readCollection(signature, storage);
  let views = initial.views;
  let diagnostics = initial.diagnostics;

  function persist(next) {
    views = next.map((view, index) => normalizeView({ ...view, order: index }, index));
    try { writeCollection(signature, views, storage); diagnostics = []; }
    catch (error) { diagnostics = [freeze({ severity: 'warn', code: 'XMLB_NAMED_VIEWS_WRITE_FAILED', message: error instanceof Error ? error.message : String(error) })]; }
    return list();
  }

  function list() { return freeze(views.map((view) => freeze({ ...view }))); }
  function find(id) { return views.find((view) => view.id === text(id)) || null; }

  return freeze({
    schema: UNIVERSAL_NAMED_VIEWS_SCHEMA,
    signature,
    key: storageKey(signature),
    list,
    diagnostics: () => freeze([...diagnostics]),
    get: (id) => find(id),
    save(name, snapshot) {
      const validName = validateName(name);
      if (views.some((view) => lower(view.name) === lower(validName))) throw new TypeError('Named view names must be unique within this dataset.');
      const order = views.length;
      const id = `view-${order + 1}-${lower(validName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'named'}`;
      return persist([...views, normalizeView({ id, name: validName, order, ...snapshot }, order)]);
    },
    rename(id, name) {
      const current = find(id);
      if (!current) throw new TypeError('Named view was not found.');
      const validName = validateName(name);
      if (views.some((view) => view.id !== current.id && lower(view.name) === lower(validName))) throw new TypeError('Named view names must be unique within this dataset.');
      return persist(views.map((view) => view.id === current.id ? { ...view, name: validName } : view));
    },
    delete(id) {
      if (!find(id)) return false;
      persist(views.filter((view) => view.id !== text(id)));
      return true;
    },
  });
}

function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function positive(value, fallback = 1) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }

export const _test = freeze({ storageKey, normalizeTransform, normalizeAnchor, normalizeFilters, validateName, normalizeView, readCollection });
