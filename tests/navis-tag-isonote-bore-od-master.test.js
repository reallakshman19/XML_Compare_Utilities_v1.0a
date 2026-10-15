import assert from 'node:assert/strict';
import {
  DEFAULT_BORE_TO_OD_PROFILE,
  builtInBoreToOdProfileSummary,
  hasBuiltInBoreToOdProfile,
  resolveBuiltInBoreToOd,
} from '../tabs/navis-tag-isonote/navis-tag-bore-od-master.js';
import { buildStagedJsonHierarchy, buildStagedSupportIndex } from '../tabs/navis-tag-isonote/navis-tag-staged-tree.js';

assert.equal(hasBuiltInBoreToOdProfile(''), true);
assert.equal(hasBuiltInBoreToOdProfile(DEFAULT_BORE_TO_OD_PROFILE), true);
assert.equal(builtInBoreToOdProfileSummary('').rowCount, 36);

for (const [rawBore, boreNominalMm, expectedOd] of [
  ['100mm', 100, 114.3],
  ['DN150', 150, 168.3],
  ['600 mm', 600, 609.6],
  ['NPS 4', 4, 114.3],
  ['4in', 4, 114.3],
]) {
  const result = resolveBuiltInBoreToOd({ rawBore, boreNominalMm, profileName: '' });
  assert.ok(result, `${rawBore} should resolve`);
  assert.equal(result.odMm, expectedOd);
  assert.equal(result.profileName, DEFAULT_BORE_TO_OD_PROFILE);
  assert.equal(result.source, 'BUILT_IN_ASME_BORE_TO_OD_PROFILE');
  assert.ok(result.standardBasis.standards.includes('ASME B36.10M-2018'));
}
assert.equal(resolveBuiltInBoreToOd({ rawBore: '123mm', boreNominalMm: 123 }), null);
assert.equal(resolveBuiltInBoreToOd({ rawBore: '100mm', boreNominalMm: 100, profileName: 'UNKNOWN_PROFILE' }), null);

function indexFor(attributes, config = {}) {
  const tree = buildStagedJsonHierarchy([{ sourceFile: 'bore.json', data: { attributes } }], {
    jsonIdentityPaths: ['attributes.NAME'],
    jsonBorePaths: ['attributes.ABORE'],
    jsonOdPaths: ['attributes.OD'],
    jsonBoreUnits: 'mm',
    boreToOdLookupEnabled: true,
    ...config,
  });
  return buildStagedSupportIndex(tree, tree.config).entries[0];
}

const builtInEntry = indexFor({ NAME: '/PS-100.1', ABORE: '100mm' });
assert.equal(builtInEntry.boreNominalMm, 100);
assert.equal(builtInEntry.odMm, 114.3);
assert.equal(builtInEntry.odSource, 'BUILT_IN_ASME_BORE_TO_OD_PROFILE');
assert.equal(builtInEntry.odLookupProfileName, DEFAULT_BORE_TO_OD_PROFILE);
assert.equal(builtInEntry.odLookupDn, 100);
assert.equal(builtInEntry.odLookupNps, '4');
assert.equal(builtInEntry.derivedFacts.boreNominalMm, 100);

const customEntry = indexFor({ NAME: '/PS-150.1', ABORE: '150mm' }, {
  boreToOdLookupName: 'PROJECT_OVERRIDE',
  boreToOdLookup: { '150mm': 170.0 },
});
assert.equal(customEntry.odMm, 170.0);
assert.equal(customEntry.odSource, 'CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP');
assert.equal(customEntry.odLookupName, 'PROJECT_OVERRIDE');

const directOdEntry = indexFor({ NAME: '/PS-200.1', ABORE: '200mm', OD: '225mm' });
assert.equal(directOdEntry.odMm, 225);
assert.equal(directOdEntry.odSource, 'DIRECT_JSON_OD_PATH');
assert.equal(directOdEntry.boreNominalMm, 200);

const unmatchedEntry = indexFor({ NAME: '/PS-123.1', ABORE: '123mm' });
assert.equal(unmatchedEntry.odMm, null);
assert.equal(unmatchedEntry.odSource, 'NONE');
assert.equal(unmatchedEntry.boreNominalMm, 123);

console.log('navis-tag-isonote bore-to-OD master tests passed');
