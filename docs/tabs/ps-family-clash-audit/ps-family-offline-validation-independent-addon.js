import { buildPsFamilyIndependentModelBenchmark } from './ps-family-offline-validation-independent-benchmark.js';
import { createPsFamilyIndependentBenchmarkExports } from './ps-family-offline-validation-independent-export.js';
import { renderPsFamilyIndependentBenchmark, renderPsFamilyIndependentBenchmarkPanel } from './ps-family-offline-validation-independent-view.js';
import { saveTextFile } from './ps-family-clash-audit-save.js';

const TAB_KEY = 'independent-benchmark';
let observer = null;

export function installPsFamilyIndependentBenchmarkAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountIndependentBenchmarkWorkspaces(doc);
  observer = new MutationObserver(() => mountIndependentBenchmarkWorkspaces(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => { observer?.disconnect(); observer = null; };
}

export function mountIndependentBenchmarkWorkspaces(doc = globalThis.document) {
  if (!doc) return 0;
  let mounted = 0;
  doc.querySelectorAll('[data-psfa-popup="1"]').forEach((popup) => {
    if (popup.querySelector('[data-psfa-independent-mounted="1"]')) return;
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
  button.dataset.psfaIndependentMounted = '1';
  button.setAttribute('aria-selected', 'false');
  button.textContent = 'Independent Benchmark';
  tabs.appendChild(button);
  const panel = popup.ownerDocument.createElement('section');
  panel.dataset.psfaPanel = TAB_KEY;
  panel.hidden = true;
  panel.innerHTML = renderPsFamilyIndependentBenchmarkPanel();
  shell.appendChild(panel);
  const state = { result: null };
  button.addEventListener('click', () => showPanel(popup));
  panel.querySelector('[data-psfa="run-independent-benchmark"]')?.addEventListener('click', () => runBenchmark(popup, panel, state));
  wireDownloads(panel, state);
}

function showPanel(popup) {
  popup.querySelectorAll('[data-psfa-panel]').forEach((panel) => { panel.hidden = panel.dataset.psfaPanel !== TAB_KEY; });
  popup.querySelectorAll('[data-psfa-workspace-tab]').forEach((button) => {
    const active = button.dataset.psfaWorkspaceTab === TAB_KEY;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function runBenchmark(popup, panel, state) {
  const host = panel.querySelector('[data-psfa="independent-benchmark-results"]');
  try {
    state.result = buildPsFamilyIndependentModelBenchmark({
      combinedInputText: value(popup, 'native-model'),
      structureXmlText: value(popup, 'structure'),
      supportXmlText: value(popup, 'support'),
      relationshipConfig: nativeConfig(popup),
      auditConfig: { sourceFamily: value(popup, 'native-source-family') },
      validationConfig: validationConfig(popup),
    });
    host.innerHTML = renderPsFamilyIndependentBenchmark(state.result);
  } catch (error) {
    state.result = null;
    host.innerHTML = `<div class="psfa-validation-error"><b>Benchmark blocked</b><span>${escapeHtml(error.message || error)}</span></div>`;
  }
}

function wireDownloads(panel, state) {
  const rows = [
    ['download-independent-metrics', 'ps-family-independent-metrics.csv', 'metricsCsv', 'text/csv'],
    ['download-independent-coverage', 'ps-family-independent-coverage.csv', 'coverageCsv', 'text/csv'],
    ['download-independent-gaps', 'ps-family-independent-gaps.csv', 'gapsCsv', 'text/csv'],
    ['download-independent-json', 'ps-family-independent-benchmark.json', 'benchmarkJson', 'application/json'],
  ];
  rows.forEach(([key, filename, exportKey, mime]) => {
    panel.querySelector(`[data-psfa="${key}"]`)?.addEventListener('click', () => {
      if (!state.result) return;
      saveTextFile(filename, createPsFamilyIndependentBenchmarkExports(state.result)[exportKey], mime);
    });
  });
}

function nativeConfig(root) {
  return {
    projectionToleranceMm: number(root, 'native-projection-tolerance'),
    memberContactToleranceMm: number(root, 'native-contact-tolerance'),
    memberCandidateToleranceMm: number(root, 'native-candidate-tolerance'),
    carrierContactToleranceMm: number(root, 'native-carrier-contact-tolerance'),
    carrierCandidateToleranceMm: number(root, 'native-carrier-candidate-tolerance'),
    carrierTopologyExactToleranceMm: number(root, 'native-topology-exact-tolerance'),
    carrierTopologySmallGapToleranceMm: number(root, 'native-topology-gap-tolerance'),
  };
}
function validationConfig(root) {
  return {
    structuralPrecision: number(root, 'validation-structural-precision'),
    structuralRecall: number(root, 'validation-structural-recall'),
    chainPrecision: number(root, 'validation-chain-precision'),
    chainRecall: number(root, 'validation-chain-recall'),
    familyPrefixesText: value(root, 'family-prefixes') || 'PS, SL',
    structuralZonesText: value(root, 'structural-zones'),
    supportZonesText: value(root, 'support-zones'),
  };
}
function value(root, key) { return root.querySelector(`[data-psfa="${key}"]`)?.value || ''; }
function number(root, key) { return Number(value(root, key)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

installPsFamilyIndependentBenchmarkAddon();
