/** Selected-issue overlay for Trace, Edit Draft, Parity, and preview SVGs. */

import { asArray, cleanText } from './topology-validator-values.js';

/** @param {ParentNode} root @returns {void} */
export function clearTopologyCheckerOverlay(root) {
  root.querySelectorAll('[data-ttv-checker-overlay]').forEach((element) => element.remove());
  root.querySelectorAll('.ttv-checker-highlight').forEach((element) => {
    element.classList.remove('ttv-checker-highlight'); element.style.removeProperty('--ttv-issue-color');
  });
  root.querySelectorAll('.ttv-checker-overlay-active').forEach((element) => element.classList.remove('ttv-checker-overlay-active'));
}

/** @param {ParentNode} root @param {Record<string,unknown>} issue @param {Record<string,unknown>|null} suggestion @returns {number} */
export function renderTopologyCheckerOverlay(root, issue, suggestion) {
  clearTopologyCheckerOverlay(root);
  const matched = issueElements(root, asArray(issue.objectIds));
  for (const element of matched) {
    element.classList.add('ttv-checker-highlight'); element.style.setProperty('--ttv-issue-color', cleanText(issue.color));
    const svg = element.closest('svg');
    if (svg) appendGhost(svg, element, issue, suggestion);
  }
  for (const host of root.querySelectorAll('.ttv-svg-host,.ttv-edit-svg-host,.ttv-parity-svg-host,.ttv-edit-3d-host')) {
    if (!host.querySelector('.ttv-checker-highlight')) continue;
    host.classList.add('ttv-checker-overlay-active');
    const badge = host.ownerDocument.createElement('div'); badge.dataset.ttvCheckerOverlay = 'badge'; badge.className = 'ttv-checker-canvas-badge';
    badge.style.setProperty('--ttv-issue-color', cleanText(issue.color)); badge.textContent = `${issue.code.replaceAll('_', ' ')} · ${issue.severity}`; host.appendChild(badge);
  }
  return matched.length;
}

/** @param {ParentNode} root @param {unknown[]} ids @returns {Element[]} */
function issueElements(root, ids) {
  const elements = [];
  for (const rawId of ids) {
    const id = cleanText(rawId);
    const selectors = [
      `[data-edit-id="${CSS.escape(id)}"]`, `[data-object-key="canonical:node:${CSS.escape(id)}"]`,
      `[data-object-key="canonical:edge:${CSS.escape(id)}"]`, `[data-object-key="scene:node:${CSS.escape(id)}"]`,
      `[data-object-key="scene:edge:${CSS.escape(id)}"]`, `[data-object-key="scene:support:${CSS.escape(id)}"]`,
    ];
    for (const selector of selectors) elements.push(...root.querySelectorAll(selector));
  }
  return [...new Set(elements)];
}

/** @param {SVGElement} svg @param {Element} source @param {Record<string,unknown>} issue @param {Record<string,unknown>|null} suggestion @returns {void} */
function appendGhost(svg, source, issue, suggestion) {
  if (!(source instanceof SVGElement)) return;
  let group = svg.querySelector(':scope > [data-ttv-checker-overlay="ghost"]');
  if (!group) {
    group = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.dataset.ttvCheckerOverlay = 'ghost'; group.classList.add('ttv-checker-suggestion-ghost'); svg.appendChild(group);
  }
  const clone = source.cloneNode(true); clone.removeAttribute('id'); clone.querySelectorAll?.('[id]').forEach((element) => element.removeAttribute('id'));
  clone.removeAttribute('data-object-key'); clone.removeAttribute('data-edit-id'); clone.style.stroke = cleanText(issue.color);
  clone.style.strokeDasharray = suggestion ? '9 6' : '3 5'; clone.style.pointerEvents = 'none'; group.appendChild(clone);
}

export const _test = Object.freeze({ issueElements, appendGhost });
