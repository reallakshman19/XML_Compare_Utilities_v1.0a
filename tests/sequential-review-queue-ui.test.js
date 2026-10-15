import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const queue = read('tabs/sequential-sketcher/review/sequential-blocked-review-queue.js');
assert.match(queue, /SequentialBlockedBranchReviewQueue\.v1/);
assert.match(queue, /buildSequentialBlockedReviewQueue/);
assert.match(queue, /refreshSequentialBlockedReviewQueue/);
assert.match(queue, /filterSequentialBlockedReviewQueue/);
assert.match(queue, /adjacentSequentialReviewRow/);
assert.match(queue, /candidateId/);
assert.match(queue, /fromPortId/);
assert.match(queue, /toPortId/);
assert.match(queue, /missingEvidenceClass/);
assert.match(queue, /expectedContinuationCategory/);
assert.match(queue, /constructionFingerprint/);
assert.doesNotMatch(queue, /applyConstructionDecision|DECISION_ACTIONS|acceptAll|bulkAccept/i,
  'queue analysis must not import decision mutation or bulk-acceptance APIs');
assert.doesNotMatch(queue, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const exportsSource = read('tabs/sequential-sketcher/review/sequential-review-queue-export.js');
assert.match(exportsSource, /SequentialDecisionRegister\.v1/);
assert.match(exportsSource, /unresolvedRows/);
assert.match(exportsSource, /manualRows/);
assert.match(exportsSource, /candidatePortPairs/);
assert.match(exportsSource, /previousConstructionFingerprint/);
assert.match(exportsSource, /resultingConstructionFingerprint/);
assert.match(exportsSource, /unresolvedCsv/);
assert.match(exportsSource, /manualCsv/);
assert.match(exportsSource, /registerJson/);
assert.doesNotMatch(exportsSource, /applyConstructionDecision|acceptAll|bulkAccept/i);

const controller = read('tabs/sequential-sketcher/review/sequential-review-queue-controller.js');
assert.match(controller, /data-ssk-review-build/);
assert.match(controller, /buildSequentialBlockedReviewQueue/);
assert.match(controller, /filterSequentialBlockedReviewQueue/);
assert.match(controller, /createSequentialDecisionRegisterExports/);
assert.match(controller, /if \(event\.target\?\.closest\?\.\('\[data-ssk-review-build\]'\)\) \{ build\(\); return; \}/);
assert.match(controller, /if \(branchRegistry\.get\(snapshot\.branchId\)\) continue/,
  'explicit analysis must not overwrite existing branch workspaces');
assert.match(controller, /options\.openBranch\?\.\(row\.branchId\)/);
assert.match(controller, /No branch was approved or bulk-resolved/);
assert.doesNotMatch(controller, /applyConstructionDecision|DECISION_ACTIONS|acceptAll|bulkAccept/i);

const registry = read('tabs/sequential-sketcher/sequential-branch-workspace-state.js');
assert.match(registry, /get\(branchIdValue\)/);
assert.match(registry, /entries\(\)/);

const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
for (const selector of [
  'data-ssk-review-build',
  'data-ssk-review-summary',
  'data-ssk-review-status',
  'data-ssk-review-reason',
  'data-ssk-review-search',
  'data-ssk-review-list',
  'data-ssk-review-prev',
  'data-ssk-review-next',
  'data-ssk-review-position',
  'data-ssk-review-export="unresolved-csv"',
  'data-ssk-review-export="manual-csv"',
  'data-ssk-review-export="register-json"',
]) assert.match(markup, new RegExp(selector));
assert.match(markup, /does not approve or bulk-resolve any branch/);

const workspace = read('tabs/sequential-sketcher/sequential-sketcher-workspace.js');
assert.match(workspace, /mountSequentialReviewQueueController/);
assert.match(workspace, /reviewController\?\.reset\(\)/);
assert.match(workspace, /reviewController\?\.refresh\(\)/);
assert.match(workspace, /reviewController\?\.selectBranch\(branchId\)/);
assert.match(workspace, /getReviewQueue/);
assert.match(workspace, /getBranchRegistry: \(\) => model\.branchRegistry/);

const css = read('tabs/sequential-sketcher/sequential-sketcher.css');
assert.match(css, /\.ssk-review-queue/);
assert.match(css, /\.ssk-review-filters/);
assert.match(css, /\.ssk-review-list/);
assert.match(css, /\.ssk-review-nav/);
assert.match(css, /\.ssk-review-exports/);

const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
const utility = read('tabs/psnm-utility-tab.js');
assert.match(tab, /20260717-ssk-workspace-apply-receipts-1/);
assert.match(utility, /20260718-ssk-geometry-order-1/);

console.log('sequential blocked review queue UI tests passed');
