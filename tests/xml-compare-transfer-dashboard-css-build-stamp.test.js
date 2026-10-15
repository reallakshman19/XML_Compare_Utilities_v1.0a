import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const transferCss = read('tabs/xml-compare-transfer-output-ui.css');
const noiseCss = read('tabs/xml-compare-transfer-noise-reduction.css');
const buildCss = read('styles/app-build-stamp.css');
const indexHtml = read('index.html');
const mainEntry = read('main-rhbg-fitguard.js');
const appDelegate = read('core/app.js');
const runtime = read('core/app-standalone-runtime.js');
const utilityTab = read('tabs/psnm-utility-tab.js');
const pipelineTab = read('tabs/pipeline-3d-model/pipeline-3d-model-tab.js');
const addon = read('tabs/pipeline-3d-model/pipeline-3d-model-table-paste-addon.js');
const profileRuntime = read('tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation-runtime.js');
const adapter = read('tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js');
const propagation = read('tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation.js');
const writer = read('tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js');
const startupToken = '20260722-p3d-base-039-1';
const actionRule = noiseCss.match(/\.xmlc-transfer-output-actions \.xmlc-transfer-action\s*\{[\s\S]*?\}/)?.[0] || '';

function includesAll(source, needles) {
  for (const needle of needles) assert.ok(source.includes(needle), `Missing required text: ${needle}`);
}

includesAll(transferCss, [
  '.xmlc-transfer-output-dashboard', '.xmlc-transfer-next-action',
  '.xmlc-transfer-dashboard-grid', '.xmlc-transfer-dashboard-card.is-ready',
  '.xmlc-transfer-dashboard-card.is-blocked', '.xmlc-transfer-dashboard-card.is-not-available',
  '.xmlc-transfer-detail-group > summary', '@media (max-width: 900px)',
]);
includesAll(noiseCss, [
  'M23: Transfer Tab 2 tile layout foundation', '.xmlc-transfer-review',
  'box-sizing: border-box', 'grid-template-columns: minmax(0, 1fr)',
  'grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  'grid-template-areas:',
  'grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  '@media (max-width: 1180px)', '@media (max-width: 720px)',
]);
includesAll(actionRule, ['white-space: normal', 'overflow-wrap: anywhere']);
assert.ok(!actionRule.includes('white-space: nowrap'));
assert.ok(!noiseCss.includes('.xmlc-transfer-dashboard-grid {\n  display: flex'));
assert.ok(!noiseCss.includes('.xmlc-transfer-output-actions {\n  display: flex'));
includesAll(buildCss, ['.app-build-stamp', 'text-overflow: ellipsis']);
assert.ok(!buildCss.includes('display: none'));
includesAll(indexHtml, [
  'styles/app-build-stamp.css?v=20260708-m23-transfer-tile-layout',
  'xml-compare-transfer-output-ui.css?v=20260707-m18-dashboard-css',
  'xml-compare-transfer-noise-reduction.css?v=20260708-m23-transfer-tile-layout',
  `main-rhbg-fitguard.js?v=${startupToken}`,
  `pipeline-3d-model-project-adapter.js?v=20260717-platform-1\": \"./tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js?v=${startupToken}`,
  `pipeline-3d-model-config.js?v=20260711-collinear-1\": \"./tabs/pipeline-3d-model/pipeline-3d-model-config.js?v=${startupToken}`,
  `pipeline-3d-model-property-sections.js?v=20260722-p3d-property-sections-1\": \"./tabs/pipeline-3d-model/pipeline-3d-model-property-sections.js?v=${startupToken}`,
]);
assert.ok(indexHtml.indexOf('xml-compare-transfer-output-ui.css') < indexHtml.indexOf('xml-compare-transfer-noise-reduction.css'));
includesAll(mainEntry, [`./core/app.js?v=${startupToken}`]);
includesAll(appDelegate, [
  `./app-standalone-runtime.js?v=${startupToken}`,
  'support-steel-relationship-bootstrap.js?v=20260717-startup-parse-hotfix-1',
  'ps-family-evidence-audit-bootstrap.js?v=20260717-startup-parse-hotfix-1',
]);
includesAll(runtime, [
  "build: 'M27 P3D-BASE-039 parseable Pipeline baseline · 2026-07-22'",
  `standalone-${startupToken}`, '../tabs/xml-compare-tab.js?v=20260717-psi-support-1',
  "className = 'app-build-stamp'",
]);
includesAll(utilityTab, [
  `pipeline-3d-model-tab.js?v=${startupToken}`,
  `pipeline-3d-model-table-paste-addon.js?v=${startupToken}`,
]);
includesAll(pipelineTab, [
  'pipeline-3d-model-project-adapter.js?v=20260717-platform-1',
  'pipeline-3d-model-config.js?v=20260711-collinear-1',
]);
includesAll(addon, [`pipeline-3d-model-profile-propagation-runtime.js?v=${startupToken}`]);
includesAll(profileRuntime, ['pipeline-3d-model-project-adapter.js?v=20260724-p3d-hard-051-1']);
includesAll(adapter, ['pipeline-3d-model-profile-propagation.js?v=20260724-p3d-core-050-1']);
includesAll(propagation, [`pipeline-3d-model-xml-builder.js?v=${startupToken}`]);
includesAll(writer, [`pipeline-3d-model-inputxml-document.js?v=${startupToken}`]);

console.log('XML Compare transfer layout and M27 P3D cache-lineage guards passed.');