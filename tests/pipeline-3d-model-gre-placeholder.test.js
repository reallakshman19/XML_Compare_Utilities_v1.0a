import assert from 'node:assert/strict';
import { normalizeElasticBendSettings } from '../tabs/pipeline-3d-model/pipeline-3d-model-elastic-bend-settings.js';
import { resolveGreFittingPlaceholder } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-placeholder.js';
import { calculateElasticBendScreening } from '../tabs/pipeline-3d-model/pipeline-3d-model-bend-screening.js';

const empty = normalizeElasticBendSettings();
assert.equal(empty.designBasis, '');
assert.equal(empty.requestedDesignBasis, '');
assert.equal(empty.profileFallbackApplied, false);
assert.equal(empty.profileResolutionReason, 'PROFILE_NOT_SPECIFIED');
assert.equal(empty.greBendBreakMultiplierBore, null);
const unknown = normalizeElasticBendSettings({ designBasis: 'not-supported' });
assert.equal(unknown.designBasis, '');
assert.equal(unknown.requestedDesignBasis, 'not-supported');
assert.equal(unknown.profileFallbackApplied, false);
assert.equal(unknown.profileResolutionReason, 'PROFILE_INVALID');
const greSettings = normalizeElasticBendSettings({
  enabled: true, emitToInputXml: true, screeningOnlyAcknowledged: true,
  designBasis: 'gre', requestedDesignBasis: 'gre',
  greNominalBoreMm: 100, greBendRadiusMm: 500,
  greBendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER',
  greBendBreakMultiplierBore: 1.5, greBendLocalThicknessMm: 12,
  greTeeBreakLengthMm: 275, greTeeLocalThicknessMm: 15,
  greRequirementReference: 'GRE-VENDOR-REQ-001',
});
const placeholder = resolveGreFittingPlaceholder(greSettings);
assert.equal(placeholder.active, true);
assert.equal(placeholder.policyReady, false);
assert.equal(placeholder.bend.nominalBoreMm, 100);
assert.equal(placeholder.bend.breakLengthBasis, 'NOMINAL_BORE_MULTIPLIER');
assert.equal(placeholder.bend.breakLengthMm, 150);
assert.equal(placeholder.bend.radiusMm, 500);
assert.equal(placeholder.tee.breakLengthBasis, 'EXPLICIT_LENGTH');
assert.equal(placeholder.tee.breakLengthMm, 275);
assert.equal(placeholder.geometryApplied, false);
assert.equal(placeholder.inputXmlApplied, false);
const explicitLength = resolveGreFittingPlaceholder({ designBasis: 'gre',
  greNominalBoreMm: 100, greBendBreakLengthBasis: 'EXPLICIT_LENGTH',
  greBendBreakLengthMm: 240 });
assert.equal(explicitLength.bend.breakMultiplierBore, null);
assert.equal(explicitLength.bend.breakLengthMm, 240);
const missingMultiplier = resolveGreFittingPlaceholder({ designBasis: 'gre',
  greNominalBoreMm: 100, greBendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER' });
assert.equal(missingMultiplier.bend.breakLengthMm, null);
const screening = calculateElasticBendScreening(greSettings, { boreMm: 114.3 });
assert.equal(screening.outsideDiameterMm, null);
assert.equal(screening.governingRadiusMm, null);
assert.equal(screening.grePlaceholder.bend.breakLengthMm, 150);
assert.ok(screening.warnings.some((item) => item.code === 'PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED'));
const absentProfile = calculateElasticBendScreening({ enabled: true }, { boreMm: 100 });
assert.ok(absentProfile.warnings.some((item) => item.code === 'PIPELINE_CONFIGURATION_PROFILE_REQUIRED'));
console.log('Pipeline GRE explicit evidence tests passed.');
