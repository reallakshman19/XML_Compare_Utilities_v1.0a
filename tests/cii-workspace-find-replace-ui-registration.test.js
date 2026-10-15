import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tab = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace-ui.js', import.meta.url), 'utf8');
const model = fs.readFileSync(new URL('../tabs/cii-workspace/cii-workspace-find-replace-editor-model.js', import.meta.url), 'utf8');
const panelAndUi = `${panel}\n${ui}`;

test('existing CII installer exposes exactly one v14 Find & Replace tile', () => {
  assert.equal((tab.match(/data-ciiw-open-find-replace/g) || []).length, 1);
  assert.match(tab, /↔ CII Find & Replace — V14/);
  assert.match(tab, /mountCiiFindReplaceShell/);
  assert.match(tab, /cii-workspace-find-replace\.css/);
});

test('Preview is the single editable Excel-style Find / Replace table', () => {
  for (const selector of [
    'data-ciifr-target', 'data-ciifr-csv', 'data-ciifr-editor-grid', 'data-ciifr-preview-body',
    'data-ciifr-add-row', 'data-ciifr-clear-grid', 'data-ciifr-copy-grid',
    'data-ciifr-validate', 'data-ciifr-apply', 'data-ciifr-download', 'data-ciifr-export-audit',
  ]) assert.match(panel, new RegExp(selector));
  assert.match(panel, /Preview is the editor/);
  assert.match(panel, /Find and Replace are always the first two editable columns/);
  assert.doesNotMatch(panel, /data-ciifr-manual-grid|data-ciifr-manual-body|data-ciifr-sync-grid/);
  assert.doesNotMatch(ui, /manualGridDirty|Update Preview/);
  assert.match(ui, /replaceFindReplaceEditorRows/);
});

test('editor supports Excel paste, copy, row growth and keyboard navigation', () => {
  assert.match(ui, /parseFindReplaceSpreadsheetPaste/);
  assert.match(ui, /editorFieldsForMode/);
  assert.match(ui, /refs\.grid, 'paste', onPaste/);
  assert.match(ui, /refs\.grid, 'keydown', onKeyDown/);
  assert.match(ui, /findReplaceRowsToTsv/);
  assert.match(ui, /clipboard\?\.writeText|clipboard\.writeText/);
  assert.match(ui, /ensureEditorRows\(startRow \+ matrix\.length\)/);
  assert.match(panel, /copy Find and Replace columns/i);
});

test('slash-list normalization is visible and uses only the first token', () => {
  assert.match(model, /FIRST_SLASH_TOKEN/);
  assert.match(model, /trimmed\.split\(','\)\[0\]/);
  assert.match(panel, /\/SL-104\.8, \/X6/);
  assert.match(panel, /SL-104\.8/);
});

test('conflict/duplicate/validation diagnostics are first-class and validation-blocking', () => {
  assert.match(panel, /Conflict, duplicate &amp; validation log/);
  assert.match(panel, /data-ciifr-diagnostic-summary/);
  assert.match(panel, /data-ciifr-diagnostic-log/);
  assert.match(model, /CONFLICTING_REPLACEMENTS/);
  assert.match(model, /DUPLICATE_FIND_REPLACE/);
  assert.match(model, /SHARED_REPLACEMENT_TARGET/);
  assert.match(model, /NO_MATCHES_IN_SCOPE/);
  assert.match(ui, /refs\.validate\.disabled = diag\.hasErrors \|\| !summary\.canValidate/);
  assert.match(ui, /Approve blocked: resolve the row conflict\/duplicate first/);
});

test('editing uses one transactional session row set and invalidates stale qualification/release', () => {
  assert.match(ui, /syncEditorSession/);
  assert.match(ui, /replaceFindReplaceEditorRows\(session/);
  assert.match(ui, /operationSignature/);
  assert.match(ui, /before\.status === 'APPROVED' \|\| before\.status === 'REJECTED'/);
});

test('finalization remains Validate then Apply then Download', () => {
  const validate = panel.indexOf('data-ciifr-validate');
  const apply = panel.indexOf('data-ciifr-apply');
  const download = panel.indexOf('data-ciifr-download');
  assert.ok(validate >= 0 && validate < apply && apply < download);
  assert.match(panel, /Apply to New Copy/);
  assert.doesNotMatch(panel, /Direct Apply to File/);
  assert.match(ui, /applyFindReplaceToNewCopy/);
});

test('finished block surface still exposes only NODE NAME and DISPLACEMENT', () => {
  assert.match(panel, /Supported block scopes:<\/strong> Node Name and Displacement/);
  assert.doesNotMatch(panelAndUi, /FORCE — qualification pending/);
  assert.doesNotMatch(ui, /\['FORCE', 'FORCE/);
  assert.match(ui, /option\.textContent = `\$\{normalized\} — unsupported`/);
});

test('UI controller does not import writer or direct file-mutation modules', () => {
  assert.doesNotMatch(ui, /target-writer|writer1|writer2|writeFile|FileSystem/);
});
