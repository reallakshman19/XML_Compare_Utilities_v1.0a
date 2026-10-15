import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, '.github/workflows/deploy.yml');
const BUILD = 'standalone-20260903-ciiw-ms-compare-action-refresh-1';

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertContains(source, snippet, description) {
  if (!source.includes(snippet)) throw new Error(`Expected ${description}`);
}

if (!fs.existsSync(workflowPath)) {
  throw new Error('Explicit GitHub Pages deployment workflow is required.');
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
for (const required of [
  ['push:', 'push-triggered deployment'],
  ['- main', 'main branch publication'],
  ['workflow_dispatch:', 'manual deployment trigger'],
  ['pages: write', 'Pages write permission'],
  ['id-token: write', 'OIDC permission'],
  ['uses: actions/checkout@v6', 'current checkout action'],
  ['uses: actions/setup-node@v5', 'Node 24-compatible setup-node action'],
  ['node-version: 24', 'Node 24 runtime selection'],
  ['uses: actions/configure-pages@v6', 'current configure-pages action'],
  ['uses: actions/upload-pages-artifact@v4', 'current upload-pages-artifact action'],
  ['uses: actions/deploy-pages@v5', 'current deploy-pages action'],
  ['- name: Verify Pages graph', 'pre-deployment qualification'],
  ['node tests/deploy-workflow-pages-artifact.test.js', 'registered Pages contract execution'],
  ['- name: Prepare Pages artifact', 'the Pages staging step'],
  ['path: ${{ runner.temp }}/pages', 'the staged Pages artifact path'],
  ['include-hidden-files: true', 'hidden file upload for the .nojekyll marker'],
  ['touch "${{ runner.temp }}/pages/.nojekyll"', 'the nojekyll marker'],
  ['pages-deployment.json', 'the deployed revision marker'],
  ['"sha": "${{ github.sha }}"', 'the exact deployed commit in the marker'],
  ['grep -F "$PAGES_BUILD_TOKEN"', 'the staged build-token guard'],
]) assertContains(workflow, required[0], required[1]);
for (const exclusion of ["--exclude='.*'", "--exclude='tests/'", "--exclude='README.md'", "--exclude='package.json'", "--exclude='**/__pycache__/'", "--exclude='**/*.pyc'"]) {
  assertContains(workflow, exclusion, exclusion);
}

const optionalAppFiles = [
  'index.html',
  'main-rhbg-fitguard.js',
  'core/app.js',
  'core/app-standalone-runtime.js',
  'tabs/psnm-utility-pages-entry.js',
  'tabs/psnm-utility-tab.js',
];
if (optionalAppFiles.every((file) => fs.existsSync(path.join(root, file)))) {
  const [index, main, app, runtime, entry, utilities] = optionalAppFiles.map(read);
  for (const source of [index, main, app, runtime, entry, utilities]) assertContains(source, BUILD, `the shared build token ${BUILD}`);
  assertContains(index, 'psnm-utility-pages-entry.js', 'the stale Utilities URL to map to the new physical entry');
  assertContains(index, 'http-equiv="Cache-Control"', 'the document cache-control guard');
  assertContains(runtime, "new URL('../tabs/psnm-utility-pages-entry.js'", 'the runtime to load the new physical Utilities entry');
  if (runtime.includes("import('../tabs/psnm-utility-tab.js?v=standalone-20260722")) throw new Error('Runtime still imports the stale July 22 Utilities URL directly.');
  assertContains(runtime, 'cache-bypass retry', 'the runtime cache-bypass retry');
  assertContains(entry, 'data-psnm-pages-entry-retry', 'the entry-level retry action');
  assertContains(utilities, 'Promise.allSettled', 'optional module isolation');
  assertContains(utilities, 'data-psnm-module-warning', 'visible optional-module diagnostics');
  if (/^import\s/m.test(utilities)) throw new Error('Utilities orchestrator must not have blocking static imports.');
}

const ciiWorkspaceTab = path.join(root, 'tabs/cii-workspace/cii-workspace-tab.js');
if (fs.existsSync(ciiWorkspaceTab)) {
  await import(`${pathToFileURL(ciiWorkspaceTab).href}?pages-graph=1`);
}

console.log('Explicit Pages deployment and resilient Utilities graph validation passed');
