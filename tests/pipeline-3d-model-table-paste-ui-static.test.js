import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const addon = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-addon.js', import.meta.url), 'utf8');
const samples = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-samples.js', import.meta.url), 'utf8');
const splitEnhancer = readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-samples.js', import.meta.url), 'utf8');
const psnm = readFileSync(new URL('../tabs/psnm-utility-tab.js', import.meta.url), 'utf8');

assert.match(addon, /Table \$\{number\} Paste/);
assert.match(addon, /Transfer to Raw Table \$\{number\} Text/);
assert.match(addon, /Raw Table 2 Text/);
assert.match(addon, /Raw Table 3 Text/);
assert.match(addon, /createElement\('details'\)/, 'raw groups use native collapsed details');
assert.doesNotMatch(addon, /details\.open\s*=\s*true|setAttribute\(['"]open/, 'raw groups remain collapsed by default');
assert.match(addon, /table2a-raw/);
assert.match(addon, /table3a-raw/);
assert.match(addon, /table3b-raw/);
assert.match(addon, /table3c-raw/);
assert.match(addon, /parseTable2Paste/);
assert.match(addon, /parseTable3Paste/);
assert.match(addon, /SAMPLE_TABLE_2_PASTE_MULTISHEET/);
assert.match(addon, /SAMPLE_TABLE_3_PASTE_MULTISHEET/);
assert.match(addon, /data-p3d=\"new-multisheet\"/);
assert.match(addon, /loadMultiSheetPasteSamples/);
assert.match(addon, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/, 'raw transfers enter the existing input propagation lifecycle');
assert.doesNotMatch(addon, /MutationObserver/, 'addon uses launcher lifecycle rather than another global observer');

assert.match(samples, /13\+621\.6/);
assert.match(samples, /13\+704\.7/);
assert.match(samples, /Handle = 271f6/);
assert.match(samples, /Handle = 2b298/);
assert.match(samples, /Handle = 288c0/);

assert.match(splitEnhancer, /renderEditablePreview\(dialog, raw\.dataset\.p3dSplit\)/);
assert.match(splitEnhancer, /syncSplitTables\(dialog\)/);
assert.match(splitEnhancer, /table2x-output/);
assert.match(splitEnhancer, /table3x-output/);

assert.match(psnm, /installPipeline3dTablePasteAddon/);
assert.match(psnm, /destroyPipeline3dTablePaste/);

console.log('pipeline-3d-model-table-paste-ui-static.test.js passed');