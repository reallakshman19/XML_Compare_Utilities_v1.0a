const STYLE_ID = 'pipeline-3d-cad-precision-style';

function ensureStyle(doc) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-precision{position:absolute;z-index:8;right:12px;top:52px;width:238px;padding:10px;border:1px solid #38bdf8;border-radius:8px;background:rgba(2,6,23,.96);color:#e2e8f0;box-shadow:0 12px 30px #0009;font:11px system-ui}.p3d-cad-precision[hidden]{display:none}.p3d-cad-precision h4{margin:0 0 7px;font-size:12px}.p3d-cad-precision-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.p3d-cad-precision label{display:flex;flex-direction:column;gap:3px}.p3d-cad-precision input,.p3d-cad-precision select{min-width:0;border:1px solid #475569;border-radius:5px;background:#0f172a;color:#f8fafc;padding:5px;font:11px monospace}.p3d-cad-precision-actions{display:flex;gap:5px;margin-top:8px}.p3d-cad-precision button{border:1px solid #475569;border-radius:5px;background:#1e293b;color:#e2e8f0;padding:5px 8px}.p3d-cad-precision button[data-action="apply"]{background:#0369a1}.p3d-cad-precision-status{min-height:16px;margin-top:6px;color:#94a3b8}.p3d-cad-precision-status[data-state="error"]{color:#fecaca}
`;
  doc.head.appendChild(style);
}

function panelHtml(name) {
  return `<aside class="p3d-cad-precision" data-p3d-cad-precision="${name}" hidden aria-label="Precision property editor">
  <h4 data-role="title">Precision edit</h4><div data-role="identity"></div>
  <div class="p3d-cad-precision-grid">
    <label>Coordinate mode<select data-field="coordinateMode"><option value="cumulative">Cumulative X</option><option value="absolute-h">Absolute H</option></select></label>
    <label>Input mode<select data-field="inputMode"><option value="absolute">Absolute</option><option value="relative">Relative</option></select></label>
    <label data-role="x-label"><span>X / Station</span><input data-field="x" inputmode="decimal"></label>
    <label data-role="y-label"><span>Y / Z</span><input data-field="y" inputmode="decimal"></label>
    <label data-role="label-field" style="grid-column:1/-1"><span>Marker label</span><input data-field="label"></label>
  </div>
  <div class="p3d-cad-precision-actions"><button type="button" data-action="apply">Apply</button><button type="button" data-action="reset">Reset</button><button type="button" data-action="cancel">Cancel</button></div>
  <div class="p3d-cad-precision-status" data-role="status" aria-live="polite"></div></aside>`;
}

const field = (panel, name) => panel.querySelector(`[data-field="${name}"]`);

function setText(panel, role, value) {
  const element = panel.querySelector(`[data-role="${role}"]`);
  const target = element?.querySelector?.('span') || element;
  if (target) target.textContent = value;
}

function setVisibility(panel, role, visible) {
  const element = panel.querySelector(`[data-role="${role}"]`);
  if (element) element.hidden = !visible;
}

function syncFields(panel, identity, before) {
  const table2 = identity.graph === 'table2x';
  const marker = identity.entityType === 'marker';
  const relative = field(panel, 'inputMode').value === 'relative';
  const absoluteH = field(panel, 'coordinateMode').value === 'absolute-h';
  field(panel, 'x').value = relative ? 0 : table2 ? before.station : absoluteH ? before.absoluteH : before.cumulative;
  field(panel, 'y').value = marker ? '' : relative ? 0 : table2 ? before.elevation : before.zText;
  field(panel, 'label').value = marker ? before.label : '';
}

function fill(panel, identity, before) {
  const table2 = identity.graph === 'table2x';
  const marker = identity.entityType === 'marker';
  panel.dataset.table2 = table2 ? '1' : '0';
  field(panel, 'coordinateMode').value = 'cumulative';
  field(panel, 'coordinateMode').disabled = table2;
  field(panel, 'inputMode').value = 'absolute';
  syncFields(panel, identity, before);
  setText(panel, 'title', marker ? 'Marker precision edit' : table2 ? 'Table 2 node precision edit' : 'Depth node precision edit');
  setText(panel, 'identity', `${identity.entityType} · ${identity.entityId}`);
  setText(panel, 'x-label', table2 ? 'Station' : 'Cumulative X / Absolute H');
  setText(panel, 'y-label', table2 ? 'Elevation' : 'Depth Z');
  setVisibility(panel, 'y-label', !marker);
  setVisibility(panel, 'label-field', marker);
}

class PipelineCadPrecisionView {
  constructor(stages) {
    const doc = stages?.table2x?.ownerDocument || globalThis.document;
    ensureStyle(doc);
    this.panels = {};
    for (const name of ['table2x', 'table3x']) {
      stages[name].insertAdjacentHTML('beforeend', panelHtml(name));
      this.panels[name] = stages[name].querySelector(`[data-p3d-cad-precision="${name}"]`);
    }
  }

  open(name, identity, before) {
    const panel = this.panels[name];
    fill(panel, identity, before);
    panel.hidden = false;
    this.status(name, 'Enter exact values or relative offsets.', '');
    return panel;
  }

  sync(name, identity, before) {
    syncFields(this.panels[name], identity, before);
  }

  close(name = null) {
    const targets = name ? [this.panels[name]] : Object.values(this.panels);
    targets.filter(Boolean).forEach((panel) => { panel.hidden = true; });
  }

  values(name) {
    const panel = this.panels[name];
    return Object.freeze({
      coordinateMode: field(panel, 'coordinateMode').value,
      inputMode: field(panel, 'inputMode').value,
      x: field(panel, 'x').value,
      y: field(panel, 'y').value,
      label: field(panel, 'label').value,
    });
  }

  status(name, message, state = '') {
    const element = this.panels[name]?.querySelector('[data-role="status"]');
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  }

  setDisabled(disabled) {
    Object.values(this.panels).forEach((panel) => panel.querySelectorAll('input,select,button').forEach((control) => {
      control.disabled = Boolean(disabled) || (control.dataset.field === 'coordinateMode' && panel.dataset.table2 === '1');
    }));
  }

  focus(name) {
    field(this.panels[name], 'x')?.focus?.();
  }

  destroy() {
    Object.values(this.panels).forEach((panel) => panel.remove());
  }
}

export function createPipelineCadPrecisionView(options = {}) {
  if (!options.stages?.table2x || !options.stages?.table3x) throw new TypeError('Precision view requires both stages.');
  return new PipelineCadPrecisionView(options.stages);
}

export const _test = Object.freeze({ panelHtml, syncFields });
