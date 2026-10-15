export const ENGINEERING_SVG_PROPERTY_INSPECTOR_VIEW_SCHEMA = 'EngineeringSvgPropertyInspectorView.v1';

function element(documentRef, tag, attributes = {}) {
  const node = documentRef.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
  return node;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function valueText(row, state, value) {
  if (state === 'mixed') return 'Mixed';
  if (state === 'unavailable') return 'Unavailable for full selection';
  if (state === 'not-applicable') return 'Not applicable';
  if (value == null || value === '') return '—';
  if (row.field.type === 'boolean') return value ? 'Yes' : 'No';
  return `${value}${row.field.unit ? ` ${row.field.unit}` : ''}`;
}

function provenanceText(aggregate) {
  if (aggregate.state === 'mixed') return 'Mixed';
  if (aggregate.state === 'unavailable') return 'Unavailable for full selection';
  if (aggregate.state === 'not-applicable') return 'Not supplied';
  return aggregate.value === null ? 'Explicitly unavailable' : String(aggregate.value);
}

function displayText(row) { return valueText(row, row.display.state, row.display.value); }
function previousText(row) {
  return valueText(row, row.previousAuthoritative.state, row.previousAuthoritative.value);
}

function controlKind(row) {
  if (!row.field.editable || ['unavailable', 'not-applicable'].includes(row.display.state)) return 'readout';
  return row.field.type;
}

function hasProvenance(row) {
  return row.sourceEvidenceCount > 0 || row.previousSourceEvidenceCount > 0;
}

function hasComparisonLayout(row) {
  return row.previousEvidenceCount > 0 || hasProvenance(row);
}

function combinedProvenanceState(row) {
  const states = [row.previousSourceAuthoritative.state, row.sourceAuthoritative.state];
  if (states.includes('mixed')) return 'mixed';
  if (states.includes('unavailable')) return 'unavailable';
  if (states.includes('uniform')) return 'uniform';
  return 'not-applicable';
}

function option(documentRef, value, label, disabled = false) {
  const node = element(documentRef, 'option');
  node.value = value;
  node.textContent = label;
  node.disabled = disabled;
  return node;
}

function createControl(documentRef, row, onFieldEdit) {
  const kind = controlKind(row);
  if (kind === 'readout') return element(documentRef, 'output');
  if (kind === 'enum') {
    const select = element(documentRef, 'select');
    select.appendChild(option(documentRef, '', '— Select —', true));
    row.field.options.forEach((value) => select.appendChild(option(documentRef, value, value)));
    select.addEventListener('change', () => onFieldEdit(row.key, select.value));
    return select;
  }
  if (kind === 'boolean') {
    const checkbox = element(documentRef, 'input', { type: 'checkbox' });
    checkbox.addEventListener('change', () => onFieldEdit(row.key, checkbox.checked));
    return checkbox;
  }
  const input = element(documentRef, 'input', { type: kind === 'number' ? 'number' : 'text' });
  if (kind === 'number') {
    input.step = 'any';
    if (row.field.min != null) input.min = String(row.field.min);
    if (row.field.max != null) input.max = String(row.field.max);
  }
  input.addEventListener('input', () => {
    const value = kind === 'number' && input.value !== '' ? Number(input.value) : input.value;
    onFieldEdit(row.key, value);
  });
  return input;
}

function updateCurrentControl(documentRef, record, row) {
  const active = documentRef.activeElement === record.control;
  const state = row.display.state;
  if (record.kind === 'readout') record.control.textContent = displayText(row);
  else if (record.kind === 'boolean') {
    if (!active) record.control.checked = state === 'uniform' && row.display.value === true;
    record.control.indeterminate = state === 'mixed';
  } else if (!active) {
    record.control.value = state === 'uniform' && row.display.value != null ? String(row.display.value) : '';
    record.control.placeholder = state === 'mixed' ? 'Mixed' : '';
  }
  record.control.disabled = record.kind === 'readout';
  record.control.setAttribute('aria-invalid', row.valid ? 'false' : 'true');
}

function comparisonText(state) {
  return ({
    'not-applicable': 'No previous evidence',
    unavailable: 'Previous/current evidence unavailable',
    mixed: 'Previous/current evidence is mixed',
    unchanged: 'Previous and Current are unchanged',
    changed: 'Previous and Current changed',
  })[state] || 'Previous/current evidence unavailable';
}

function updateProvenance(record, row) {
  if (!record.previousSource || !record.currentSource) return;
  const previous = row.previousSourceAuthoritative;
  const current = row.sourceAuthoritative;
  record.previousSource.textContent = `Source: ${provenanceText(previous)}`;
  record.currentSource.textContent = `Source: ${provenanceText(current)}`;
  record.previousSource.setAttribute('data-engineering-svg-property-provenance-state', previous.state);
  record.currentSource.setAttribute('data-engineering-svg-property-provenance-state', current.state);
  record.root.setAttribute('data-engineering-svg-property-provenance-state', combinedProvenanceState(row));
}

function updateControl(documentRef, record, row) {
  updateCurrentControl(documentRef, record, row);
  record.root.setAttribute('data-engineering-svg-property-state', row.display.state);
  record.root.setAttribute('data-engineering-svg-property-dirty', row.dirty ? 'true' : 'false');
  record.root.setAttribute('data-engineering-svg-property-valid', row.valid ? 'true' : 'false');
  record.root.setAttribute('data-engineering-svg-property-comparison', row.comparisonState);
  if (record.previousOutput) {
    record.previousOutput.textContent = previousText(row);
    record.previousGroup.setAttribute('data-engineering-svg-property-state', row.previousAuthoritative.state);
    record.currentGroup.setAttribute('data-engineering-svg-property-state', row.display.state);
    record.comparison.textContent = comparisonText(row.comparisonState);
  }
  updateProvenance(record, row);
  clearChildren(record.messages);
  row.messages.forEach((message) => {
    const item = element(documentRef, 'li');
    item.textContent = message;
    record.messages.appendChild(item);
  });
}

function safeId(value) { return String(value).replace(/[^a-z0-9_-]/gi, '-'); }
function fieldLabel(row) {
  return row.field.unit ? `${row.field.label} (${row.field.unit})` : row.field.label;
}

function createMessages(documentRef, row, messagesId) {
  return element(documentRef, 'ul', {
    id: messagesId,
    'data-engineering-svg-property-messages': row.key,
  });
}

function createLegacyRow(documentRef, row, onFieldEdit, ids) {
  const label = element(documentRef, 'label');
  label.setAttribute('for', ids.controlId);
  label.textContent = fieldLabel(row);
  const control = createControl(documentRef, row, onFieldEdit);
  control.id = ids.controlId;
  control.setAttribute('aria-describedby', ids.messagesId);
  control.setAttribute('data-engineering-svg-property-control', row.key);
  return { label, control, kind: controlKind(row), comparisonLayout: false, provenanceLayout: false };
}

function sourceOutput(documentRef, row, side) {
  const attribute = side === 'previous'
    ? 'data-engineering-svg-property-previous-source'
    : 'data-engineering-svg-property-current-source';
  return element(documentRef, 'output', {
    [attribute]: row.key,
    'aria-label': `${side === 'previous' ? 'Previous' : 'Current'} ${row.field.label} source`,
  });
}

function createComparisonRow(documentRef, row, onFieldEdit, ids) {
  const heading = element(documentRef, 'div', { 'data-engineering-svg-property-label': row.key });
  heading.textContent = fieldLabel(row);
  const comparison = element(documentRef, 'p', { 'data-engineering-svg-property-comparison-text': row.key });
  const previousGroup = element(documentRef, 'div', { 'data-engineering-svg-property-previous': row.key });
  const previousLabel = element(documentRef, 'span');
  previousLabel.textContent = 'Previous';
  const previousOutput = element(documentRef, 'output', { tabindex: '-1', 'aria-label': `Previous ${row.field.label}` });
  previousGroup.append(previousLabel, previousOutput);
  const currentGroup = element(documentRef, 'div', { 'data-engineering-svg-property-current': row.key });
  const currentLabel = element(documentRef, 'label');
  currentLabel.setAttribute('for', ids.controlId);
  currentLabel.textContent = 'Current';
  const control = createControl(documentRef, row, onFieldEdit);
  control.id = ids.controlId;
  control.setAttribute('aria-describedby', ids.messagesId);
  control.setAttribute('data-engineering-svg-property-control', row.key);
  currentGroup.append(currentLabel, control);
  const provenanceLayout = hasProvenance(row);
  const previousSource = provenanceLayout ? sourceOutput(documentRef, row, 'previous') : null;
  const currentSource = provenanceLayout ? sourceOutput(documentRef, row, 'current') : null;
  if (previousSource) previousGroup.appendChild(previousSource);
  if (currentSource) currentGroup.appendChild(currentSource);
  return {
    heading, comparison, previousGroup, previousOutput, previousSource, currentGroup, currentSource,
    control, kind: controlKind(row), comparisonLayout: true, provenanceLayout,
  };
}

function createRow(documentRef, row, onFieldEdit, idPrefix) {
  const root = element(documentRef, 'div', { 'data-engineering-svg-property-key': row.key });
  const token = `${safeId(idPrefix)}-${safeId(row.key)}`;
  const ids = { controlId: `${token}-control`, messagesId: `${token}-messages` };
  const comparisonLayout = hasComparisonLayout(row);
  const record = comparisonLayout
    ? createComparisonRow(documentRef, row, onFieldEdit, ids)
    : createLegacyRow(documentRef, row, onFieldEdit, ids);
  const messages = createMessages(documentRef, row, ids.messagesId);
  if (comparisonLayout) root.append(record.heading, record.comparison, record.previousGroup, record.currentGroup, messages);
  else root.append(record.label, record.control, messages);
  return { root, messages, ...record };
}

function placeRows(rowsHost, orderedRecords) {
  orderedRecords.forEach((record, index) => {
    const current = rowsHost.children[index] || null;
    if (current !== record.root) rowsHost.insertBefore(record.root, current);
  });
}

export function createEngineeringSvgPropertyInspectorView(options = {}) {
  const host = options.host;
  if (!host?.ownerDocument?.createElement) throw new TypeError('Property inspector view requires a DOM host.');
  const documentRef = host.ownerDocument;
  const idPrefix = String(options.idPrefix || 'engineering-svg-inspector');
  const rowsHost = element(documentRef, 'div', { 'data-engineering-svg-property-rows': '1' });
  const heading = element(documentRef, 'h2', { 'data-engineering-svg-inspector-heading': '1' });
  const summary = element(documentRef, 'p', { 'data-engineering-svg-inspector-summary': '1' });
  const actions = element(documentRef, 'div', { 'data-engineering-svg-inspector-actions': '1' });
  const apply = element(documentRef, 'button', { type: 'button', 'data-engineering-svg-apply': '1' });
  const cancel = element(documentRef, 'button', { type: 'button', 'data-engineering-svg-cancel': '1' });
  apply.textContent = 'Apply';
  cancel.textContent = 'Cancel';
  actions.append(apply, cancel);
  host.append(heading, summary, rowsHost, actions);
  const records = new Map();
  let currentModel = null;
  let busy = false;
  const onFieldEdit = (key, value) => options.onFieldEdit?.(key, value);
  apply.addEventListener('click', () => options.onApply?.());
  cancel.addEventListener('click', () => options.onCancel?.());

  function render(model) {
    currentModel = model;
    heading.textContent = model.selectedIds.length
      ? `Properties — ${model.selectedIds.join(', ')}`
      : 'Properties — no selection';
    summary.textContent = `${model.rows.length} fields · ${model.dirtyCount} staged · ${model.invalidCount} invalid`;
    const present = new Set();
    const orderedRecords = model.rows.map((row) => {
      present.add(row.key);
      const expectedKind = controlKind(row);
      const expectedComparison = hasComparisonLayout(row);
      const expectedProvenance = hasProvenance(row);
      let record = records.get(row.key);
      if (!record || record.kind !== expectedKind
        || record.comparisonLayout !== expectedComparison
        || record.provenanceLayout !== expectedProvenance) {
        record?.root.remove();
        record = createRow(documentRef, row, onFieldEdit, idPrefix);
        records.set(row.key, record);
      }
      updateControl(documentRef, record, row);
      return record;
    });
    records.forEach((record, key) => {
      if (!present.has(key)) { record.root.remove(); records.delete(key); }
    });
    placeRows(rowsHost, orderedRecords);
    apply.disabled = busy || !model.applyEligible;
    cancel.disabled = busy || model.dirtyCount === 0;
    return model;
  }

  return Object.freeze({
    schema: ENGINEERING_SVG_PROPERTY_INSPECTOR_VIEW_SCHEMA,
    render,
    getModel: () => currentModel,
    getControl: (key) => records.get(key)?.control || null,
    getApplyButton: () => apply,
    getCancelButton: () => cancel,
    setBusy(value) { busy = value === true; if (currentModel) render(currentModel); },
    destroy() {
      records.clear(); heading.remove(); summary.remove(); rowsHost.remove(); actions.remove();
    },
  });
}
