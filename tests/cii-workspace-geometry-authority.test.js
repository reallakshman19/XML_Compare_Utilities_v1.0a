import assert from 'assert';
import { qualifyCiiGeometryTransform, registeredCiiPoint } from '../tabs/cii-workspace/cii-workspace-geometry.js';

const point = (x, y, z) => ({ x, y, z });
const anchor = (source, target, sourceOdMm = 273, extra = {}) => ({ source, target, sourceOdMm, ...extra });

const one = qualifyCiiGeometryTransform([{ source: point(0, 0, 0), target: point(10, 20, 30) }]);
assert.strictEqual(one.status, 'UNDERDETERMINED');
assert.strictEqual(one.registeredWeight, 0);

const two = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(10, 20, 30), 60.3),
  anchor(point(100, 0, 0), point(10, 120, 30), 60.3),
]);
assert.strictEqual(two.status, 'UNDERDETERMINED');
assert.strictEqual(two.registeredWeight, 0);
assert.strictEqual(two.toleranceMm, 120.6);

const incompatibleSpan = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(10, 20, 30), 60.3),
  anchor(point(100, 0, 0), point(10, 420, 30), 60.3),
]);
assert.strictEqual(incompatibleSpan.status, 'INCOMPATIBLE');

const nearCollinear = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(1000, 0, 0)),
  anchor(point(1000, 0, 0), point(2000, 0, 0)),
  anchor(point(2000, 0.01, 0), point(3000, 0.01, 0)),
]);
assert.strictEqual(nearCollinear.status, 'UNDERDETERMINED');
assert.strictEqual(nearCollinear.registeredWeight, 0);

const transform = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(1000, -500, 200), 88.9),
  anchor(point(100, 0, 0), point(1000, -400, 200), 88.9),
  anchor(point(0, 100, 0), point(900, -500, 200), 88.9),
]);
assert.strictEqual(transform.status, 'READY');
assert.strictEqual(transform.registeredWeight, 8);
assert.strictEqual(transform.basisHypothesisCount, 1);
assert.strictEqual(transform.tolerancePolicy.factor, 2);
assert.strictEqual(transform.tolerancePolicy.anchorTolerances[0].toleranceMm, 177.8);
assert.strictEqual(transform.tolerancePolicy.identityRole, 'TOLERANCE_SCALE_ONLY');
assert(transform.weight.total > 0);
const mapped = registeredCiiPoint(transform, point(50, 25, 0));
assert(Math.abs(mapped.x - 975) < 1e-6);
assert(Math.abs(mapped.y + 450) < 1e-6);
assert(Math.abs(mapped.z - 200) < 1e-6);

const fourConsistent = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(10, 20, 30)),
  anchor(point(100, 0, 0), point(110, 20, 30)),
  anchor(point(0, 100, 0), point(10, 120, 30)),
  anchor(point(0, 0, 100), point(10, 20, 130)),
]);
assert.strictEqual(fourConsistent.status, 'READY');
assert.strictEqual(fourConsistent.basisHypothesisCount, 4);
assert.strictEqual(fourConsistent.admissibleBasisCount, 4);
assert.strictEqual(fourConsistent.basisComparisons.length, 6);

const ambiguous = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(0, 0, 0)),
  anchor(point(1000, 0, 0), point(1000, 0, 0)),
  anchor(point(2000, 1, 0), point(2000, 1, 0)),
  anchor(point(3000, 0, 1), point(3000, 1, 0)),
], { nonCollinearSinTolerance: 1e-4 });
assert.strictEqual(ambiguous.status, 'AMBIGUOUS');
assert.strictEqual(ambiguous.reason, 'METHOD_A_AMBIGUOUS_BASES');
assert(ambiguous.admissibleBasisCount >= 2);
assert.strictEqual(ambiguous.basisAgreementToleranceMm, 546);
assert(ambiguous.conflictingBasisComparisons.some((row) => row.materialDisagreementMm > 1000));
assert.strictEqual(ambiguous.registeredWeight, 0);

const corruptedFourth = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(1000, -500, 200)),
  anchor(point(100, 0, 0), point(1000, -400, 200)),
  anchor(point(0, 100, 0), point(900, -500, 200)),
  anchor(point(100, 100, 0), point(5000, 5000, 5000)),
]);
assert.strictEqual(corruptedFourth.status, 'INCOMPATIBLE');
assert.strictEqual(corruptedFourth.registeredWeight, 0);

const xOne = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(0, 0, 0), 100),
  anchor(point(100, 0, 0), point(100, 0, 0), 100),
  anchor(point(0, 100, 0), point(0, 250, 0), 100),
], { odToleranceFactor: 1 });
const xTwo = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(0, 0, 0), 100),
  anchor(point(100, 0, 0), point(100, 0, 0), 100),
  anchor(point(0, 100, 0), point(0, 250, 0), 100),
], { odToleranceFactor: 2 });
assert.strictEqual(xOne.status, 'INCOMPATIBLE');
assert.strictEqual(xTwo.status, 'READY');
assert.strictEqual(xOne.tolerancePolicy.anchorTolerances[0].toleranceMm, 100);
assert.strictEqual(xTwo.tolerancePolicy.anchorTolerances[0].toleranceMm, 200);

const targetOdSmall = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(0, 0, 0), 273, { targetOdMm: 20 }),
  anchor(point(100, 0, 0), point(100, 0, 0), 273, { targetOdMm: 20 }),
  anchor(point(0, 100, 0), point(0, 100, 0), 273, { targetOdMm: 20 }),
]);
const targetOdLarge = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(0, 0, 0), 273, { targetOdMm: 1000 }),
  anchor(point(100, 0, 0), point(100, 0, 0), 273, { targetOdMm: 1000 }),
  anchor(point(0, 100, 0), point(0, 100, 0), 273, { targetOdMm: 1000 }),
]);
assert.strictEqual(targetOdSmall.tolerancePolicy.basisAgreementToleranceMm, 546);
assert.strictEqual(targetOdLarge.tolerancePolicy.basisAgreementToleranceMm, 546, 'TARGET OD must not alter Method A tolerance');

const missingOd = qualifyCiiGeometryTransform([
  { source: point(0, 0, 0), target: point(0, 0, 0) },
  { source: point(1, 0, 0), target: point(1, 0, 0) },
  { source: point(0, 1, 0), target: point(0, 1, 0) },
]);
assert.strictEqual(missingOd.status, 'UNAVAILABLE');
assert.strictEqual(missingOd.reason, 'SOURCE_OD_TOLERANCE_UNAVAILABLE');

const invalid = qualifyCiiGeometryTransform([
  anchor(point(0, 0, 0), point(0, 0, 0)),
  anchor(point(1, 0, 0), point(1, 0, 0)),
  anchor({ x: 'bad', y: 1, z: 0 }, point(0, 1, 0)),
]);
assert.strictEqual(invalid.status, 'INCOMPATIBLE');
assert.strictEqual(invalid.reason, 'NON_FINITE_ANCHOR_COORDINATE');
assert.strictEqual(registeredCiiPoint(transform, { x: NaN, y: 0, z: 0 }), null);

console.log('CII Workspace OD-scaled multi-basis geometry authority checks passed.');
