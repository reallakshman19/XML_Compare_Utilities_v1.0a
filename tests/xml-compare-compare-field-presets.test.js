import assert from 'node:assert/strict';

import {
  applyCompareFieldPreset,
  compareFieldPresetNames,
  fieldsForComparePreset,
} from '../xml-compare/XmlCompareCompareFieldPresets.js';

assert.deepEqual(fieldsForComparePreset('coordinates'), ['globalX', 'globalY', 'globalZ']);
assert.equal(fieldsForComparePreset('element-endpoints').includes('FROM_GLOBAL_X'), true);
assert.equal(fieldsForComparePreset('line-identity').includes('Branchname'), true);
assert.equal(fieldsForComparePreset('support').includes('SupportText'), true);
assert.equal(compareFieldPresetNames().includes('coordinates'), true);
assert.deepEqual(applyCompareFieldPreset(['lineNo'], 'coordinates'), ['lineNo', 'globalX', 'globalY', 'globalZ']);

console.log('XML Compare compare field presets tests passed');
