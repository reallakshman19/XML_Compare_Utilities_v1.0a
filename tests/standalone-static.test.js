import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const expectedTabs = [
  'xml-compare',
  'psnm-utility',
];
const allowedBareImports = new Set(['three', 'gltf-exporter', 'mdb-reader', 'buffer', 'xlsx']);
const allowedBarePrefixes = ['three/addons/'];
const allowedMissingAssets = new Set([
  'data/mocks/mock_complex_piping.pcf',
  'opt/mock-xml.xml',
  'opt/mock-pcf-data.json',
  'Docs/Masters/wtValveweights.json',
]);

function fail(message) {
  throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function stripQuery(value) {
  return String(value || '').split('?')[0].split('#')[0];
}

function decodeLocalPath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isBare(specifier) {
  return !specifier.startsWith('.') && !specifier.startsWith('/');
}

function resolveRelative(fromRel, specifier) {
  const clean = stripQuery(specifier);
  const base = path.dirname(path.join(root, fromRel));
  return path.resolve(base, clean);
}

function assertInside(absPath, context) {
  const rel = path.relative(root, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`${context} escapes app root: ${rel}`);
  return rel.replace(/\\/g, '/');
}

function assertLocalRefExists(fromRel, specifier, context) {
  const clean = decodeLocalPath(stripQuery(specifier));
  if (/^(https?:|data:|blob:|#)/i.test(clean)) return;
  if (!clean.startsWith('.') && !clean.startsWith('/')) {
    const rootCandidate = path.resolve(root, clean);
    if (fs.existsSync(rootCandidate)) {
      assertInside(rootCandidate, context);
      return;
    }
  }
  if (isBare(clean)) {
    const allowed = allowedBareImports.has(clean) || allowedBarePrefixes.some((prefix) => clean.startsWith(prefix));
    if (!allowed) fail(`${context} uses unexpected bare import: ${clean}`);
    return;
  }
  const absPath = resolveRelative(fromRel, clean);
  const rel = assertInside(absPath, context);
  if (!path.extname(absPath)) {
    const jsPath = `${absPath}.js`;
    if (fs.existsSync(jsPath)) {
      assertInside(jsPath, context);
      return;
    }
  }
  if (!fs.existsSync(absPath)) {
    if (allowedMissingAssets.has(rel)) return;
    fail(`${context} target is missing: ${rel}`);
  }
}

function walk(dirRel) {
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(dirRel, entry.name).replace(/\\/g, '/');
    if (rel.startsWith('.git/') || rel.startsWith('node_modules/')) continue;
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

const index = read('index.html');
const moduleScripts = [...index.matchAll(/<script\s+[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/g)].map((match) => match[1]);
if (moduleScripts.length !== 1) fail(`Expected one module script, found ${moduleScripts.length}`);
assertLocalRefExists('index.html', moduleScripts[0], 'index module script');
for (const match of index.matchAll(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/g)) {
  const href = match[1];
  if (!href.startsWith('//')) assertLocalRefExists('index.html', href, 'index stylesheet/link');
}

const mainPath = stripQuery(moduleScripts[0]).replace(/^\.\//, '');
const main = read(mainPath);
if (!main.includes("import('./core/app.js")) fail('main entrypoint must dynamically import ./core/app.js');
if (!main.includes('.catch(reportStartupError)')) fail('main entrypoint must report startup errors');

const runtime = read('core/app-standalone-runtime.js');
for (const tabId of expectedTabs) {
  if (!runtime.includes(`id: '${tabId}'`)) fail(`Missing standalone tab ${tabId}`);
}
for (const tabId of ['pcfx-converter', 'rvm-json-pcf']) {
  if (!expectedTabs.includes(tabId) && runtime.includes(`id: '${tabId}'`)) fail(`Unexpected standalone tab ${tabId}`);
}
if (!runtime.includes('TAB_CHANGE_REQUESTED')) fail('Runtime must listen for tab-change-requested events');
if (!runtime.includes('app:switch-tab')) fail('Runtime must listen for app:switch-tab window events');

const importPattern = /(?:import\s+(?:[^'"()]+?\s+from\s+)?|export\s+[^'"()]+?\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
const newUrlPattern = /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;
const importWarnings = [];
for (const jsFile of walk('').filter((file) => /\.(js|mjs)$/.test(file) && !file.startsWith('tests/'))) {
  const text = read(jsFile);
  for (const match of text.matchAll(importPattern)) {
    try { assertLocalRefExists(jsFile, match[1], `${jsFile} import`); }
    catch (error) { importWarnings.push(String(error?.message || error)); }
  }
  for (const match of text.matchAll(newUrlPattern)) {
    try { assertLocalRefExists(jsFile, match[1], `${jsFile} new URL`); }
    catch (error) { importWarnings.push(String(error?.message || error)); }
  }
}
if (importWarnings.length) {
  console.warn(`Standalone static import scan warnings: ${importWarnings.length}`);
  for (const warning of importWarnings.slice(0, 10)) console.warn(`- ${warning}`);
}

console.log(`Standalone static validation passed for ${path.basename(root)} (${expectedTabs.join(', ')})`);
