import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createLinewiseUniversalPreviewModel, UNIVERSAL_PREVIEW_MODEL_SCHEMA } from '../xml-compare/universal-categorizer/universal-preview-model.js';
import { findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';

const preview = createLinewiseUniversalPreviewModel(createLinewiseUniversalPreset());
assert.equal(preview.schema, UNIVERSAL_PREVIEW_MODEL_SCHEMA);
assert.deepEqual(preview.workflow.map((step) => step.title), ['Source', 'Recipe Builder', 'Preview', 'Export']);
assert.equal(preview.exportLocked, true);
assert.ok(preview.sources.rows.length >= 1);
assert.equal(preview.sources.title, 'Source column review');
assert.ok(preview.sources.rows.some((source) => source.columns.some((column) => column.name && column.role)));
assert.ok(preview.builder.levels.length >= 1);
assert.equal(preview.builder.title, 'Structure Recipe Builder');
assert.equal(preview.builder.selectedItem.title, 'Selected item properties');
assert.ok(preview.builder.selectedItem.keyColumn);
assert.ok(Array.isArray(preview.builder.selectedItem.attachedBlocks));
assert.ok(Array.isArray(preview.builder.selectedItem.mappedFields));
assert.equal(preview.columnRoleReview.title, 'Column role review');
assert.equal(preview.columnRoleReview.kicker, 'Role overrides');
assert.ok(preview.columnRoleReview.rows.length >= 1);
assert.ok(preview.columnRoleReview.actions.every((action) => action.locked && action.enabled === false));
assert.equal(preview.mappingWorkbench.title, 'Mapping Workbench');
assert.equal(preview.mappingWorkbench.status, 'review-only');
assert.ok(preview.mappingWorkbench.rows.some((row) => row.sourceField === 'FROM_NODE' && row.targetLocation.includes('LineBlock')));
assert.ok(preview.mappingWorkbench.actions.every((action) => action.enabled === false));
assert.equal(preview.mappingReview.title, 'Mapping review queue');
assert.equal(preview.mappingReview.selected.title, 'Selected mapping detail');
assert.equal(preview.mappingReview.decisions.length, 5);
assert.ok(preview.mappingReview.decisions.every((action) => action.locked));
assert.equal(preview.mappingTrace.title, 'Sample value mapping trace');
assert.ok(Array.isArray(preview.mappingTrace.rows));
assert.equal(preview.mappingConfidence.title, 'Mapping confidence');
assert.equal(preview.mappingConfidence.kicker, 'Quality scoring');
assert.ok(Array.isArray(preview.mappingConfidence.rows));
assert.ok(preview.mappingConfidence.rows.every((row) => row.qualityScore >= 0 && row.qualityScore <= 100));
assert.equal(preview.tree.title, 'Tree Preview');
assert.equal(preview.pivot.title, 'Pivot Preview');
assert.deepEqual(preview.previewModes.map((mode) => mode.title), ['Tree Preview', 'Pivot Preview', 'Diagnostics']);
assert.equal(preview.exportPlan.status, 'Locked');
assert.ok(preview.exportPlan.guidanceItems.some((item) => item.includes('XML serializer')));
assert.equal(preview.pivot.columns.join('|'), 'Path|Level|Key|Block|Field|Value|Source');
assert.ok(Array.isArray(preview.tree.nodes));
assert.ok(Array.isArray(preview.pivot.rows));
assert.equal(preview.advancedDiagnostics.title, 'Advanced diagnostics');

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-015 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

function changedFilesFromGit() {
  const baseRef = safeGitRef(process.env.GITHUB_BASE_REF || 'main');
  const commands = [
    `git fetch --no-tags --depth=1 origin ${baseRef}:refs/remotes/origin/${baseRef} && git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`,
    `git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`,
    `git diff --name-only --diff-filter=ACMRTUXB ${baseRef}...HEAD`,
  ];
  for (const command of commands) {
    try {
      const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
    } catch {
      // Try the next git command. This keeps the guard portable across local and CI checkouts.
    }
  }
  return [];
}
function safeGitRef(value) { const ref = String(value || 'main').trim(); return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'main'; }

console.log('xml-compare-universal-preview-model tests passed');
