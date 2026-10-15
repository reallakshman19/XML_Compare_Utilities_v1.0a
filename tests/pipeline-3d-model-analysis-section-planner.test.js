import assert from 'node:assert/strict';
import {
  buildPipelineAnalysisSectionLedgerText,
  buildPipelineAnalysisSectionResolutionJson,
  resolvePipelineAnalysisSectionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-section-planner.js';

const rows = Object.freeze([
  Object.freeze({ nodeNumber: 100, x: 0, y: 0, z: 0 }),
  Object.freeze({ nodeNumber: 110, x: 1000, y: 0, z: 0 }),
  Object.freeze({ nodeNumber: 120, x: 2000, y: 0, z: 0 }),
  Object.freeze({ nodeNumber: 130, x: 3000, y: 0, z: 0 }),
  Object.freeze({ nodeNumber: 140, x: 4000, y: 0, z: 0 }),
]);

function frozenTree(value) {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(frozenTree);
}

const one = resolvePipelineAnalysisSectionPlan({ coordinateRows: rows, profileId: 'normal-metallic' });
assert.equal(one.ready, true);
assert.equal(one.analysisSectionPlan.sections.length, 1);
assert.equal(one.analysisSectionPlan.sections[0].analysisSectionId, 'AS1');
assert.equal(one.analysisSectionPlan.elementResolutions.length, 4);
assert.ok(one.analysisSectionPlan.elementResolutions.every((item) => item.analysisSectionId === 'AS1'));
assert.equal(one.analysisSectionPlan.elementResolutions[0].sectionDisposition, 'SECTION_START');
assert.equal(one.analysisSectionPlan.elementResolutions[0].boundaryNode, 100);
assert.equal(one.analysisSectionPlan.elementResolutions[1].boundaryNode, null);

const unsortedInput = {
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 2, profileId: 'gre', sourceReference: 'later' },
    { startElementIndex: 0, profileId: 'normal-metallic', sourceReference: 'first' },
  ],
};
const before = JSON.stringify(unsortedInput);
const unsorted = resolvePipelineAnalysisSectionPlan(unsortedInput);
assert.equal(JSON.stringify(unsortedInput), before);
assert.equal(unsorted.ready, true);
assert.deepEqual(unsorted.analysisSectionPlan.sections.map((item) => [item.analysisSectionId, item.startElementIndex]), [
  ['AS1', 0], ['AS2', 2],
]);
assert.deepEqual(unsorted.analysisSectionPlan.elementResolutions.map((item) => item.analysisSectionId), [
  'AS1', 'AS1', 'AS2', 'AS2',
]);
assert.equal(unsorted.analysisSectionPlan.elementResolutions[1].sectionDisposition, 'INHERITED');
assert.equal(unsorted.analysisSectionPlan.elementResolutions[2].sectionDisposition, 'SECTION_START');
assert.equal(unsorted.analysisSectionPlan.elementResolutions[2].boundaryNode, 120);
assert.equal(unsorted.analysisSectionPlan.elementResolutions[1].analysisSectionId, 'AS1');
assert.equal(unsorted.analysisSectionPlan.elementResolutions[2].analysisSectionId, 'AS2');
assert.equal(JSON.stringify(unsorted), JSON.stringify(resolvePipelineAnalysisSectionPlan({
  ...unsortedInput, analysisSections: [...unsortedInput.analysisSections].reverse(),
})));
assert.equal(buildPipelineAnalysisSectionResolutionJson(unsorted), buildPipelineAnalysisSectionResolutionJson(unsorted));
assert.equal(buildPipelineAnalysisSectionLedgerText(unsorted), buildPipelineAnalysisSectionLedgerText(unsorted));
assert.ok(frozenTree(unsorted));

const duplicate = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 2, profileId: 'gre' },
    { startElementIndex: 2, profileId: 'asme-b31.4' },
  ],
});
assert.equal(duplicate.ready, false);
assert.ok(duplicate.blockerCodes.includes('PIPELINE_ANALYSIS_SECTION_DUPLICATE_BOUNDARY'));
assert.equal(duplicate.migration.resolutionReason, 'EXPLICIT_ANALYSIS_SECTIONS_BLOCKED');
assert.equal(duplicate.migration.resolvedProfileId, '');

const outOfRange = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 4, profileId: 'gre' },
  ],
});
assert.ok(outOfRange.blockerCodes.includes('PIPELINE_ANALYSIS_SECTION_START_OUT_OF_RANGE'));

const missingFirst = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [{ startElementIndex: 1, profileId: 'asme-b31.4' }],
});
assert.ok(missingFirst.blockerCodes.includes('PIPELINE_ANALYSIS_SECTION_FIRST_BOUNDARY_REQUIRED'));
assert.ok(missingFirst.blockerCodes.includes('PIPELINE_ELEMENT_SECTION_COVERAGE_INVALID'));
assert.equal(missingFirst.migration.resolutionReason, 'EXPLICIT_ANALYSIS_SECTIONS_BLOCKED');
assert.equal(missingFirst.migration.resolvedMode, '');

const noChange = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 2, profileId: 'normal-metallic' },
  ],
});
assert.ok(noChange.blockerCodes.includes('PIPELINE_ANALYSIS_SECTION_NO_CHANGE'));

for (const profileId of ['unknown', 'Normal-Metallic']) {
  const invalid = resolvePipelineAnalysisSectionPlan({ coordinateRows: rows, profileId });
  assert.equal(invalid.ready, false);
  assert.ok(invalid.blockerCodes.includes('PIPELINE_PROFILE_ID_INVALID'));
  assert.equal(invalid.analysisSectionPlan.sections.length, 0);
}

const badId = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [{ analysisSectionId: 'S1', startElementIndex: 0, profileId: 'normal-metallic' }],
});
assert.ok(badId.blockerCodes.includes('PIPELINE_ANALYSIS_SECTION_ID_INVALID'));
assert.equal(badId.analysisSectionPlan.sections[0].analysisSectionId, 'AS1');

const emittedBend = Object.freeze({
  status: 'EMITTED', incomingElementIndex: 0, cornerNode: 110, radiusMm: 1500,
});
const fittingBlocked = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 1, profileId: 'asme-b31.4' },
  ],
  bendResolution: Object.freeze({
    bendByIncomingElementIndex: Object.freeze({ 0: emittedBend }),
    candidates: Object.freeze([emittedBend]),
  }),
});
assert.ok(fittingBlocked.blockerCodes.includes('PIPELINE_PROFILE_BOUNDARY_INTERSECTS_FITTING'));
assert.equal(fittingBlocked.analysisSectionPlan.elementResolutions[0].analysisSectionId, 'AS1');
assert.equal(fittingBlocked.analysisSectionPlan.elementResolutions[1].analysisSectionId, 'AS2');
assert.equal(emittedBend.incomingElementIndex, 0);
assert.equal(fittingBlocked.analysisSectionPlan.sections[1].startElementIndex, 1);
assert.equal(fittingBlocked.migration.resolutionReason, 'EXPLICIT_ANALYSIS_SECTIONS_BLOCKED');
assert.equal(fittingBlocked.migration.resolvedProfileId, '');

const candidateBlocked = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 1, profileId: 'gre' },
  ],
  bendResolution: {
    bendByIncomingElementIndex: {},
    candidates: [{ status: 'READY_NOT_EMITTED', geometryFits: true, incomingElementIndex: 0, cornerNode: 110 }],
  },
});
assert.ok(candidateBlocked.blockerCodes.includes('PIPELINE_PROFILE_BOUNDARY_INTERSECTS_FITTING'));

const disabled = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 1, profileId: 'gre' },
  ],
  bendResolution: {
    candidates: [{ status: 'DISABLED', geometryFits: true, radiusMm: 1500, incomingElementIndex: 0, cornerNode: 110 }],
  },
});
assert.equal(disabled.ready, true);


const infeasible = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 1, profileId: 'gre' },
  ],
  bendResolution: {
    candidates: [{ status: 'INFEASIBLE', geometryFits: false, radiusMm: 1500,
      incomingElementIndex: 0, cornerNode: 110 }],
  },
});
assert.equal(infeasible.ready, true);
assert.equal(infeasible.blockerCodes.includes('PIPELINE_PROFILE_BOUNDARY_INTERSECTS_FITTING'), false);

const invalidSectionProfile = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [{ startElementIndex: 0, profileId: 'Normal-Metallic' }],
});
assert.equal(invalidSectionProfile.ready, false);
assert.equal(invalidSectionProfile.migration.resolutionReason, 'EXPLICIT_ANALYSIS_SECTIONS_BLOCKED');
assert.equal(invalidSectionProfile.migration.resolvedProfileId, '');
assert.ok(invalidSectionProfile.blockerCodes.includes('PIPELINE_PROFILE_ID_INVALID'));

const away = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 2, profileId: 'gre' },
  ],
  bendResolution: { bendByIncomingElementIndex: { 0: emittedBend }, candidates: [emittedBend] },
});
assert.equal(away.ready, true);

const mutable = {
  coordinateRows: rows.map((item) => ({ ...item })),
  analysisSections: [{ startElementIndex: 0, profileId: 'normal-metallic', sourceReference: 'A' }],
};
const isolated = resolvePipelineAnalysisSectionPlan(mutable);
mutable.coordinateRows[0].nodeNumber = 999;
mutable.analysisSections[0].profileId = 'gre';
assert.equal(isolated.analysisSectionPlan.elementResolutions[0].boundaryNode, 100);
assert.equal(isolated.analysisSectionPlan.sections[0].profileId, 'normal-metallic');

console.log('Pipeline deterministic analysis-section planning tests passed.');
