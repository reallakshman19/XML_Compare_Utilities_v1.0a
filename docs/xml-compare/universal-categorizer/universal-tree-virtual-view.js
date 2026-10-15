import { createUniversalVirtualController } from './universal-viewport-virtual-window.js';

export const UNIVERSAL_TREE_VIRTUAL_VIEW_SCHEMA = 'universal-tree-virtual-view/v1';

const freeze = (value) => Object.freeze(value);
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderUniversalTreeVirtualRows(rows = [], context = {}) {
  return rows.map((item, offset) => {
    const node = item.row || item.node || {};
    const id = item.id;
    const selected = context.selectedId === id;
    const related = context.relatedIds?.has?.(id);
    const className = selected ? 'is-selected' : related ? 'is-related' : '';
    const rowIndex = context.start + offset + 1;
    return `<button type="button" role="row" tabindex="${selected ? '0' : '-1'}" class="uxc-tree-row ${className}" data-uxc-tree-id="${esc(id)}" data-depth="${esc(node.depth)}" style="--uxc-depth:${Number(node.depth) || 0}" aria-rowindex="${rowIndex}" aria-selected="${selected}"><span role="gridcell">${esc(node.level)}</span><b role="gridcell">${esc(node.label)}</b><small role="gridcell">${esc(node.key || 'root')}</small></button>`;
  }).join('');
}

export function createUniversalTreeVirtualView(options = {}) {
  const controller = createUniversalVirtualController({
    ...options,
    idAttribute: 'data-uxc-tree-id',
    identityFor: (item) => item.id,
    renderRows: renderUniversalTreeVirtualRows,
    rowHeight: options.rowHeight || 36,
  });
  controller.setProjection(options.items || []);
  return freeze({ schema: UNIVERSAL_TREE_VIRTUAL_VIEW_SCHEMA, ...controller });
}

export const _test = freeze({ renderUniversalTreeVirtualRows });
