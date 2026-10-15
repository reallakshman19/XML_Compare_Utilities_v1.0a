import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  SUPPORT_REPORT_COMPLETENESS,
  supportReportCompleteness,
  supportReportExportFileName,
} from '../tabs/support-steel-relationship-builder/support-report-ui-state.js';

function report(xmlOnlyRowCount, reportRowCount = 5) {
  return { summary: { xmlOnlyRowCount, reportRowCount } };
}

test('partial enrichment produces explicit partial state and detached filenames', () => {
  const value = supportReportCompleteness(report(2));
  assert.equal(value.state, SUPPORT_REPORT_COMPLETENESS.PARTIAL);
  assert.equal(value.partial, true);
  assert.equal(value.xmlOnlyRowCount, 2);
  assert.equal(supportReportExportFileName(report(2), 'xlsx'), 'support-report-partial.xlsx');
  assert.equal(supportReportExportFileName(report(2), '.CSV'), 'support-report-partial.csv');
});

test('reports without XML-only rows retain the existing neutral filenames', () => {
  const value = supportReportCompleteness(report(0));
  assert.equal(value.state, SUPPORT_REPORT_COMPLETENESS.NO_XML_ONLY_ROWS);
  assert.equal(value.partial, false);
  assert.equal(supportReportExportFileName(report(0), 'xlsx'), 'support-report.xlsx');
  assert.equal(supportReportExportFileName(report(0), 'csv'), 'support-report.csv');
});

test('invalid counts fail safe to zero and export extension is required', () => {
  assert.equal(supportReportCompleteness(report(-3)).xmlOnlyRowCount, 0);
  assert.equal(supportReportCompleteness(report('not-a-number')).xmlOnlyRowCount, 0);
  assert.equal(supportReportCompleteness(report(1.9)).xmlOnlyRowCount, 1);
  assert.throws(() => supportReportExportFileName(report(1), ''), /extension is required/i);
});

test('Support Report UI marks partial readiness and preserves invalidation export blocking', () => {
  const addon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
  const view = readFileSync('tabs/support-steel-relationship-builder/support-report-view.js', 'utf8');
  assert.match(addon, /Support Report ready — partial enrichment/);
  assert.match(addon, /supportReportExportFileName\(report, 'xlsx'\)/);
  assert.match(addon, /supportReportExportFileName\(report, 'csv'\)/);
  assert.match(addon, /function invalidate[\s\S]*?setExportEnabled\(popup, false\);/);
  assert.match(view, /data-ssr-completeness="partial"/);
  assert.match(view, /not complete engineering output/);
});

test('WP-008 cache routing keeps the Owner contract token and adds a fresh UI dimension', () => {
  const addon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
  const bootstrap = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', 'utf8');
  const token = '20260910-support-report-ui-completeness-16';
  assert.match(addon, new RegExp(`support-report-view\\.js\\?v=20260910-support-report-owner-contract-15&ui=${token}`));
  assert.match(addon, new RegExp(`support-report-ui-state\\.js\\?v=${token}`));
  assert.match(bootstrap, new RegExp(`support-report-addon\\.js\\?v=20260910-support-report-owner-contract-15&ui=${token}`));
});
