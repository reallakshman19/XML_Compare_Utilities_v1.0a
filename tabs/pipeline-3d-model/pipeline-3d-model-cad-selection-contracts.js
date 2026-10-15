export const PIPELINE_CAD_SELECTION_SCHEMA = 'PipelineCadSelection.v1';
export const PIPELINE_CAD_SELECTION_BOX_SCHEMA = 'PipelineCadSelectionBox.v1';

function itemKey(item) { return `${item?.id ?? ''}:${item?.type ?? ''}`; }
function freezeItem(item = {}) {
  const id = String(item.id || '');
  const type = String(item.type || '');
  return id && type ? Object.freeze({ id, type }) : null;
}

export function normalizePipelineCadSelectionItems(items = []) {
  const unique = new Map();
  for (const source of items || []) {
    const item = freezeItem(source);
    if (item) unique.set(itemKey(item), item);
  }
  return Object.freeze([...unique.values()]);
}

export function pipelineCadSelectionMode(event = {}) {
  return event.shiftKey || event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
}

export function updatePipelineCadSelection(current = [], candidates = [], mode = 'replace') {
  const incoming = normalizePipelineCadSelectionItems(candidates);
  if (mode === 'replace') return incoming;
  const next = new Map(normalizePipelineCadSelectionItems(current).map((item) => [itemKey(item), item]));
  for (const item of incoming) {
    const key = itemKey(item);
    if (mode === 'remove') next.delete(key);
    else if (mode === 'add') next.set(key, item);
    else if (next.has(key)) next.delete(key);
    else next.set(key, item);
  }
  return Object.freeze([...next.values()]);
}

export function createPipelineCadSelectionDetail(options = {}) {
  const items = normalizePipelineCadSelectionItems(options.items);
  const requested = String(options.primaryId || '');
  const primary = items.find((item) => item.id === requested) || items.at(-1) || null;
  const types = [...new Set(items.map((item) => item.type))];
  return Object.freeze({
    schema: PIPELINE_CAD_SELECTION_SCHEMA,
    graph: options.graph || null,
    items,
    entityIds: Object.freeze(items.map((item) => item.id)),
    primaryId: primary?.id || null,
    primaryType: primary?.type || null,
    entityId: primary?.id || null,
    entityType: primary?.type || null,
    count: items.length,
    homogeneousType: types.length === 1 ? types[0] : null,
    source: options.source || 'pointer',
    mode: options.mode || 'replace',
  });
}

export function normalizePipelineCadSelectionBox(start = {}, end = {}) {
  const x1 = Number(start.x) || 0; const y1 = Number(start.y) || 0;
  const x2 = Number(end.x) || 0; const y2 = Number(end.y) || 0;
  return Object.freeze({
    schema: PIPELINE_CAD_SELECTION_BOX_SCHEMA,
    start: Object.freeze({ x: x1, y: y1 }), end: Object.freeze({ x: x2, y: y2 }),
    left: Math.min(x1, x2), right: Math.max(x1, x2),
    top: Math.min(y1, y2), bottom: Math.max(y1, y2),
    direction: x2 >= x1 ? 'window' : 'crossing',
  });
}

function windowContains(box, point, radius) {
  return point.x - radius >= box.left && point.x + radius <= box.right
    && point.y - radius >= box.top && point.y + radius <= box.bottom;
}
function crossingTouches(box, point, radius) {
  return point.x + radius >= box.left && point.x - radius <= box.right
    && point.y + radius >= box.top && point.y - radius <= box.bottom;
}

export function selectPipelineCadItemsInBox(candidates = [], boxInput = {}, options = {}) {
  const box = boxInput.schema === PIPELINE_CAD_SELECTION_BOX_SCHEMA
    ? boxInput : normalizePipelineCadSelectionBox(boxInput.start, boxInput.end);
  const radius = Math.max(0, Number(options.radius) || 0);
  const selected = [];
  for (const candidate of candidates || []) {
    const point = options.toScreen ? options.toScreen(candidate) : candidate.screen;
    if (!point) continue;
    const matches = box.direction === 'window'
      ? windowContains(box, point, radius) : crossingTouches(box, point, radius);
    if (matches) selected.push({ id: candidate.id, type: candidate.type });
  }
  return normalizePipelineCadSelectionItems(selected);
}

export function partitionPipelineCadSelection(items = []) {
  const groups = new Map();
  for (const item of normalizePipelineCadSelectionItems(items)) {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  }
  return Object.freeze(Object.fromEntries([...groups].map(([type, values]) => [type, Object.freeze(values)])));
}
