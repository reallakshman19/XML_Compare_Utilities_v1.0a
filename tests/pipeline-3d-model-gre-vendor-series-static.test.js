import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionRoot = path.join(root, 'tabs/pipeline-3d-model');
const names = ['pipeline-3d-model-gre-vendor-series-contracts.js',
  'pipeline-3d-model-gre-vendor-series-resolution.js'];
const sources = Object.fromEntries(names.map((name) => [name, fs.readFileSync(path.join(productionRoot, name), 'utf8')]));
for (const [name, source] of Object.entries(sources)) {
  const lines = source.trimEnd().split(/\r?\n/);
  assert.ok(lines.length < 300, `${name} must remain below 300 lines`);
  assert.ok(lines.length > 100, `${name} must remain normally formatted and reviewable`);
  assert.ok(Math.max(...lines.map((line) => line.length)) < 190, `${name} must not contain minified physical lines`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.|window\.|XMLSerializer|pipeline-3d-model-inputxml|xml-builder/i);
  assert.doesNotMatch(source, /bend-screening|bend-classification|bend-route|bend-resolution|normal-fitting|b314-radius/);
  assert.doesNotMatch(source, /Date\(|Math\.random|performance\.|localeCompare/);
  assert.doesNotMatch(source, /geometryApplied\s*=\s*true|inputXmlApplied\s*=\s*true/);
}
const contracts = sources[names[0]], resolution = sources[names[1]];
assert.match(contracts, /PipelineGreVendorSeriesPolicyRegistry\.v1/);
assert.match(contracts, /PipelineGreVendorSeriesMigration\.v1/);
assert.match(contracts, /PipelineGreVendorSeriesSectionResolution\.v1/);
assert.match(contracts, /PipelineGreVendorSeriesElementResolution\.v1/);
assert.match(contracts, /gre-vendor-qualified-bend[\s\S]*gre-vendor-qualified-tee/);
assert.match(contracts, /bore \* multiplier/);
assert.doesNotMatch(contracts, /outsideDiameterMm\s*[*\/]|[*\/]\s*outsideDiameterMm/);
assert.doesNotMatch(resolution, /outsideDiameterMm\s*[*\/]|[*\/]\s*outsideDiameterMm/);
assert.doesNotMatch(resolution, /nearest|round\(|range fallback/i);
assert.doesNotMatch(resolution, /cornerNode|turnAngle|candidateRadius|geometryFits|fittingNode|elementSplit/i);
const otherProduction = fs.readdirSync(productionRoot).filter((name) => name.endsWith('.js') && !names.includes(name))
  .map((name) => fs.readFileSync(path.join(productionRoot, name), 'utf8')).join('\n');
assert.equal(otherProduction.includes('pipeline-3d-model-gre-vendor-series-contracts.js'), false);
assert.equal(otherProduction.includes('pipeline-3d-model-gre-vendor-series-resolution.js'), false);
console.log('pipeline-3d-model GRE vendor-series static: PASS');
