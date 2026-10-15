import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  parseSupportReportXmlAsync,
  SUPPORT_REPORT_INLINE_PARSE_MAX_BYTES,
  SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES,
} from '../tabs/support-steel-relationship-builder/support-report-parse-client.js';
import { _test as safetyTest } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js?v=20260913-support-report-large-xml-test-1';
import { _test as viewTest, SUPPORT_REPORT_TRACE_PREVIEW_LIMIT } from '../tabs/support-steel-relationship-builder/support-report-view.js?v=20260913-support-report-large-xml-test-1';

const changedJs = [
  'tabs/support-steel-relationship-builder/support-report-addon.js',
  'tabs/support-steel-relationship-builder/support-report-clash-evidence.js',
  'tabs/support-steel-relationship-builder/support-report-clash-safety.js',
  'tabs/support-steel-relationship-builder/support-report-clash-test-context.js',
  'tabs/support-steel-relationship-builder/support-report-parse-client.js',
  'tabs/support-steel-relationship-builder/support-report-parse-worker.js',
  'tabs/support-steel-relationship-builder/support-report-view.js',
  'tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js',
];

class FakeWorker {
  static last = null;

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = new Map();
    this.terminated = false;
    FakeWorker.last = this;
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  postMessage(message) {
    this.message = message;
    queueMicrotask(() => this.listeners.get('message')?.({
      data: { id: message.id, ok: true, result: { rowCount: 17, sourceUnits: 'm' } },
    }));
  }
  terminate() { this.terminated = true; }
}

test('changed Support Report JavaScript remains syntactically valid', () => {
  for (const file of changedJs) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file} failed JavaScript parsing:\n${result.stderr || result.stdout}`);
  }
});

test('large Blob/File source is handed to a module worker without main-thread text materialization', async () => {
  let textReads = 0;
  const source = {
    size: SUPPORT_REPORT_INLINE_PARSE_MAX_BYTES + 1024,
    async text() { textReads += 1; throw new Error('main thread must not read the large source'); },
  };
  const result = await parseSupportReportXmlAsync(source, {}, { WorkerCtor: FakeWorker });
  assert.equal(result.rowCount, 17);
  assert.equal(textReads, 0);
  assert.equal(FakeWorker.last.message.source, source);
  assert.equal(FakeWorker.last.options.type, 'module');
  assert.equal(FakeWorker.last.terminated, true);
});

test('large XML fails visibly instead of freezing when module workers are unavailable', async () => {
  let textReads = 0;
  const source = {
    size: SUPPORT_REPORT_INLINE_PARSE_MAX_BYTES + 1,
    async text() { textReads += 1; return '<exchange />'; },
  };
  await assert.rejects(
    parseSupportReportXmlAsync(source, {}, { WorkerCtor: null, fallbackParser: () => ({}) }),
    /requires browser module-worker support/i,
  );
  assert.equal(textReads, 0);
});

test('small XML retains inline fallback compatibility', async () => {
  const source = {
    size: 64,
    async text() { return '<exchange units="m"></exchange>'; },
  };
  const parsed = await parseSupportReportXmlAsync(source, { sourceUnits: 'm' }, {
    WorkerCtor: null,
    fallbackParser(text, options) { return { text, options }; },
  });
  assert.match(parsed.text, /exchange/);
  assert.equal(parsed.options.sourceUnits, 'm');
});

test('safety classification consumes first-pass raw clash metadata', () => {
  const unsafe = safetyTest.classifyUnsafeClashes([
    {
      clashName: 'Ambiguous', guid: 'AMB', clashTestIndex: 2,
      branchBearingObjectCount: 2, secondaryFamilyIds: ['PS-100'],
    },
    {
      clashName: 'Conflict', guid: 'CON', clashTestIndex: 3,
      branchBearingObjectCount: 1, secondaryFamilyIds: ['PS-100', 'SL-200'],
    },
  ]);
  assert.equal(unsafe.size, 2);
  assert.equal(unsafe.get('2\u0000AMB').code, 'SUPPORT_REPORT_AMBIGUOUS_PIPE_SIDE');
  assert.equal(unsafe.get('3\u0000CON').code, 'SUPPORT_REPORT_CONFLICTING_SECONDARY_FAMILY');
  assert.equal(safetyTest.validateStructure('<exchange><clashtest><clashresult></clashtest></exchange>').ok, false);
});

test('large UI traces are capped without truncating report/export data', () => {
  const rows = Array.from({ length: SUPPORT_REPORT_TRACE_PREVIEW_LIMIT + 25 }, (_, index) => ({
    evidence: {
      jsonTrace: {
        posClusters: [{ posClusterId: `P${index + 1}`, members: [] }],
      },
    },
  }));
  const preview = viewTest.collectTraceEntries(rows, SUPPORT_REPORT_TRACE_PREVIEW_LIMIT);
  assert.equal(preview.entries.length, SUPPORT_REPORT_TRACE_PREVIEW_LIMIT);
  assert.equal(preview.truncated, true);

  const view = readFileSync('tabs/support-steel-relationship-builder/support-report-view.js', 'utf8');
  assert.match(view, /rows\.slice\(0, SUPPORT_REPORT_TABLE_PREVIEW_LIMIT\)/);
  assert.match(view, /CSV, XLSX and Debug exports still contain the complete report/);
  assert.match(view, /Trace CSV and Debug JSON still contain the complete decision trail/);
});

test('Support Report UI stages large files instead of copying them into textareas', () => {
  const addon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
  const bootstrap = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', 'utf8');
  assert.equal(SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES, 1024 * 1024);
  assert.match(addon, /file\.size <= SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES/);
  assert.match(addon, /staged for background parsing \(text preview omitted\)/);
  assert.match(addon, /parseSupportReportXmlAsync\(primarySource/);
  assert.match(addon, /new AbortController\(\)/);
  assert.match(addon, /state\.runAbort\?\.abort\(\)/);
  assert.match(bootstrap, /perf=20260913-support-report-large-xml-1/);
});
