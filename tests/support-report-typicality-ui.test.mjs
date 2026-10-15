import assert from 'node:assert/strict';
import test from 'node:test';
import { _test as addonTest } from '../tabs/support-steel-relationship-builder/support-report-addon.js';
import {
  compareStructuralFamilyFeatures,
  _test as typicalityTest,
} from '../tabs/support-steel-relationship-builder/support-report-typicality.js';
import {
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  SUPPORT_REPORT_TYPICALITY_UI_SETTINGS,
  mergeSupportReportTypicalityProfile,
  profileValue,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-profile.js';
import { renderSupportReportTable, renderSupportReportWorkspace } from '../tabs/support-steel-relationship-builder/support-report-view.js';

test('Support Report panel exposes optional second XML typicality input', () => {
  const html = addonTest.renderPanel();
  assert.match(html, /Typical-structure reference XML/);
  assert.match(html, /data-ssr-typical-file="1"/);
  assert.match(html, /data-ssr-typical-xml/);
  assert.match(html, /legacy 21-column mode/);
  assert.match(html, /comparison columns 22–24/i);
});

test('typicality configuration exposes active defaults and hard-coded policy help through info hovers', () => {
  const html = addonTest.typicalityConfigCard();
  assert.match(html, /<details class="ssrb-card" data-ssr-typical-config open>/);
  assert.match(html, /data-ssr-typical-setting="structural\.geometryEnvelopeToleranceMm"/);
  assert.match(html, /Envelope tolerance \(mm\)/);
  assert.match(html, /value="25"/);
  assert.match(html, /data-ssr-typical-setting="pipingLocation\.assignmentWeights\.supportTypeMember"/);
  assert.match(html, /data-ssr-typical-setting="pipingLocation\.structuredSequence\.linearityToleranceMm"/);
  assert.match(html, /data-ssr-typical-setting="pipingLocation\.structuredSequence\.enforceMonotonic1D"/);
  assert.match(html, /data-ssr-typical-setting="pipingLocation\.structuredSequence\.evidenceWeights\.memberOrdinalPattern"/);
  assert.match(html, /data-ssr-typical-setting="pipingLocation\.structuredSequence\.evidenceWeights\.prevNamePattern"/);
  assert.match(html, /data-ssr-typical-setting="pipingLocation\.structuredSequence\.prevNamePatternScores\.onePositionDifferent"/);
  assert.match(html, /Dimensional resolution order/);
  assert.match(html, /3D → 2D → 1D/);
  assert.match(html, /Repeated member suffix evidence/);
  assert.match(html, /PREV NAME fuzzy evidence/);
  assert.match(html, /Solver unmatched sentinel/);
  assert.match(html, /1,000,000,000 cost units/);
  assert.match(html, /Solver ineligible sentinel/);
  assert.match(html, /Default 25 mm/);
  assert.match(html, /Advisory family-level diagnostic/);
  assert.match(html, /does not reject a structurally eligible family by itself/);
  assert.match(html, /canonical physical-location/);
  assert.match(html, />\(i\)<\/span>/);
});

test('envelope tolerance is configured and evaluated in millimetres', () => {
  assert.equal(SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.structural.geometryEnvelopeToleranceMm, 25);
  assert.equal(typicalityTest.envelopeToleranceMm(SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.structural), 25);

  const feature = (familyId, spanX) => ({
    familyId,
    locationCount: 2,
    memberMultiplicitySpectrum: [1, 1],
    normalizedPipeClassPopulation: ['2|P|31441C4|PP', '4|P|31441C4|PP'],
    rawClashPointCount: 2,
    geometryEnvelopeMm: { span: { x: spanX, y: 0, z: 0 } },
    pairDistanceSpectrumMm: [1000],
  });
  const profile = mergeSupportReportTypicalityProfile({
    structural: {
      geometryEnvelopeToleranceMm: 25,
      pairDistanceMedianToleranceMm: 100,
      pairDistanceP95ToleranceMm: 100,
      pairDistanceMaxToleranceMm: 100,
    },
  });
  const within = compareStructuralFamilyFeatures(feature('PS-1', 0), feature('PS-2', 24.999), profile);
  const outside = compareStructuralFamilyFeatures(feature('PS-1', 0), feature('PS-2', 25.001), profile);
  const withinEnvelope = within.signals.find((item) => item.reasonCode === 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE');
  const outsideEnvelope = outside.signals.find((item) => item.reasonCode === 'STRUCT_GEOMETRY_ENVELOPE_WITHIN_TOLERANCE');
  assert.equal(withinEnvelope.threshold, 25);
  assert.equal(withinEnvelope.result, 'PASS');
  assert.equal(outsideEnvelope.result, 'FAIL');
});

test('pair-distance P95 is advisory while median and maximum remain hard', () => {
  const feature = (familyId, distances) => ({
    familyId,
    locationCount: 3,
    memberMultiplicitySpectrum: [1, 1, 1],
    normalizedPipeClassPopulation: ['2|P|31441C4|HT', '2|P|31441C4|HT', '4|P|31441C4|PP'],
    rawClashPointCount: 3,
    geometryEnvelopeMm: { span: { x: 100, y: 100, z: 0 } },
    pairDistanceSpectrumMm: distances,
  });
  const profile = mergeSupportReportTypicalityProfile({
    structural: {
      geometryEnvelopeToleranceMm: 25,
      pairDistanceMedianToleranceMm: 10,
      pairDistanceP95ToleranceMm: 25,
      pairDistanceMaxToleranceMm: 50,
    },
  });
  const comparison = compareStructuralFamilyFeatures(
    feature('PS-1', [100, 200, 300]),
    feature('PS-2', [100, 209, 349]),
    profile,
  );
  const pair = comparison.signals.find((item) => item.reasonCode === 'STRUCT_PAIR_DISTANCE_WITHIN_TOLERANCE');
  assert.equal(pair.residual.median, 9);
  assert.ok(pair.residual.p95 > 25);
  assert.equal(pair.residual.max, 49);
  assert.equal(pair.policy.median, 'HARD');
  assert.equal(pair.policy.p95, 'ADVISORY');
  assert.equal(pair.policy.max, 'HARD');
  assert.equal(pair.p95Result, 'ADVISORY_EXCEEDED');
  assert.equal(pair.result, 'PASS');
  assert.equal(comparison.result, 'TYPICAL');
});

test('typicality profile partial overrides preserve unrelated governed defaults including nested sequence scores', () => {
  const merged = mergeSupportReportTypicalityProfile({
    pipingLocation: {
      assignmentWeights: { supportTypeMember: 250000 },
      structuredSequence: {
        evidenceWeights: { prevNamePattern: 175 },
        prevNamePatternScores: { sameTrailing3: 0.7 },
      },
    },
  });
  assert.equal(merged.pipingLocation.assignmentWeights.supportTypeMember, 250000);
  assert.equal(
    merged.pipingLocation.assignmentWeights.memberMultiplicity,
    SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.pipingLocation.assignmentWeights.memberMultiplicity,
  );
  assert.equal(merged.pipingLocation.structuredSequence.evidenceWeights.prevNamePattern, 175);
  assert.equal(
    merged.pipingLocation.structuredSequence.evidenceWeights.memberOrdinalPattern,
    SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.pipingLocation.structuredSequence.evidenceWeights.memberOrdinalPattern,
  );
  assert.equal(merged.pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing3, 0.7);
  assert.equal(
    merged.pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing4,
    SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing4,
  );
  assert.equal(
    merged.structural.pairDistanceP95ToleranceMm,
    SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.structural.pairDistanceP95ToleranceMm,
  );
  assert.equal(profileValue(merged, 'pipingLocation.assignmentWeights.supportTypeMember'), 250000);
  assert.ok(SUPPORT_REPORT_TYPICALITY_UI_SETTINGS.length >= 25);
});

test('ready-state comparison text distinguishes legacy and comparison modes', () => {
  assert.equal(addonTest.comparisonReadyText({}), ' · legacy 21-column mode');
  const text = addonTest.comparisonReadyText({
    typicalityAudit: {
      profileId: 'PS_TYPICAL_V1_PROVISIONAL',
      matches: [
        { result: 'TYPICAL' },
        { result: 'REVIEW' },
        { result: 'AMBIGUOUS' },
      ],
    },
  });
  assert.match(text, /1 typical, 1 review, 1 ambiguous/);
  assert.match(text, /columns 22–24 enabled/);
  assert.match(text, /profile PS_TYPICAL_V1_PROVISIONAL/);
});

test('comparison report table renders derived columns while legacy table does not', () => {
  const baseRow = {
    scope: 'ASIM',
    civilSecondarySupport: 'PS-11168',
    pipe: 'ASIM-1835-2"-P8810320-31441C4-HT-01',
  };
  const legacy = renderSupportReportTable({ rows: [baseRow] });
  assert.doesNotMatch(legacy, /TYPICAL STRUCTURE/);

  const report = {
    rows: [{
      ...baseRow,
      typicalStructure: 'PS-14168',
      pipingSupportArrangementMatch: 'TOPOLOGY ONLY (SUPPORT TYPE UNAVAILABLE)',
      typicalityAuditId: 'TYP-PS-11168--PS-14168-L01',
    }],
    typicalityAudit: { matches: [{ result: 'TYPICAL' }] },
    summary: {},
    diagnostics: [],
  };
  const table = renderSupportReportTable(report);
  assert.match(table, /TYPICAL STRUCTURE \(PS NO\.\)/);
  assert.match(table, /PIPING SUPPORT ARRANGEMENT MATCH/);
  assert.match(table, /TYPICALITY AUDIT ID/);
  assert.match(table, /PS-14168/);
  assert.match(table, /TYP-PS-11168--PS-14168-L01/);

  const workspace = renderSupportReportWorkspace(report);
  assert.match(workspace, /Typical-structure comparison:/);
});
