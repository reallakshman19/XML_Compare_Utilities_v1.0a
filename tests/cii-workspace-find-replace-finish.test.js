import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const panel = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace-ui.js', import.meta.url), 'utf8');
const product = `${panel}\n${ui}`;

test('finished CII Find & Replace exposes the supported app surface without pending FORCE UI', () => {
  assert.match(panel, /1\. Target CII v14/);
  assert.match(panel, /2\. Scope and CSV/);
  assert.match(panel, /3\. Manual table entry/);
  assert.match(panel, /4\. Preview and approval/);
  assert.match(panel, /5\. Validate, Apply to New Copy, and Download/);
  assert.match(panel, /Supported block scopes:<\/strong> Node Name and Displacement/);
  assert.match(ui, /SUPPORTED_GRID_BLOCKS/);
  assert.match(ui, /\['NODENAME', 'NODE NAME'\]/);
  assert.match(ui, /\['DISPLACEMENT', 'DISPLACEMENT'\]/);
  assert.doesNotMatch(product, /FORCE — qualification pending/);
  assert.doesNotMatch(ui, /\['FORCE', 'FORCE/);
});

test('unsupported pasted block values remain fail-closed instead of becoming selectable features', () => {
  assert.match(ui, /option\.textContent = `\$\{normalized\} — unsupported`/);
  assert.match(ui, /option\.disabled = true/);
  assert.match(ui, /if \(compact === 'FORCE' \|\| compact === 'FORCMNT'\) return 'FORCE'/);
});

test('release path is new-copy only and keeps direct writer authority absent', () => {
  const validate = panel.indexOf('data-ciifr-validate');
  const apply = panel.indexOf('data-ciifr-apply');
  const download = panel.indexOf('data-ciifr-download');
  assert.ok(validate >= 0 && validate < apply && apply < download);
  assert.match(panel, /TARGET0 is never overwritten/);
  assert.match(ui, /applyFindReplaceToNewCopy/);
  assert.doesNotMatch(product, /Direct Apply to File/);
  assert.doesNotMatch(ui, /target-writer|writer1|writer2|writeFile|FileSystem/);
});
