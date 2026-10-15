import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../tabs/cii-workspace/cii-workspace-transfer-scope-ui.css', import.meta.url), 'utf8');

for (const token of [
  'ciiMultiSourceReviewMarkup',
  'ciiMultiSourceReviewBySource',
  'data-ciiw-ms-decision',
  'applyMultiSourceReview',
  'Apply correspondence approvals to Transfer Preview',
  'preview = await createCiiWriter2SourceSetPreviewWithVersionBridge(previewInput()',
  'data-ciiw-ms-manual-remove',
  'ciiw-ms-inline-action',
]) assert.ok(ui.includes(token), token);

assert.ok(!ui.includes('const reviewBySource = buildAutomaticReview(firstPass);'), 'multi-source Compare must not hide review behind the prior automatic second pass');
assert.ok(ui.includes('if (results) results.innerHTML = ciiMultiSourceReviewMarkup'), 'visible Correspondence Review must render combined multi-source rows');
assert.ok(css.includes('button.ciiw-ms-inline-action'));
assert.ok(css.includes('width:auto!important'));
assert.ok(css.includes('padding:3px 8px!important'));

console.log('CII Writer2 multi-source review ownership + compact manual controls: PASS');
