import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const docsRoot = path.join(root, 'docs');
const manifestPath = path.join(docsRoot, '.pages-build-manifest.json');

const EXCLUDED_ROOT_DIRS = new Set(['.git', '.github', 'docs', 'tests', 'node_modules']);
const EXCLUDED_ROOT_FILES = new Set(['README.md', 'package.json', 'package-lock.json']);

function hasHiddenSegment(relativePath) {
  return relativePath.split(path.sep).some((segment) => segment.startsWith('.'));
}

function shouldExclude(relativePath, dirent) {
  const parts = relativePath.split(path.sep);
  if (parts.length === 1 && dirent.isDirectory() && EXCLUDED_ROOT_DIRS.has(parts[0])) return true;
  if (parts.length === 1 && dirent.isFile() && EXCLUDED_ROOT_FILES.has(parts[0])) return true;
  if (hasHiddenSegment(relativePath)) return true;
  if (dirent.isDirectory() && dirent.name === '__pycache__') return true;
  if (dirent.isFile() && dirent.name.endsWith('.pyc')) return true;
  return false;
}

async function readPreviousManifest() {
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    return new Set(Array.isArray(parsed.generatedFiles) ? parsed.generatedFiles : []);
  } catch (error) {
    if (error?.code === 'ENOENT') return new Set();
    throw error;
  }
}

async function removePreviousGenerated(previous) {
  for (const relativePath of [...previous].sort((a, b) => b.length - a.length)) {
    const target = path.join(docsRoot, relativePath);
    await fs.rm(target, { force: true });
  }
}

async function assertSafeTarget(relativePath, previous) {
  const target = path.join(docsRoot, relativePath);
  try {
    await fs.lstat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (!previous.has(relativePath)) {
    throw new Error(`Refusing to overwrite authored docs file: docs/${relativePath}`);
  }
}

async function copyTree(sourceDir, relativeDir, previous, generated) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (shouldExclude(relativePath, entry)) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(sourcePath, relativePath, previous, generated);
      continue;
    }
    if (!entry.isFile()) continue;
    await assertSafeTarget(relativePath, previous);
    const targetPath = path.join(docsRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
    generated.push(relativePath.split(path.sep).join('/'));
  }
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return process.env.GITHUB_SHA || 'UNKNOWN';
  }
}

function buildToken(indexHtml) {
  const match = indexHtml.match(/<meta\s+name=["']app-build["']\s+content=["']([^"']+)["']/i);
  if (!match) throw new Error('index.html is missing the app-build meta token');
  return match[1];
}

async function writePagesMetadata(generated) {
  const indexPath = path.join(docsRoot, 'index.html');
  const entryPath = path.join(docsRoot, 'tabs', 'psnm-utility-pages-entry.js');
  const index = await fs.readFile(indexPath, 'utf8');
  const entry = await fs.readFile(entryPath, 'utf8');
  const token = buildToken(index);
  if (!entry.includes(token)) throw new Error(`Pages entry is missing shared build token ${token}`);

  await fs.writeFile(path.join(docsRoot, '.nojekyll'), '');
  await fs.writeFile(path.join(docsRoot, 'pages-deployment.json'), `${JSON.stringify({
    repository: 'reallaksh19/XML_Compare_Utilities',
    source_sha: gitSha(),
    build: token,
    mode: 'branch-docs',
  }, null, 2)}\n`);

  generated.push('.nojekyll', 'pages-deployment.json');
  return token;
}

async function writeManifest(generated, token) {
  const payload = {
    schema: 'PagesDocsBuildManifest.v1',
    build: token,
    generatedFiles: [...new Set(generated)].sort(),
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  await fs.mkdir(docsRoot, { recursive: true });
  const previous = await readPreviousManifest();
  await removePreviousGenerated(previous);

  const generated = [];
  await copyTree(root, '', previous, generated);
  const token = await writePagesMetadata(generated);
  await writeManifest(generated, token);

  console.log(`Prepared docs/ for GitHub Pages: ${generated.length} generated files; build ${token}`);
}

await main();
