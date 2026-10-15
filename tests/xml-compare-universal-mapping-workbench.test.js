import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry, findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createLinewiseUniversalMappingWorkbench, createUniversalMappingWorkbench, UNIVERSAL_MAPPING_WORKBENCH_SCHEMA } from '../xml-compare/universal-categorizer/universal-mapping-workbench.js';

const profile = createLinewiseUniversalPreset();
const linewise = createLinewiseUniversalMappingWorkbench(profile);
assert.equal(linewise.schema, UNIVERSAL_MAPPING_WORKBENCH_SCHEMA);
assert.equal(linewise.title, 'Mapping Workbench');
assert.equal(linewise.status, 'review-only');
assert.deepEqual(linewise.columns, ['Source field', 'Target recipe location', 'Role', 'Status']);
assert.ok(linewise.summary.columns >= 1);
assert.ok(linewise.rows.some((row) => row.sourceField === 'FROM_NODE' && row.targetLocation === 'element / LineBlock / elementKey' && row.role === 'source key'));
assert.ok(linewise.rows.some((row) => row.sourceField === 'GLOBAL_X' && row.targetLocation === 'node / DerivedCoordinateBlock / GLOBAL_X' && row.role === 'attached field'));
assert.ok(linewise.rows.some((row) => row.sourceField === 'TAG' && row.targetLocation === 'node / RestraintsBlock / TAG'));
assert.ok(linewise.actions.every((action) => action.enabled === false && action.locked === true));

const registry = createUniversalSourceRegistry(profile, {
  coordinateLookup: { columns: ['NODE', 'GLOBAL_X'], rows: [{ NODE: '10', GLOBAL_X: '1000' }] },
});
const withMissing = createUniversalMappingWorkbench({ profile, registry });
assert.ok(withMissing.diagnostics.some((item) => item.code === 'UXC_MAPPING_REQUIRED_COLUMN_MISSING' && item.subjectId === 'coordinateLookup'));
assert.equal(JSON.stringify(createUniversalMappingWorkbench({ profile, registry })), JSON.stringify(withMissing), 'Mapping workbench must be deterministic for equivalent inputs');

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-011 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

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

console.log('xml-compare-universal-mapping-workbench tests passed');
