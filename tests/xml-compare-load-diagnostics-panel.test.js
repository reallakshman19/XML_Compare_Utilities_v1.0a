import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appendLoadDiagnosticRow, clearLoadDiagnosticsState, createLoadDiagnosticsState, renderXmlCompareLoadDiagnosticsPanelHtml } from '../xml-compare/XmlCompareLoadDiagnosticsPanel.js';
import { _test as tabTest } from '../tabs/xml-compare-tab.js';
import { installXmlCompareLoadDiagnosticsRuntime } from '../tabs/xml-compare-load-diagnostics-runtime.js';

let bounded = createLoadDiagnosticsState();
for (let i = 0; i < 85; i += 1) bounded = appendLoadDiagnosticRow(bounded, { event: 'file-selected', side: i % 2 ? 'b' : 'a', fileName: `f-${i}.xml`, workspaceRevision: i });
assert.equal(bounded.rows.length, 80, 'load diagnostics remain bounded');
assert.equal(bounded.rows[0].fileName, 'f-5.xml', 'oldest rows are trimmed first');

const emptyHtml = renderXmlCompareLoadDiagnosticsPanelHtml(createLoadDiagnosticsState());
assert.ok(emptyHtml.includes('Load Diagnostics'));
assert.ok(emptyHtml.includes('No load diagnostics yet'));
assert.ok(emptyHtml.includes('data-xml-compare-action="clear-load-diagnostics"'));

let panelState = appendLoadDiagnosticRow(createLoadDiagnosticsState(), { side: 'a', event: 'file-read-success', fileName: '<source&.xml', chars: 12, size: 12, profile: 'categorized', message: '<loaded&ok>' });
panelState = appendLoadDiagnosticRow(panelState, { side: 'b', event: 'file-read-error', fileName: 'target.xml', message: 'bad <xml>' });
const rowsHtml = renderXmlCompareLoadDiagnosticsPanelHtml(panelState);
assert.ok(rowsHtml.includes('Source A'));
assert.ok(rowsHtml.includes('Target B'));
assert.ok(rowsHtml.includes('&lt;source&amp;.xml'));
assert.ok(rowsHtml.includes('&lt;loaded&amp;ok&gt;'));
assert.equal(rowsHtml.includes('<source&.xml'), false, 'file name is escaped');
assert.equal(rowsHtml.includes('bad <xml>'), false, 'message is escaped');

const cleared = clearLoadDiagnosticsState(panelState);
assert.equal(cleared.rows.length, 1);
assert.equal(cleared.rows[0].event, 'diagnostics-cleared');

const nativeState = tabTest.createInitialState();
nativeState.fileA = { name: 'kept.xml', size: 10 };
nativeState.textA = '<A/>';
tabTest.recordLoadFileEvent(nativeState, 'file-selected', nativeState.fileA, 'a');
tabTest.clearLoadDiagnostics(nativeState);
assert.equal(nativeState.fileA.name, 'kept.xml', 'clear diagnostics does not clear loaded file state');
assert.equal(nativeState.textA, '<A/>', 'clear diagnostics does not clear loaded XML text');
assert.equal(nativeState.loadDiagnostics.rows[0].event, 'diagnostics-cleared');

let reads = 0;
const xmlText = '<ROOT><PIPINGELEMENT LINE_ID="L1" /></ROOT>';
const nativeFile = { name: 'native-source.xml', size: xmlText.length, text: async () => { reads += 1; return xmlText; } };
const loadedText = await tabTest.storeLoadedFile(nativeFile, 'a', nativeState);
tabTest.recordLoadSuccess(nativeState, nativeFile, 'a', loadedText);
const success = nativeState.loadDiagnostics.rows.at(-1);
assert.equal(reads, 1, 'native load diagnostics do not cause a second file read');
assert.equal(success.event, 'file-read-success');
assert.equal(success.side, 'a');
assert.equal(success.fileName, 'native-source.xml');
assert.equal(success.chars, xmlText.length);
assert.equal(success.workspaceRevision, nativeState.workspaceRevision);

const badFile = { name: 'bad.xml', size: 7, text: async () => { throw new Error('boom'); } };
try { await tabTest.storeLoadedFile(badFile, 'b', nativeState); } catch (error) { tabTest.recordLoadError(nativeState, badFile, 'b', error); }
const failure = nativeState.loadDiagnostics.rows.at(-1);
assert.equal(failure.event, 'file-read-error');
assert.equal(failure.side, 'b');
assert.equal(failure.fileName, 'bad.xml');
assert.ok(failure.message.includes('boom'));

const shell = fs.readFileSync(new URL('../xml-compare/XmlCompareWorkspaceShell.js', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../tabs/xml-compare-load-diagnostics-runtime.js', import.meta.url), 'utf8');
assert.equal(shell.includes('xml-compare-load-diagnostics-runtime.js'), false, 'workspace shell no longer imports load diagnostics runtime');
assert.equal(shell.includes('loadTabDiagnostics'), false, 'workspace shell no longer tracks diagnostics loader');
assert.equal(runtime.includes('addEventListener'), false, 'runtime has no document listener ownership');
assert.equal(runtime.includes('capture'), false, 'runtime has no capture ownership');
assert.equal(runtime.includes('querySelector'), false, 'runtime has no DOM query/injection path');
assert.equal(runtime.includes('insertAdjacent'), false, 'runtime has no DOM injection path');
assert.equal(runtime.includes('file.text'), false, 'runtime has no independent file read path');
assert.equal(runtime.includes('data-xml-compare-loaded'), false, 'runtime has no stale loaded-card selector dependency');
assert.equal(installXmlCompareLoadDiagnosticsRuntime(), false, 'runtime installer is inert');

console.log('XML Compare native load diagnostics panel tests passed');
