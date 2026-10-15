const STYLE_ID = 'pipeline-cad-markup-style';
function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style'); style.id = STYLE_ID;
  style.textContent = `.p3d-cad-markup-panel{margin:8px 0;padding:8px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0}.p3d-cad-markup-panel h3{margin:0 0 6px;font-size:12px}.p3d-cad-markup-panel table{width:100%;border-collapse:collapse;font:10px ui-monospace,monospace}.p3d-cad-markup-panel th,.p3d-cad-markup-panel td{border:1px solid #334155;padding:4px 6px;text-align:left}.p3d-cad-markup-panel tr[data-status="ORPHANED"]{background:#451a1a;color:#fecaca}.p3d-cad-markup-panel tr[aria-selected="true"]{outline:2px solid #67e8f9;outline-offset:-2px}.p3d-cad-markup-empty{color:#94a3b8}`;
  doc.head.appendChild(style);
}
function cell(doc, value) {
  const td = doc.createElement('td'); td.textContent = String(value ?? ''); return td;
}
function renderRows(body, evidence, selectedId = '') {
  const doc = body.ownerDocument; body.replaceChildren();
  if (!evidence.length) {
    const row = doc.createElement('tr'); const empty = cell(doc, 'No persistent dimensions or annotations.');
    empty.colSpan = 7; empty.className = 'p3d-cad-markup-empty';
    row.appendChild(empty); body.appendChild(row); return;
  }
  evidence.forEach((item) => {
    const row = doc.createElement('tr');
    row.dataset.status = item.status;
    row.dataset.p3dCadMarkupId = item.id;
    row.tabIndex = 0;
    row.setAttribute('aria-selected', item.id === selectedId ? 'true' : 'false');
    [item.id, item.type, item.graph, item.textValue, item.authority, item.anchors, item.status]
      .forEach((value) => row.appendChild(cell(doc, value)));
    body.appendChild(row);
  });
}
export function mountPipelineCadMarkupView({ dialog, markup }) {
  if (!dialog?.ownerDocument || !markup) return null;
  const doc = dialog.ownerDocument; ensureStyle(doc);
  const section = doc.createElement('section');
  section.className = 'p3d-cad-markup-panel'; section.dataset.p3dCadMarkupPanel = '1';
  section.setAttribute('aria-label', 'Pipeline CAD persistent drawing evidence');
  const heading = doc.createElement('h3'); heading.textContent = 'Persistent drawing evidence';
  const table = doc.createElement('table'); const head = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['ID', 'Type', 'Graph', 'Text / value', 'Authority', 'Anchors', 'Status'].forEach((label) => {
    const th = doc.createElement('th'); th.scope = 'col'; th.textContent = label; headRow.appendChild(th);
  });
  head.appendChild(headRow); const body = doc.createElement('tbody');
  body.setAttribute('aria-live', 'polite'); table.append(head, body);
  section.append(heading, table); dialog.appendChild(section);
  let selectedId = '';
  let selectHandler = null;
  let destroyed = false;
  const render = () => renderRows(body, markup.getEvidence(), selectedId);
  const choose = (event) => {
    const row = event.target?.closest?.('[data-p3d-cad-markup-id]');
    if (!row || !section.contains(row)) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    selectHandler?.(row.dataset.p3dCadMarkupId);
  };
  body.addEventListener('click', choose);
  body.addEventListener('keydown', choose);
  const unsubscribe = markup.subscribe(render); render();
  return Object.freeze({
    element: section,
    render,
    setSelectHandler(handler) {
      if (handler !== null && typeof handler !== 'function') throw new TypeError('Markup select handler must be a function.');
      selectHandler = handler;
      return true;
    },
    setSelectedId(id) {
      const next = String(id || '');
      if (next === selectedId) return selectedId;
      selectedId = next;
      render();
      return selectedId;
    },
    destroy() {
      if (destroyed) return false; destroyed = true;
      unsubscribe();
      body.removeEventListener('click', choose);
      body.removeEventListener('keydown', choose);
      section.remove();
      selectHandler = null;
      return true;
    },
  });
}
export const _markupViewTest = Object.freeze({ renderRows });
