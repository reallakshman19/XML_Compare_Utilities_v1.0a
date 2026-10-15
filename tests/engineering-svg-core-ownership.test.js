import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_PATH = 'docs/architecture/engineering-svg/core-ownership.v1.json';
const DOC_PATH = 'docs/architecture/engineering-svg/core-ownership.md';
const REQUIRED_CONSUMERS = Object.freeze([
  'PIPELINE_3D', 'REVISION_COMPARE', 'SEQUENTIAL_SKETCHER', 'TOPOLOGY_TRACE',
]);

function normalized(value) {
  return String(value).split(sep).join('/').replace(/^\.\//, '');
}

function isWithin(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function resolvedImportPath(importer, specifier) {
  const clean = String(specifier).split(/[?#]/, 1)[0];
  if (!clean.startsWith('.')) return normalized(clean);
  return normalized(relative(process.cwd(), resolve(dirname(importer), clean)));
}

function importSpecifiers(source) {
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const output = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) output.add(match[1]);
  }
  return [...output];
}

async function javascriptFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) return javascriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  }));
  return nested.flat().sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function exportedModules(source) {
  return [...source.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]\s*;/g)]
    .map((match) => match[1]);
}

function validateManifest(manifest) {
  assert.equal(manifest.schema, 'EngineeringSvgCoreOwnership.v1');
  assert.equal(manifest.coreRoot, 'core/engineering-svg');
  assert.equal(manifest.publicEntryPoint, `${manifest.coreRoot}/index.js`);
  assert.match(manifest.baselineMainSha, /^[0-9a-f]{40}$/);
  assert(Array.isArray(manifest.publicExports) && manifest.publicExports.length > 0);
  assert.deepEqual(
    manifest.consumers.map((consumer) => consumer.id).sort(),
    [...REQUIRED_CONSUMERS].sort(),
  );
  assert.equal(new Set(manifest.consumers.map((consumer) => consumer.root)).size, 4);
  assert.equal(manifest.rules.coreMayImportConsumers, false);
  assert.equal(manifest.rules.consumerMayImportAnotherConsumerIntegration, false);
  assert.equal(manifest.rules.rendererOwnsDomainAuthority, false);
  assert.equal(manifest.rules.threeDimensionalBackendIsPartOfSharedSvgCore, false);
}

async function validatePublicExports(manifest) {
  const source = await readFile(manifest.publicEntryPoint, 'utf8');
  assert.deepEqual(
    exportedModules(source),
    manifest.publicExports,
    'Shared Engineering SVG public exports changed without an ownership-manifest update.',
  );
}

async function validateCoreDirection(manifest) {
  const files = await javascriptFiles(manifest.coreRoot);
  assert(files.length > 0, 'Shared Engineering SVG core must contain JavaScript modules.');
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      const imported = resolvedImportPath(file, specifier);
      for (const root of manifest.prohibitedCoreImportRoots) {
        assert.equal(
          isWithin(imported, root), false,
          `${file} must not import consumer-owned root ${root} through ${specifier}.`,
        );
      }
    }
  }
}

async function validateConsumerIsolation(manifest) {
  for (const consumer of manifest.consumers) {
    assert(consumer.integrationKind && consumer.adoption);
    assert(Array.isArray(consumer.integrationFiles) && consumer.integrationFiles.length > 0);
    for (const file of consumer.integrationFiles) {
      assert(isWithin(file, consumer.root), `${file} must stay inside ${consumer.root}.`);
      const source = await readFile(file, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        const imported = resolvedImportPath(file, specifier);
        for (const other of manifest.consumers.filter((item) => item.id !== consumer.id)) {
          assert.equal(
            isWithin(imported, other.root), false,
            `${file} must not import ${other.id} integration through ${specifier}.`,
          );
        }
      }
    }
  }
}

async function validatePhaseZeroFiles(manifest) {
  const documentation = await readFile(DOC_PATH, 'utf8');
  const selfSource = await readFile(fileURLToPath(import.meta.url), 'utf8');
  assert.match(documentation, new RegExp(manifest.schema.replace('.', '\\.')));
  assert.match(documentation, /Mission: ESVG-CORE-P0/);
  assert(selfSource.trimEnd().split('\n').length < 300);
  assert.equal(/export\s+default\b/.test(selfSource), false);
}

const manifest = await readJson(MANIFEST_PATH);
validateManifest(manifest);
await validatePublicExports(manifest);
await validateCoreDirection(manifest);
await validateConsumerIsolation(manifest);
await validatePhaseZeroFiles(manifest);

console.log('engineering-svg-core-ownership.test.js passed');
