import { createUniversalVirtualController } from './universal-viewport-virtual-window.js';

export const UNIVERSAL_PIVOT_VIRTUAL_VIEW_SCHEMA = 'universal-pivot-virtual-view/v1';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderUniversalPivotVirtualRows(rows = [], context = {}, columns = []) {
  return rows.map((item, offset) => {
    const row = item.row;
    const sourceIndex = context.start + offset;
    const id = item.id;
    const selected = context.selectedId === id;
    const related = context.relatedIds?.has?.(id);
    const className = selected ? 'is-selected' : related ? 'is-related' : '';
    const cells = arr(columns).map((column) => `<span role="gridcell">${esc(row[String(column).toLowerCase()] ?? row[column] ?? '')}</span>`).join('');
    return `<div role="row" tabindex="${selected ? '0' : '-1'}" class="uxc-pivot-row ${className}" data-uxc-pivot-id="${esc(id)}" aria-rowindex="${sourceIndex + 1}" aria-selected="${selected}">${cells}</div>`;
  }).join('');
}

export function createUniversalPivotVirtualView(options = {}) {
  const columns = arr(options.columns);
  const identityFor = (item) => item.id;
  const controller = createUniversalVirtualController({
    ...options,
    idAttribute: 'data-uxc-pivot-id',
    identityFor,
    renderRows: (rows, context) => renderUniversalPivotVirtualRows(rows, context, columns),
    rowHeight: options.rowHeight || 34,
  });
  controller.setProjection(options.items || []);
  return freeze({ schema: UNIVERSAL_PIVOT_VIRTUAL_VIEW_SCHEMA, columns: freeze(columns), ...controller });
}

export const _test = freeze({ renderUniversalPivotVirtualRows });
