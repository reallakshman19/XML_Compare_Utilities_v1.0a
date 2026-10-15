import { buildSupportSteelRelationshipBundle } from './support-steel-restraint-evidence-bundle.js?v=20260717-startup-parse-hotfix-1';
import { parseSupportSteelJson } from './support-steel-source-utils.js?v=20260717-startup-parse-hotfix-1';
import {
  renderSupportRestraintFunctionPanel,
  renderSupportRestraintFunctionResults,
} from './support-restraint-function-view.js?v=20260717-startup-parse-hotfix-1';

const POPUP_SELECTOR = '[data-ssrb-popup="1"]';
const TAB_KEY = 'restraint';
const mounted = new WeakSet();
let observer = null;

export function installSupportRestraintFunctionAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountAll(doc);
  observer = new MutationObserver(() => mountAll(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => { observer?.disconnect(); observer = null; };
}
function mountAll(doc) { for (const popup of doc.querySelectorAll(POPUP_SELECTOR)) mount(popup); }
function mount(popup) {
  if (mounted.has(popup)) return;
  const tabs = popup.querySelector('.ssrb-tabs');
  const workspace = popup.querySelector('.ssrb-workspace');
  if (!tabs || !workspace) return;
  mounted.add(popup);
  const button = popup.ownerDocument.createElement('button');
  button.type = 'button'; button.dataset.ssrbTab = TAB_KEY; button.textContent = 'Function'; tabs.appendChild(button);
  const panel = popup.ownerDocument.createElement('section');
  panel.dataset.ssrbPanel = TAB_KEY; panel.hidden = true; panel.innerHTML = renderSupportRestraintFunctionPanel(); workspace.appendChild(panel);
  button.addEventListener('click', () => showPanel(popup));
  popup.addEventListener('click', (event) => { if (event.target.closest('[data-ssrb-build]')) setTimeout(() => run(popup), 0); });
}
function run(popup) {
  const host = popup.querySelector('[data-ssrf-results]');
  try {
    const combinedInput = parseSupportSteelJson(popup.querySelector('[data-ssrb-input="model"]')?.value || '', 'Combined staged model source');
    const bundle = buildSupportSteelRelationshipBundle({ combinedInput, config: { ...readExistingRules(popup), ...readFunctionRules(popup) } });
    host.innerHTML = renderSupportRestraintFunctionResults(bundle.supportRestraintFunction);
  } catch (error) {
    host.innerHTML = `<div class="ssrb-empty"><b>Function audit blocked</b><br>${h(error.message || error)}</div>`;
  }
}
function readFunctionRules(popup) {
  return {
    restraintDirectionToleranceMm: Number(popup.querySelector('[data-ssrf-rule="restraintDirectionToleranceMm"]')?.value),
    verticalPipeParallelThreshold: Number(popup.querySelector('[data-ssrf-rule="verticalPipeParallelThreshold"]')?.value),
  };
}
function readExistingRules(popup) {
  const values = {};
  popup.querySelectorAll('[data-ssrb-rule]').forEach((node) => {
    const key = node.dataset.ssrbRule;
    values[key] = node.type === 'checkbox' ? node.checked : node.type === 'number' ? Number(node.value) : node.value;
  });
  return values;
}
function showPanel(popup) {
  popup.querySelectorAll('[data-ssrb-panel]').forEach((panel) => { panel.hidden = panel.dataset.ssrbPanel !== TAB_KEY; });
  popup.querySelectorAll('[data-ssrb-tab]').forEach((button) => {
    const active = button.dataset.ssrbTab === TAB_KEY;
    button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
  });
}
function h(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
installSupportRestraintFunctionAddon();