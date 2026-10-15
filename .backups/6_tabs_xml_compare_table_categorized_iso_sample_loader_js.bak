import {
  ISO_NOTE_RECIPE_PROFILE,
  ISO_NOTE_TABLE_1_SAMPLE,
  ISO_NOTE_TABLE_2_SAMPLE,
} from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import {
  buildXmlArtifactFromTable,
  createConnectorPreviewByKey,
  createXmlCompareSourceHandoff,
  loadTableXmlRecipe,
  saveTableXmlRecipe,
} from '../xml-compare/table-categorizer/table-categorized-xml-recipe-workflow.js';

export const TABLE_CATEGORIZED_ISO_SAMPLE_LOADER_SCHEMA = 'table-categorized-iso-sample-loader/v5-s1-s2-send-controls';
export const ISO_SAMPLE_ACTION = 'load-isorecipe-full-rev-editable-template-sample';

const PANEL_ATTR = 'data-table-categorized-iso-sample-panel';
const BUTTON_ATTR = 'data-table-categorized-iso-sample-loader';
const FIELD_ATTR = 'data-table-categorized-iso-sample-field';
const HANDOFF_ATTR = 'data-table-categorized-s1-s2-handoff-controls';
const HANDOFF_STATUS_ATTR = 'data-table-categorized-s1-s2-handoff-status';
const STYLE_ID = 'table-categorized-iso-sample-style';
const ACTIVE_SOURCE_SELECTOR = '[data-table-categorized-active-source]';
const SOURCE_TEXT_SELECTOR = '[data-table-categorized-source-text]';
const SOURCE_NAME_SELECTOR = '[data-table-categorized-source-name]';
const DELIMITER_SELECTOR = '[data-table-categorized-delimiter-mode]';
const ACTION_SELECTOR = '[data-table-categorized-action]';

export function createIsoRecipeTemplateState({ table1Text = ISO_NOTE_TABLE_1_SAMPLE, table2Text = ISO_NOTE_TABLE_2_SAMPLE, recipeProfile = ISO_NOTE_RECIPE_PROFILE } = {}) {
  const saved = saveTableXmlRecipe(recipeProfile, {
    recipeId: recipeProfile.profileId || 'ISOrecipe',
    displayName: recipeProfile.displayName || 'ISOrecipe',
    connectorKeyField: recipeProfile.connectorKeyField || 'connectorKey',
    notes: ['Editable template sample: Rev 1 and Rev 2 full tables remain user-editable before XML generation.'],
  });
  return Object.freeze({
    table1Text,
    table2Text,
    savedRecipeJson: saved.json,
    savedRecipe: saved.recipe,
  });
}

export function buildIsoRecipeSampleWorkflow(input = createIsoRecipeTemplateState()) {
  const template = normalizeWorkflowInput(input);
  const recipe = template.savedRecipe || loadTableXmlRecipe(template.savedRecipeJson);
  const sourceAArtifact = buildXmlArtifactFromTable({
    tableText: template.table1Text,
    sourceId: 'SourceA',
    sourceName: 'Rev 1 Table / Source A',
    recipe,
    delimiterMode: 'tab',
  });
  const sourceBArtifact = buildXmlArtifactFromTable({
    tableText: template.table2Text,
    sourceId: 'SourceB',
    sourceName: 'Rev 2 Table / Target B',
    recipe,
    delimiterMode: 'tab',
  });
  const sourceA = createXmlCompareSourceHandoff(sourceAArtifact, { side: 'sourceA', sourceLabel: 'Source A' });
  const sourceB = createXmlCompareSourceHandoff(sourceBArtifact, { side: 'sourceB', sourceLabel: 'Target B' });
  const connectorKey = sourceAArtifact.records?.find((record) => record.connectorKey === 'SL-14143')?.connectorKey || sourceAArtifact.records?.[0]?.connectorKey || sourceBArtifact.records?.[0]?.connectorKey || 'SL-14143';
  const connector = createConnectorPreviewByKey(sourceA, sourceB, connectorKey);
  return Object.freeze({
    schema: 'IsoRecipeSampleWorkflow.v5',
    savedRecipe: recipe,
    savedRecipeJson: template.savedRecipeJson,
    table1Text: template.table1Text,
    table2Text: template.table2Text,
    sourceAArtifact,
    sourceBArtifact,
    sourceA,
    sourceB,
    connector,
    diagnostics: Object.freeze([
      ...(sourceAArtifact.validationResults || []),
      ...(sourceBArtifact.validationResults || []),
      ...(sourceA.diagnostics || []),
      ...(sourceB.diagnostics || []),
      ...(connector.diagnostics || []),
    ]),
  });
}

export function renderIsoRecipeSamplePanel(workflow = buildIsoRecipeSampleWorkflow()) {
  const a = findRecord(workflow.sourceAArtifact, 'SL-14143') || workflow.sourceAArtifact?.records?.[0] || {};
  const b = findRecord(workflow.sourceBArtifact, 'SL-14143') || workflow.sourceBArtifact?.records?.[0] || {};
  const connector = workflow.connector?.preview || null;
  const issues = workflow.connector?.diagnostics?.length || workflow.diagnostics?.filter((item) => ['BLOCKER', 'ERROR'].includes(item?.severity)).length || 0;
  return `<div class="table-categorized-shell-side-card" ${PANEL_ATTR}="IsoRecipeSampleWorkflow.v5">
    <h4>ISOrecipe Editable Template Sample</h4>
    <p><b>Recipe = template.</b> Edit Rev 1, Rev 2, or the ISOrecipe JSON, then rebuild. Outputs are generated from edited full tables, not from hardcoded result defaults.</p>
    <div class="table-categorized-xml-actions" data-table-categorized-iso-sample-icons="true">
      <button type="button" ${BUTTON_ATTR}="load-table1-source" title="Load full Rev 1 table into the app source table slot">📥 Load Table 1 as Source A</button>
      <button type="button" ${BUTTON_ATTR}="load-table2-target" title="Create/select the second app source slot and load full Rev 2 table as target">📤 Load Table 2 as Target B</button>
      <button type="button" ${BUTTON_ATTR}="send-s1-source" title="Convert loaded table S1 and send it to XML Compare Source A">➡️ Send S1 as Source A</button>
      <button type="button" ${BUTTON_ATTR}="send-s2-target" title="Convert loaded table S2 and send it to XML Compare Target B">➡️ Send S2 as Target B</button>
    </div>
    <label>Rev 1 full table → XML1 → Source A<textarea ${FIELD_ATTR}="table1" rows="10">${escapeHtml(workflow.table1Text)}</textarea></label>
    <label>Rev 2 full table → XML2 → Target B<textarea ${FIELD_ATTR}="table2" rows="10">${escapeHtml(workflow.table2Text)}</textarea></label>
    <details open>
      <summary>ISOrecipe template JSON</summary>
      <textarea ${FIELD_ATTR}="recipe" rows="10">${escapeHtml(workflow.savedRecipeJson)}</textarea>
    </details>
    <div class="table-categorized-xml-actions">
      <button type="button" ${BUTTON_ATTR}="rebuild">Confirm / Rebuild XML1 + XML2</button>
      <button type="button" ${BUTTON_ATTR}="download-recipe">Download ISOrecipe JSON</button>
      <button type="button" ${BUTTON_ATTR}="download-xml1">Download XML1</button>
      <button type="button" ${BUTTON_ATTR}="download-xml2">Download XML2</button>
      <button type="button" ${BUTTON_ATTR}="download-handoff">Download Source A/B Handoff JSON</button>
    </div>
    <table>
      <thead><tr><th>Side</th><th>Rows</th><th>connectorKey</th><th>Revision</th><th>Guide Gap</th></tr></thead>
      <tbody>
        <tr><td>Source A / XML1</td><td>${escapeHtml(workflow.sourceAArtifact?.source?.rows?.length || 0)}</td><td>${escapeHtml(a.connectorKey)}</td><td>${escapeHtml(a.fields?.revision)}</td><td>${escapeHtml(a.fields?.guideGapMm)} mm</td></tr>
        <tr><td>Target B / XML2</td><td>${escapeHtml(workflow.sourceBArtifact?.source?.rows?.length || 0)}</td><td>${escapeHtml(b.connectorKey)}</td><td>${escapeHtml(b.fields?.revision)}</td><td>${escapeHtml(b.fields?.guideGapMm)} mm</td></tr>
      </tbody>
    </table>
    <p><b>Connector preview:</b> ${connector ? `${escapeHtml(connector.sourceUid)} → ${escapeHtml(connector.targetUid)}` : 'not available'}${issues ? ` (${issues} issue(s))` : ''}</p>
    <p><small>The S1/S2 send buttons convert the loaded table source slot to XML using ISOrecipe and place it into the XML Compare Source/Target file inputs.</small></p>
  </div>`;
}

export function injectIsoRecipeSampleLoader(doc = globalThis.document) {
  if (!doc?.querySelector) return false;
  const popup = doc.querySelector('[data-xml-compare-table-categorized-popup]');
  if (!popup || popup.querySelector(`[${BUTTON_ATTR}="open"]`)) return false;
  const templateHeader = [...popup.querySelectorAll('h4')].find((node) => node.textContent?.trim() === 'Load Template');
  const container = templateHeader?.parentElement;
  if (!container) return false;
  const button = doc.createElement('button');
  button.type = 'button';
  button.setAttribute(BUTTON_ATTR, 'open');
  button.textContent = '📘 Load ISOrecipe Full Rev Tables';
  const fieldComparisonButton = container.querySelector('[data-table-categorized-action="load-field-comparison-sample"]');
  if (fieldComparisonButton) fieldComparisonButton.insertAdjacentElement('afterend', button);
  else container.append(button);
  return true;
}

export function injectSourceTargetHandoffControls(doc = globalThis.document) {
  if (!doc?.querySelector) return false;
  const popup = doc.querySelector('[data-xml-compare-table-categorized-popup]');
  if (!popup || popup.querySelector(`[${HANDOFF_ATTR}]`)) return false;
  const side = popup.querySelector('.table-categorized-shell-side');
  if (!side) return false;
  const card = doc.createElement('div');
  card.className = 'table-categorized-shell-side-card';
  card.setAttribute(HANDOFF_ATTR, 'true');
  card.innerHTML = `<h4>XML Compare Source / Target</h4>
    <p>Convert loaded table slots independently and send them to XML Compare.</p>
    <div class="table-categorized-xml-actions">
      <button type="button" ${BUTTON_ATTR}="send-s1-source">➡️ Send Table S1 as Source A</button>
      <button type="button" ${BUTTON_ATTR}="send-s2-target">➡️ Send Table S2 as Target B</button>
    </div>
    <p ${HANDOFF_STATUS_ATTR}>Load S1/S2, then send to Source/Target.</p>`;
  side.append(card);
  return true;
}

export function injectIsoRecipeLayoutStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    textarea[data-table-categorized-source-text] {
      min-height: 360px;
      height: min(54vh, 560px);
      resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      line-height: 1.35;
      white-space: pre;
    }
    .table-categorized-shell-paste textarea[data-table-categorized-source-text] {
      width: 100%;
    }
  `;
  doc.head.append(style);
  return true;
}

export function showIsoRecipeSamplePanel(doc = globalThis.document, workflow = buildIsoRecipeSampleWorkflow()) {
  const popup = doc?.querySelector?.('[data-xml-compare-table-categorized-popup]');
  if (!popup) return false;
  popup.querySelector(`[${PANEL_ATTR}]`)?.remove();
  const side = popup.querySelector('.table-categorized-shell-side .table-categorized-shell-side-card') || popup.querySelector('.table-categorized-shell-side');
  if (!side) return false;
  side.insertAdjacentHTML('afterend', renderIsoRecipeSamplePanel(workflow));
  return true;
}

export function handleIsoRecipeSampleClick(event, doc = globalThis.document) {
  const button = event.target?.closest?.(`[${BUTTON_ATTR}]`);
  if (!button) return false;
  event.preventDefault();
  const action = button.getAttribute(BUTTON_ATTR);
  if (action === 'open') return showIsoRecipeSamplePanel(doc);
  if (action === 'load-table1-source') return loadIsoTableIntoRuntime(doc, { side: 'sourceA', sourceName: 'Rev 1 Table / Source A', tableText: ISO_NOTE_TABLE_1_SAMPLE, panelField: 'table1' });
  if (action === 'load-table2-target') return loadIsoTableIntoRuntime(doc, { side: 'targetB', sourceName: 'Rev 2 Table / Target B', tableText: ISO_NOTE_TABLE_2_SAMPLE, panelField: 'table2' });
  if (action === 'send-s1-source') return sendRuntimeSourceToXmlCompare(doc, { sourceId: 'S1', targetSide: 'a' });
  if (action === 'send-s2-target') return sendRuntimeSourceToXmlCompare(doc, { sourceId: 'S2', targetSide: 'b' });
  if (action === 'rebuild') return showIsoRecipeSamplePanel(doc, workflowFromPanel(doc));
  const workflow = workflowFromPanel(doc);
  if (action === 'download-recipe') return downloadText('ISOrecipe.json', workflow.savedRecipeJson, 'application/json;charset=utf-8', doc);
  if (action === 'download-xml1') return downloadText('ISOrecipe-SourceA.xml', workflow.sourceAArtifact.xmlText, 'application/xml;charset=utf-8', doc);
  if (action === 'download-xml2') return downloadText('ISOrecipe-TargetB.xml', workflow.sourceBArtifact.xmlText, 'application/xml;charset=utf-8', doc);
  if (action === 'download-handoff') return downloadText('ISOrecipe-source-target-handoff.json', JSON.stringify({ sourceA: workflow.sourceA, targetB: workflow.sourceB, connector: workflow.connector }, null, 2), 'application/json;charset=utf-8', doc);
  return false;
}

export function workflowFromPanel(doc = globalThis.document) {
  const panel = doc?.querySelector?.(`[${PANEL_ATTR}]`);
  if (!panel) return buildIsoRecipeSampleWorkflow();
  const table1Text = readField(panel, 'table1') || ISO_NOTE_TABLE_1_SAMPLE;
  const table2Text = readField(panel, 'table2') || ISO_NOTE_TABLE_2_SAMPLE;
  const savedRecipeJson = readField(panel, 'recipe') || createIsoRecipeTemplateState().savedRecipeJson;
  return buildIsoRecipeSampleWorkflow({ table1Text, table2Text, savedRecipeJson });
}

export function loadIsoTableIntoRuntime(doc = globalThis.document, { side = 'sourceA', sourceName = '', tableText = '', panelField = 'table1' } = {}) {
  const panel = doc?.querySelector?.(`[${PANEL_ATTR}]`);
  if (panel) {
    const target = panel.querySelector(`[${FIELD_ATTR}="${panelField}"]`);
    if (target) target.value = tableText;
  }
  const targetSecondSource = side === 'targetB';
  const run = () => {
    if (targetSecondSource && !hasSecondSourceOption(doc)) {
      const added = clickRuntimeAction(doc, 'add-source');
      if (!added) return false;
      defer(() => selectAndFillRuntimeSource(doc, { targetSecondSource, sourceName, tableText }));
      return true;
    }
    return selectAndFillRuntimeSource(doc, { targetSecondSource, sourceName, tableText });
  };
  return run();
}

export function sendRuntimeSourceToXmlCompare(doc = globalThis.document, { sourceId = 'S1', targetSide = 'a' } = {}) {
  const select = doc?.querySelector?.(ACTIVE_SOURCE_SELECTOR);
  if (!select) return setHandoffStatus(doc, 'Table source selector was not found.', false);
  const option = [...select.options].find((item) => (item.value || item.textContent || '') === sourceId);
  if (!option) return setHandoffStatus(doc, `Table ${sourceId} was not found. Add/load that source first.`, false);
  if (select.value !== sourceId) {
    select.value = sourceId;
    dispatchDomEvent(select, 'change');
  }
  defer(() => sendActiveRuntimeSourceToXmlCompare(doc, { sourceId, targetSide }));
  return true;
}

function sendActiveRuntimeSourceToXmlCompare(doc, { sourceId = 'S1', targetSide = 'a' } = {}) {
  const text = String(doc?.querySelector?.(SOURCE_TEXT_SELECTOR)?.value || '');
  const sourceName = String(doc?.querySelector?.(SOURCE_NAME_SELECTOR)?.value || sourceId);
  if (!text.trim()) return setHandoffStatus(doc, `Table ${sourceId} is empty.`, false);
  let recipe;
  try {
    const panelRecipe = readField(doc?.querySelector?.(`[${PANEL_ATTR}]`) || doc, 'recipe');
    recipe = loadTableXmlRecipe(panelRecipe || createIsoRecipeTemplateState().savedRecipeJson);
  } catch (error) {
    return setHandoffStatus(doc, `ISOrecipe JSON is invalid: ${String(error?.message || error)}`, false);
  }
  const artifact = buildXmlArtifactFromTable({
    tableText: text,
    sourceId: targetSide === 'b' ? 'SourceB' : 'SourceA',
    sourceName,
    recipe,
    delimiterMode: 'tab',
  });
  if (!artifact?.exportResult?.ok) {
    const first = artifact?.exportResult?.diagnostics?.[0]?.message || artifact?.validationResults?.[0]?.message || 'XML export failed.';
    return setHandoffStatus(doc, `${sourceId} could not be exported: ${first}`, false);
  }
  const input = doc?.querySelector?.(`input[data-xml-compare-load="${targetSide === 'b' ? 'b' : 'a'}"]`);
  if (!input) return setHandoffStatus(doc, `XML Compare ${targetSide === 'b' ? 'Target B' : 'Source A'} file input was not found.`, false);
  const ok = setInputFile(input, artifactFile(artifact, { sourceId, targetSide }), doc);
  if (!ok) return setHandoffStatus(doc, 'Browser file handoff API is unavailable.', false);
  return setHandoffStatus(doc, `Sent table ${sourceId} to XML Compare ${targetSide === 'b' ? 'Target B' : 'Source A'}.`, true);
}

function selectAndFillRuntimeSource(doc, { targetSecondSource = false, sourceName = '', tableText = '' } = {}) {
  const select = doc?.querySelector?.(ACTIVE_SOURCE_SELECTOR);
  if (select) {
    const optionValues = [...select.options].map((option) => option.value || option.textContent || '');
    const preferred = targetSecondSource ? (optionValues.find((value) => value === 'S2') || optionValues[1] || optionValues.at(-1)) : (optionValues.find((value) => value === 'S1') || optionValues[0]);
    if (preferred && select.value !== preferred) {
      select.value = preferred;
      dispatchDomEvent(select, 'change');
      defer(() => fillActiveRuntimeSource(doc, { sourceName, tableText }));
      return true;
    }
  }
  return fillActiveRuntimeSource(doc, { sourceName, tableText });
}

function fillActiveRuntimeSource(doc, { sourceName = '', tableText = '' } = {}) {
  const nameInput = doc?.querySelector?.(SOURCE_NAME_SELECTOR);
  const textArea = doc?.querySelector?.(SOURCE_TEXT_SELECTOR);
  const delimiter = doc?.querySelector?.(DELIMITER_SELECTOR);
  if (!textArea) return false;
  if (nameInput) {
    nameInput.value = sourceName;
    dispatchDomEvent(nameInput, 'input');
  }
  if (delimiter) {
    delimiter.value = 'tab';
    dispatchDomEvent(delimiter, 'change');
  }
  defer(() => {
    const freshTextArea = doc?.querySelector?.(SOURCE_TEXT_SELECTOR);
    if (!freshTextArea) return;
    freshTextArea.value = tableText;
    dispatchDomEvent(freshTextArea, 'input');
    clickRuntimeAction(doc, 'parse');
    defer(() => showIsoRecipeSamplePanel(doc, workflowFromPanel(doc)));
  });
  return true;
}

function hasSecondSourceOption(doc) {
  const select = doc?.querySelector?.(ACTIVE_SOURCE_SELECTOR);
  return Boolean(select && select.options && select.options.length > 1);
}

function clickRuntimeAction(doc, action) {
  const button = [...(doc?.querySelectorAll?.(`${ACTION_SELECTOR}[data-table-categorized-action="${action}"]`) || [])].find((item) => !item.disabled);
  if (!button) return false;
  button.click();
  return true;
}

function setInputFile(input, file, doc = globalThis.document) {
  const view = doc?.defaultView || globalThis;
  const Transfer = view.DataTransfer || globalThis.DataTransfer;
  if (!Transfer || !file) return false;
  const transfer = new Transfer();
  transfer.items.add(file);
  input.files = transfer.files;
  dispatchDomEvent(input, 'change');
  return true;
}

function artifactFile(artifact, { sourceId = 'S1', targetSide = 'a' } = {}) {
  const view = globalThis;
  const FileCtor = view.File || Blob;
  const name = targetSide === 'b' ? `table_${sourceId}_target.xml` : `table_${sourceId}_source.xml`;
  return new FileCtor([artifact.xmlText], name, { type: 'application/xml' });
}

function setHandoffStatus(doc, message, ok = true) {
  const status = doc?.querySelector?.(`[${HANDOFF_STATUS_ATTR}]`);
  if (status) {
    status.textContent = message;
    status.dataset.status = ok ? 'ok' : 'error';
  }
  return ok;
}

function dispatchDomEvent(node, type) {
  const view = node?.ownerDocument?.defaultView || globalThis;
  const EventCtor = view.Event || Event;
  node.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true }));
}

function defer(callback) {
  if (typeof queueMicrotask === 'function') queueMicrotask(callback);
  else setTimeout(callback, 0);
}

function normalizeWorkflowInput(input = {}) {
  if (input.savedRecipeJson || input.savedRecipe) return input;
  return createIsoRecipeTemplateState(input);
}

function readField(container, name) {
  return String(container?.querySelector?.(`[${FIELD_ATTR}="${name}"]`)?.value || '');
}

function findRecord(artifact, connectorKey) {
  return (artifact?.records || []).find((record) => record.connectorKey === connectorKey) || null;
}

function downloadText(name, text, type, doc = globalThis.document) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  doc.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function installIsoRecipeSampleLoader(doc = globalThis.document) {
  if (!doc?.addEventListener) return false;
  injectIsoRecipeLayoutStyle(doc);
  doc.addEventListener('click', (event) => handleIsoRecipeSampleClick(event, doc), { capture: true });
  injectIsoRecipeSampleLoader(doc);
  injectSourceTargetHandoffControls(doc);
  if (typeof MutationObserver !== 'undefined' && doc.body) {
    new MutationObserver(() => {
      injectIsoRecipeLayoutStyle(doc);
      injectIsoRecipeSampleLoader(doc);
      injectSourceTargetHandoffControls(doc);
    }).observe(doc.body, { childList: true, subtree: true });
  }
  return true;
}

installIsoRecipeSampleLoader();
