import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const config = fs.readFileSync('playwright.xml-builder-viewport.config.mjs', 'utf8');
const workflowPath = '.github/workflows/xml-builder-viewport-browser.yml';
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';
const browserEvidencePaths = [
  'artifacts/xml-builder-viewport-browser-results.json',
  'playwright-report/xml-builder-viewport',
  'test-results/xml-builder-viewport',
];
const spec = fs.readFileSync('tests/browser/xml-builder-viewport.spec.mjs', 'utf8');
assert.equal(packageJson.scripts['test:xml-builder-viewport-browser'], 'playwright test --config=playwright.xml-builder-viewport.config.mjs');
assert.ok(packageJson.scripts['test:xml-builder-viewport-large-data']);
assert.match(config, /xml-builder-viewport\.spec\.mjs/);
assert.match(config, /timeout: 90_000/);
assert.match(config, /trace: 'retain-on-failure'/);
assert.match(config, /screenshot: 'only-on-failure'/);
for (const evidencePath of browserEvidencePaths) assert.ok(config.includes(evidencePath));
if (workflow) {
  assert.match(workflow, /XML Builder Viewport Browser Acceptance/);
  assert.match(workflow, /timeout-minutes: 30/);
}
for (const id of ['XMLB-VP-B01','XMLB-VP-B02','XMLB-VP-B03','XMLB-VP-B04','XMLB-VP-B05','XMLB-VP-B06','XMLB-VP-B07','XMLB-VP-B08','XMLB-VP-B09']) assert.ok(spec.includes(id));
for (let index = 1; index <= 15; index += 1) assert.ok(spec.includes(`XMLB-VP2-B${String(index).padStart(2, '0')}`));
console.log('xml-builder viewport browser contract tests passed');