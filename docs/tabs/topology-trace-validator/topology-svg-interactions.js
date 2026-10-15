/**
 * Functionality: applies read-only click tracing across SVG, ledger rows, and
 * projection rows. Inputs are a DOM root, immutable selection lookup, and an
 * object key. Output is the selected lookup group. Fallback: unknown keys clear
 * highlights and return null; no engineering artifact is mutated.
 */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

/** @param {ParentNode} root @param {Record<string, unknown>} lookup @param {string} objectKey @returns {Record<string, unknown>|null} */
export function applyTopologyTraceSelection(root, lookup, objectKey) {
  root.querySelectorAll('.is-selected, .is-related').forEach((element) => element.classList.remove('is-selected', 'is-related'));
  const group = objectRecord(lookup[objectKey]);
  if (!asArray(group.keys).length) return null;
  const keys = new Set(asArray(group.keys).map(cleanText));
  root.querySelectorAll('[data-object-key]').forEach((element) => {
    const key = cleanText(element.getAttribute('data-object-key'));
    if (!keys.has(key)) return;
    element.classList.add(key === objectKey ? 'is-selected' : 'is-related');
  });
  return group;
}

/** @param {Element} svg @param {ParentNode} traceRoot @param {Record<string, unknown>} lookup @param {(selection:Record<string, unknown>|null,objectKey:string)=>void} onSelection @returns {() => void} */
export function wireTopologySvgInteractions(svg, traceRoot, lookup, onSelection) {
  const onClick = (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-object-key]') : null;
    const objectKey = cleanText(target?.getAttribute('data-object-key'));
    const selection = objectKey ? applyTopologyTraceSelection(traceRoot, lookup, objectKey) : null;
    onSelection(selection, objectKey);
  };
  svg.addEventListener('click', onClick);
  return () => svg.removeEventListener('click', onClick);
}

/** @param {Record<string, unknown>} lookup @param {string} objectKey @returns {string[]} */
export function resolveTopologySelectionKeys(lookup, objectKey) {
  return asArray(objectRecord(lookup[objectKey]).keys).map(cleanText);
}
