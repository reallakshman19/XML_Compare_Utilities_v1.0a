import assert from 'assert';
import { scoreCiiEdgeCandidate } from '../tabs/cii-workspace/cii-workspace-evidence.js';

const edge = (kind, fromDegree, toDegree, diameter = 273, wall = 8) => ({
  componentKind: kind, lengthMm: 1000, diameter, wall,
  fromContext: { degree: fromDegree }, toContext: { degree: toDegree },
});

// Structural identity contradictions remain fail-closed. With no coordinate
// evidence available, dimensions alone cannot rescue the candidate score.
const branchSource = edge('PIPE', 2, 3);
const localWinner = edge('PIPE', 2, 2);
const result = scoreCiiEdgeCandidate(branchSource, localWinner);
assert.strictEqual(result.hardFail, true);
assert(result.blockers.includes('BRANCH_TOPOLOGY_INCOMPATIBLE'));
assert.strictEqual(result.score, 0);

const rigidMismatch = scoreCiiEdgeCandidate(edge('RIGID', 1, 2), edge('PIPE', 1, 2));
assert.strictEqual(rigidMismatch.hardFail, true);
assert(rigidMismatch.blockers.includes('RIGID_COMPONENT_KIND_INCOMPATIBLE'));
assert.strictEqual(rigidMismatch.score, 0);

// OD and wall are revision evidence, not structural identity blockers. A
// network-supported correspondence remains available. OD uses explicit
// <10% HIGH, 10-50% MEDIUM, >50% REVIEW bands; wall is downstream delta evidence.
const odMismatch = scoreCiiEdgeCandidate(edge('PIPE', 1, 2, 273, 8), edge('PIPE', 1, 2, 168, 8));
assert.strictEqual(odMismatch.hardFail, false);
assert.strictEqual(odMismatch.dimensions.diameter.pass, false);
assert.strictEqual(odMismatch.dimensions.wall.pass, true);
assert.strictEqual(odMismatch.identityConfidence, 'MEDIUM');
assert(!odMismatch.blockers.includes('OD_INCOMPATIBLE'));
assert(odMismatch.score > 81 && odMismatch.score < 82);

const wallMismatch = scoreCiiEdgeCandidate(edge('PIPE', 1, 2, 273, 12), edge('PIPE', 1, 2, 273, 4));
assert.strictEqual(wallMismatch.hardFail, false);
assert.strictEqual(wallMismatch.dimensions.diameter.pass, true);
assert.strictEqual(wallMismatch.dimensions.wall.pass, false);
assert(!wallMismatch.blockers.includes('WALL_THICKNESS_INCOMPATIBLE'));
assert.strictEqual(wallMismatch.identityConfidence, 'HIGH');
assert.strictEqual(wallMismatch.odConfidence.confidence, 'HIGH');
assert.strictEqual(wallMismatch.score, 100);

// Wall tolerance remains reported as engineering evidence but no longer controls identity confidence.
const withinWallTolerance = scoreCiiEdgeCandidate(edge('PIPE', 1, 2, 273, 8), edge('PIPE', 1, 2, 273, 7.4));
assert.strictEqual(withinWallTolerance.dimensions.wall.pass, true);
assert.strictEqual(withinWallTolerance.identityConfidence, 'HIGH');

const outsideWallTolerance = scoreCiiEdgeCandidate(edge('PIPE', 1, 2, 273, 8), edge('PIPE', 1, 2, 273, 6));
assert.strictEqual(outsideWallTolerance.hardFail, false);
assert.strictEqual(outsideWallTolerance.dimensions.wall.pass, false);
assert.strictEqual(outsideWallTolerance.identityConfidence, 'HIGH');

console.log('CII Workspace structural hard-conflict checks passed.');
