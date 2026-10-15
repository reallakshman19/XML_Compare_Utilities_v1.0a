export const UNIVERSAL_VIEWPORT_SEARCH_SCHEMA = 'universal-viewport-search/v1';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();

export function normalizeUniversalViewportSearch(value) {
  const normalized = text(value).replace(/\s+/g, ' ').toLocaleLowerCase();
  return freeze({
    text: normalized,
    tokens: freeze(normalized ? normalized.split(' ') : []),
  });
}

function scalarSearchValues(value) {
  if (value == null) return [];
  if (typeof value !== 'object') return [text(value)];
  if (Array.isArray(value)) return value.flatMap(scalarSearchValues);
  return Object.entries(value).flatMap(([key, item]) => [text(key), ...scalarSearchValues(item)]);
}

function treeValues(row = {}) {
  return [
    row.path,
    row.label,
    row.level,
    row.levelId,
    row.key,
    ...scalarSearchValues(row.fields),
  ];
}

function pivotValues(row = {}) {
  return [row.path, row.label, row.level, row.key, row.block, row.field, row.value, row.source];
}

function searchValues(surface, row) {
  return surface === 'pivot' ? pivotValues(row) : treeValues(row);
}

function facets(surface, row = {}) {
  if (surface === 'pivot') {
    return freeze({ level: text(row.level), block: text(row.block), source: text(row.source) });
  }
  return freeze({ level: text(row.level || row.levelId), block: '', source: '' });
}

export function createUniversalViewportSearchIndex(rows = [], options = {}) {
  const surface = options.surface === 'pivot' ? 'pivot' : 'tree';
  const identityFor = options.identityFor;
  if (typeof identityFor !== 'function') throw new TypeError('Search index requires identityFor().');
  const source = arr(rows);
  const items = source.map((row, index) => {
    const id = text(identityFor(row, index));
    const normalized = searchValues(surface, row).map(text).filter(Boolean)
      .join(' ').replace(/\s+/g, ' ').toLocaleLowerCase();
    return freeze({ id, row, index, searchText: normalized, facets: facets(surface, row) });
  });
  return freeze({
    schema: UNIVERSAL_VIEWPORT_SEARCH_SCHEMA,
    surface,
    rows: source,
    items: freeze(items),
  });
}

export function universalViewportItemMatches(item, search) {
  const tokens = arr(search?.tokens);
  return tokens.every((token) => item.searchText.includes(token));
}

export const _test = freeze({ scalarSearchValues, treeValues, pivotValues, facets, searchValues });
