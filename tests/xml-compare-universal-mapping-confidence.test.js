import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createLinewiseUniversalPreset } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry, findForbiddenUxc001Changes } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createUniversalMappingWorkbench } from '../xml-compare/universal-categorizer/universal-mapping-workbench.js';
import { createUniversalMappingReview } from '../xml-compare/universal-categorizer/universal-mapping-review.js';
import { createUniversalMappingTrace } from '../xml-compare/universal-categorizer/universal-mapping-trace.js';
import { createLinewiseUniversalMappingConfidence, createUniversalMappingConfidence, UNIVERSAL_MAPPING_CONFIDENCE_SCHEMA } from '../xml-compare/universal-categorizer/universal-mapping-confidence.js';

const profile = createLinewiseUniversalPreset();
const registry = createUniversalSourceRegistry(profile, {
  coordinateLookup: { columns: ['NODE', 'GLOBAL_X'], rows: [{ NODE: '10', GLOBAL_X: '1000' }] },
});
const mappingWorkbench = createUniversalMappingWorkbench({ profile, registry });
const mappingReview = createUniversalMappingReview({ mappingWorkbench });
const mappingTrace = createUniversalMappingTrace({ registry, mappingWorkbench, mappingReview });
const confidence = createUniversalMappingConfidence({ mappingWorkbench, mappingReview, mappingTrace });
assert.equal(confidence.schema, UNIVERSAL_MAPPING_CONFIDENCE_SCHEMA);
assert.equal(confidence.title, 'Mapping confidence');
assert.equal(confidence.kicker, 'Quality scoring');
assert.deepEqual(confidence.columns, ['Source field', 'Target recipe location', 'Role', 'Confidence', 'Quality score', 'Readiness']);
assert.ok(confidence.rows.length >= 1);
assert.ok(confidence.summary.high + confidence.summary.medium + confidence.summary.low === confidence.rows.length);
assert.ok(confidence.rows.every((row) => Number.isInteger(row.qualityScore) && row.qualityScore >= 0 && row.qualityScore <= 100));
assert.ok(confidence.rows.every((row) => row.evidenceReasons.length >= 1));
assert.ok(confidence.selected.sourceField);
assert.ok(confidence.rows.some((row) => row.sourceField === 'GLOBAL_X' && row.evidenceReasons.some((item) => item.includes('Sample value trace'))));
assert.equal(JSON.stringify(createUniversalMappingConfidence({ mappingWorkbench, mappingReview, mappingTrace })), JSON.stringify(confidence), 'Mapping confidence output must be deterministic');

const linewiseNoSamples = createLinewiseUniversalMappingConfidence(profile);
assert.ok(linewiseNoSamples.diagnostics.some((item) => item.code === 'UXC_MAPPING_CONFIDENCE_TRACE_EVIDENCE_MISSING'));
assert.ok(linewiseNoSamples.rows.some((row) => row.riskFlags.includes('no-sample-row')));

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-014 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

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
console.log('xml-compare-universal-mapping-confidence tests passed');
