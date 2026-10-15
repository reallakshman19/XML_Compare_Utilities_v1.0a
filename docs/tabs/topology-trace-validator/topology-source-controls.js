/** Pure source-branch/type control rendering for Topology Trace. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { escapeAttribute, escapeHtml, shortText } from './topology-controller-helpers.js';

/** @param {string} type @returns {string} */
function typeIcon(type) {
  const icons = { PIPE: '〒', VALVE: '⊠', SUPPORT: '△', FLANGE: '◫', 'ELBO/BEND': '⌒', TEE: '⊤', OLET: '○', INST: '◎', REDUCER: '⊳', GASK: '⊶' };
  return icons[type] || '◻';
}

/** @param {Record<string, Element>} elements @param {Record<string, unknown>} source @returns {Readonly<Record<string, unknown>>} */
export function renderTopologySourceControls(elements, source) {
  const branches = asArray(source.branches).map(objectRecord);
  elements.branchTree.innerHTML = `<button type="button" data-ttv-branch="" class="is-active">All branches<span>${branches.length}</span></button>${branches.map((branch) => `<button type="button" data-ttv-branch="${escapeAttribute(branch.name)}">${escapeHtml(shortText(branch.name, 35))}<span>${asArray(branch.components).length}</span></button>`).join('')}`;
  const counts = objectRecord(objectRecord(source.metrics).componentCategoryCounts), types = Object.keys(counts);
  const ribbon = elements.traceRoot?.querySelector('[data-ttv-type-ribbon]');
  if (ribbon) ribbon.innerHTML = types.map((type) => `<button class="ttv-type-pill is-active" data-ttv-type="${escapeAttribute(type)}" title="${type}">${typeIcon(type)}<span>${escapeHtml(type)}</span><em>${counts[type]}</em></button>`).join('');
  elements.componentSymbols.checked = false;
  return Object.freeze({ branch: '', selectedBranches: new Set(), types: Object.freeze(types), showComponentSymbols: false });
}

/** @param {Record<string, Element>} elements @param {Record<string, unknown>} source @param {Record<string, unknown>} viewState @param {boolean} showComponentSymbols @returns {void} */
export function syncTopologySourceControls(elements, source, viewState, showComponentSymbols) {
  elements.branchTree.querySelectorAll('[data-ttv-branch]').forEach((button) => {
    const branch = cleanText(button.getAttribute('data-ttv-branch'));
    button.classList.toggle('is-active', viewState.selectedBranches.has(branch) || (viewState.selectedBranches.size === 0 && !branch));
    button.classList.toggle('is-multi-selected', viewState.selectedBranches.size > 1 && viewState.selectedBranches.has(branch));
  });
  elements.componentSymbols.checked = showComponentSymbols;
  const exportButton = elements.traceRoot?.querySelector('[data-ttv-export-selection]');
  if (exportButton) {
    const allCount = asArray(source.branches).length;
    exportButton.disabled = viewState.selectedBranches.size === 0 || viewState.selectedBranches.size >= allCount;
  }
}

export const _test = Object.freeze({ typeIcon });
