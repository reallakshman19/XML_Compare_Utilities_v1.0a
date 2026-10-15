import assert from 'node:assert/strict';
import { normalizeElasticBendSettings } from '../tabs/pipeline-3d-model/pipeline-3d-model-elastic-bend-settings.js';
import { calculateElasticBendScreening } from '../tabs/pipeline-3d-model/pipeline-3d-model-bend-screening.js';
import { resolveGreFittingPlaceholder } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-placeholder.js';
const empty = normalizeElasticBendSettings();
assert.equal(empty.designBasis, ''); assert.equal(empty.standardRadiusMultiplierD, null);
assert.equal(empty.youngsModulusMpa, null); assert.equal(empty.practicalRadiusMultiplierD, null);
assert.equal(empty.greBendBreakMultiplierBore, null);
const noBoreOd = calculateElasticBendScreening({ enabled: true, designBasis: 'default-metallic',
  diameterSource: 'explicit-od', standardRadiusMultiplierD: 2,
  detectHorizontal: true, detectVertical: true, detectCompound: true }, { boreMm: 114.3 });
assert.equal(noBoreOd.outsideDiameterMm, null);
assert.ok(noBoreOd.warnings.some((item) => item.code === 'PIPELINE_CONFIGURATION_DIAMETER_REQUIRED'));
const explicit = calculateElasticBendScreening({ enabled: true, designBasis: 'default-metallic',
  requestedDesignBasis: 'default-metallic', diameterSource: 'explicit-od',
  explicitOutsideDiameterMm: 100, standardRadiusMultiplierD: 2,
  detectHorizontal: true, detectVertical: true, detectCompound: true }, { boreMm: 114.3 });
assert.equal(explicit.outsideDiameterMm, 100); assert.equal(explicit.governingRadiusMm, 200);
const gre = resolveGreFittingPlaceholder({ designBasis: 'gre', greNominalBoreMm: 100,
  greBendRadiusMm: 300, greBendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER',
  greBendBreakMultiplierBore: 2, greBendLocalThicknessMm: 10,
  greTeeBreakLengthMm: 150, greTeeLocalThicknessMm: 12 });
assert.equal(gre.bend.breakLengthMm, 200);
assert.equal(resolveGreFittingPlaceholder({ designBasis: 'gre', greNominalBoreMm: 100 })
  .bend.breakMultiplierBore, null);
console.log('pipeline-3d-model explicit bend screening: PASS');
