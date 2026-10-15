import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalMappingWorkbench } from '../xml-compare/universal-categorizer/universal-mapping-workbench.js';
import { createLinewiseUniversalMappingReview, createUniversalMappingReview, UNIVERSAL_MAPPING_REVIEW_SCHEMA } from '../xml-compare/universal-categorizer/universal-mapping-review.js';
import { findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';

const profile = createLinewiseUniversalPreset();
const review = createLinewiseUniversalMappingReview(profile);
assert.equal(review.schema, UNIVERSAL_MAPPING_REVIEW_SCHEMA);
assert.equal(review.title, 'Mapping review queue');
assert.equal(review.selected.title, 'Selected mapping detail');
assert.deepEqual(review.groups.map((group) => group.groupId), ['key-mappings', 'field-mappings', 'unmapped-columns', 'diagnostics']);
assert.ok(review.groups.find((group) => group.groupId === 'key-mappings').count >= 1);
assert.ok(review.groups.find((group) => group.groupId === 'field-mappings').count >= 1);
assert.equal(review.decisions.length, 5);
assert.ok(review.decisions.every((action) => action.enabled === false && action.locked === true));

const workbenchWithUnmapped = createUniversalMappingWorkbench({
  profile: { ...profile, sources: [...profile.sources, { sourceId: 'extraLookup', displayName: 'Extra Lookup', requiredColumns: ['UNUSED_FIELD'] }] },
});
const needsReview = createUniversalMappingReview({ mappingWorkbench: workbenchWithUnmapped });
assert.equal(needsReview.status, 'review-required');
assert.ok(needsReview.diagnostics.some((item) => item.code === 'UXC_MAPPING_REVIEW_UNMAPPED_COLUMNS'));
assert.equal(JSON.stringify(createUniversalMappingReview({ mappingWorkbench: workbenchWithUnmapped })), JSON.stringify(needsReview), 'Mapping review must be deterministic for equivalent inputs');

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-012 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

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
    } catch {}
  }
  return [];
}
function safeGitRef(value) { const ref = String(value || 'main').trim(); return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'main'; }

console.log('xml-compare-universal-mapping-review tests passed');
