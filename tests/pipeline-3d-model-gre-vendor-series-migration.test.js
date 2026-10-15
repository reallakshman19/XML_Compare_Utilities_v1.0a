import assert from 'node:assert/strict';
import { createPipelineGreVendorSeriesMigration } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-vendor-series-contracts.js';

const explicit = createPipelineGreVendorSeriesMigration({
  sourceKinds: ['EXPLICIT_GLOBAL_GRE_VENDOR_SERIES'],
  legacyAnalysisSectionIds: [], legacyEvidenceObserved: false,
  legacyGreVendorSeriesBasisConfirmed: false,
});
assert.equal(explicit.ready, true);

const confirmed = createPipelineGreVendorSeriesMigration({
  sourceKinds: ['CONFIRMED_LEGACY_GRE_PLACEHOLDER'],
  legacyAnalysisSectionIds: ['AS1'], legacyEvidenceObserved: true,
  legacyGreVendorSeriesBasisConfirmed: true,
});
assert.equal(confirmed.ready, true);

const contradictions = [
  { sourceKinds: ['CONFIRMED_LEGACY_GRE_PLACEHOLDER'], legacyAnalysisSectionIds: [],
    legacyEvidenceObserved: false, legacyGreVendorSeriesBasisConfirmed: false },
  { sourceKinds: [], legacyAnalysisSectionIds: [], legacyEvidenceObserved: true,
    legacyGreVendorSeriesBasisConfirmed: true },
  { sourceKinds: ['CONFIRMED_LEGACY_GRE_PLACEHOLDER'], legacyAnalysisSectionIds: ['AS1', 'AS1'],
    legacyEvidenceObserved: true, legacyGreVendorSeriesBasisConfirmed: true },
  { sourceKinds: ['EXPLICIT_GLOBAL_GRE_VENDOR_SERIES'], legacyAnalysisSectionIds: ['AS1'],
    legacyEvidenceObserved: true, legacyGreVendorSeriesBasisConfirmed: true },
  { sourceKinds: [], legacyAnalysisSectionIds: [], legacyEvidenceObserved: false,
    legacyGreVendorSeriesBasisConfirmed: true },
];
for (const input of contradictions) assert.equal(createPipelineGreVendorSeriesMigration(input).ready, false);
assert.ok(createPipelineGreVendorSeriesMigration(contradictions[0]).blockerCodes
  .includes('PIPELINE_GRE_VENDOR_LEGACY_AUTHORITY_UNCONFIRMED'));
assert.ok(createPipelineGreVendorSeriesMigration(contradictions[2]).blockerCodes
  .includes('PIPELINE_GRE_VENDOR_INPUT_INVALID'));

for (const ids of [[true], [123], [[]], [{}]]) {
  const result = createPipelineGreVendorSeriesMigration({
    sourceKinds: ['CONFIRMED_LEGACY_GRE_PLACEHOLDER'], legacyAnalysisSectionIds: ids,
    legacyEvidenceObserved: true, legacyGreVendorSeriesBasisConfirmed: true,
  });
  assert.equal(result.ready, false);
}

console.log('pipeline-3d-model GRE vendor-series migration: PASS');
