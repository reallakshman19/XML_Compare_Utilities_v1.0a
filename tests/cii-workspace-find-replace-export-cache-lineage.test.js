import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const BUILD = 'standalone-20260903-ciifr-export-refresh-1';
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Pages and Utilities cache lineage forces the current CII Workspace controller', () => {
  const sources = [
    read('index.html'),
    read('main-rhbg-fitguard.js'),
    read('core/app.js'),
    read('core/app-standalone-runtime.js'),
    read('tabs/psnm-utility-pages-entry.js'),
    read('tabs/psnm-utility-tab.js'),
  ];
  for (const source of sources) assert.match(source, new RegExp(BUILD));

  const workspace = read('tabs/cii-workspace/cii-workspace-tab.js');
  assert.match(workspace, /cii-workspace-find-replace-ui\.js\?v=20260904-padded-find-scroll-1/);
});

test('current Find & Replace UI enables export only from the applied release state', () => {
  const ui = read('tabs/cii-workspace/cii-workspace-find-replace-ui.js');
  const session = read('tabs/cii-workspace/cii-workspace-find-replace-session.js');
  const output = read('tabs/cii-workspace/cii-workspace-find-replace-output.js');

  assert.match(ui, /refs\.download\.disabled = !summary\.canDownload/);
  assert.match(ui, /session = applyFindReplaceToNewCopy\(session\); render\(\);/);
  assert.match(session, /canDownload: appliedToNewCopy/);
  assert.match(session, /status: APPLIED_TO_NEW_COPY/);
  assert.match(output, /READY_FOR_DOWNLOAD/);
  assert.match(output, /APPLY_TO_NEW_COPY_REQUIRED/);
});
