import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const view = fs.readFileSync(path.join(root, 'tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-ui-view.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-ui.js'), 'utf8');
for (const title of ['Configuration status', 'Branch and InputXML metadata', 'Analysis-section profiles',
  'Diameter and property authority', 'Normal fittings', 'ASME B31.4 criteria', 'GRE vendor series',
  'GRE bend', 'GRE tee', 'Geometry and writer gates', 'Legacy migration review',
  'Evidence preview and export']) assert.match(view, new RegExp(title));
for (const action of ['Save draft', 'Validate', 'Apply and rebuild', 'Export configuration JSON',
  'Export configuration TSV', 'Export blocker report', 'Clear draft', 'Close']) assert.match(view, new RegExp(action));
assert.match(view, /<option value="">Select…<\/option>/);
assert.match(view, /Import visible branch block values/);
assert.doesNotMatch(view, /Normal — default|value="(?:11\.00|B1|PL-XX|120|90|5|40|60|500|207000)"/);
assert.match(controller, /BRANCH_INPUT_BLOCK/);
assert.match(controller, /apply\.disabled = instance\.plan\?\.ready !== true/);
assert.match(controller, /Legacy — confirmation required/);
assert.doesNotMatch(controller, /export\s+default|Math\.random|performance\.now|localeCompare/);
console.log('pipeline-3d-model engineering configuration UI static: PASS');
