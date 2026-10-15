import {
  normalizeUniversalViewportSearch,
  universalViewportItemMatches,
} from './universal-viewport-search.js';

export const UNIVERSAL_VIEWPORT_PROJECTION_SCHEMA = 'universal-viewport-projection/v1';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const token = (value) => text(value).toLocaleLowerCase();

export function normalizeUniversalViewportFilters(value = {}, dimensions = []) {
  return freeze(Object.fromEntries(dimensions.map((name) => [name, text(value?.[name])] )));
}

function filterMatches(item, filters) {
  return Object.entries(filters).every(([name, value]) => !value
    || token(item.facets?.[name]) === token(value));
}

export function createUniversalViewportProjection(index, options = {}) {
  const dimensions = arr(options.dimensions);
  const search = normalizeUniversalViewportSearch(options.searchText);
  const filters = normalizeUniversalViewportFilters(options.filters, dimensions);
  const items = arr(index?.items).filter((item) => (
    universalViewportItemMatches(item, search) && filterMatches(item, filters)
  ));
  const ids = freeze(items.map((item) => item.id));
  const selectedId = text(options.selectedId);
  return freeze({
    schema: UNIVERSAL_VIEWPORT_PROJECTION_SCHEMA,
    surface: index?.surface || '',
    search,
    filters,
    items: freeze(items),
    rows: freeze(items.map((item) => item.row)),
    ids,
    total: arr(index?.items).length,
    count: items.length,
    selectedId,
    selectedVisible: !selectedId || ids.includes(selectedId),
  });
}

export function deriveUniversalViewportFilterOptions(index, dimensions = []) {
  return freeze(Object.fromEntries(arr(dimensions).map((name) => {
    const seen = new Map();
    for (const item of arr(index?.items)) {
      const value = text(item.facets?.[name]);
      const key = token(value);
      if (key && !seen.has(key)) seen.set(key, value);
    }
    const values = [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [name, freeze(values)];
  })));
}

export function projectionIdentityIndex(projection) {
  return new Map(arr(projection?.items).map((item, index) => [item.id, index]));
}

export const _test = freeze({ filterMatches, token });
