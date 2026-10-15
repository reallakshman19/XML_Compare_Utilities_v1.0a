import assert from 'node:assert/strict';

import {
  compareEngineeringTerms,
  createDefaultSupportDictionary,
  mapEngineeringTerm,
  normalizeEngineeringToken,
} from '../xml-compare/XmlCompareEngineeringTextDictionary.js';
import { compareTextValues } from '../xml-compare/XmlCompareTextValidationRules.js';

const dictionary = createDefaultSupportDictionary();
assert.equal(normalizeEngineeringToken('line stop'), 'LINE_STOP');
assert.equal(mapEngineeringTerm('LIM', dictionary).mapped, 'LINE_STOP');
assert.equal(compareEngineeringTerms({ sourceValue: 'LIM', targetValue: 'LINE_STOP', dictionary }).status, 'OK');
assert.equal(compareEngineeringTerms({ sourceValue: 'ANC', targetValue: 'ANCHOR', dictionary }).status, 'OK');
assert.equal(compareEngineeringTerms({ sourceValue: '+Y', targetValue: 'REST', dictionary }).status, 'OK');
assert.equal(compareEngineeringTerms({ sourceValue: 'UNKNOWN', targetValue: 'REST', dictionary }).status, 'UNKNOWN_ENGINEERING_TOKEN');

const generic = compareTextValues({ sourceValue: 'abc', targetValue: 'ABC', rule: { mode: 'exact-normalized' } });
assert.equal(generic.status, 'OK');

const dictionaryMode = compareTextValues({
  sourceValue: 'LIM',
  targetValue: 'LINE_STOP',
  rule: { field: 'SupportText', mode: 'engineering-dictionary', dictionary },
});
assert.equal(dictionaryMode.status, 'OK');
assert.notEqual(dictionary.LIM, undefined);

console.log('XML Compare engineering text dictionary tests passed');
