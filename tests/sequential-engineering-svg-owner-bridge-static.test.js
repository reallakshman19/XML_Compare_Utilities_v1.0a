import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const productionFiles = [
  'tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-index-projection.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-authority.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-adapter.js',
  'tabs/sequential-sketcher/sequential-sketcher-workspace.js',
];

for (const relative of productionFiles) {
  const source = read(relative);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|dispatchEvent|CustomEvent|MutationObserver/);
  assert.doesNotMatch(source, /nearest|screen matching|array index|display text/i);
}

for (const relative of productionFiles.slice(0, 2)) {
  assert(read(relative).split('\n').length < 300, `${relative} must remain below 300 lines`);
}

const bridge = read(productionFiles[0]);
assert.match(bridge, /SequentialEngineeringSvgOwnerBridge\.v1/);
assert.match(bridge, /SequentialEngineeringSvgOwnerEvent\.v1/);
assert.match(bridge, /source-inspected/);
assert.match(bridge, /source-reloaded/);
assert.match(bridge, /snapshot/);
assert.match(bridge, /registerPublisher/);
assert.doesNotMatch(bridge, /timestamp|randomUUID|Math\.random|Date\.now|fallback.*revision/i);
assert.doesNotMatch(bridge, /window\.|document\.|querySelector|closest\(/);

const projection = read(productionFiles[1]);
assert.match(projection, /SequentialEngineeringSvgIndexProjection\.v1/);
assert.match(projection, /componentReferences/);
assert.match(projection, /conflict:/);
assert.doesNotMatch(projection, /return\s+indexes|indexes:\s*indexes/);

const authority = read(productionFiles[2]);
assert.match(authority, /input\.indexProjection/);
assert.match(authority, /supportProjection\.constructionFingerprint !== confirmed\.constructionFingerprint/);

const adapter = read(productionFiles[3]);
assert.match(adapter, /SequentialEngineeringSvgOwnerEvent\.v1/);
assert.match(adapter, /if \(!state\) return/);
assert.doesNotMatch(adapter, /advanceConstruction|applyConstructionDecision|runConstructionUntilBlocked/);
assert.doesNotMatch(adapter, /commandGateway\s*:/);

const workspace = read(productionFiles[4]);
assert.match(workspace, /createSequentialEngineeringSvgOwnerBridge/);
assert.match(workspace, /registerPublisher/);
assert.match(workspace, /getEngineeringSvgOwnerSnapshot/);
assert.match(workspace, /subscribeEngineeringSvgOwnerState/);
assert.match(workspace, /inspect\('source-reloaded'\)/);
assert.match(workspace, /publishOwner\(reason\)/);
assert.match(workspace, /publishOwner\(opened\.restored \? 'branch-restored' : 'branch-opened'\)/);
assert.match(workspace, /publishOwner\('projection-changed'\)/);
assert.match(workspace, /publishOwner\('selection-changed'\)/);
assert.doesNotMatch(workspace, /mountEngineeringSvg|Engineering SVG Preview|data-ssk-viewer/);

function filesUnder(relative) {
  const absolute = path.join(root, relative);
  return readdirSync(absolute).flatMap((name) => {
    const child = path.join(absolute, name);
    return statSync(child).isDirectory()
      ? filesUnder(path.join(relative, name))
      : [path.join(relative, name).replaceAll('\\', '/')];
  });
}

for (const relative of [
  ...filesUnder('tabs/sequential-sketcher/construction'),
  ...filesUnder('tabs/sequential-sketcher/support'),
  ...filesUnder('tabs/sequential-sketcher/review'),
]) {
  if (!relative.endsWith('.js')) continue;
  assert.doesNotMatch(read(relative), /sequential-engineering-svg-owner-bridge/);
}

console.log('Sequential Engineering SVG owner bridge static guards: ok');
