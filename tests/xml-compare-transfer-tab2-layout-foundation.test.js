import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';

const css = readFileSync('tabs/xml-compare-transfer-noise-reduction.css', 'utf8');

const input = {
  source: { fileName: 'very-long-source-file-name-that-should-not-force-layout-overlap.xml' },
  target: { fileName: 'very-long-target-file-name-that-should-not-force-layout-overlap.xml', text: '<Target />' },
  targetText: '<Target />',
  aim: { transferBlocks: ['RestraintsBlock', 'NodeNameBlock', 'VeryLongBlockNameThatMustWrapWithoutBreakingTheTileLayout'] },
  transferModal: { activeTab: 'transfer-compare' },
  transferWorkflowGate: { blockers: [], okForTransferStage: true, nextAction: 'Stage transfer after readiness and approval are complete.' },
};

const applied = {
  transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock', 'VeryLongBlockNameThatMustWrapWithoutBreakingTheTileLayout'] },
  transferAudit: { updatedCount: 2, skippedCount: 1, blockerCount: 0 },
  transferLastResult: {
    ok: true,
    scope: 'node',
    updatedCount: 2,
    skippedCount: 1,
    blockedCount: 0,
    patchedTargetText: '<Target><Patched>true</Patched></Target>',
  },
};

const html = renderXmlCompareTransferModalPopupHtml({ input, tState: applied, stageScope: 'node', transferPreview: { summary: { previewCount: 9 } } });

assert.ok(html.includes('xmlc-transfer-review'), 'Tab 2 root class must be present');
assert.ok(html.includes('xmlc-transfer-dashboard-grid'), 'dashboard tile grid must be present');
assert.ok(html.includes('xmlc-transfer-output-actions'), 'output action tile region must be present');
assert.ok(html.includes('data-xml-compare-dashboard-card="exports"'), 'applied state must include exports dashboard card');
assert.ok(html.includes('Export all transfer artifacts'), 'applied state must include long export labels that require wrapping');
assert.ok(html.includes('VeryLongBlockNameThatMustWrapWithoutBreakingTheTileLayout'), 'test fixture must include long text pressure');

const dashboardGridRule = css.match(/\.xmlc-transfer-dashboard-grid\s*\{[\s\S]*?\}/)?.[0] || '';
const actionGridRule = css.match(/\.xmlc-transfer-output-actions\s*\{[\s\S]*?\}/)?.[0] || '';
const actionButtonRule = css.match(/\.xmlc-transfer-output-actions \.xmlc-transfer-action\s*\{[\s\S]*?\}/)?.[0] || '';

assert.ok(dashboardGridRule.includes('display: grid'), 'dashboard tiles must be grid-based');
assert.ok(dashboardGridRule.includes('minmax(min(100%, 180px), 1fr)'), 'dashboard tiles must have bounded columns');
assert.ok(!dashboardGridRule.includes('display: flex'), 'dashboard tiles must not use collision-prone flex rows');

assert.ok(actionGridRule.includes('display: grid'), 'action tiles must be grid-based');
assert.ok(actionGridRule.includes('minmax(min(100%, 170px), 1fr)'), 'action tiles must have bounded columns');
assert.ok(!actionGridRule.includes('display: flex'), 'action tiles must not use collision-prone flex rows');

assert.ok(actionButtonRule.includes('white-space: normal'), 'action buttons must allow label wrapping');
assert.ok(actionButtonRule.includes('overflow-wrap: anywhere'), 'action buttons must wrap long text');
assert.ok(!actionButtonRule.includes('white-space: nowrap'), 'action buttons must not use nowrap');

console.log('XML Compare Transfer Tab 2 tile layout foundation regression guard passed');
