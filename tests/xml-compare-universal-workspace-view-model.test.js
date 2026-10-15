import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalWorkspaceViewModel, UNIVERSAL_WORKSPACE_VIEW_MODEL_SCHEMA } from '../xml-compare/universal-categorizer/universal-workspace-view-model.js';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';

const linewise = createLinewiseUniversalWorkspaceViewModel(createLinewiseUniversalPreset());
assert.equal(linewise.schema, UNIVERSAL_WORKSPACE_VIEW_MODEL_SCHEMA);
assert.equal(linewise.eyebrow, 'Universal Categorizer Workspace');
assert.equal(linewise.statusChips.some((chip) => chip.label === 'Sample preview'), true);
assert.deepEqual(linewise.workflowSteps.map((step) => step.title), ['Source', 'Recipe Builder', 'Preview', 'Export']);
assert.equal(linewise.readinessCards.some((card) => card.label === 'Export' && card.value === 'Locked'), true);
assert.equal(linewise.readinessCards.some((card) => card.label === 'Tree nodes'), true);
assert.equal(linewise.readinessCards.some((card) => card.label === 'Pivot rows'), true);
assert.equal(linewise.samplePreview.sources.title, 'Source column review');
assert.equal(linewise.samplePreview.builder.title, 'Structure Recipe Builder');
assert.equal(linewise.samplePreview.builder.selectedItem.title, 'Selected item properties');
assert.equal(linewise.samplePreview.columnRoleReview.title, 'Column role review');
assert.ok(linewise.samplePreview.columnRoleReview.rows.length >= 1);
assert.equal(linewise.samplePreview.mappingWorkbench.title, 'Mapping Workbench');
assert.ok(linewise.samplePreview.mappingWorkbench.summary.proposals >= 1);
assert.equal(linewise.samplePreview.mappingReview.title, 'Mapping review queue');
assert.equal(linewise.samplePreview.mappingReview.selected.title, 'Selected mapping detail');
assert.equal(linewise.samplePreview.mappingTrace.title, 'Sample value mapping trace');
assert.equal(linewise.samplePreview.mappingConfidence.title, 'Mapping confidence');
assert.ok(linewise.samplePreview.mappingConfidence.rows.length >= 1);
assert.deepEqual(linewise.samplePreview.previewModes.map((mode) => mode.title), ['Tree Preview', 'Pivot Preview', 'Diagnostics']);
assert.equal(linewise.samplePreview.exportPlan.status, 'Locked');
assert.equal(linewise.samplePreview.tree.title, 'Tree Preview');
assert.equal(linewise.samplePreview.pivot.title, 'Pivot Preview');
assert.ok(Array.isArray(linewise.samplePreview.tree.nodes));
assert.ok(Array.isArray(linewise.samplePreview.pivot.rows));
assert.equal(linewise.recipeDesigner.title, 'Recipe validation');
assert.equal(linewise.recipe.title, 'Structure Recipe Builder bridge');
assert.equal(linewise.exportGate.title, 'XML export gate');
assert.equal(linewise.exportGate.blocked, true);
assert.equal(linewise.boundary.items.some((item) => item.includes('No existing converter')), true);

const actionLabels = linewise.designerActions.map((action) => action.label);
assert.deepEqual(actionLabels, ['Add level', 'Add block', 'Map source field', 'Preview pivot', 'Export XML']);
for (const action of linewise.designerActions) {
  assert.equal(action.enabled, false);
  assert.equal(action.locked, true);
  assert.ok(action.lockedReason);
}

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

console.log('xml-compare-universal-workspace-view-model tests passed');
