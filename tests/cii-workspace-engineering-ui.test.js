import assert from 'assert';
import { readFile } from 'node:fs/promises';
import { baseAnchorEvidenceMarkup, _test } from '../tabs/cii-workspace/cii-workspace-engineering-ui.js';
import { ciiSuggestionSelectionKey } from '../tabs/cii-workspace/cii-workspace-base-loop-selection.js';

function run(runId, axisLabel, length, count, terminator) {
  return { runId, axisLabel, totalLengthMm: length, elementCount: count, terminatorClasses: [`${terminator}:`] };
}
function methodA(confidence = 'HIGH', cap = null) {
  const anchorPairs = (cap ? [['10','110'],['20','120'],['30','130']] : [['10','110'],['20','120'],['30','130'],['40','140']])
    .map(([sourceNodeId, targetNodeId]) => ({ sourceNodeId, targetNodeId }));
  return {
    status: 'READY', confidence, baseCount: 1,
    bestBase: {
      baseId: `METHOD_A_AUTO_${anchorPairs.map((item) => `${item.sourceNodeId}=>${item.targetNodeId}`).join('__')}`,
      selectedBasisId: 'B0-1-2', anchorPairs,
      anchorCount: cap ? 3 : 4, establishmentAnchorCount: 3, validationAnchorCount: cap ? 0 : 1,
      automaticConfidenceMinimumAnchorCount: 4, automaticConfidenceCap: cap,
      minimumAnchorSinAngle: 0.707107, rmsResidualMm: 0.72, maxResidualMm: 1.41,
      maxNormalizedResidual: 0.705, rotation: [[1,0,0],[0,1,0],[0,0,1]], translation: [2500,-700,50],
      tolerancePolicy: { factor: 2, anchorTolerances: anchorPairs.map(() => ({ toleranceMm: 2 })) },
      weight: { total: 91.4 }, expansionDiagnostics: { ambiguousSourceNodeIds: [], ambiguousTargetNodeIds: [] },
    },
  };
}
function methodB() {
  return {
    status: 'READY', reason: 'TWO_AXIS_RUN_BASIS_COMPATIBLE', compatibleBasisCount: 2,
    tolerancePolicy: { factor: 2, odRefMm: 114.3, toleranceMm: 228.6 },
    source: { independentAxisRunCount: 2, runs: [run('R1','X',3000,3,'BRANCH'), run('R2','Z',2000,2,'DIRECTION_CHANGE')] },
    target: { independentAxisRunCount: 2, runs: [run('R1','Y',3000,3,'BRANCH'), run('R2','Z',2000,2,'DIRECTION_CHANGE')] },
    weight: { compatibleDimension: 'TWO_AXIS', compatibleIndependentRunCount: 2 },
    selectedBasis: {
      maxNormalizedGeometricError: 0.21,
      mapping: { rows: [
        { sourceRunId: 'R1', targetRunId: 'R1', lengthDeltaMm: 8, terminatorsCompatible: true },
        { sourceRunId: 'R2', targetRunId: 'R2', lengthDeltaMm: 12, terminatorsCompatible: true },
      ] },
    },
  };
}
function row(overrides = {}) {
  return {
    sourceNodeId: '10', targetNodeId: '110', basisMethod: 'METHOD_A_AND_B', confidence: 'HIGH',
    score: 94, winnerGap: 18, requiredWinnerGap: 12,
    candidateGeneration: { mutualBest: true, sourceRank: 1, targetRank: 1 },
    methodA: methodA(), methodAWeight: { total: 91.4 }, methodB: methodB(), methodBWeight: { total: 88.2 },
    identityExclusions: ['NODE_NUMBER_OFFSET_NOT_USED','OD_NOT_IDENTITY_USED_AS_TOLERANCE_SCALE','WALL_NOT_USED'],
    ...overrides,
  };
}

const abRow = row();
const corroborated = baseAnchorEvidenceMarkup({ baseAnchorSuggestions: [abRow] });
assert(corroborated.includes('METHOD A + METHOD B'), 'canonical A+B basis label must be primary UI');
assert(corroborated.includes('A + B corroborated'), 'A+B must be presented as corroboration');
assert(corroborated.includes('A+B acceptance creates two independent OR loops'), 'A+B UI must state that acceptance does not fuse the methods');
assert(corroborated.includes('Add 2 OR bases'), 'A+B action must project two independent loops');
assert(corroborated.includes('data-ciiw-selection-key="10=&gt;110"'), 'base selection key must use the data-ciiw-* lifecycle namespace');
assert(corroborated.includes('RMS residual'), 'Method A RMS residual must be visible without raw JSON');
assert(corroborated.includes('1.41 mm'), 'Method A max residual must be visible');
assert(corroborated.includes('2 mm'), 'Method A OD-scaled tolerance must be visible');
assert(corroborated.includes('SOURCE runs') && corroborated.includes('TARGET runs'), 'Method B physical run evidence must be visible');
assert(corroborated.includes('X · 3000 mm · 3 elements · BRANCH'), 'run axis, length, element count and terminator must be human-readable');
assert(corroborated.includes('18 / 12'), 'winner gap authority gate must be visible');
assert(corroborated.includes('Inspect transform evidence') && corroborated.includes('Inspect network evidence'), 'rawer evidence belongs under inspectors');
assert(!corroborated.includes('{"'), 'primary/expanded evidence markup must not dump JSON objects');
assert(!corroborated.includes('91.4 + 88.2'), 'A and B weights must never be presented as a summed authority score');

const selected = baseAnchorEvidenceMarkup({ baseAnchorSuggestions: [abRow] }, new Set([ciiSuggestionSelectionKey(abRow)]));
assert(selected.includes('Accepted independent base set'));
assert(selected.includes('2 loops · A 1 · B 1'), 'selected A+B card must show two independent loops');
assert(selected.includes('OR + conflict veto'));
assert(selected.includes('Remove from base set'));
assert(selected.includes('data-selected="true"'));

const capped = _test.methodAMarkup(row({ basisMethod: 'METHOD_A_SPATIAL', methodA: methodA('REVIEW', 'REVIEW') }));
assert(capped.includes('Automatic confidence capped at REVIEW'), 'three-anchor automatic Method A must visibly retain REVIEW cap');
assert(capped.includes('until 4 anchors validate the transform'));

const nonMutual = _test.methodBMarkup(row({
  basisMethod: 'METHOD_A_SPATIAL', winnerGap: 0,
  candidateGeneration: { mutualBest: false, sourceRank: 2, targetRank: 2 },
}));
assert(nonMutual.includes('authority:</b> REVIEW'), 'local Method B run compatibility is not network authority for a non-mutual candidate');
assert(nonMutual.includes('STRUCTURAL_CANDIDATE_NOT_MUTUAL_BEST'));
assert(!nonMutual.includes('authority:</b> QUALIFIED'));

const weakGap = _test.methodBMarkup(row({ basisMethod: 'METHOD_A_SPATIAL', winnerGap: 5, requiredWinnerGap: 12 }));
assert(weakGap.includes('WINNER_GAP_GATE_NOT_MET'), 'winner-gap failure must be visible rather than silently promoted');

const aOnly = baseAnchorEvidenceMarkup({ baseAnchorSuggestions: [row({ basisMethod: 'METHOD_A_SPATIAL', methodB: null, methodBWeight: null })] });
assert(aOnly.includes('METHOD A — Spatial'));
assert(aOnly.includes('Method B — Network') && aOnly.includes('UNAVAILABLE'));

const bOnly = baseAnchorEvidenceMarkup({ baseAnchorSuggestions: [row({ basisMethod: 'METHOD_B_NETWORK', methodA: { status: 'UNAVAILABLE' }, methodAWeight: null })] });
assert(bOnly.includes('METHOD B — Network'));
assert(bOnly.includes('No qualified non-collinear local rigid-registration base'));

const landmark = baseAnchorEvidenceMarkup({ baseAnchorSuggestions: [row({
  basisMethod: 'LANDMARK_ONLY', confidence: 'REVIEW', methodA: { status: 'UNAVAILABLE' }, methodAWeight: null,
  methodB: { ...methodB(), status: 'REVIEW', reason: 'METHOD_B_TWO_AXIS_GATE_NOT_MET' }, winnerGap: 0,
})] });
assert(landmark.includes('LANDMARK ONLY'));
assert(landmark.includes('METHOD_B_TWO_AXIS_GATE_NOT_MET'));
assert(landmark.includes('Use manual anchor'), 'unqualified landmark evidence must stay in separate manual fallback mode');

const css = await readFile(new URL('../tabs/cii-workspace/cii-workspace.css', import.meta.url), 'utf8');
const engineeringCss = await readFile(new URL('../tabs/cii-workspace/cii-workspace-engineering-ui.css', import.meta.url), 'utf8');
assert(css.includes('height: 100%'), 'application-level full viewport must not depend on browser fullscreen API');
assert(css.includes('[data-ciiw-layout="compact"]'), 'engineer must be able to return to compact application layout');
assert(css.includes('position: sticky'), 'review tables must retain sticky headers in full viewport');
assert(css.includes('.ciiw-method-grid'), 'method evidence card layout must be present');
assert(engineeringCss.includes('.ciiw-base-set'), 'accepted independent base set must have dedicated engineering presentation');
assert(engineeringCss.includes('[data-selected="true"]'), 'multiple selected base cards must remain visibly selected');

console.log('CII engineering full-screen / multi-base Method A+B evidence UI checks passed.');
