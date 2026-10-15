/**
 * Directional restraint rendering contract.
 * Real CAESAR restraint semantics are projected into one REST arrow, two
 * lateral GUIDE arrows, axial LINESTOP arrows, hold-down pairs, and explicit
 * axis arrows without browser state.
 */

import assert from 'node:assert/strict';
import { buildCanonicalRestraintGeometry } from '../tabs/topology-trace-validator/topology-3d-visual-model.js';

const canonical = {
  nodes: [
    { id: 'N1', position: { x: 0, y: 0, z: 0 } },
    { id: 'N2', position: { x: 1000, y: 0, z: 0 } },
  ],
  edges: [{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2' }],
  supports: [
    { id: 'S-REST', nodeId: 'N1', restraints: [{ kind: 'REST', type: '+Y', direction: '+Y' }] },
    { id: 'S-GUIDE', nodeId: 'N1', restraints: [{ kind: 'GUIDE', type: 'GUI', direction: 'GUI' }] },
    { id: 'S-LINESTOP', nodeId: 'N2', restraints: [{ kind: 'LINESTOP', type: 'LIM', direction: 'LIM' }] },
    { id: 'S-HOLDOWN', nodeId: 'N1', restraints: [{ kind: 'HOLDOWN', type: '+Y', direction: '+Y' }] },
    { id: 'S-X', nodeId: 'N2', restraints: [{ kind: '', type: 'X', direction: 'X' }] },
  ],
};

const geometry = buildCanonicalRestraintGeometry(canonical);
const arrows = geometry.markers.filter((marker) => marker.kind === 'RESTRAINT_ARROW');
assert.equal(geometry.segments.length, 8);
assert.equal(arrows.length, 8);
const sortDirs = (dirs) => dirs.map(d => d.join(',')).sort();
assert.deepEqual(sortDirs(arrows.filter((row) => row.objectId === 'S-REST').map((row) => row.direction)), sortDirs([[0, 1, 0]]));
assert.deepEqual(sortDirs(arrows.filter((row) => row.objectId === 'S-GUIDE').map((row) => row.direction)), sortDirs([[0, 0, 1], [0, 0, -1]]));
assert.deepEqual(sortDirs(arrows.filter((row) => row.objectId === 'S-LINESTOP').map((row) => row.direction)), sortDirs([[-1, 0, 0], [1, 0, 0]]));
assert.deepEqual(sortDirs(arrows.filter((row) => row.objectId === 'S-HOLDOWN').map((row) => row.direction)), sortDirs([[0, 1, 0], [0, -1, 0]]));
assert.deepEqual(sortDirs(arrows.filter((row) => row.objectId === 'S-X').map((row) => row.direction)), sortDirs([[1, 0, 0]]));
assert(geometry.markers.filter((marker) => marker.kind === 'SUPPORT').every((marker) => marker.isObjectMarker));

const scaledGeometry = buildCanonicalRestraintGeometry(canonical, { verticalAxis: 'Y', supportScale: 5 });
const baseSupport = geometry.markers.find((marker) => marker.kind === 'SUPPORT');
const scaledSupport = scaledGeometry.markers.find((marker) => marker.kind === 'SUPPORT');
assert.equal(scaledSupport.sizeMm, baseSupport.sizeMm * 2, 'support marker scale must follow the UI slider');
assert.equal(scaledGeometry.segments[0].radiusMm, geometry.segments[0].radiusMm * 2, 'support shaft scale must follow the UI slider');

console.log('topology 3D restraint geometry passed: directional arrows and support rendering scale verified.');
