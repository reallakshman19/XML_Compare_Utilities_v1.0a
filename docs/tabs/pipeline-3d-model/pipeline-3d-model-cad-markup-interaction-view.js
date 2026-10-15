import {
  PipelineCadMarkupMode,
  PipelineCadMarkupStage,
} from './pipeline-3d-model-cad-markup-interaction-contracts.js';

const STYLE_ID = 'pipeline-cad-markup-interaction-style';
const MODE_LABELS = Object.freeze([
  [PipelineCadMarkupMode.MARKUP_SELECT, 'Markup Select'],
  [PipelineCadMarkupMode.DIMENSION_HORIZONTAL, 'H Dim'],
  [PipelineCadMarkupMode.DIMENSION_VERTICAL, 'V Dim'],
  [PipelineCadMarkupMode.DIMENSION_ALIGNED, 'Aligned Dim'],
  [PipelineCadMarkupMode.ANNOTATION, 'Note'],
]);

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-markup-interaction-layer{position:absolute;z-index:2;inset:0;pointer-events:none;touch-action:none;outline:none}
.p3d-cad-markup-interaction-layer[data-active="1"]{pointer-events:auto;cursor:crosshair}
.p3d-cad-markup-interaction-panel{position:fixed;z-index:6;left:12px;bottom:34px;width:min(360px,42vw);padding:8px;border:1px solid #475569;border-radius:8px;background:rgba(2,6,23,.96);color:#e2e8f0;font:11px sans-serif}
.p3d-cad-markup-interaction-panel[hidden]{display:none}.p3d-cad-markup-interaction-panel h3{margin:0 0 7px;font-size:12px}.p3d-cad-markup-interaction-panel label{display:grid;grid-template-columns:110px 1fr;gap:7px;align-items:center;margin:5px 0}.p3d-cad-markup-interaction-panel input,.p3d-cad-markup-interaction-panel select{min-width:0;border:1px solid #475569;border-radius:5px;background:#0f172a;color:#f8fafc;padding:4px 6px}.p3d-cad-markup-interaction-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.p3d-cad-markup-interaction-actions button{border:1px solid #475569;border-radius:5px;background:#1e293b;color:#e2e8f0;padding:4px 8px}.p3d-cad-markup-interaction-status{min-height:14px;margin-top:6px;overflow:hidden;color:#94a3b8;text-overflow:ellipsis;white-space:nowrap}.p3d-cad-markup-interaction-status[data-state="error"]{color:#fecaca}.p3d-cad-markup-tool-separator{width:1px;height:22px;background:#475569}
`;
  doc.head.appendChild(style);
}

function button(doc, label, dataset = {}) {
  const element = doc.createElement('button');
  element.type = 'button';
  element.textContent = label;
  Object.assign(element.dataset, dataset);
  return element;
}

function field(doc, form, labelText, name, input) {
  const label = doc.createElement('label');
  const text = doc.createElement('span');
  text.textContent = labelText;
  input.dataset.markupField = name;
  label.append(text, input);
  form.appendChild(label);
  return input;
}

function selectInput(doc, values, value) {
  const select = doc.createElement('select');
  values.forEach((item) => {
    const option = doc.createElement('option');
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
  select.value = value;
  return select;
}

function textInput(doc, value, maximum = null) {
  const input = doc.createElement('input');
  input.type = 'text';
  input.value = value || '';
  if (maximum) input.maxLength = maximum;
  return input;
}

function numberInput(doc, value) {
  const input = doc.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.value = String(Number(value) || 0);
  return input;
}

function createPanel(doc, className, label) {
  const section = doc.createElement('section');
  section.className = `p3d-cad-markup-interaction-panel ${className}`;
  section.setAttribute('aria-label', label);
  section.hidden = true;
  const heading = doc.createElement('h3');
  const form = doc.createElement('div');
  const actions = doc.createElement('div');
  actions.className = 'p3d-cad-markup-interaction-actions';
  const status = doc.createElement('div');
  status.className = 'p3d-cad-markup-interaction-status';
  status.setAttribute('aria-live', 'polite');
  section.append(heading, form, actions, status);
  return { section, heading, form, actions, status };
}

function createAnnotationPanel(doc) {
  const panel = createPanel(doc, 'p3d-cad-markup-annotation-panel', 'Pipeline CAD annotation placement');
  panel.heading.textContent = 'Place annotation';
  field(doc, panel.form, 'Text', 'annotationText', textInput(doc, '', 240));
  field(doc, panel.form, 'Alignment', 'annotationAlignment', selectInput(doc, ['LEFT', 'CENTER', 'RIGHT'], 'LEFT'));
  const enabled = doc.createElement('input'); enabled.type = 'checkbox';
  field(doc, panel.form, 'Leader', 'annotationLeaderEnabled', enabled);
  field(doc, panel.form, 'Leader dx', 'annotationLeaderDx', numberInput(doc, 0));
  field(doc, panel.form, 'Leader dy', 'annotationLeaderDy', numberInput(doc, 0));
  panel.commit = button(doc, 'Commit note', { markupAnnotationAction: 'commit' });
  panel.cancel = button(doc, 'Cancel', { markupAnnotationAction: 'cancel' });
  panel.actions.append(panel.commit, panel.cancel);
  return panel;
}

function createPropertyPanel(doc) {
  const panel = createPanel(doc, 'p3d-cad-markup-property-panel', 'Pipeline CAD markup properties');
  panel.apply = button(doc, 'Apply', { markupPropertyAction: 'apply' });
  panel.remove = button(doc, 'Delete selected', { markupPropertyAction: 'delete' });
  panel.undo = button(doc, 'Markup Undo', { markupPropertyAction: 'undo' });
  panel.redo = button(doc, 'Markup Redo', { markupPropertyAction: 'redo' });
  panel.actions.append(panel.apply, panel.remove, panel.undo, panel.redo);
  return panel;
}

function recordById(documentValue, id) {
  return documentValue?.dimensions?.find((item) => item.dimensionId === id)
    || documentValue?.annotations?.find((item) => item.annotationId === id)
    || null;
}

function renderDimensionFields(panel, record) {
  const doc = panel.form.ownerDocument;
  field(doc, panel.form, 'Offset', 'offset', numberInput(doc, record.offset));
  field(doc, panel.form, 'Label mode', 'labelMode', selectInput(doc, ['MEASURED', 'CUSTOM'], record.labelMode));
  field(doc, panel.form, 'Custom label', 'customLabel', textInput(doc, record.customLabel, 120));
}

function renderAnnotationFields(panel, record) {
  const doc = panel.form.ownerDocument;
  field(doc, panel.form, 'Text', 'text', textInput(doc, record.text, 240));
  field(doc, panel.form, 'Alignment', 'alignment', selectInput(doc, ['LEFT', 'CENTER', 'RIGHT'], record.alignment));
  const enabled = doc.createElement('input'); enabled.type = 'checkbox'; enabled.checked = record.leader.enabled;
  field(doc, panel.form, 'Leader', 'leaderEnabled', enabled);
  field(doc, panel.form, 'Leader dx', 'leaderDx', numberInput(doc, record.leader.dx));
  field(doc, panel.form, 'Leader dy', 'leaderDy', numberInput(doc, record.leader.dy));
}

function finiteField(panel, name) {
  const value = Number(panel.form.querySelector(`[data-markup-field="${name}"]`)?.value);
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return value;
}

function propertyPanelVisible(state, record, canUndo, canRedo) {
  if (state.stage === PipelineCadMarkupStage.PALETTE) return false;
  return Boolean(record || canUndo || canRedo);
}

export function mountPipelineCadMarkupInteractionView(options = {}) {
  const { dialog, stages } = options;
  if (!dialog?.ownerDocument || !stages?.table2x || !stages?.table3x) {
    throw new TypeError('Markup interaction view requires a dialog and both graph stages.');
  }
  const doc = dialog.ownerDocument;
  ensureStyle(doc);
  const layers = {};
  const modeButtons = [];
  const inserted = [];
  for (const graphName of ['table2x', 'table3x']) {
    const stage = stages[graphName];
    const layer = doc.createElement('div');
    layer.className = 'p3d-cad-markup-interaction-layer';
    layer.dataset.markupInteractionGraph = graphName;
    layer.tabIndex = -1;
    stage.appendChild(layer);
    layers[graphName] = layer;
    inserted.push(layer);
    const toolbar = stage.querySelector('.p3d-cad-toolbar');
    const separator = doc.createElement('span');
    separator.className = 'p3d-cad-markup-tool-separator';
    toolbar.appendChild(separator); inserted.push(separator);
    MODE_LABELS.forEach(([mode, label]) => {
      const control = button(doc, label, { markupMode: mode, markupGraph: graphName });
      control.setAttribute('aria-pressed', 'false');
      toolbar.appendChild(control); modeButtons.push(control); inserted.push(control);
    });
    const off = button(doc, 'Markup Off', { markupMode: 'OFF', markupGraph: graphName });
    toolbar.appendChild(off); modeButtons.push(off); inserted.push(off);
  }
  const annotation = createAnnotationPanel(doc);
  const property = createPropertyPanel(doc);
  dialog.append(annotation.section, property.section);
  inserted.push(annotation.section, property.section);
  let propertyKey = '';

  function render(state, documentValue, canUndo = false, canRedo = false) {
    modeButtons.forEach((control) => {
      const active = control.dataset.markupMode === state.mode && control.dataset.markupGraph === state.graph;
      control.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    Object.entries(layers).forEach(([graphName, layer]) => {
      const active = Boolean(state.mode && state.graph === graphName);
      layer.dataset.active = active ? '1' : '0';
      layer.tabIndex = active ? 0 : -1;
    });
    annotation.section.hidden = state.stage !== PipelineCadMarkupStage.PALETTE;
    const record = recordById(documentValue, state.selected?.id);
    const nextKey = record ? `${record.dimensionId || record.annotationId}:${record.revision}` : '';
    property.section.hidden = !propertyPanelVisible(state, record, canUndo, canRedo);
    property.apply.disabled = !record;
    property.remove.disabled = !record;
    property.undo.disabled = !canUndo;
    property.redo.disabled = !canRedo;
    if (nextKey !== propertyKey) {
      propertyKey = nextKey;
      property.form.replaceChildren();
      property.heading.textContent = record ? `${record.dimensionId ? 'Dimension' : 'Annotation'} · ${nextKey.split(':')[0]}` : 'Markup properties';
      if (record?.dimensionId) renderDimensionFields(property, record);
      if (record?.annotationId) renderAnnotationFields(property, record);
    }
    const feedback = state.feedback ? `${state.feedback.acquisitionMode} · ${state.feedback.identity}` : '';
    annotation.status.textContent = feedback;
    property.status.textContent = state.selected ? `${state.selected.status || 'ACTIVE'} · ${state.selected.graph}` : '';
  }

  function annotationPayload() {
    return {
      text: annotation.form.querySelector('[data-markup-field="annotationText"]').value,
      alignment: annotation.form.querySelector('[data-markup-field="annotationAlignment"]').value,
      leader: {
        enabled: annotation.form.querySelector('[data-markup-field="annotationLeaderEnabled"]').checked,
        dx: finiteField(annotation, 'annotationLeaderDx'),
        dy: finiteField(annotation, 'annotationLeaderDy'),
      },
    };
  }

  function selectedPatch(record) {
    if (record.dimensionId) return {
      offset: finiteField(property, 'offset'),
      labelMode: property.form.querySelector('[data-markup-field="labelMode"]').value,
      customLabel: property.form.querySelector('[data-markup-field="customLabel"]').value,
    };
    return {
      text: property.form.querySelector('[data-markup-field="text"]').value,
      alignment: property.form.querySelector('[data-markup-field="alignment"]').value,
      leader: {
        enabled: property.form.querySelector('[data-markup-field="leaderEnabled"]').checked,
        dx: finiteField(property, 'leaderDx'),
        dy: finiteField(property, 'leaderDy'),
      },
    };
  }

  return Object.freeze({
    layers,
    modeButtons: Object.freeze(modeButtons),
    annotation,
    property,
    render,
    annotationPayload,
    selectedPatch,
    setStatus(message, state = 'info') {
      const target = annotation.section.hidden ? property.status : annotation.status;
      target.textContent = String(message || '');
      target.dataset.state = state;
    },
    destroy() {
      inserted.reverse().forEach((element) => element.remove());
      return true;
    },
  });
}

export const _markupInteractionViewTest = Object.freeze({ recordById, finiteField, propertyPanelVisible });
