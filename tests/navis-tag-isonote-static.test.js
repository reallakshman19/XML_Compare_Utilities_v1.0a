import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { _test as tabTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-tab.js';
import { _test as uiTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-evidence.js';
import { _test as uiViewTest } from '../tabs/navis-tag-isonote/navis-tag-isonote-ui-view.js';

const utilityTab = readFileSync('tabs/navis-tag-isonote/navis-tag-isonote-tab.js', 'utf8');
const utilityView = readFileSync('tabs/navis-tag-isonote/navis-tag-isonote-ui-view.js', 'utf8');
const utilityEvidence = readFileSync('tabs/navis-tag-isonote/navis-tag-isonote-ui-evidence.js', 'utf8');
const readiness = readFileSync('tabs/navis-tag-isonote/navis-tag-readiness.js', 'utf8');
const identityTrace = readFileSync('tabs/navis-tag-isonote/navis-tag-identity-trace.js', 'utf8');
const stagedTree = readFileSync('tabs/navis-tag-isonote/navis-tag-staged-tree.js', 'utf8');
const boreOdMaster = readFileSync('tabs/navis-tag-isonote/navis-tag-bore-od-master.js', 'utf8');
const refinement = readFileSync('tabs/navis-tag-isonote/navis-tag-index-refinement.js', 'utf8');
const benchmarkRunner = readFileSync('scripts/navis-tag-isonote-full-benchmark.mjs', 'utf8');
const utilitiesRegistry = readFileSync('tabs/psnm-utility-tab.js', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(utilityTab, /Navis Tag to ISONOTE/);
assert.match(utilityTab, /1\. JSON Trace/);
assert.match(utilityTab, /2\. Navis Tag Coordinates/);
assert.match(utilityTab, /3\. Tag ↔ JSON Match/);
assert.match(utilityTab, /Export Results/);
assert.match(utilityTab, /attachNavisResolutionToIdentityTrace/);
assert.match(utilityTab, /refineStagedSupportIndex/);
assert.match(utilityTab, /download-trace/);
assert.match(utilityTab, /inputsDirty/);
assert.match(utilityTab, /needsRebuild/);
assert.match(utilityTab, /Derived coordinates are stale/);
assert.match(utilityView, /Support ISONOTE/);
assert.match(utilityEvidence, /JSON Trace — selected support nodes/);
assert.match(utilityEvidence, /Navis Tag Coordinate Resolution — one row per Tag ID/);
assert.match(utilityEvidence, /Navis Tag ↔ JSON Node Match — final decisions/);
assert.match(utilityEvidence, /Transformed E \(JSON comparison mm\)/);
assert.match(utilityEvidence, /configured Navis datum offsets/);
assert.match(utilityEvidence, /Configured EL offset mm/);
assert.match(utilityEvidence, /Applied EL offset mm/);
assert.match(utilityEvidence, /EL transformation formula/);
assert.match(utilityEvidence, /NEAREST_REJECTED/);
assert.match(utilityEvidence, /Failed tolerance axes/);
assert.match(utilityEvidence, /Candidate and nearest-rejected coordinate comparisons/);
assert.match(utilityView, /data-nti-config="tableIdentityColumns"/);
assert.match(utilityView, /data-nti-config="tableReferenceColumns"/);
assert.match(utilityView, /data-nti-config="tablePositionMode"/);
assert.match(utilityView, /data-nti-config="tableEastingColumn"/);
assert.match(utilityView, /data-nti-config="tableNorthingColumn"/);
assert.match(utilityView, /data-nti-config="tableElevationColumn"/);
assert.match(utilityView, /data-nti-config="tableElevationDatumMm"/);
assert.match(utilityView, /data-nti-config="jsonElevationDatumMm"/);
assert.match(utilityView, /Navis Elevation datum offset \(mm, added after unit conversion\)/);
assert.match(utilityView, /data-nti-config="navisElevationDatumMm"/);
assert.match(utilityView, /data-nti-navis-datum-preview/);
assert.match(utilityView, /Run rebuilds automatically/);
assert.match(utilityEvidence, /jsonTraceRows/);
assert.match(utilityEvidence, /navisCoordinateRows/);
assert.match(utilityEvidence, /matchRows/);
assert.match(utilityView, /data-nti-config="jsonIdentityPaths"/);
assert.match(utilityView, /data-nti-config="jsonReferencePaths"/);
assert.match(utilityView, /data-nti-config="jsonPositionPaths"/);
assert.match(utilityView, /data-nti-config="jsonPipePaths"/);
assert.match(utilityView, /data-nti-config="jsonZonePaths"/);
assert.match(utilityView, /data-nti-config="boreToOdLookupEnabled"/);
assert.match(utilityView, /selectedNavisCommentId/);
assert.match(utilityView, /selectedReferencePath/);
assert.match(utilityView, /data-nti-path-select/);
assert.match(utilityView, /Discovered staged JSON paths/);
assert.match(utilityView, /Source Readiness/);
assert.match(utilityView, /data-nti-table-filter/);
assert.match(readiness, /TABLE_SEPARATE_POSITION_COLUMNS_INCOMPLETE/);
assert.match(readiness, /BORE_TO_OD_LOOKUP_PROFILE_INVALID/);
assert.match(identityTrace, /attachNavisResolutionToIdentityTrace/);
assert.match(identityTrace, /selectedNavisCommentId/);
assert.match(identityTrace, /RESOLVED_EXACT_REFERENCE/);
assert.match(stagedTree, /resolvedPipe/);
assert.match(stagedTree, /resolvedZone/);
assert.match(stagedTree, /derivedFacts/);
assert.match(stagedTree, /CUSTOM_EXPLICIT_BORE_TO_OD_LOOKUP/);
assert.match(stagedTree, /BUILT_IN_ASME_BORE_TO_OD_PROFILE/);
assert.match(boreOdMaster, /ASME_B36_10M_B36_19M_2018/);
assert.match(boreOdMaster, /ASME B36\.10M-2018/);
assert.match(boreOdMaster, /resolveBuiltInBoreToOd/);
assert.match(refinement, /suppressedMirrorEntryCount/);
assert.match(refinement, /DERIVED_FROM_BRANCH/);
assert.match(benchmarkRunner, /asim1836-managed-stage-2\/v1/);
assert.match(benchmarkRunner, /DISJOINT_COORDINATE_EXTENTS/);
assert.match(benchmarkRunner, /verifyExpectations/);
assert.match(utilitiesRegistry, /installNavisTagIsonoteUtilityTile/);
assert.match(utilitiesRegistry, /mountNavisTagIsonote/);
assert.equal(typeof packageJson.scripts['test:navis-tag-isonote'], 'string');
assert.ok(packageJson.scripts['test:navis-tag-isonote'].includes('navis-tag-isonote-contracts-v3.test.js'));
assert.ok(packageJson.scripts['test:navis-tag-isonote'].includes('navis-tag-isonote-index-refinement.test.js'));
assert.ok(packageJson.scripts['test:navis-tag-isonote'].includes('navis-tag-isonote-bore-od-master.test.js'));
assert.ok(packageJson.scripts.test.includes('test:navis-tag-isonote'));

const builtState = { inputsDirty: false, identityTrace: {}, navisParse: {}, readiness: {}, resolutionBuild: {} };
assert.equal(tabTest.needsRebuild(builtState), false);
assert.equal(tabTest.needsRebuild({ ...builtState, inputsDirty: true }), true);
assert.equal(tabTest.needsRebuild({ ...builtState, navisParse: null }), true);

const datumPreview = uiViewTest.renderNavisDatumPreview({
  config: { navisElevationDatumMm: -100000 },
  inputsDirty: true,
  navisParse: {
    tags: [{ tagId: '8', rawPosition: { z: 101.210338 }, position: { unitScale: 1000 } }],
  },
});
assert.match(datumPreview, /Current configured elevation offset: <b>-100000 mm<\/b>/);
assert.match(datumPreview, /Tag 8: 101\.210338 × 1000 − 100000 = 1210\.338 mm/);
assert.match(datumPreview, /automatically rebuild/);

const tag8Evidence = {
  viewIndex: 1,
  viewName: 'Tag View 8',
  viewGuid: 'view-8',
  tagId: '8',
  commentId: '8',
  commentBody: 'Tag 8 coordinate match',
  commentUser: 'reviewer',
  positionSource: 'RLTAG_POS3D',
  rawPosition: { x: 423.170971, y: -1141.125, z: 101.18415 },
  units: 'm',
  position: {
    x: 423170.971,
    y: -1141125,
    z: 1184.15,
    unitScale: 1000,
    sourceUnit: 'm',
    datumOffsetMm: { x: 0, y: 0, z: -100000 },
    profileName: 'NAVIS_DEFAULT',
    axisBasis: 'OBJECT_XYZ',
  },
  diagnostics: [],
};
const navisCoordinateRows = uiTest.navisCoordinateRows({
  config: { navisEastingDatumMm: 0, navisNorthingDatumMm: 0, navisElevationDatumMm: -100000 },
  inputsDirty: false,
  navisParse: { tags: [tag8Evidence] },
});
assert.equal(navisCoordinateRows[0].tagId, '8');
assert.equal(navisCoordinateRows[0].xmlZ, 101.18415);
assert.equal(navisCoordinateRows[0].unitScaleToMm, 1000);
assert.equal(navisCoordinateRows[0].configuredDatumEL, -100000);
assert.equal(navisCoordinateRows[0].appliedDatumEL, -100000);
assert.equal(navisCoordinateRows[0].datumStatus, 'CURRENT');
assert.equal(navisCoordinateRows[0].navisToJsonEL, 1184.15);
assert.equal(navisCoordinateRows[0].elFormula, '101.18415 × 1000 − 100000 = 1184.15 mm');
assert.equal(navisCoordinateRows[0].coordinateStatus, 'VALID_FOR_MATCHING');

const staleDatumRows = uiTest.navisCoordinateRows({
  config: { navisEastingDatumMm: 0, navisNorthingDatumMm: 0, navisElevationDatumMm: 0 },
  inputsDirty: true,
  navisParse: { tags: [tag8Evidence] },
});
assert.equal(staleDatumRows[0].configuredDatumEL, 0);
assert.equal(staleDatumRows[0].appliedDatumEL, -100000);
assert.equal(staleDatumRows[0].datumStatus, 'REBUILD_REQUIRED');

const baseTraceRow = {
  tableRowId: 'STAGED-1',
  tableRowIndex: 1,
  tableIdentityRaw: '/PS-12244/DATUM|/PS-12244/SREF',
  canonicalIdentity: 'PS-12244/DATUM',
  supportRoot: 'PS-12244',
  status: 'RESOLVED_EXACT_REFERENCE',
  selectionReason: 'EXACT_FULL_IDENTITY',
  candidateCount: 1,
  selectedNodeId: 'SJ-25',
  selectedSourceFile: 'managed.json',
  selectedJsonPath: '$[0].children[4]',
  selectedRawType: 'SUPPORT',
  selectedRawName: 'SUPPORT PS-12244',
  selectedIdentityPath: 'attributes.NAME',
  selectedReferenceRaw: '=1006649732/51230',
  selectedReferencePath: 'attributes.REF',
  positionSourcePath: 'attributes.POSI',
  position: { x: 423170.971, y: -1141125, z: 1184.15, sourceUnit: 'mm', unitScale: 1, datumOffsetMm: { x: 0, y: 0, z: 0 }, profileName: 'JSON_DEFAULT' },
  resolvedBranch: '/PIPE/B2',
  resolvedPipe: '/PIPE',
  resolvedZone: '',
  identityConfidence: 'HIGH',
};

const stagedUiRows = uiTest.jsonTraceRows({ identityTrace: { rows: [baseTraceRow] } });
assert.equal(stagedUiRows[0].groupedIdentityRaw, '/PS-12244/DATUM|/PS-12244/SREF');
assert.equal(stagedUiRows[0].jsonE, 423170.971);

const selectedTraceRow = {
  ...baseTraceRow,
  navisResolutionStatus: 'RESOLVED',
  selectedNavisTagId: '8',
  selectedNavisViewName: 'Tag View 8',
  selectedNavisCommentId: '8',
  selectedNavisCommentBody: 'Tag 8 coordinate match',
  selectedNavisPosition: { x: 423170.971, y: -1141125, z: 1184.15 },
  deltaEMm: 0,
  deltaNMm: 0,
  deltaElMm: 0,
  verticalBasis: 'CENTERLINE',
  verticalResidualMm: 0,
  navisProximityEvidence: { candidateCount: 1 },
  navisAmbiguity: 'UNAMBIGUOUS',
  navisConfidence: 'HIGH',
  supportIsonote: 'Tag 8 coordinate match',
};
const matchUiRows = uiTest.matchRows({ identityTrace: { rows: [selectedTraceRow] } });
assert.equal(matchUiRows[0].navisTagId, '8');
assert.equal(matchUiRows[0].deltaE, 0);
assert.equal(matchUiRows[0].selectedIsonote, 'Tag 8 coordinate match');

const rejectedUiRows = uiTest.matchRows({
  identityTrace: { rows: [{ ...baseTraceRow, navisResolutionStatus: 'UNRESOLVED' }] },
  audit: {
    decisions: [{
      tableRowId: 'STAGED-1',
      status: 'UNRESOLVED',
      candidateCount: 0,
      ambiguity: 'NEAREST_TAG_8_OUTSIDE_EL_TOLERANCE',
      confidence: 'UNRESOLVED',
      supportIsonote: '',
      nearestRejectedTagId: '8',
      nearestRejectedViewName: 'Tag View 8',
      nearestRejectedCommentId: '8',
      nearestRejectedCommentBody: 'Tag 8 coordinate match',
      nearestRejectedNavisPosition: { x: 423170.971, y: -1141125, z: 101184.15 },
      nearestRejectedAxes: ['EL'],
      nearestRejectedDeltaEMm: 0,
      nearestRejectedDeltaNMm: 0,
      nearestRejectedDeltaElMm: 100000,
      nearestRejectedVerticalResidualMm: 100000,
      nearestRejectedCandidate: {
        tagId: '8',
        viewName: 'Tag View 8',
        commentId: '8',
        commentBody: 'Tag 8 coordinate match',
        tagPosition: { x: 423170.971, y: -1141125, z: 101184.15 },
        deltaEMm: 0,
        deltaNMm: 0,
        deltaElMm: 100000,
        verticalBasis: 'CENTERLINE',
        verticalResidualMm: 100000,
        failedAxes: ['EL'],
      },
    }],
  },
});
assert.equal(rejectedUiRows[0].displayedNavisRole, 'NEAREST_REJECTED');
assert.equal(rejectedUiRows[0].toleranceResult, 'OUTSIDE_TOLERANCE');
assert.equal(rejectedUiRows[0].navisTagId, '8');
assert.equal(rejectedUiRows[0].failedAxes, 'EL');
assert.equal(rejectedUiRows[0].deltaEL, 100000);
assert.equal(rejectedUiRows[0].selectedIsonote, '');

const rejectedCandidateRows = uiTest.candidateRows({
  audit: {
    candidateLedger: [{
      ledgerKind: 'NEAREST_REJECTED',
      tagId: '8',
      accepted: false,
      withinTolerance: false,
      failedAxes: ['EL'],
      rejectionReasons: ['EL_OUTSIDE_TOLERANCE'],
    }],
  },
});
assert.equal(rejectedCandidateRows[0].comparisonOutcome, 'NEAREST_REJECTED');
assert.equal(rejectedCandidateRows[0].failedAxesDisplay, 'EL');
assert.equal(rejectedCandidateRows[0].rejectionReasonsDisplay, 'EL_OUTSIDE_TOLERANCE');

console.log('navis-tag-isonote static tests passed');
