import { buildPsFamilyOfflineValidationBenchmark } from './ps-family-offline-validation-benchmark.js';
import { createPsFamilyValidationExports } from './ps-family-offline-validation-export.js';
import { renderPsFamilyOfflineValidation, renderPsFamilyValidationPanel } from './ps-family-offline-validation-view.js';
import { saveTextFile } from './ps-family-clash-audit-save.js';

const POPUP_SELECTOR = '[data-psfa-popup="1"]';
const TAB_KEY = 'validation';
const STYLE_ID = 'ps-family-offline-validation-style';
let observer = null;

export function installPsFamilyOfflineValidationAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  ensureValidationStyle(doc);
  mountValidationWorkspaces(doc);
  observer = new MutationObserver(() => mountValidationWorkspaces(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    observer = null;
  };
}

export function mountValidationWorkspaces(doc = globalThis.document) {
  if (!doc) return 0;
  let mounted = 0;
  doc.querySelectorAll(POPUP_SELECTOR).forEach((popup) => {
    if (popup.querySelector('[data-psfa-validation-mounted="1"]')) return;
    mountValidationWorkspace(popup);
    mounted += 1;
  });
  return mounted;
}

function mountValidationWorkspace(popup) {
  const tabs = popup.querySelector('.psfa-tabs');
  const shell = popup.querySelector('.psfa-shell');
  if (!tabs || !shell) return;
  const button = popup.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'psmap-tab psfa-tab';
  button.dataset.psfaWorkspaceTab = TAB_KEY;
  button.dataset.psfaValidationMounted = '1';
  button.setAttribute('aria-selected', 'false');
  button.textContent = 'Offline Validation';
  tabs.appendChild(button);

  const panel = popup.ownerDocument.createElement('section');
  panel.dataset.psfaPanel = TAB_KEY;
  panel.hidden = true;
  panel.innerHTML = renderPsFamilyValidationPanel();
  shell.appendChild(panel);

  const state = { benchmark: null };
  button.addEventListener('click', () => showValidationPanel(popup));
  panel.querySelector('[data-psfa="run-offline-validation"]')?.addEventListener('click', () => runValidation(popup, state));
  wireDownloads(panel, state);
}

function showValidationPanel(popup) {
  popup.querySelectorAll('[data-psfa-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.psfaPanel !== TAB_KEY;
  });
  popup.querySelectorAll('[data-psfa-workspace-tab]').forEach((button) => {
    const active = button.dataset.psfaWorkspaceTab === TAB_KEY;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function runValidation(popup, state) {
  const host = popup.querySelector('[data-psfa="offline-validation-results"]');
  try {
    state.benchmark = buildPsFamilyOfflineValidationBenchmark({
      relationshipBundleText: fieldValue(popup, 'bundle'),
      structureXmlText: fieldValue(popup, 'structure'),
      supportXmlText: fieldValue(popup, 'support'),
      config: {
        structuralPrecision: numberField(popup, 'validation-structural-precision'),
        structuralRecall: numberField(popup, 'validation-structural-recall'),
        chainPrecision: numberField(popup, 'validation-chain-precision'),
        chainRecall: numberField(popup, 'validation-chain-recall'),
        familyPrefixesText: fieldValue(popup, 'family-prefixes') || 'PS, SL',
        structuralZonesText: fieldValue(popup, 'structural-zones'),
        supportZonesText: fieldValue(popup, 'support-zones'),
      },
    });
    host.innerHTML = renderPsFamilyOfflineValidation(state.benchmark);
  } catch (error) {
    host.innerHTML = `<div class="psfa-validation-error"><b>Validation blocked</b><span>${escapeHtml(error.message || error)}</span></div>`;
  }
}

function wireDownloads(panel, state) {
  const download = (key, filename, mime) => {
    panel.querySelector(`[data-psfa="${key}"]`)?.addEventListener('click', () => {
      if (!state.benchmark) return;
      const exports = createPsFamilyValidationExports(state.benchmark);
      const exportKey = key === 'download-validation-metrics'
        ? 'metricsCsv'
        : key === 'download-validation-disagreements' ? 'disagreementsCsv' : 'validationJson';
      saveTextFile(filename, exports[exportKey], mime);
    });
  };
  download('download-validation-metrics', 'ps-family-validation-metrics.csv', 'text/csv');
  download('download-validation-disagreements', 'ps-family-validation-disagreements.csv', 'text/csv');
  download('download-validation-json', 'ps-family-offline-validation.json', 'application/json');
}

function fieldValue(root, key) {
  return root.querySelector(`[data-psfa="${key}"]`)?.value || '';
}

function numberField(root, key) {
  return Number(fieldValue(root, key));
}

function ensureValidationStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psfa-validation-thresholds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.psfa-validation-thresholds label{display:grid;gap:6px}.psfa-validation-caution{display:grid;gap:5px;padding:12px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.08);margin:12px 0}.psfa-validation-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}.psfa-validation-metric{padding:12px;border:1px solid rgba(125,211,252,.25);border-radius:12px}.psfa-validation-metric dl{display:grid;grid-template-columns:1fr auto;gap:5px 12px}.psfa-validation-metric dd{margin:0}.psfa-validation-diagnostics{display:grid;gap:8px;margin-top:12px}.psfa-validation-diagnostics article,.psfa-validation-error{display:grid;gap:4px;padding:10px;border:1px solid rgba(245,158,11,.3);border-radius:10px}.psfa-validation-empty{padding:18px;text-align:center}.psfa-validation-error{border-color:rgba(239,68,68,.5)}@media(max-width:800px){.psfa-validation-thresholds{grid-template-columns:repeat(2,minmax(0,1fr))}.psfa-validation-metrics{grid-template-columns:1fr}}`;
  doc.head?.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

installPsFamilyOfflineValidationAddon();
