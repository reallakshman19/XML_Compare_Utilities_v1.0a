import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStructuredSequenceContext,
  compareMemberOrdinalPatterns,
  comparePreviousNamePatterns,
  compareStructuredSequenceCandidate,
  memberOrdinalPattern,
  orderedLocationIds,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-sequence.js';

const sequenceProfile = Object.freeze({
  linearityToleranceMm: 10,
  planarityToleranceMm: 10,
  geometry3dToleranceMm: 20,
  geometry2dToleranceMm: 20,
  stationFingerprintToleranceMm: 20,
  memberPatternScores: {
    exact: 1,
    partial: 0.4,
    none: 0,
  },
  prevNamePatternScores: {
    exact: 1,
    onePositionDifferent: 0.9,
    sameTrailing4: 0.8,
    sameTrailing3: 0.65,
    sameTrailing2: 0.45,
    sameTrailing1: 0.2,
    prefixOnly: 0.1,
    none: 0,
  },
});

function location(id, x, y, z) {
  return Object.freeze({ locationId: id, representativePointGlobalMm: Object.freeze({ x, y, z }) });
}

test('structured sequence identifies a collinear goalpost row and stable forward/reverse station orders', () => {
  const context = buildStructuredSequenceContext([
    location('A3', 2400, 0, 0),
    location('A1', 0, 0, 0),
    location('A2', 1200, 0, 0),
    location('A4', 4200, 0, 0),
  ], sequenceProfile);
  assert.equal(context.supports1d, true);
  assert.deepEqual(context.availableDimensions, ['3D', '1D']);
  const forward = orderedLocationIds(context, 'FORWARD');
  const reverse = orderedLocationIds(context, 'REVERSE');
  assert.deepEqual([...reverse], [...forward].reverse());
  assert.equal(new Set(forward).size, 4);
});

test('structured sequence identifies planar 2D lattice without falsely calling it linear', () => {
  const context = buildStructuredSequenceContext([
    location('A', 0, 0, 0),
    location('B', 1000, 0, 0),
    location('C', 0, 500, 0),
    location('D', 1000, 500, 0),
  ], sequenceProfile);
  assert.equal(context.supports2d, true);
  assert.equal(context.supports1d, false);
  assert.deepEqual(context.availableDimensions, ['3D', '2D']);
  assert.ok(context.lineMaxResidualMm > sequenceProfile.linearityToleranceMm);
  assert.ok(context.planeMaxResidualMm <= sequenceProfile.planarityToleranceMm);
});

test('3D then lower-dimensional fingerprints compare translated goalpost rows without absolute-coordinate dependence', () => {
  const leftLocations = [
    location('L1', 0, 0, 0),
    location('L2', 1200, 0, 0),
    location('L3', 2400, 0, 0),
    location('L4', 4200, 0, 0),
  ];
  const rightLocations = [
    location('R1', 10000, 5000, 700),
    location('R2', 10000, 6200, 700),
    location('R3', 10000, 7400, 700),
    location('R4', 10000, 9200, 700),
  ];
  const left = buildStructuredSequenceContext(leftLocations, sequenceProfile);
  const right = buildStructuredSequenceContext(rightLocations, sequenceProfile);
  const comparison = compareStructuredSequenceCandidate(leftLocations[1], rightLocations[1], left, right, sequenceProfile);
  assert.equal(comparison.stages[0].dimension, '3D');
  assert.equal(comparison.stages[0].result, 'PASS');
  assert.equal(comparison.stages.at(-1).dimension, '1D');
  assert.equal(comparison.stages.at(-1).result, 'PASS');
  assert.equal(comparison.firstPassingDimension, '3D');
});

test('structured sequence reports no passing dimension when every evaluated stage fails', () => {
  const leftLocations = [
    location('L1', 0, 0, 0),
    location('L2', 100, 0, 0),
    location('L3', 300, 0, 0),
  ];
  const rightLocations = [
    location('R1', 10000, 0, 0),
    location('R2', 11000, 0, 0),
  ];
  const left = buildStructuredSequenceContext(leftLocations, sequenceProfile);
  const right = buildStructuredSequenceContext(rightLocations, sequenceProfile);
  const comparison = compareStructuredSequenceCandidate(leftLocations[0], rightLocations[0], left, right, sequenceProfile);
  assert.equal(comparison.stages.every((stage) => stage.result !== 'PASS'), true);
  assert.equal(comparison.firstPassingDimension, null);
});

test('member ordinal repetition such as .2/.4 is exact supporting evidence, not raw member-name identity', () => {
  assert.deepEqual(memberOrdinalPattern(['/PS-100.4', '/PS-100.2']), [2, 4]);
  const exact = compareMemberOrdinalPatterns(['/PS-100.2', '/PS-100.4'], ['/SL-900.4', '/SL-900.2'], sequenceProfile);
  assert.equal(exact.result, 'EXACT');
  assert.equal(exact.similarity, 1);
  assert.equal(exact.reasonCode, 'MEMBER_ORDINAL_PATTERN_EXACT');

  const partial = compareMemberOrdinalPatterns(['/PS-100.2', '/PS-100.4'], ['/SL-900.2', '/SL-900.5'], sequenceProfile);
  assert.equal(partial.result, 'PARTIAL');
  assert.equal(partial.overlapRatio, 0.5);
  assert.equal(partial.similarity, 0.2);
});

test('PREV NAME fuzzy evidence is classified by governed pattern classes with an auditable wildcard mask', () => {
  const onePosition = comparePreviousNamePatterns('PS02005', 'PS02015', sequenceProfile);
  assert.equal(onePosition.class, 'ONE_POSITION_DIFFERENT');
  assert.equal(onePosition.similarity, 0.9);
  assert.equal(onePosition.wildcardMask, 'PS020?5');

  const trailing = comparePreviousNamePatterns('AA1234', 'ZZ1234', sequenceProfile);
  assert.equal(trailing.class, 'SAME_TRAILING_4');
  assert.equal(trailing.similarity, 0.8);

  const missing = comparePreviousNamePatterns('', 'PS02015', sequenceProfile);
  assert.equal(missing.result, 'UNAVAILABLE');
  assert.equal(missing.similarity, null);
});
