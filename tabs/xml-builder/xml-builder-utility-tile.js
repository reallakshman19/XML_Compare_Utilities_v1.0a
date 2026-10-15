import { buildXmlCiiCustomInputXml } from '../../converters/xml-cii2019-core/custom-input-api.js';
import {
  bindXmlCiiCustomInputPanel,
  getXmlCiiCustomInputState,
  renderXmlCiiCustomInputPanel,
  saveXmlCiiCustomInputState,
} from '../model-converters/custom-input/custom-input-panel.js';
import { buildInputXmlFromNodeXml } from '../model-converters/xml-cii-node-to-inputxml-core.js';
import { renderXmlCiiTopology5BPanel } from '../model-converters/xml-cii-topology-5b-panel.js';

/**
 * Utility-popup XML Builder.
 * Inputs: custom branch/node/DTXR/support/coordinate tables.
 * Outputs: node XML, Caesar InputXML, and topology canvas geometry.
 * Fallback: build errors are shown inline and table text remains editable.
 */

const ACTIVATE = 'click';
const STYLE_ID = 'xml-builder-utility-style';
const OUTPUT_STORE = 'xmlBuilder.outputs.v1';
const POPUP_TITLE_ID = 'xml-builder-utility-title';
const TOPOLOGY_STATE_KEY = '__xmlCiiTopology5BNativeState';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function readOutputs() {
  try { return JSON.parse(localStorage.getItem(OUTPUT_STORE) || '{}'); } catch { return {}; }
}

function saveOutputs(outputs) {
  try { localStorage.setItem(OUTPUT_STORE, JSON.stringify(outputs)); } catch {}
}

function ensureStyle(doc = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.xml-builder-launcher{height:160px;width:220px;border:1px solid rgba(125,211,252,.32);border-radius:16px;background:#111827;color:#e5eefb;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.25);display:grid!important;grid-template-columns:1fr;place-items:center;text-align:center;padding:16px;margin-top:18px;gap:5px;box-sizing:border-box}.xml-builder-launcher-icon{display:block;font-size:40px;line-height:1;margin:0 0 6px}.xml-builder-launcher b{font-size:15px;color:#e0f2fe}.xml-builder-launcher span{color:#9fb3ca;font-size:12px;line-height:1.35}
.xml-builder-backdrop{position:fixed;inset:0;z-index:96;display:grid;place-items:center;padding:20px;background:rgba(2,6,23,.78);box-sizing:border-box}.xml-builder-dialog{width:min(1500px,calc(100vw - 34px));height:min(920px,calc(100vh - 34px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(125,211,252,.36)!important;border-radius:14px!important;background:#0f172a!important;color:#dbeafe;box-shadow:0 24px 80px rgba(0,0,0,.56)}.xml-builder-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.18);background:#111827}.xml-builder-head b{font-size:16px;color:#f8fafc}.xml-builder-head span{display:block;color:#9fb3ca;font-size:12px;margin-top:3px}.xml-builder-close{background:#1f2937;color:#e5eefb;border:1px solid rgba(148,163,184,.34);border-radius:8px;padding:7px 10px;cursor:pointer;font-size:12px}.xml-builder-body{min-height:0;overflow:auto;padding:12px}
.xml-builder-root{display:grid;gap:12px}.xml-builder-grid{display:grid;grid-template-columns:minmax(380px,1fr) minmax(380px,1fr);gap:12px;align-items:start}.xml-builder-output,.xml-builder-root textarea{box-sizing:border-box}.xml-builder-output{width:100%;min-height:260px;font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#07101f;color:#e6edf5;border:1px solid rgba(148,163,184,.35);border-radius:8px;padding:8px}.xml-cii-native-card{border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:10px;margin-bottom:10px;background:#111827}.xml-cii-native-toolbar,.xml-cii-native-master-tabs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.model-converters-run-btn,.model-converters-download-btn,.xml-cii-native-master-tab{background:#1f2937;color:#e5eefb;border:1px solid rgba(148,163,184,.34);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px}.xml-cii-native-master-tab.is-active,.model-converters-run-btn{background:#1d4ed8;border-color:#2563eb;color:#fff}.model-converters-workflow-detail-title,.model-converters-workflow-section-title{font-size:12px;font-weight:700;color:#dbeafe;text-transform:uppercase;letter-spacing:.04em}.model-converters-workflow-detail-text,.xml-cii-native-hint{font-size:12px;color:#9fb3ca;line-height:1.4}.xml-cii-native-table-wrap{overflow:auto;max-height:340px}.xml-cii-native-table{width:100%;border-collapse:collapse;font-size:12px}.xml-cii-native-table th,.xml-cii-native-table td{border-bottom:1px solid rgba(148,163,184,.16);padding:6px 8px;text-align:left}.xml-cii-native-table th{color:#bfdbfe;background:#0b1220}
@media(max-width:980px){.xml-builder-grid{grid-template-columns:1fr}.xml-builder-dialog{height:calc(100vh - 24px);width:calc(100vw - 24px)}}`;
  doc.head?.appendChild(style);
}

function downloadText(fileName, text, type) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([text], { type }));
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function collectCustomState(container) {
  const state = getXmlCiiCustomInputState();
  container.querySelectorAll('[data-custom-input-text]').forEach((field) => { state[field.dataset.customInputText] = field.value; });
  container.querySelectorAll('[data-custom-input-opt]').forEach((input) => { state.options[input.dataset.customInputOpt] = input.checked; });
  saveXmlCiiCustomInputState(state);
  return state;
}

function firstNodeNumber(xmlText) {
  return String(xmlText || '').match(/<NodeNumber>([^<]+)<\/NodeNumber>/)?.[1]?.trim() || '100';
}

function buildAll(container, outputs) {
  const state = collectCustomState(container);
  const xmlResult = buildXmlCiiCustomInputXml(state, state.options);
  state.xmlText = xmlResult.xmlText;
  saveXmlCiiCustomInputState(state);
  const inputResult = buildInputXmlFromNodeXml(xmlResult.xmlText, { applyEnrichment: false, buildProfile: 'xml-builder', jobName: 'XML_BUILDER', sourceName: 'xml-builder-generated.xml' });
  Object.assign(outputs, {
    xmlText: xmlResult.xmlText,
    inputXmlText: inputResult.finalInputXmlText || inputResult.coreInputXmlText || '',
    xmlSummary: JSON.stringify(xmlResult.summary, null, 2),
    inputXmlSummary: JSON.stringify(inputResult.diagnostics?.summary || {}, null, 2),
    error: '',
  });
  saveOutputs(outputs);
}

function renderOutputPanel(outputs) {
  return `<section class="xml-cii-native-card">
    <div><strong>Build Output</strong><div class="xml-cii-native-hint">Generated XML, InputXML, and topology geometry are derived from the table builder state.</div></div>
    <div class="xml-cii-native-toolbar">
      <button type="button" class="model-converters-run-btn" data-xml-builder-build>Build XML + InputXML + Geometry</button>
      <button type="button" class="model-converters-download-btn" data-xml-builder-download="xml" ${outputs.xmlText ? '' : 'disabled'}>Download XML</button>
      <button type="button" class="model-converters-download-btn" data-xml-builder-download="inputxml" ${outputs.inputXmlText ? '' : 'disabled'}>Download InputXML</button>
    </div>
    <div class="xml-cii-native-hint">${esc(outputs.error || 'Ready')}</div>
    <div class="xml-builder-grid">
      <div><div class="model-converters-workflow-section-title">Generated XML</div><pre class="xml-cii-native-hint">${esc(outputs.xmlSummary || 'No XML built yet.')}</pre><textarea class="xml-builder-output" readonly>${esc(outputs.xmlText || '')}</textarea></div>
      <div><div class="model-converters-workflow-section-title">InputXML</div><pre class="xml-cii-native-hint">${esc(outputs.inputXmlSummary || 'No InputXML built yet.')}</pre><textarea class="xml-builder-output" readonly>${esc(outputs.inputXmlText || '')}</textarea></div>
    </div>
  </section>`;
}

function renderTopology(host, outputs) {
  const xmlText = outputs.xmlText || getXmlCiiCustomInputState().xmlText || '';
  if (!xmlText) {
    host.innerHTML = '<section class="xml-cii-native-card"><div class="model-converters-workflow-section-title">Topology Canvas</div><div class="xml-cii-native-hint">Build XML to show route geometry.</div></section>';
    return;
  }
  host[TOPOLOGY_STATE_KEY] = { ...(host[TOPOLOGY_STATE_KEY] || {}), manualXml: xmlText, manualSourceName: 'XML Builder output', anchorNode: firstNodeNumber(xmlText) };
  renderXmlCiiTopology5BPanel(host, { root: host, anchorNode: firstNodeNumber(xmlText) });
}

function render(container, outputs) {
  container.innerHTML = `<div class="xml-builder-root">
    <section class="xml-cii-native-card"><div class="model-converters-workflow-detail-title">XML Builder</div><div class="model-converters-workflow-detail-text">Build node XML and Caesar InputXML from pasted tables, then inspect the topology canvas.</div></section>
    <section data-xml-builder-custom></section>
    <div data-xml-builder-output>${renderOutputPanel(outputs)}</div>
    <section data-xml-builder-topology></section>
  </div>`;
  const customHost = container.querySelector('[data-xml-builder-custom]');
  customHost.innerHTML = renderXmlCiiCustomInputPanel();
  bindXmlCiiCustomInputPanel(customHost, container, {});
  bindOutputActions(container, outputs);
  renderTopology(container.querySelector('[data-xml-builder-topology]'), outputs);
}

function bindOutputActions(container, outputs) {
  container.querySelector('[data-xml-builder-build]')?.addEventListener(ACTIVATE, () => {
    try { buildAll(container, outputs); } catch (error) { outputs.error = error?.message || String(error); saveOutputs(outputs); }
    render(container, outputs);
  });
  container.querySelectorAll('[data-xml-builder-download]').forEach((button) => button.addEventListener(ACTIVATE, () => {
    const kind = button.dataset.xmlBuilderDownload;
    if (kind === 'xml') downloadText('xml-builder-generated.xml', outputs.xmlText || '', 'application/xml');
    if (kind === 'inputxml') downloadText('xml-builder-inputxml.xml', outputs.inputXmlText || '', 'application/xml');
  }));
}

export function renderXmlBuilderTab(container) {
  ensureStyle(container?.ownerDocument || document);
  const outputs = readOutputs();
  render(container, outputs);
  return () => { container.innerHTML = ''; };
}

function renderLauncher() {
  return `<button type="button" class="psmap-card psmap-tile xml-builder-launcher" data-xml-builder-open="1" title="Open XML Builder"><span class="xml-builder-launcher-icon" aria-hidden="true">XML</span><b>XML Builder</b><span>Build XML, InputXML, and topology geometry</span></button>`;
}

function mountPopup(root, onClose) {
  ensureStyle(root?.ownerDocument || document);
  const modal = document.createElement('div');
  modal.className = 'xml-builder-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'psmap-card xml-builder-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', POPUP_TITLE_ID);
  dialog.innerHTML = `<div class="xml-builder-head"><div><b id="${POPUP_TITLE_ID}">XML Builder</b><span>Custom XML, InputXML, and topology canvas utility.</span></div><button type="button" class="xml-builder-close" data-xml-builder-close="1">Close</button></div><div class="xml-builder-body" data-xml-builder-body></div>`;
  modal.appendChild(dialog);
  (document.body || root).appendChild(modal);
  renderXmlBuilderTab(dialog.querySelector('[data-xml-builder-body]'));
  modal.addEventListener(ACTIVATE, (event) => {
    if (event.target === modal || event.target.closest?.('[data-xml-builder-close="1"]')) {
      modal.remove();
      onClose();
    }
  });
  return modal;
}

export function installXmlBuilderUtilityTile(container) {
  ensureStyle(container?.ownerDocument || document);
  const utilitiesRoot = container.querySelector('.psnm-root') || container;
  if (utilitiesRoot.querySelector('[data-xml-builder-launcher]')) return null;
  const launcher = document.createElement('section');
  launcher.setAttribute('data-xml-builder-launcher', '1');
  launcher.innerHTML = renderLauncher();
  utilitiesRoot.appendChild(launcher);
  let popup = null;
  launcher.querySelector('[data-xml-builder-open="1"]').addEventListener(ACTIVATE, () => {
    if (popup) return;
    popup = mountPopup(utilitiesRoot, () => { popup = null; });
  });
  return () => {
    if (popup) popup.remove();
    launcher.remove();
  };
}

export const _test = Object.freeze({ renderLauncher, renderOutputPanel, firstNodeNumber });
