import { writePipelineElementHtml } from './pipeline-3d-model-dom-write.js';

function text(value) {
  return String(value ?? '');
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function buildPipelineCadSvgReferenceHtml(graphName, svgHtml = '') {
  const name = escapeHtml(graphName);
  const label = graphName === 'table3x' ? 'Table 3X' : 'Table 2X';
  return `<div class="p3d-cad-svg-reference" data-p3d-cad-svg-reference="${name}" data-reference-state="greyed" role="img" aria-label="${label} legacy SVG reference; CAD canvas is active">${text(svgHtml)}</div>`;
}

export function resolvePipelineSvgPreviewTarget(holder) {
  return holder?.querySelector?.('[data-p3d-cad-svg-reference]') || holder || null;
}

export function renderPipelineSvgPreview(holder, svgHtml) {
  return writePipelineElementHtml(resolvePipelineSvgPreviewTarget(holder), svgHtml);
}
