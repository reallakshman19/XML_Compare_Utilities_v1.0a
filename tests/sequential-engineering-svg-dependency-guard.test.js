import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'tabs/sequential-sketcher/sequential-engineering-svg-authority.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-scene.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-properties.js',
  'tabs/sequential-sketcher/sequential-engineering-svg-adapter.js',
];
const forbidden = /\b(document|window|innerHTML|localStorage|sessionStorage|Canvas|WebGL|THREE|ReactDOM|React|CustomEvent)\b|addEventListener|dispatchEvent|sequential-construction-svg|sequential-sketcher-projection|sequential-sketcher-tab|sequential-sketcher-workspace|advanceConstruction|applyConstructionDecision|runConstructionUntilBlocked|createEngineeringSvgCommandGateway|commandGateway\s*:|Math\.(round|floor|ceil|trunc)|toFixed|parseInt|Date\s*\(|new\s+Date|Math\.random/;

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, forbidden, `${name} crosses the read-only dependency boundary`);
  assert.doesNotMatch(source, /engineering-svg-command-gateway/, `${name} imports an edit gateway module`);
}

function javascriptFiles(directory) {
  const rows = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) rows.push(...javascriptFiles(path));
    else if (name.endsWith('.js')) rows.push(path);
  }
  return rows;
}

for (const directory of ['core/engineering-scene', 'core/engineering-svg']) {
  for (const path of javascriptFiles(join(root, directory))) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /sequential-sketcher|sequential-engineering-svg/i, `${path} imports Sequential domain code`);
  }
}

const renderer = readFileSync(join(root, 'tabs/sequential-sketcher/canvas/sequential-construction-svg.js'), 'utf8');
assert.doesNotMatch(renderer, /sequential-engineering-svg|EngineeringScene|EngineeringSvgAdapter/, 'existing Sequential renderer must remain independent');

console.log('Sequential engineering SVG dependency guards: ok');
