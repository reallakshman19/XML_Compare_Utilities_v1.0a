/**
 * Functionality: renders immutable source-search matches into the left result
 * panel. Input is the view model search slice. Output is inert HTML with
 * object identity keys for explicit controller focus. Fallback: an empty
 * message is shown when no source component matches every active field.
 */

import { asArray, escapeMarkup, objectRecord } from './topology-validator-values.js';
import { shortText } from './topology-controller-helpers.js?v=1';

/** @param {Record<string, unknown>} viewModel @returns {string} */
export function buildTopologySearchResultsMarkup(viewModel) {
  const summary = objectRecord(viewModel.filterSummary), results = asArray(viewModel.searchResults).map(objectRecord);
  if (summary.searchActive !== true) return '';
  const heading = `<h2>Search results <span>${escapeMarkup(summary.sourceMatchCount)}</span></h2>`;
  if (!results.length) return `${heading}<p class="ttv-search-empty">No source objects match all active search fields.</p>`;
  const buttons = results.map((result) => {
    const name = escapeMarkup(result.name || result.ref || 'Unnamed');
    const path = escapeMarkup(shortText(result.sourcePath, 40));
    return `<button type="button" data-object-key="${escapeMarkup(result.objectKey)}"><span class="ttv-search-chip" data-ttv-type-chip="${escapeMarkup(result.componentCategory)}">${escapeMarkup(result.componentCategory)}</span><div class="ttv-search-text"><strong>${name}</strong><small title="${escapeMarkup(result.sourcePath)}">${path}</small></div></button>`;
  }).join('');
  const footer = `<div class="ttv-search-footer">${summary.sourceMatchCount} matches &middot; ${Number(summary.sourceMatchCount) > results.length ? `showing first ${results.length}` : 'all shown'}</div>`;
  return `${heading}<div class="ttv-search-result-list">${buttons}</div>${footer}`;
}
