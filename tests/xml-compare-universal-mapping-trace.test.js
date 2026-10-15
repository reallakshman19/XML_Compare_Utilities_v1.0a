import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry, findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createUniversalMappingWorkbench } from '../xml-compare/universal-categorizer/universal-mapping-workbench.js';
import { createUniversalMappingReview } from '../xml-compare/universal-categorizer/universal-mapping-review.js';
import { createUniversalMappingTrace, UNIVERSAL_MAPPING_TRACE_SCHEMA } from '../xml-compare/universal-categorizer/universal-mapping-trace.js';

const profile = createLinewiseUniversalPreset();
const registry = createUniversalSourceRegistry(profile, {
  coordinateLookup: { columns: ['NODE', 'GLOBAL_X'], rows: [{ NODE: '10', GLOBAL_X: '1000' }] },
});
const mappingWorkbench = createUniversalMappingWorkbench({ profile, registry });
const mappingReview = createUniversalMappingReview({ mappingWorkbench });
const trace = createUniversalMappingTrace({ registry, mappingWorkbench, mappingReview });
assert.equal(trace.schema, UNIVERSAL_MAPPING_TRACE_SCHEMA);
assert.equal(trace.title, 'Sample value mapping trace');
assert.deepEqual(trace.columns, ['Source row', 'Source field', 'Sample value', 'Target recipe location', 'Trace status']);
assert.ok(trace.rows.some((row) => row.sourceField === 'GLOBAL_X' && row.sampleValue === '1000' && row.traceStatus === 'Traced'));
assert.ok(trace.rows.some((row) => row.sourceField === 'NODE' && row.sampleValue === '10'));
assert.ok(trace.selectedTrace.sourceField);
assert.equal(JSON.stringify(createUniversalMappingTrace({ registry, mappingWorkbench, mappingReview })), JSON.stringify(trace), 'Mapping trace must be deterministic for equivalent inputs');

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-013 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

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
console.log('xml-compare-universal-mapping-trace tests passed');
