import { SUPPORT_STEEL_SAMPLE_COMBINED } from '../support-steel-relationship-builder/support-steel-relationship-samples.js';
import {
  buildPsFamilyNativeAuditPipeline,
  createPsFamilyNativePipelineReadiness,
} from './ps-family-native-combined-input.js';
import { createPsFamilyNativePipelineExports } from './ps-family-native-audit-pipeline-export.js';
import {
  renderPsFamilyNativePipelinePanel,
  renderPsFamilyNativePipelineReadiness,
  renderPsFamilyNativePipelineResults,
} from './ps-family-native-audit-pipeline-view.js';
import { saveTextFile, saveZipTextFiles } from './ps-family-clash-audit-save.js';

const POPUP_SELECTOR = '[data-psfa-popup="1"]';
const TAB_KEY = 'native-pipeline';
const STYLE_ID = 'ps-family-native-pipeline-style';
let observer = null;

export function installPsFamilyNativeAuditPipelineAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  ensureStyle(doc);
  mountNativePipelineWorkspaces(doc);
  observer = new MutationObserver(() => mountNativePipelineWorkspaces(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    observer = null;
  };
}

export function mountNativePipelineWorkspaces(doc = globalThis.document) {
  if (!doc) return 0;
  let mounted = 0;
  doc.querySelectorAll(POPUP_SELECTOR).forEach((popup) => {
    if (popup.querySelector('[data-psfa-native-mounted="1"]')) return;
    mountWorkspace(popup);
    mounted += 1;
  });
  return mounted;
}

function mountWorkspace(popup) {
  const tabs = popup.querySelector('.psfa-tabs');
  const shell = popup.querySelector('.psfa-shell');
  if (!tabs || !shell) return;
  const button = popup.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'psmap-tab psfa-tab';
  button.dataset.psfaWorkspaceTab = TAB_KEY;
  button.dataset.psfaNativeMounted = '1';
  button.setAttribute('aria-selected', 'false');
  button.textContent = 'Native Pipeline';
  tabs.appendChild(button);
  const panel = popup.ownerDocument.createElement('section');
  panel.dataset.psfaPanel = TAB_KEY;
  panel.hidden = true;
  panel.innerHTML = renderPsFamilyNativePipelinePanel();
  shell.appendChild(panel);
  const state = { pipeline: null };
  button.addEventListener('click', () => showPanel(popup));
  panel.querySelector('[data-psfa="native-load-sample"]')?.addEventListener('click', () => loadSample(panel));
  panel.querySelector('[data-psfa="native-check-readiness"]')?.addEventListener('click', () => checkReadiness(panel));
  panel.querySelector('[data-psfa="native-build-audit"]')?.addEventListener('click', () => runPipeline(popup, panel, state));
  panel.querySelector('[data-psfa="native-use-bundle"]')?.addEventListener('click', () => useBundleInAudit(popup, panel, state));
  wireDownloads(panel, state);
}

function showPanel(popup) {
  popup.querySelectorAll('[data-psfa-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.psfaPanel !== TAB_KEY;
  });
  popup.querySelectorAll('[data-psfa-workspace-tab]').forEach((button) => {
    const active = button.dataset.psfaWorkspaceTab === TAB_KEY;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function loadSample(panel) {
  field(panel, 'native-model').value = JSON.stringify(SUPPORT_STEEL_SAMPLE_COMBINED, null, 2);
  setText(panel, 'native-model-status', 'Combined PS-14259 piping, support and structural demo loaded');
  setRunState(panel, 'Demo loaded', 'Check readiness or build the native pipeline.');
}

function checkReadiness(panel) {
  const readiness = createPsFamilyNativePipelineReadiness(nativeInput(panel));
  panel.querySelector('[data-psfa="native-results"]').innerHTML = renderPsFamilyNativePipelineReadiness(readiness);
  setRunState(
    panel,
    readiness.blocking ? 'Readiness blocked' : 'Combined model ready',
    readiness.blocking ? 'Correct the combined staged model before building.' : 'No clash XML is required.',
  );
}

function runPipeline(popup, panel, state) {
  try {
    state.pipeline = buildPsFamilyNativeAuditPipeline(nativeInput(panel));
    panel.querySelector('[data-psfa="native-results"]').innerHTML = renderPsFamilyNativePipelineResults(state.pipeline);
    setRunState(
      panel,
      state.pipeline.summary.status,
      `${state.pipeline.summary.completeCarrierToStructurePathCount} complete carrier-to-structure paths · ${state.pipeline.summary.incompleteCarrierToStructureFamilyCount} incomplete families · ${state.pipeline.summary.carrierToStructurePathExceptionCount} path exceptions`,
    );
    populateBundleField(popup, state.pipeline);
  } catch (error) {
    state.pipeline = null;
    panel.querySelector('[data-psfa="native-results"]').innerHTML = `<div class="psfa-native-error"><b>Native pipeline blocked</b><span>${escapeHtml(error.message || error)}</span></div>`;
    setRunState(panel, 'Build blocked', error.message || String(error));
  }
}

function nativeInput(panel) {
  return {
    combinedInputText: field(panel, 'native-model')?.value || '',
    relationshipConfig: {
      projectionToleranceMm: numberField(panel, 'native-projection-tolerance'),
      memberContactToleranceMm: numberField(panel, 'native-contact-tolerance'),
      memberCandidateToleranceMm: numberField(panel, 'native-candidate-tolerance'),
      carrierContactToleranceMm: numberField(panel, 'native-carrier-contact-tolerance'),
      carrierCandidateToleranceMm: numberField(panel, 'native-carrier-candidate-tolerance'),
      carrierTopologyExactToleranceMm: numberField(panel, 'native-topology-exact-tolerance'),
      carrierTopologySmallGapToleranceMm: numberField(panel, 'native-topology-gap-tolerance'),
    },
    auditConfig: { sourceFamily: field(panel, 'native-source-family')?.value || '' },
  };
}

function useBundleInAudit(popup, panel, state) {
  if (!state.pipeline) {
    setRunState(panel, 'No bundle available', 'Build the native pipeline first.');
    return;
  }
  populateBundleField(popup, state.pipeline);
  popup.querySelectorAll('[data-psfa="evidence-mode"]').forEach((node) => {
    node.value = 'RELATIONSHIP_BUNDLE';
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  setRunState(panel, 'Bundle handed off', 'The generated relationship bundle is now loaded in the standard Audit Input workspace.');
}

function populateBundleField(popup, pipeline) {
  const target = popup.querySelector('[data-psfa="bundle"]');
  if (!target || !pipeline?.relationshipBundle) return;
  target.value = JSON.stringify(pipeline.relationshipBundle, null, 2);
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function wireDownloads(panel, state) {
  const download = (key, filename, exportKey, mime) => {
    panel.querySelector(`[data-psfa="${key}"]`)?.addEventListener('click', () => {
      if (!state.pipeline) return;
      const exports = createPsFamilyNativePipelineExports(state.pipeline);
      saveTextFile(filename, exports[exportKey], mime);
    });
  };
  download('native-download-bundle', 'support-steel-relationship-bundle.json', 'relationshipBundleJson', 'application/json');
  download('native-download-audit', 'ps-family-evidence-audit.json', 'auditJson', 'application/json');
  panel.querySelector('[data-psfa="native-download-package"]')?.addEventListener('click', () => {
    if (!state.pipeline) return;
    const exports = createPsFamilyNativePipelineExports(state.pipeline);
    saveZipTextFiles('ps-family-native-audit-package.zip', [
      { name: 'native-pipeline.json', text: exports.pipelineJson },
      { name: 'relationship-bundle.json', text: exports.relationshipBundleJson },
      { name: 'audit.json', text: exports.auditJson },
      { name: 'pipeline-summary.csv', text: exports.summaryCsv },
      { name: 'support-summary.csv', text: exports.supportSummaryCsv },
      { name: 'audit-exceptions.csv', text: exports.supportExceptionsCsv },
      { name: 'input-evidence.csv', text: exports.inputEvidenceCsv },
      { name: 'carrier-catalog.csv', text: exports.carrierCatalogCsv },
      { name: 'carrier-resolutions.csv', text: exports.carrierResolutionCsv },
      { name: 'support-carrier-edges.csv', text: exports.supportCarrierEdgesCsv },
      { name: 'carrier-attachment-evaluations.csv', text: exports.carrierAttachmentCsv },
      { name: 'carrier-attachment-edges.csv', text: exports.carrierAttachmentEdgesCsv },
      { name: 'carrier-topology-components.csv', text: exports.carrierTopologyComponentsCsv },
      { name: 'carrier-topology-ports.csv', text: exports.carrierTopologyPortsCsv },
      { name: 'carrier-topology-connections.csv', text: exports.carrierTopologyConnectionsCsv },
      { name: 'carrier-topology-paths.csv', text: exports.carrierTopologyPathsCsv },
      { name: 'carrier-topology-exceptions.csv', text: exports.carrierTopologyExceptionsCsv },
      { name: 'carrier-to-structure-complete-paths.csv', text: exports.carrierToStructureCompletePathsCsv },
      { name: 'carrier-to-structure-path-exceptions.csv', text: exports.carrierToStructurePathExceptionsCsv },
      { name: 'carrier-to-structure-families.csv', text: exports.carrierToStructureFamiliesCsv },
    ]);
  });
}

function setRunState(panel, title, message) {
  const host = panel.querySelector('[data-psfa="native-run-state"]');
  if (host) host.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span>`;
}
function field(root, key) { return root.querySelector(`[data-psfa="${key}"]`); }
function numberField(root, key) { return Number(field(root, key)?.value); }
function setText(root, key, value) { const node = field(root, key); if (node) node.textContent = value; }
function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psfa-native-actions,.psfa-native-export-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.psfa-native-primary{font-weight:700}.psfa-native-input-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.psfa-native-result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.psfa-native-input-grid label{display:grid;gap:6px}.psfa-native-input-grid textarea{min-height:360px;font-family:ui-monospace,monospace}.psfa-native-config{margin:12px 0}.psfa-native-config-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}.psfa-native-config-grid label{display:grid;gap:5px}.psfa-native-run-state,.psfa-native-readiness,.psfa-native-error{display:grid;gap:4px;padding:10px;border:1px solid rgba(125,211,252,.3);border-radius:10px;margin:10px 0}.psfa-native-readiness.is-blocked,.psfa-native-error{border-color:rgba(239,68,68,.55)}.psfa-native-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:12px 0}.psfa-native-summary article{display:grid;gap:4px;padding:10px;border:1px solid rgba(125,211,252,.22);border-radius:10px}.psfa-native-summary span{font-size:11px}.psfa-native-summary strong{font-size:18px}.psfa-native-contract{display:grid;grid-template-columns:auto 1fr;gap:5px 12px}.psfa-native-contract dd{margin:0}@media(max-width:900px){.psfa-native-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.psfa-native-config-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.psfa-native-result-grid{grid-template-columns:1fr}.psfa-native-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  doc.head?.appendChild(style);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

installPsFamilyNativeAuditPipelineAddon();
