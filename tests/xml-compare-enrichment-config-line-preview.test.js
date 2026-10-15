import assert from 'node:assert/strict';
import {
  XML_COMPARE_ENRICHMENT_LEGACY_STORAGE_KEY,
  XML_COMPARE_ENRICHMENT_STORAGE_KEY,
  addRestraintTypeRow,
  buildEnrichmentLineIdOptions,
  createEnrichmentConfig,
  deleteRestraintTypeRow,
  loadEnrichmentFromStorage,
  renderXmlCompareEnrichmentConfigPopupHtml,
  saveEnrichmentToStorage,
  serializableEnrichmentConfig,
  updateRestraintTypeRow,
} from '../xml-compare/XmlCompareEnrichmentConfig.js';
import { _test as tabTest } from '../tabs/xml-compare-tab.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}

const workspace = {
  source: { records: [{ lineNo: '/A/B1', uid: 's1' }, { lineNo: '/A/B1', uid: 's2' }, { branchName: '/B/B1', uid: 's3' }] },
  target: { records: [{ lineNo: '/T/B1', uid: 't1' }] },
};

const options = buildEnrichmentLineIdOptions(workspace);
assert.deepEqual(options.source.map(o => o.value), ['/A/B1', '/B/B1']);
assert.deepEqual(options.target.map(o => o.value), ['/T/B1']);
assert.equal(options.source[0].uid, 's1');

const previewLineId = '/X-88102-4-P8810212-END/B1';
const config = createEnrichmentConfig({
  open: true,
  activeEnrTab: 'class',
  pipingClass: { regex: '([0-9]{5})', group: '1', tokenPosition: '4', tokenDelimiter: '-', previewSide: 'source', previewLineId },
  rating: { enabled: true, method: 'table', tableText: 'PIPINGCLASS\tRATING\n88102\t1500' },
});
const html = renderXmlCompareEnrichmentConfigPopupHtml(config, {
  workspace: { source: { records: [{ lineNo: previewLineId, uid: 'sample' }] }, target: workspace.target },
});

for (const text of ['Example Branch / Line ID', 'Source A', 'Target B', 'Regex', 'Group', 'Token position', 'Token delimiter', 'Apply to all', 'Derived facts preview', 'PipingClass', 'Rating', 'Extraction details', 'Regex group', 'Regex error', 'Token value', 'Selected result', 'Tokens']) assert.ok(html.includes(text));
for (const text of ['Regex is a search pattern', 'Group means which bracketed part', 'Token position is the part number', 'Token delimiter is the character', 'Use these extraction rules for every line ID']) assert.ok(html.includes(text));
for (const text of ['88102', '1500', 'P8810212', 'X | 88102 | 4 | P8810212 | END']) assert.ok(html.includes(text));

const edited = updateRestraintTypeRow(createEnrichmentConfig({ restraintTypeConvert: { rows: [{ label: 'A', from: '1', to: '2' }] } }), 0, 'label', 'B');
assert.equal(edited.restraintTypeConvert.rows[0].label, 'B');
assert.equal(updateRestraintTypeRow(edited, 0, 'bad', 'X').restraintTypeConvert.rows[0].label, 'B', 'bad RTC column ignored');
assert.equal(updateRestraintTypeRow(edited, 9, 'from', 'X').restraintTypeConvert.rows[0].from, '1', 'bad RTC index ignored');
const added = addRestraintTypeRow(edited);
assert.deepEqual(added.restraintTypeConvert.rows.at(-1), { label: '', from: '', to: '' });
const deleted = deleteRestraintTypeRow(added, 0);
assert.equal(deleted.restraintTypeConvert.rows.length, 1);
assert.deepEqual(deleteRestraintTypeRow(deleted, 0).restraintTypeConvert.rows, [], 'deleting last row is allowed');

const state = { enrichmentConfig: createEnrichmentConfig({ pipingClass: { applyToAllConfirmed: true }, restraintTypeConvert: { rows: [{ label: 'L', from: '7', to: '8' }] } }) };
tabTest.setRestraintTypeRowField(state, { dataset: { enrRtcRow: '0', enrRtcCol: 'from' }, value: '10' });
assert.equal(state.enrichmentConfig.restraintTypeConvert.rows[0].from, '10');
assert.equal(state.enrichmentConfig.pipingClass.applyToAllConfirmed, true, 'RTC row edits preserve unrelated piping class state');

const store = memoryStorage();
const savedCfg = createEnrichmentConfig({ open: true, activeEnrTab: 'class', restraintTypeConvert: { rows: [{ label: 'X', from: '1', to: '2' }] } });
saveEnrichmentToStorage(savedCfg, store);
assert.ok(store.getItem(XML_COMPARE_ENRICHMENT_STORAGE_KEY), 'canonical key used for save');
assert.equal(store.getItem(XML_COMPARE_ENRICHMENT_LEGACY_STORAGE_KEY), null, 'legacy key not saved');
const savedRaw = JSON.parse(store.getItem(XML_COMPARE_ENRICHMENT_STORAGE_KEY));
assert.equal('open' in savedRaw, false, 'open state is not persisted');
assert.equal('activeEnrTab' in savedRaw, false, 'active tab is not persisted');
assert.equal(loadEnrichmentFromStorage(store).restraintTypeConvert.rows[0].label, 'X');

const legacyStore = memoryStorage();
legacyStore.setItem(XML_COMPARE_ENRICHMENT_LEGACY_STORAGE_KEY, JSON.stringify(serializableEnrichmentConfig(savedCfg)));
assert.equal(loadEnrichmentFromStorage(legacyStore).restraintTypeConvert.rows[0].from, '1', 'legacy key can still be read');
const badStore = memoryStorage();
badStore.setItem(XML_COMPARE_ENRICHMENT_STORAGE_KEY, '{bad json');
assert.equal(loadEnrichmentFromStorage(badStore).pipingClass.regex, '([0-9]{5})', 'malformed JSON falls back to defaults');
const roundTrip = memoryStorage();
saveEnrichmentToStorage(added, roundTrip);
assert.deepEqual(loadEnrichmentFromStorage(roundTrip).restraintTypeConvert.rows, added.restraintTypeConvert.rows, 'rows survive save/load round trip');

console.log('xml-compare-enrichment-config-line-preview.test.js passed');
