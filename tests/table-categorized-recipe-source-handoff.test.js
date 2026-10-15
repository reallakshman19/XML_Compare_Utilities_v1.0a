import assert from 'node:assert/strict';

import {
  ISO_NOTE_RECIPE_PROFILE,
  ISO_NOTE_TABLE_1_SAMPLE,
  ISO_NOTE_TABLE_2_SAMPLE,
} from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import {
  buildXmlArtifactFromTable,
  createConnectorPreviewByKey,
  createXmlCompareSourceHandoff,
  loadTableXmlRecipe,
  saveTableXmlRecipe,
} from '../xml-compare/table-categorizer/table-categorized-xml-recipe-workflow.js';

const saved = saveTableXmlRecipe(ISO_NOTE_RECIPE_PROFILE, {
  recipeId: 'ISOrecipe',
  displayName: 'ISOrecipe',
  connectorKeyField: 'connectorKey',
  notes: ['Table 1 and Table 2 are converted independently, then connected in XML Compare by connectorKey.'],
});
assert.equal(saved.recipe.schema, 'SavedTableXmlRecipe.v1');
assert.equal(saved.recipe.recipeId, 'ISOrecipe');
assert.equal(saved.recipe.connectorKeyField, 'connectorKey');
assert.match(saved.json, /"recipeId": "ISOrecipe"/);
assert.match(saved.json, /"SupportISONOTE"/);

const reloaded = loadTableXmlRecipe(saved.json);
assert.equal(reloaded.recipeId, 'ISOrecipe');
assert.equal(reloaded.profile.profileId, 'ISOrecipe');
assert.equal(reloaded.profile.requiredColumns[0], 'SupportISONOTE');

const sourceAArtifact = buildXmlArtifactFromTable({
  tableText: ISO_NOTE_TABLE_1_SAMPLE,
  sourceId: 'SourceA',
  sourceName: 'Rev 1 Table',
  recipe: reloaded,
});
const sourceBArtifact = buildXmlArtifactFromTable({
  tableText: ISO_NOTE_TABLE_2_SAMPLE,
  sourceId: 'SourceB',
  sourceName: 'Rev 2 Table',
  recipe: reloaded,
});

assert.equal(sourceAArtifact.exportResult.ok, true, JSON.stringify(sourceAArtifact.exportResult.diagnostics, null, 2));
assert.equal(sourceBArtifact.exportResult.ok, true, JSON.stringify(sourceBArtifact.exportResult.diagnostics, null, 2));
assert.equal(sourceAArtifact.source.rows.length, 17);
assert.equal(sourceBArtifact.source.rows.length, 17);
assert.match(sourceAArtifact.xmlText, /<IsoNoteXml/);
assert.match(sourceBArtifact.xmlText, /<IsoNoteXml/);
assert.match(sourceAArtifact.xmlText, /<connectorKey>SL-14143<\/connectorKey>/);
assert.match(sourceBArtifact.xmlText, /<connectorKey>SL-14143<\/connectorKey>/);
assert.match(sourceAArtifact.xmlText, /<revision>1<\/revision>/);
assert.match(sourceBArtifact.xmlText, /<revision>1<\/revision>/);
assert.match(sourceAArtifact.xmlText, /<guideGapMm>25<\/guideGapMm>/);
assert.match(sourceBArtifact.xmlText, /<guideGapMm>15<\/guideGapMm>/);
assert.match(sourceAArtifact.xmlText, /<nodeName>SL-14143.1\|HOLD<\/nodeName>/);
assert.match(sourceBArtifact.xmlText, /<nodeNumber>15140<\/nodeNumber>/);

assert.ok(sourceAArtifact.records.length >= 14, 'full Rev 1 table should create many connector-key records');
assert.ok(sourceBArtifact.records.length >= 14, 'full Rev 2 table should create many connector-key records even when duplicate note keys merge');
const a14143 = sourceAArtifact.records.find((record) => record.connectorKey === 'SL-14143');
const b14143 = sourceBArtifact.records.find((record) => record.connectorKey === 'SL-14143');
assert.ok(a14143);
assert.ok(b14143);
assert.equal(a14143.fields.guideGapMm, 25);
assert.equal(b14143.fields.guideGapMm, 15);
assert.equal(a14143.fields.nodeName, 'SL-14143.1|HOLD');
assert.equal(b14143.fields.nodeNumber, 15140);

const sourceA = createXmlCompareSourceHandoff(sourceAArtifact, { side: 'sourceA', sourceLabel: 'Source A' });
const sourceB = createXmlCompareSourceHandoff(sourceBArtifact, { side: 'sourceB', sourceLabel: 'Source B' });
assert.equal(sourceA.schema, 'TableXmlSourceHandoff.v1');
assert.equal(sourceA.xmlText, sourceAArtifact.xmlText);
assert.equal(sourceB.xmlText, sourceBArtifact.xmlText);
assert.equal(sourceA.diagnostics[0].code, 'source_handoff_xml_well_formed');
assert.equal(sourceB.diagnostics[0].code, 'source_handoff_xml_well_formed');

const connector = createConnectorPreviewByKey(sourceA, sourceB, 'SL-14143');
assert.equal(connector.ok, true, JSON.stringify(connector.diagnostics, null, 2));
assert.equal(connector.preview.sourceStableKey, 'SL-14143');
assert.equal(connector.preview.targetStableKey, 'SL-14143');
assert.equal(connector.preview.sourceUid, 'SourceA:SL-14143');
assert.equal(connector.preview.targetUid, 'SourceB:SL-14143');
assert.deepEqual(connector.preview.basis, ['table-xml-recipe', 'connector-key', 'connectorKey']);
assert.equal(connector.preview.transformBasis, 'connector-key');

const missing = createConnectorPreviewByKey(sourceA, sourceB, 'SL-99999');
assert.equal(missing.ok, false);
assert.equal(missing.diagnostics[0].code, 'connector_key_not_found');

console.log('table-categorized-recipe-source-handoff.test.js passed');
