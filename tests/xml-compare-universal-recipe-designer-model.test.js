import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createLinewiseUniversalRecipeDesignerModel, createUniversalRecipeDesignerModel, validateUniversalRecipeProfile, UNIVERSAL_RECIPE_DESIGNER_MODEL_SCHEMA } from '../xml-compare/universal-categorizer/universal-recipe-designer-model.js';
import { findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';

const linewise = createLinewiseUniversalRecipeDesignerModel(createLinewiseUniversalPreset());
assert.equal(linewise.schema, UNIVERSAL_RECIPE_DESIGNER_MODEL_SCHEMA);
assert.equal(linewise.status, 'ready');
assert.equal(linewise.summary.errors, 0);
assert.equal(linewise.summary.warnings, 0);
assert.equal(linewise.levels.some((level) => level.levelId === 'documentRoot' && level.root === true), true);
assert.equal(linewise.blocks.some((block) => block.blockName === 'DerivedCoordinateBlock' && block.attachToLevelId === 'node'), true);
assert.equal(linewise.attachments.some((rule) => rule.ruleId === 'coordinates-to-node'), true);
assert.deepEqual(linewise.commands.map((command) => command.label), ['Add level', 'Add block', 'Map source field', 'Preview pivot', 'Export XML']);
for (const command of linewise.commands) {
  assert.equal(command.enabled, false);
  assert.equal(command.locked, true);
  assert.equal(command.lockedReason, 'locked-shadow-mode');
}
assert.equal(JSON.stringify(linewise), JSON.stringify(createLinewiseUniversalRecipeDesignerModel(createLinewiseUniversalPreset())));

const invalidProfile = normalizeUniversalCategorizerProfile({
  profileId: 'uxc-invalid-recipe-test',
  sources: [
    { sourceId: 'mainXml', role: 'primary' },
  ],
  levelDefinitions: [
    { levelId: 'root', displayName: 'Root', children: ['node', 'missingChild'] },
    { levelId: 'root', displayName: 'Root Duplicate' },
    { levelId: 'node', displayName: 'Node' },
  ],
  blockDefinitions: [
    { blockName: 'NodeBlock', attachToLevelId: 'node' },
    { blockName: 'NodeBlock', attachToLevelId: 'missingLevel' },
  ],
  sideloadAttachments: [
    { ruleId: 'bad-rule', sourceId: 'missingSource', attachToLevelId: 'missingLevel', sourceKey: '', targetKey: '', blockName: 'MissingBlock', mode: 'create-block' },
  ],
});
const invalid = createUniversalRecipeDesignerModel(invalidProfile);
const invalidCodes = invalid.diagnostics.map((item) => item.code);
assert.equal(invalid.status, 'blocked');
assert.ok(invalidCodes.includes('UXC_RECIPE_DUPLICATE_LEVEL_ID'));
assert.ok(invalidCodes.includes('UXC_RECIPE_DUPLICATE_BLOCK_NAME'));
assert.ok(invalidCodes.includes('UXC_RECIPE_MISSING_CHILD_LEVEL'));
assert.ok(invalidCodes.includes('UXC_RECIPE_BLOCK_LEVEL_MISSING'));
assert.ok(invalidCodes.includes('UXC_RECIPE_ATTACHMENT_SOURCE_MISSING'));
assert.ok(invalidCodes.includes('UXC_RECIPE_ATTACHMENT_LEVEL_MISSING'));
assert.ok(invalidCodes.includes('UXC_RECIPE_ATTACHMENT_BLOCK_MISSING'));
assert.ok(invalidCodes.includes('UXC_RECIPE_ATTACHMENT_SOURCE_KEY_EMPTY'));
assert.ok(invalidCodes.includes('UXC_RECIPE_ATTACHMENT_TARGET_KEY_EMPTY'));
assert.equal(invalid.summary.errors > 0, true);
assert.equal(invalid.summary.warnings, 2);

const cycleProfile = normalizeUniversalCategorizerProfile({
  profileId: 'uxc-cycle-recipe-test',
  sources: [{ sourceId: 'mainXml', role: 'primary' }],
  levelDefinitions: [
    { levelId: 'a', displayName: 'A', children: ['b'] },
    { levelId: 'b', displayName: 'B', children: ['a'] },
  ],
  blockDefinitions: [],
  sideloadAttachments: [],
});
const cycleDiagnostics = validateUniversalRecipeProfile(cycleProfile);
assert.ok(cycleDiagnostics.some((item) => item.code === 'UXC_RECIPE_NO_ROOT_LEVEL'));
assert.ok(cycleDiagnostics.some((item) => item.code === 'UXC_RECIPE_HIERARCHY_CYCLE'));

const emptyProfile = normalizeUniversalCategorizerProfile({ profileId: 'uxc-empty-recipe-test' });
const emptyDiagnostics = validateUniversalRecipeProfile(emptyProfile);
assert.ok(emptyDiagnostics.some((item) => item.code === 'UXC_RECIPE_NO_LEVELS'));

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-006 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

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

function safeGitRef(value) {
  const ref = String(value || 'main').trim();
  return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'main';
}

console.log('xml-compare-universal-recipe-designer-model tests passed');
