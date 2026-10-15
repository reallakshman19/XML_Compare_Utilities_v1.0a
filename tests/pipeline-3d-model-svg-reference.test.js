import assert from 'node:assert/strict';
import {
  buildPipelineCadSvgReferenceHtml,
  renderPipelineSvgPreview,
  resolvePipelineSvgPreviewTarget,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-svg-reference.js';
import {
  buildPipelineCadWorkspaceHtml,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-workspace-view.js';

const reference = { innerHTML: '<svg>old</svg>' };
const holder = {
  innerHTML: 'holder unchanged',
  querySelector: (selector) => selector === '[data-p3d-cad-svg-reference]' ? reference : null,
};
assert.equal(resolvePipelineSvgPreviewTarget(holder), reference);
assert.equal(renderPipelineSvgPreview(holder, '<svg>new</svg>'), true);
assert.equal(reference.innerHTML, '<svg>new</svg>');
assert.equal(holder.innerHTML, 'holder unchanged', 'CAD holder must not be replaced');

const fallback = { innerHTML: '' };
assert.equal(renderPipelineSvgPreview(fallback, '<svg>legacy</svg>'), true);
assert.equal(fallback.innerHTML, '<svg>legacy</svg>');
assert.equal(renderPipelineSvgPreview(null, '<svg/>'), false);

const html = buildPipelineCadSvgReferenceHtml('table2x', '<svg data-source="live"></svg>');
assert.match(html, /data-reference-state="greyed"/);
assert.match(html, /legacy SVG reference; CAD canvas is active/);
assert.match(html, /data-source="live"/);
const workspace = buildPipelineCadWorkspaceHtml('table3x', '<svg data-source="original"></svg>');
assert.match(workspace, /data-p3d-cad-svg-reference="table3x"/);
assert.match(workspace, /data-p3d-cad-stage="table3x"/);

console.log('pipeline-3d-model SVG reference: PASS');
