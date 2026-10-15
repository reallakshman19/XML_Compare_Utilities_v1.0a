/**
 * Dependency-free Excel-like grid for the update ledger: per-column filters
 * (text + distinct-value dropdown), header-click sort, editable cells,
 * fill-down (select a range in one column, Ctrl+D), and CSV copy. Rendering
 * is capped after filtering so multi-thousand-row ledgers stay responsive.
 */

const RENDER_CAP = 800;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function createUpdateLedgerGrid(host, { columns, onCellEdit, onRowFocus }) {
  let rows = [];
  let filters = {}; // key -> lowercase text
  let sortKey = '';
  let sortDir = 1;
  let anchor = null; // { rowIndex, key } within the visible set
  let focus = null;

  host.classList.add('ttv-ledger-grid');

  function visibleRows() {
    let result = rows.filter((row) => Object.entries(filters).every(([key, text]) => !text
      || String(row[key] ?? '').toLowerCase().includes(text)));
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const left = a[sortKey] ?? '', right = b[sortKey] ?? '';
        const numeric = Number(left) - Number(right);
        return (Number.isFinite(numeric) && String(Number(left)) === String(left) ? numeric : String(left).localeCompare(String(right))) * sortDir;
      });
    }
    return result;
  }

  function selectionRange(visible) {
    if (!anchor || !focus || anchor.key !== focus.key) return null;
    const [from, to] = [anchor.rowIndex, focus.rowIndex].sort((a, b) => a - b);
    return { key: anchor.key, from, to: Math.min(to, visible.length - 1) };
  }

  function render() {
    const visible = visibleRows();
    const range = selectionRange(visible);
    const inRange = (rowIndex, key) => range && key === range.key && rowIndex >= range.from && rowIndex <= range.to;
    const header = columns.map((column) => `
      <th style="width:${column.width ?? 'auto'}">
        <button type="button" data-ledger-sort="${column.key}">${esc(column.label)}${sortKey === column.key ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</button>
        <input type="text" data-ledger-filter="${column.key}" list="ttv-ledger-list-${column.key}" placeholder="filter" value="${esc(filters[column.key] ?? '')}">
        <datalist id="ttv-ledger-list-${column.key}">${[...new Set(rows.map((row) => String(row[column.key] ?? '')))].filter(Boolean).slice(0, 40).map((value) => `<option value="${esc(value)}"></option>`).join('')}</datalist>
      </th>`).join('');
    const body = visible.slice(0, RENDER_CAP).map((row, rowIndex) => `
      <tr data-ledger-row="${rowIndex}">
        ${columns.map((column) => `<td data-ledger-cell data-row="${rowIndex}" data-key="${column.key}"
          class="${column.editable ? 'is-editable' : ''} ${inRange(rowIndex, column.key) ? 'is-range' : ''}"
          title="${esc(row[column.key])}">${esc(row[column.key])}</td>`).join('')}
      </tr>`).join('');
    host.innerHTML = `
      <div class="ttv-ledger-toolbar">
        <span>${visible.length} of ${rows.length} update(s)${visible.length > RENDER_CAP ? ` · showing first ${RENDER_CAP}` : ''}</span>
        <button type="button" data-ledger-copy>Copy CSV</button>
        <button type="button" data-ledger-clear-filters>Clear filters</button>
        <span class="ttv-ledger-hint">Click cell → Shift-click below → Ctrl+D fills down (editable columns)</span>
      </div>
      <div class="ttv-ledger-scroll"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
    host.__visible = visible;
  }

  function commitEdit(cell, value) {
    const visible = host.__visible ?? [];
    const row = visible[Number(cell.dataset.row)];
    if (!row) return;
    row[cell.dataset.key] = value;
    onCellEdit?.(row, cell.dataset.key, value);
    render();
  }

  function beginEdit(cell) {
    const column = columns.find((item) => item.key === cell.dataset.key);
    if (!column?.editable) return;
    const current = cell.textContent;
    cell.innerHTML = `<input type="text" data-ledger-editor value="${esc(current)}">`;
    const editor = cell.querySelector('[data-ledger-editor]');
    editor.focus(); editor.select();
    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') editor.blur();
      if (event.key === 'Escape') { editor.value = current; editor.blur(); }
      event.stopPropagation();
    });
    editor.addEventListener('blur', () => commitEdit(cell, editor.value));
  }

  host.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const sort = target.closest('[data-ledger-sort]');
    if (sort) {
      const key = sort.getAttribute('data-ledger-sort');
      if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = 1; }
      render(); return;
    }
    if (target.closest('[data-ledger-copy]')) {
      import('./topology-update-ledger-model.js').then(({ updateLedgerCsv }) => {
        host.ownerDocument.defaultView.navigator.clipboard?.writeText(updateLedgerCsv(visibleRows()));
      });
      return;
    }
    if (target.closest('[data-ledger-clear-filters]')) { filters = {}; render(); return; }
    const cell = target.closest('[data-ledger-cell]');
    if (cell && !cell.querySelector('[data-ledger-editor]')) {
      const position = { rowIndex: Number(cell.dataset.row), key: cell.dataset.key };
      if (event.shiftKey && anchor && anchor.key === position.key) focus = position;
      else { anchor = position; focus = position; }
      const row = (host.__visible ?? [])[position.rowIndex];
      if (row && !event.shiftKey) onRowFocus?.(row);
      render();
    }
  });

  host.addEventListener('dblclick', (event) => {
    const cell = event.target instanceof Element ? event.target.closest('[data-ledger-cell]') : null;
    if (cell && !cell.querySelector('[data-ledger-editor]')) beginEdit(cell);
  });

  host.addEventListener('input', (event) => {
    const filter = event.target instanceof Element ? event.target.closest('[data-ledger-filter]') : null;
    if (!filter) return;
    filters = { ...filters, [filter.getAttribute('data-ledger-filter')]: filter.value.trim().toLowerCase() };
    const active = filter.getAttribute('data-ledger-filter');
    render();
    const restored = host.querySelector(`[data-ledger-filter="${active}"]`);
    if (restored) { restored.focus(); restored.setSelectionRange(restored.value.length, restored.value.length); }
  });

  host.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'd') return;
    const visible = host.__visible ?? [];
    const range = selectionRange(visible);
    const column = columns.find((item) => item.key === range?.key);
    if (!range || !column?.editable) return;
    event.preventDefault();
    const value = visible[range.from]?.[range.key] ?? '';
    for (let index = range.from + 1; index <= range.to; index += 1) {
      visible[index][range.key] = value;
      onCellEdit?.(visible[index], range.key, value);
    }
    render();
  });

  host.tabIndex = 0;

  return Object.freeze({
    setRows(next) { rows = next.map((row) => ({ ...row })); render(); },
    getRows() { return rows; },
    destroy() { host.innerHTML = ''; },
  });
}
