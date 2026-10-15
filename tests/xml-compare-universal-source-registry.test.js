import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { normalizeUniversalCategorizerProfile } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry, findForbiddenUxc001Changes, isForbiddenUxc001File } from '../xml-compare/universal-categorizer/universal-source-registry.js';

const profile = normalizeUniversalCategorizerProfile({
  profileId: 'uxc-source-registry-test',
  sources: [
    { sourceId: 'mainXml', role: 'primary', sourceKind: 'xml' },
    { sourceId: 'coordLookup', role: 'sideload', requiredColumns: ['NODE', 'GLOBAL_X', 'GLOBAL_Y'], optionalColumns: ['GLOBAL_Z'] },
  ],
});

const registry = createUniversalSourceRegistry(profile, {
  mainXml: { columns: ['DocumentRoot'] },
  coordLookup: { rows: [{ NODE: '10', GLOBAL_X: '1000' }] },
});

assert.equal(registry.schema, 'universal-source-registry/v1-shadow');
assert.equal(registry.primarySources.length, 1);
assert.equal(registry.sideloadSources.length, 1);
assert.equal(registry.sourceMap.mainXml.role, 'primary');
assert.equal(registry.sourceMap.coordLookup.role, 'sideload');
assert.deepEqual(registry.sourceMap.coordLookup.requiredColumns, ['NODE', 'GLOBAL_X', 'GLOBAL_Y']);
assert.deepEqual(registry.sourceMap.coordLookup.columns, ['NODE', 'GLOBAL_X']);
assert.deepEqual(registry.sourceMap.coordLookup.presentRequiredColumns, ['NODE', 'GLOBAL_X']);
assert.deepEqual(registry.sourceMap.coordLookup.missingRequiredColumns, ['GLOBAL_Y']);
assert.equal(registry.sourceMap.coordLookup.status, 'missing-required-columns');
assert.ok(registry.diagnostics.some((item) => item.code === 'UXC_SOURCE_REQUIRED_COLUMN_MISSING' && item.sourceId === 'coordLookup' && item.column === 'GLOBAL_Y'));

const completeRegistry = createUniversalSourceRegistry(profile, [
  { sourceId: 'mainXml', columns: ['DocumentRoot'] },
  { sourceId: 'coordLookup', rows: [{ NODE: '10', GLOBAL_X: '1000', GLOBAL_Y: '2000', GLOBAL_Z: '3000' }] },
]);
assert.equal(completeRegistry.sourceMap.coordLookup.status, 'ready');
assert.deepEqual(completeRegistry.missingColumns.coordLookup, []);

assert.equal(isForbiddenUxc001File('xml-compare/CategorizedInputXmlConverter.js'), true);
assert.equal(isForbiddenUxc001File('xml-compare/universal-categorizer/universal-source-registry.js'), false);
assert.deepEqual(findForbiddenUxc001Changes(['xml-compare/universal-categorizer/universal-source-registry.js']), []);

const changedForbiddenFiles = findForbiddenUxc001Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-001 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

function changedFilesFromGit() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return [...new Set(output.split(/\r?\n/).map((line) => {
      const path = line.slice(3).trim();
      // Handle renamed files "old -> new"
      if (path.includes(' -> ')) return path.split(' -> ')[1].trim();
      return path;
    }).filter(Boolean))];
  } catch {
    return [];
  }
}

function safeGitRef(value) {
  const ref = String(value || 'main').trim();
  return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'main';
}

console.log('xml-compare-universal-source-registry tests passed');
