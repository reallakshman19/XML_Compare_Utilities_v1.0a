import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertSupportReportEvidenceReady,
  supportReportBlockingDiagnostic,
} from '../tabs/support-steel-relationship-builder/support-report-build-gate.js';

test('Support Report build gate blocks ERROR diagnostics', () => {
  const error = { severity: 'ERROR', code: 'BROKEN', message: 'unsafe clash evidence' };
  const warn = { severity: 'WARN', code: 'REVIEW', message: 'review only' };
  assert.equal(supportReportBlockingDiagnostic([warn, error]), error);
  assert.throws(() => assertSupportReportEvidenceReady({ rows: [{}], diagnostics: [warn, error] }), /unsafe clash evidence/);
});

test('Support Report build gate permits WARN and INFO when usable rows exist', () => {
  const evidence = { rows: [{}], diagnostics: [
    { severity: 'WARN', code: 'REVIEW' },
    { level: 'INFO', code: 'TRACE' },
  ] };
  assert.equal(supportReportBlockingDiagnostic(evidence.diagnostics), null);
  assert.equal(assertSupportReportEvidenceReady(evidence), evidence);
});

test('Support Report build gate blocks empty evidence and surfaces the parser warning', () => {
  assert.throws(() => assertSupportReportEvidenceReady({
    rows: [],
    diagnostics: [{ severity: 'WARN', code: 'MISSING_PIPE_SIDE', message: 'No branch-bearing pipe side.' }],
  }), /no usable clash evidence.*No branch-bearing pipe side/i);
});

test('Support Report build gate accepts level-style ERROR diagnostics', () => {
  assert.throws(() => assertSupportReportEvidenceReady({
    rows: [{}],
    diagnostics: [{ level: 'error', code: 'LEGACY_ERROR' }],
  }), /LEGACY_ERROR/);
});

test('Support Report UI routes readiness through the gate before report construction', () => {
  const addon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
  const bootstrap = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', 'utf8');
  assert.match(addon, /support-report-build-gate\.js\?v=20260909-support-report-empty-block-7/);
  assert.match(addon, /assertSupportReportEvidenceReady\(parseSupportReportClashXml\(xmlText\)\)/);
  assert.ok(addon.indexOf('assertSupportReportEvidenceReady(parseSupportReportClashXml(xmlText))')
    < addon.indexOf('buildSupportReportBundle({ clashEvidence, relationshipBundle })'));
  assert.match(bootstrap, /support-report-addon\.js\?v=20260910-support-report-owner-contract-15/);
});
