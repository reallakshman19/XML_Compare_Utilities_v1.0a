import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const preview = read('tabs/sequential-sketcher/persistence/sequential-workspace-import-preview.js');
assert.match(preview, /SequentialWorkspaceImportPreview\.v1/);
assert.match(preview, /sequentialWorkspaceCurrentStateFingerprint/);
assert.match(preview, /buildSequentialWorkspaceImportPreview/);
assert.match(preview, /formatSequentialWorkspaceImportPreview/);
assert.match(preview, /sourceRelation/);
assert.match(preview, /overwrittenWorkspaceBranchIds/);
assert.match(preview, /removedWorkspaceBranchIds/);
assert.match(preview, /requiresExplicitApply:\s*true/);
assert.match(preview, /Nothing has been applied/);
assert.doesNotMatch(preview, /restorePackage|applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked|DECISION_ACTIONS/,
  'preview computation must remain non-mutating');

const controller = read('tabs/sequential-sketcher/persistence/sequential-workspace-persistence-controller.js');
assert.match(controller, /buildSequentialWorkspaceImportPreview/);
assert.match(controller, /formatSequentialWorkspaceImportPreview/);
assert.match(controller, /sequentialWorkspaceCurrentStateFingerprint/);
assert.match(controller, /let pendingRestoration = null/);
assert.match(controller, /let pendingPreview = null/);
assert.match(controller, /function applyPending\(\)/);
assert.match(controller, /function cancelPending\(\)/);
assert.match(controller, /WORKSPACE_IMPORT_PREVIEW_STALE/);
assert.match(controller, /beforeFingerprint !== pendingPreview\.currentStateFingerprint/);
assert.match(controller, /data-ssk-workspace-apply/);
assert.match(controller, /data-ssk-workspace-cancel/);
assert.match(controller, /getPendingPreview/);
const previewFileBody = controller.match(/async function previewFile\(file\) \{([\s\S]*?)\n  \}\n\n  function approval/u)?.[1] || '';
assert.ok(previewFileBody, 'previewFile body must be discoverable');
assert.doesNotMatch(previewFileBody, /restorePackage/,
  'selecting a file must validate and preview without restoring live state');
const applyBody = controller.match(/function applyPending\(\) \{([\s\S]*?)\n  \}\n\n  function cancelPending/u)?.[1] || '';
assert.match(applyBody, /workspace\?\.restorePackage\?\.\(restoration\)/,
  'only the explicit Apply path may restore the package');
assert.equal((controller.match(/restorePackage\?\.\(/gu) || []).length, 1,
  'workspace restoration must have exactly one explicit callsite');
assert.doesNotMatch(controller, /applyConstructionDecision|advanceConstruction|runConstructionUntilBlocked|DECISION_ACTIONS/,
  'import preview controller must not execute construction mutations');

const markup = read('tabs/sequential-sketcher/sequential-sketcher-markup.js');
for (const selector of [
  'data-ssk-workspace-import',
  'data-ssk-workspace-apply',
  'data-ssk-workspace-cancel',
  'data-ssk-workspace-package-summary',
]) assert.match(markup, new RegExp(selector));
assert.match(markup, /Selecting a package validates it and creates a non-mutating preview/);
assert.match(markup, /Apply verified package/);
assert.match(markup, /Cancel preview/);
assert.match(markup, /data-ssk-workspace-apply disabled/);
assert.match(markup, /data-ssk-workspace-cancel disabled/);

const tab = read('tabs/sequential-sketcher/sequential-sketcher-tab.js');
const utility = read('tabs/psnm-utility-tab.js');
assert.match(tab, /20260717-ssk-workspace-apply-receipts-1/);
assert.match(utility, /20260718-ssk-geometry-order-1/);

console.log('sequential workspace import preview UI tests passed');
