import assert from 'node:assert/strict';
import { applyXmlCompareEnrichment, extractPipingClass, previewPipingClassExtraction } from '../xml-compare/XmlCompareEnrichmentApply.js';

const lineId = '/ASIM-1835-4"-P8810212-31441C4-PP/B1';
const xmlLineId = lineId.replaceAll('"', '&quot;');
const baseConfig = {
  pipingClass: { regex: '([0-9]{5})', group: '1', tokenPosition: '4', tokenDelimiter: '-' },
};

const result = previewPipingClassExtraction(lineId, baseConfig);
assert.equal(result.regexValue, '88102');
assert.equal(result.regexError, '');
assert.equal(result.tokenValue, 'P8810212');
assert.equal(result.selectedValue, '88102');
assert.equal(result.pipingClass, '88102');
assert.deepEqual(result.tokens, ['ASIM', '1835', '4"', 'P8810212', '31441C4', 'PP']);
assert.equal(result.source, 'regex');
assert.equal(extractPipingClass(lineId, baseConfig.pipingClass), '88102');

const fallback = previewPipingClassExtraction(lineId, { pipingClass: { ...baseConfig.pipingClass, regex: 'XYZ([0-9]{5})' } });
assert.equal(fallback.regexValue, '');
assert.equal(fallback.regexError, '');
assert.equal(fallback.tokenValue, 'P8810212');
assert.equal(fallback.selectedValue, 'P8810212');
assert.equal(fallback.source, 'token');

const invalid = previewPipingClassExtraction(lineId, { pipingClass: { ...baseConfig.pipingClass, regex: '([0-9]{5}' } });
assert.notEqual(invalid.regexError, '');
assert.equal(invalid.tokenValue, 'P8810212');
assert.equal(invalid.selectedValue, 'P8810212');
assert.equal(invalid.source, 'token');

const rating = previewPipingClassExtraction(lineId, { ...baseConfig, rating: { enabled: true, method: 'table', tableText: 'PIPINGCLASS\tRATING\n88102\t1500' } });
assert.equal(rating.rating, '1500');

const xml = `<ROOT>
  <Meta>keep-root</Meta>
  <PIPINGELEMENT FROM_NODE="1" TO_NODE="2" LINE_ID="${xmlLineId}" DELTA_X="1" DELTA_Y="2" DELTA_Z="3">
    <UserChild>keep me</UserChild>
    <BEND />
    <RESTRAINT TYPE="17" />
  </PIPINGELEMENT>
</ROOT>`;
const enrichConfig = {
  pointPropertiesBasis: { enabled: true, value: 'TO' },
  componentType: { enabled: true, bendType: 'ELBO', sifType: 'BRAN', rigidType: 'ATTA', defaultType: 'PIPE' },
  dtxr: { enabled: true, typeMapText: 'TYPE\tKIND\tDTXR_POS\n17\tREST\tPIPE SUPPORT' },
  pipingClass: { enabled: true, ...baseConfig.pipingClass },
  rating: { enabled: true, method: 'table', tableText: 'PIPINGCLASS\tRATING\n88102\t1500' },
  position: { enabled: true, startX: '0', startY: '0', startZ: '0' },
};
function countTag(text, tag) { return (String(text).match(new RegExp(`<${tag}>`, 'g')) || []).length; }

const first = applyXmlCompareEnrichment(xml, enrichConfig);
const second = applyXmlCompareEnrichment(first.xmlText, enrichConfig);
for (const tag of ['PipingClass', 'Rating', 'ComponentType', 'Point_properties_basis', 'DTXR_POS', 'DTXR_PS', 'Position']) {
  assert.equal(countTag(second.xmlText, tag), 1, `${tag} is not duplicated on repeat apply`);
}
assert.equal(second.report.pipingClassApplied, 1);
assert.equal(second.report.ratingApplied, 1);
assert.equal(second.report.componentTypeApplied, 1);
assert.equal(second.report.pointBasisApplied, 1);
assert.equal(second.report.dtxrApplied, 1);
assert.equal(second.report.positionApplied, 1);
assert.ok(second.xmlText.includes('<UserChild>keep me</UserChild>'), 'unrelated child tag remains intact');
assert.ok(second.xmlText.includes('<Meta>keep-root</Meta>'), 'non-PIPINGELEMENT structure remains intact');

const changed = applyXmlCompareEnrichment(second.xmlText, {
  ...enrichConfig,
  pointPropertiesBasis: { enabled: true, value: 'FROM' },
  rating: { enabled: true, method: 'fixed', fixedValue: '900' },
});
assert.equal(countTag(changed.xmlText, 'Point_properties_basis'), 1);
assert.equal(countTag(changed.xmlText, 'Rating'), 1);
assert.ok(changed.xmlText.includes('<Point_properties_basis>FROM</Point_properties_basis>'));
assert.ok(!changed.xmlText.includes('<Point_properties_basis>TO</Point_properties_basis>'));
assert.ok(changed.xmlText.includes('<Rating>900</Rating>'));
assert.ok(!changed.xmlText.includes('<Rating>1500</Rating>'));

console.log('xml-compare-enrichment-apply-preview.test.js passed');
