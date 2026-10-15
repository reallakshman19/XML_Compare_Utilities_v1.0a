import { createLinewiseUniversalPreset } from './universal-xml-categorizer-contracts.js';
import { createLinewiseUniversalWorkspaceViewModel } from './universal-workspace-view-model.js';
import { renderUniversalReviewPanels } from './universal-review-panels-view.js';
import { universalViewportStyleHtml } from './universal-viewport-shell-view.js';

export const UNIVERSAL_XML_CATEGORIZER_SHELL_SCHEMA = 'universal-xml-categorizer-shell/v2';
export const UNIVERSAL_XML_CATEGORIZER_BUTTON_ATTR = 'data-xml-compare-universal-categorizer-open';
export const UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR = 'data-xml-compare-universal-categorizer-popup';

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderUniversalXmlCategorizerButtonHtml() {
  return `<button type="button" class="xml-compare-universal-categorizer-btn" ${UNIVERSAL_XML_CATEGORIZER_BUTTON_ATTR}>Universal XML Categorizer</button>`;
}

function workflowHtml(preview) {
  return `<nav class="uxc-workflow" aria-label="Universal Categorizer workflow">${preview.workflow.map((step) => `<article><b>${esc(step.number)}</b><span>${esc(step.title)}</span><small>${esc(step.caption)}</small></article>`).join('')}</nav>`;
}

function readinessHtml(viewModel) {
  return `<section class="uxc-readiness-strip">${viewModel.readinessCards.map((card) => `<article><small>${esc(card.label)}</small><b>${esc(card.value)}</b><span>${esc(card.note)}</span></article>`).join('')}</section>`;
}

export function renderUniversalXmlCategorizerWorkspaceHtml(viewModel, options = {}) {
  const preview = viewModel.samplePreview;
  const contextLabel = options.contextStatus === 'loaded' ? 'Loaded preview' : 'Sample preview';
  const previewHtml = options.viewportHtml || '<section data-uxc-preview-mount></section>';
  return `<div class="universal-xml-categorizer-backdrop" ${UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR}>${universalViewportStyleHtml()}<section class="universal-xml-categorizer-dialog" role="dialog" aria-modal="true" aria-label="Universal XML Categorizer"><header class="uxc-hero"><div><span class="uxc-eyebrow">${esc(viewModel.eyebrow)}</span><h3>${esc(viewModel.title)}</h3><p>${esc(viewModel.subtitle)}</p></div><div class="uxc-hero-actions"><span class="uxc-status-chip">${contextLabel}</span><span class="uxc-status-chip is-locked">Export locked</span><button type="button" data-universal-categorizer-close>Close</button></div></header>${workflowHtml(preview)}${readinessHtml(viewModel)}<main class="uxc-builder-workspace">${renderUniversalReviewPanels(viewModel)}${previewHtml}</main></section></div>`;
}

export function renderUniversalXmlCategorizerShellHtml(profile = createLinewiseUniversalPreset()) {
  const viewModel = createLinewiseUniversalWorkspaceViewModel(profile || createLinewiseUniversalPreset());
  return renderUniversalXmlCategorizerWorkspaceHtml(viewModel, { contextStatus: 'sample' });
}

export const _test = Object.freeze({ workflowHtml, readinessHtml });
