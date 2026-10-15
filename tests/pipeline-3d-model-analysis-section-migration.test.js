import assert from 'node:assert/strict';
import { resolvePipelineAnalysisSectionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-section-planner.js';

const coordinateRows = Object.freeze([
  Object.freeze({ nodeNumber: 100 }),
  Object.freeze({ nodeNumber: 110 }),
  Object.freeze({ nodeNumber: 120 }),
]);

for (const [profileId, mode] of [
  ['normal-metallic', 'NORMAL'],
  ['asme-b31.4', 'ASME_B31_4'],
  ['gre', 'GRE'],
]) {
  const result = resolvePipelineAnalysisSectionPlan({ coordinateRows, profileId, sourceAuthority: 'EXPLICIT' });
  assert.equal(result.ready, true);
  assert.equal(result.migration.sourceKind, 'EXPLICIT_PROFILE');
  assert.equal(result.migration.requestedProfileId, profileId);
  assert.equal(result.migration.resolvedProfileId, profileId);
  assert.equal(result.migration.resolvedMode, mode);
  assert.equal(result.migration.fallbackApplied, false);
  assert.equal(result.analysisSectionPlan.sections[0].profileId, profileId);
}

for (const [legacyDesignBasis, profileId, mode] of [
  ['default-metallic', 'normal-metallic', 'NORMAL'],
  ['asme-b31.4', 'asme-b31.4', 'ASME_B31_4'],
  ['gre', 'gre', 'GRE'],
]) {
  const result = resolvePipelineAnalysisSectionPlan({
    coordinateRows, legacyDesignBasis, legacyResolvedMode: mode, sourceAuthority: 'LEGACY', sourceReference: 'settings-v3',
  });
  assert.equal(result.ready, true);
  assert.equal(result.migration.sourceKind, 'LEGACY_DESIGN_BASIS');
  assert.equal(result.migration.legacyDesignBasis, legacyDesignBasis);
  assert.equal(result.migration.resolvedProfileId, profileId);
  assert.equal(result.migration.resolvedMode, mode);
  assert.equal(result.migration.resolutionReason, 'LEGACY_DESIGN_BASIS_MIGRATED');
  assert.equal(result.migration.sourceAuthority, 'LEGACY');
  assert.equal(result.migration.sourceReference, 'settings-v3');
}

const safe = resolvePipelineAnalysisSectionPlan({ coordinateRows });
assert.equal(safe.ready, true);
assert.equal(safe.migration.sourceKind, 'SAFE_NORMAL_FALLBACK');
assert.equal(safe.migration.resolvedProfileId, 'normal-metallic');
assert.equal(safe.migration.resolvedMode, 'NORMAL');
assert.equal(safe.migration.fallbackEligible, true);
assert.equal(safe.migration.fallbackApplied, true);
assert.equal(safe.migration.resolutionReason, 'LEGACY_PROFILE_NOT_SPECIFIED_SAFE_NORMAL');

const unsafe = resolvePipelineAnalysisSectionPlan({ coordinateRows, greEvidencePresent: true });
assert.equal(unsafe.ready, false);
assert.equal(unsafe.migration.sourceKind, 'UNRESOLVED');
assert.equal(unsafe.migration.fallbackApplied, false);
assert.equal(unsafe.analysisSectionPlan.sections.length, 0);
assert.ok(unsafe.blockerCodes.includes('PIPELINE_LEGACY_PROFILE_FALLBACK_BLOCKED'));

for (const profileId of ['invalid', 'Normal-Metallic']) {
  const invalid = resolvePipelineAnalysisSectionPlan({
    coordinateRows, profileId, legacyDesignBasis: 'gre', greEvidencePresent: false,
  });
  assert.equal(invalid.ready, false);
  assert.equal(invalid.migration.sourceKind, 'UNRESOLVED');
  assert.equal(invalid.migration.resolvedProfileId, '');
  assert.equal(invalid.migration.fallbackApplied, false);
  assert.equal(invalid.analysisSectionPlan.sections.length, 0);
  assert.ok(invalid.blockerCodes.includes('PIPELINE_PROFILE_ID_INVALID'));
}

const unknownLegacy = resolvePipelineAnalysisSectionPlan({ coordinateRows, legacyDesignBasis: 'vendor-special' });
assert.equal(unknownLegacy.ready, false);
assert.equal(unknownLegacy.migration.sourceKind, 'UNRESOLVED');
assert.ok(unknownLegacy.blockerCodes.includes('PIPELINE_LEGACY_PROFILE_INVALID'));

const badMode = resolvePipelineAnalysisSectionPlan({
  coordinateRows, legacyDesignBasis: 'gre', legacyResolvedMode: 'NORMAL',
});
assert.equal(badMode.ready, false);
assert.ok(badMode.blockerCodes.includes('PIPELINE_LEGACY_PROFILE_INVALID'));

const sectionConflict = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  legacyDesignBasis: 'gre',
  analysisSections: [{ startElementIndex: 0, profileId: 'normal-metallic' }],
});
assert.equal(sectionConflict.ready, false);
assert.equal(sectionConflict.migration.sourceKind, 'EXPLICIT_SECTIONS');
assert.equal(sectionConflict.migration.resolutionReason, 'EXPLICIT_ANALYSIS_SECTIONS_BLOCKED');
assert.equal(sectionConflict.migration.resolvedProfileId, '');
assert.ok(sectionConflict.blockerCodes.includes('PIPELINE_SECTION_PROFILE_CONFLICT'));

const matchingGlobal = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  profileId: 'normal-metallic',
  legacyDesignBasis: 'default-metallic',
  analysisSections: [{ startElementIndex: 0, profileId: 'normal-metallic' }],
});
assert.equal(matchingGlobal.ready, true);

const explicitSectionWinsStaleLegacy = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  profileId: 'normal-metallic',
  legacyDesignBasis: 'gre',
  analysisSections: [{ startElementIndex: 0, profileId: 'normal-metallic' }],
});
assert.equal(explicitSectionWinsStaleLegacy.ready, true);
assert.equal(explicitSectionWinsStaleLegacy.blockerCodes.includes('PIPELINE_SECTION_PROFILE_CONFLICT'), false);

const explicitSectionWinsInvalidLegacy = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  profileId: 'normal-metallic',
  legacyDesignBasis: 'vendor-special',
  analysisSections: [{ startElementIndex: 0, profileId: 'normal-metallic' }],
});
assert.equal(explicitSectionWinsInvalidLegacy.ready, true);
assert.equal(explicitSectionWinsInvalidLegacy.blockerCodes.includes('PIPELINE_LEGACY_PROFILE_INVALID'), false);

const explicitWinsStaleLegacy = resolvePipelineAnalysisSectionPlan({
  coordinateRows, profileId: 'normal-metallic', legacyDesignBasis: 'gre',
});
assert.equal(explicitWinsStaleLegacy.ready, true);
assert.equal(explicitWinsStaleLegacy.migration.sourceKind, 'EXPLICIT_PROFILE');
assert.equal(explicitWinsStaleLegacy.migration.resolvedProfileId, 'normal-metallic');
assert.equal(explicitWinsStaleLegacy.migration.legacyDesignBasis, '');

const explicitWinsInvalidLegacy = resolvePipelineAnalysisSectionPlan({
  coordinateRows, profileId: 'asme-b31.4', legacyDesignBasis: 'vendor-special',
});
assert.equal(explicitWinsInvalidLegacy.ready, true);
assert.equal(explicitWinsInvalidLegacy.migration.resolvedProfileId, 'asme-b31.4');
assert.equal(explicitWinsInvalidLegacy.blockerCodes.includes('PIPELINE_LEGACY_PROFILE_INVALID'), false);

const contextLegacy = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  exportContext: { profile: { requestedDesignBasis: 'asme-b31.4', resolvedDesignBasis: 'asme-b31.4', resolvedMode: 'ASME_B31_4', fallbackApplied: false } },
});
assert.equal(contextLegacy.ready, true);
assert.equal(contextLegacy.migration.resolvedProfileId, 'asme-b31.4');

const contextModeMismatch = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  exportContext: { profile: { requestedDesignBasis: 'asme-b31.4', resolvedDesignBasis: 'asme-b31.4', resolvedMode: 'GRE', fallbackApplied: false } },
});
assert.equal(contextModeMismatch.ready, false);
assert.equal(contextModeMismatch.analysisSectionPlan.sections.length, 0);
assert.ok(contextModeMismatch.blockerCodes.includes('PIPELINE_LEGACY_PROFILE_INVALID'));

const deterministicA = resolvePipelineAnalysisSectionPlan({
  coordinateRows,
  analysisSections: [
    { profileId: 'gre', startElementIndex: 1 },
    { profileId: 'normal-metallic', startElementIndex: 0 },
  ],
  sourceReference: 'migration-proof', sourceAuthority: 'TEST',
});
const deterministicB = resolvePipelineAnalysisSectionPlan({
  sourceAuthority: 'TEST', sourceReference: 'migration-proof',
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 1, profileId: 'gre' },
  ],
  coordinateRows,
});
assert.equal(JSON.stringify(deterministicA), JSON.stringify(deterministicB));
assert.ok(Object.isFrozen(deterministicA.migration));

console.log('Pipeline analysis-section profile migration tests passed.');
