import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionRoot = path.join(root, 'tabs/pipeline-3d-model');
const paths = ['pipeline-3d-model-b314-radius-contracts.js', 'pipeline-3d-model-b314-radius-resolution.js'];
const sources = Object.fromEntries(paths.map((name) => [name, fs.readFileSync(path.join(productionRoot, name), 'utf8')]));
for (const [name, source] of Object.entries(sources)) {
  const lines = source.trimEnd().split(/\r?\n/);
  assert.ok(lines.length < 700, `${name} must remain within the authorized two-file design`);
  if (name.includes('resolution')) {
    assert.ok(lines.length >= 150, `${name} must remain normally formatted and reviewable`);
    assert.ok(lines.every((line) => line.length <= 140), `${name} must avoid unreadable physical lines`);
  }
  assert.equal(/export\s+default/.test(source), false);
  assert.equal(/localStorage|sessionStorage|document\.|window\.|XMLSerializer|inputxml|xml-builder/i.test(source), false);
  assert.equal(/normal-fitting|gre-|branchInfo\.boreMm|nominalPipeSizeNps\s*\*/i.test(source), false);
  assert.equal(/Date\(|Math\.random|performance\.|localeCompare/.test(source), false);
}
const contracts = sources[paths[0]], resolution = sources[paths[1]];
assert.match(contracts, /PipelineB314RadiusPolicyRegistry\.v1/);
assert.match(contracts, /PipelineB314RadiusMigration\.v1/);
assert.match(contracts, /PipelineB314RadiusPlan\.v1/);
assert.match(contracts, /PipelineB314RadiusResolution\.v1/);
assert.match(resolution, /authenticateAnalysisPlan/);
assert.match(resolution, /validateSectionQuantities/);
assert.match(resolution, /rejectIncompatible/);
assert.match(resolution, /Candidate overrides may target only exact B31\.4 candidates/);
assert.match(resolution, /including provenance/);
assert.match(resolution, /observedCandidateRadiusD/);
assert.match(resolution, /observedCandidateRadiusMm/);
const allProduction = fs.readdirSync(productionRoot)
  .filter((name) => name.endsWith('.js') && !name.includes('b314-radius'))
  .map((name) => fs.readFileSync(path.join(productionRoot, name), 'utf8')).join('\n');
assert.equal(allProduction.includes('pipeline-3d-model-b314-radius-contracts'), false);
assert.equal(allProduction.includes('pipeline-3d-model-b314-radius-resolution'), false);
console.log('pipeline-3d-model B31.4 radius static: PASS');
