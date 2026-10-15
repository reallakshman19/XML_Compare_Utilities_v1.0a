import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROD = path.join(ROOT, 'tabs/sequential-sketcher');
const files = [
  'sequential-engineering-svg-preview-policy.js', 'sequential-engineering-svg-preview-workspace.js',
  'sequential-engineering-svg-preview-controller.js', 'sequential-engineering-svg-parity-validation.js',
  'sequential-engineering-svg-shadow-workspace.js', 'sequential-sketcher-tab.js', 'sequential-sketcher-markup.js',
];
for (const name of files) {
  const source = fs.readFileSync(path.join(PROD, name), 'utf8');
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b|MutationObserver|localStorage|sessionStorage|setInterval|setTimeout/);
}
const markup = fs.readFileSync(path.join(PROD, 'sequential-sketcher-markup.js'), 'utf8');
assert.match(markup, />Construction SVG</);
assert.match(markup, />Engineering SVG preview</);
assert.match(markup, /ENGINEERING_SVG_PREVIEW[^>]+disabled/);
assert.match(markup, /data-ssk-construction-surface/);
assert.match(markup, /data-ssk-engineering-svg-preview-host/);
const controller = fs.readFileSync(path.join(PROD, 'sequential-engineering-svg-preview-controller.js'), 'utf8');
assert.match(controller, /getEngineeringSvgOwnerSnapshot\(\)/);
assert.match(controller, /subscribeEngineeringSvgOwnerState\(state\.handleOwnerEvent\)/);
assert.doesNotMatch(controller, /selectedCandidateId\s*=|construction\/|continuity\/|review\/|support\//);
const tab = fs.readFileSync(path.join(PROD, 'sequential-sketcher-tab.js'), 'utf8');
assert.doesNotMatch(tab, /sequentialEngineeringSvgPreviewWorkspaceFactory/);
const workspace = fs.readFileSync(path.join(PROD, 'sequential-engineering-svg-preview-workspace.js'), 'utf8');
assert.match(workspace, /domainRef\?\.candidateId/);
assert.match(workspace, /commandGateway:\s*null/);
assert.doesNotMatch(workspace, /coordinates|proximity|arrayIndex|sourceOrder/);
console.log('Sequential Engineering SVG preview static boundaries: ok');
