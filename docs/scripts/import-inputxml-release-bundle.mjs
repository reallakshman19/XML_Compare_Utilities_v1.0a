/**
 * Functionality: deterministically import the authoritative 3D_Converters InputXML v2 bundle.
 * Parameters: explicit source and target directories, with sibling/default paths at the CLI boundary.
 * Outputs: one all-or-nothing verified vendor/3d-converters/inputxml-v2 directory.
 * Fallback: none; a stale manifest, changed file, missing file, or escaping path blocks import.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPT_DIR);
const DEFAULT_SOURCE = resolve(ROOT, '..', '3D_Converters', 'dist', 'inputxml-release', 'inputxml-v2');
const DEFAULT_TARGET = resolve(ROOT, 'vendor', '3d-converters', 'inputxml-v2');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function manifestBase(manifest) {
  return {
    schema: manifest.schema,
    contractVersion: manifest.contractVersion,
    producer: manifest.producer,
    upstreamRevision: manifest.upstreamRevision,
    files: manifest.files,
  };
}

function safeBundlePath(directory, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || isAbsolute(relativePath)) throw new Error(`Invalid bundle path: ${relativePath}.`);
  const root = resolve(directory);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) throw new Error(`Bundle file escapes its directory: ${relativePath}.`);
  return path;
}

async function loadManifest(directory) {
  const path = join(directory, 'inputxml-contract-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  if (manifest.schema !== 'InputXmlContractEvidenceBundle.v1' || manifest.contractVersion !== 'inputxml-v2') {
    throw new Error('InputXML contract bundle schema or version is invalid.');
  }
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('InputXML contract bundle file inventory is empty.');
  const observed = sha256(Buffer.from(stableJson(manifestBase(manifest)), 'utf8'));
  if (observed !== manifest.bundleHashSha256) throw new Error('InputXML contract bundle manifest hash is stale.');
  return manifest;
}

async function verifyFiles(directory, manifest) {
  for (const descriptor of manifest.files) {
    const path = safeBundlePath(directory, descriptor.path);
    const bytes = await readFile(path);
    if (bytes.length !== descriptor.bytes) throw new Error(`InputXML bundle byte count differs: ${descriptor.path}.`);
    if (sha256(bytes) !== descriptor.sha256) throw new Error(`InputXML bundle SHA-256 differs: ${descriptor.path}.`);
  }
}

function assertTarget(directory) {
  const vendorRoot = resolve(ROOT, 'vendor', '3d-converters');
  const target = resolve(directory);
  if (!target.startsWith(`${vendorRoot}${sep}`)) throw new Error(`InputXML import target escapes ${vendorRoot}: ${target}.`);
}

export async function importInputXmlReleaseBundle(sourceDirectory, targetDirectory) {
  const source = resolve(sourceDirectory);
  const target = resolve(targetDirectory);
  assertTarget(target);
  const manifest = await loadManifest(source);
  await verifyFiles(source, manifest);
  const temporary = `${target}.importing`;
  assertTarget(temporary);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(dirname(temporary), { recursive: true });
  await cp(source, temporary, { recursive: true });
  await verifyFiles(temporary, await loadManifest(temporary));
  await rm(target, { recursive: true, force: true });
  await rename(temporary, target);
  console.log(`[inputxml-contract-import] PASS: ${manifest.files.length} files from ${manifest.upstreamRevision}.`);
  return Object.freeze({ source, target, manifest });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await importInputXmlReleaseBundle(process.argv[2] || DEFAULT_SOURCE, process.argv[3] || DEFAULT_TARGET);
}
