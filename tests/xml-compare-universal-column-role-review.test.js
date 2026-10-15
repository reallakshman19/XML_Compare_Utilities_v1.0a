import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createLinewiseUniversalColumnRoleReview, createUniversalColumnRoleReview, UNIVERSAL_COLUMN_ROLE_REVIEW_SCHEMA } from '../xml-compare/universal-categorizer/universal-column-role-review.js';

const profile = createLinewiseUniversalPreset();
const registry = Object.freeze({
  schema: 'universal-source-registry/v1-shadow',
  profileId: 'column-role-review-test',
  sources: Object.freeze([
    Object.freeze({
      sourceId: 'coordinateLookup',
      displayName: 'Node Coordinate Lookup',
      role: 'sideload',
      sourceKind: 'table',
      requiredColumns: Object.freeze(['NODE']),
      optionalColumns: Object.freeze([]),
      columns: Object.freeze(['NODE', 'GLOBAL_X', 'TAG_NO', 'COMMENTS']),
      rows: Object.freeze([Object.freeze({ NODE: '10', GLOBAL_X: '1000', TAG_NO: 'T-1', COMMENTS: 'sample' })]),
      diagnostics: Object.freeze([]),
    }),
  ]),
  diagnostics: Object.freeze([]),
});
const review = createUniversalColumnRoleReview({ registry });
assert.equal(review.schema, UNIVERSAL_COLUMN_ROLE_REVIEW_SCHEMA);
assert.equal(review.title, 'Column role review');
assert.equal(review.kicker, 'Role overrides');
assert.equal(review.status, 'locked-review-only');
assert.deepEqual(review.columns, ['Source', 'Column', 'Inferred role', 'Pending role', 'Reason']);
assert.ok(review.rows.length >= 4);
assert.ok(review.rows.some((row) => row.column === 'NODE' && row.inferredRole === 'Required key'));
assert.ok(review.rows.some((row) => row.column === 'GLOBAL_X' && row.inferredRole === 'Coordinate field'));
assert.ok(review.rows.some((row) => row.column === 'TAG_NO' && row.inferredRole === 'Mapped field'));
assert.ok(review.rows.some((row) => row.column === 'COMMENTS' && row.inferredRole === 'Available field'));
assert.ok(review.rows.every((row) => row.pendingRole === row.inferredRole));
assert.ok(review.rows.every((row) => row.status === 'locked'));
assert.deepEqual(review.actions.map((action) => action.label), ['Accept inferred role', 'Change role', 'Reset role', 'Ignore column', 'Approve column roles']);
assert.ok(review.actions.every((action) => action.locked && action.enabled === false));
assert.equal(JSON.stringify(createUniversalColumnRoleReview({ registry })), JSON.stringify(review), 'Column role review output must be deterministic');

const linewise = createLinewiseUniversalColumnRoleReview(profile);
assert.equal(linewise.schema, UNIVERSAL_COLUMN_ROLE_REVIEW_SCHEMA);
assert.ok(linewise.rows.length >= 1);
assert.ok(linewise.selected.rowId || linewise.selected.column);

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-015 stabilized scope modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

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
console.log('xml-compare-universal-column-role-review tests passed');
