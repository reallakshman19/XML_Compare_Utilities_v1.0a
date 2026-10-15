import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tab = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace.css', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace-ui.js', import.meta.url), 'utf8');
const output = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace-output.js', import.meta.url), 'utf8');

test('editable Preview uses a fixed viewport with an explicit vertical scrollbar and cache-busted CSS', () => {
  const wrap = css.match(/\.ciifr-sheet-wrap\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(wrap, /height:\s*clamp\(/);
  assert.match(wrap, /overflow-x:\s*auto/);
  assert.match(wrap, /overflow-y:\s*scroll/);
  assert.match(wrap, /scrollbar-gutter:\s*stable/);
  assert.match(wrap, /scrollbar-color:/);
  assert.match(css, /\.ciifr-sheet-wrap::\-webkit-scrollbar/);
  assert.match(tab, /cii-workspace-find-replace\.css\?v=20260904-padded-find-scroll-1/);
  assert.match(tab, /cii-workspace-find-replace-ui\.js\?v=20260904-padded-find-scroll-1/);
  assert.match(tab, /if \(existing\.href !== href\) existing\.href = href/);
  assert.match(panel, /fixed-height table with a dedicated vertical scrollbar/);
});

test('qualification KPI is neutral before validation and explicit after validation attempts', () => {
  assert.match(panel, /data-ciifr-qualification>—<\/dd>/);
  assert.doesNotMatch(panel, /NOT VALIDATED/);
  assert.match(ui, /function qualificationLabel/);
  assert.match(ui, /VALIDATION FAILED/);
  assert.match(ui, /POSTIMAGE BLOCKED/);
  assert.match(ui, /QUALIFICATION BLOCKED/);
  assert.match(ui, /QUALIFIED PREVIEW/);
  assert.match(ui, /APPLIED TO NEW COPY/);
  assert.doesNotMatch(ui, /'NOT VALIDATED'/);
});

test('UI exposes replaced CII export only after Validate and Apply-to-new-copy custody', () => {
  const validate = panel.indexOf('data-ciifr-validate');
  const apply = panel.indexOf('data-ciifr-apply');
  const exportCii = panel.indexOf('data-ciifr-download');
  assert.ok(validate >= 0 && validate < apply && apply < exportCii);
  assert.match(panel, /Export Replaced CII/);
  assert.match(panel, /applied, independently revalidated TARGET1/);
  assert.match(ui, /refs\.download\.disabled = !summary\.canDownload/);
  assert.match(ui, /buildFindReplaceDownloadArtifact\(session\)/);
  assert.match(ui, /result\.status !== 'READY_FOR_DOWNLOAD'/);
  assert.match(ui, /session\.release\?\.status !== 'APPLIED_TO_NEW_COPY'/);
  assert.match(ui, /downloadText/);
});

test('export backend emits a new CII artifact without writer or overwrite authority', () => {
  assert.match(output, /\.find-replace\.cii/);
  assert.match(output, /originalFileOverwritten:\s*false/);
  assert.match(output, /writerInvoked:\s*false/);
  assert.match(output, /APPLY_TO_NEW_COPY_REQUIRED/);
  assert.match(output, /READY_FOR_DOWNLOAD/);
  assert.match(output, /APPLIED_TARGET1_HASH_MISMATCH/);
});
