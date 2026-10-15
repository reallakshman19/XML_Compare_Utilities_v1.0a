import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js', import.meta.url), 'utf8');

for (const token of [
  'data-ciiw-ms-manual-editor',
  'data-ciiw-ms-manual-source',
  'data-ciiw-ms-manual-target',
  'data-ciiw-ms-manual-add',
  'anchorPairsBySource',
  'manualAnchorPairsBySource',
  'reviewed manual anchor',
]) assert.ok(ui.includes(token), `multi-source manual fallback must contain ${token}`);

assert.ok(ui.includes('if (loops.length) rows.push([item.sourceId, loops]);'),
  'empty automatic base arrays must be omitted so manual anchorPairs can route through the legacy locked-anchor path');
assert.ok(ui.includes("authorityModeBySource.set(id, 'AUTO')"),
  'choosing an automatic base must activate AUTO without erasing manual evidence');
assert.ok(ui.includes("authorityModeBySource.set(id, 'MANUAL')"),
  'adding a manual anchor must activate MANUAL without erasing automatic evidence');
assert.ok(!ui.includes('selectedBySource.set(id, new Set());'),
  'qualified selected bases must never be destroyed by a manual claim');
assert.ok(ui.includes('data-ciiw-ms-authority-switch'),
  'both retained evidence lanes require an explicit reviewable authority switch');
assert.ok(ui.includes('manual fallback prefilled'),
  'Use manual anchor must prefill editable fields rather than throw the prior no-qualified-loop error');

const expected = new Map([
  ['9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b', 'S1'],
  ['7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd', 'S2'],
  ['c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa', 'S3'],
]);
const selected = ['S3', 'S2', 'S1'];
const resolved = [];
for (const fileLabel of selected) {
  const bytes = await readFile(new URL(`../Benchmark/${fileLabel}.CII`, import.meta.url));
  const sha = createHash('sha256').update(bytes).digest('hex');
  resolved.push([expected.get(sha), fileLabel, sha]);
}
resolved.sort(([a], [b]) => a.localeCompare(b));
assert.deepEqual(resolved.map(([id, file]) => [id, file]), [['S1', 'S1'], ['S2', 'S2'], ['S3', 'S3']]);

const preimage = resolved.map(([id, , sha]) => `${id}:${sha}\n`).join('');
assert.equal(createHash('sha256').update(preimage).digest('hex'),
  '5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3');

console.log('CII Writer2 multi-source manual anchors + canonical source identity: PASS');
