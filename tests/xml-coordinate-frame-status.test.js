import assert from 'node:assert/strict';

import { coordinateFrameReadyForConnector } from '../xml-compare/contracts/coordinate-frame-status-contract.js';
import { buildCoordinateFrameStatus, buildCoordinateFrameStatusSummary } from '../xml-compare/input/build-coordinate-frame-status.js';

const absolute = buildCoordinateFrameStatus({ uid: 'a', position: { x: 1, y: 2, z: 3 } }, { sourceId: 'A' });
assert.equal(absolute.mode, 'absolute');
assert.equal(absolute.comparableForDelta, true);

const sideload = buildCoordinateFrameStatus({ uid: 'b', globalX: '1', globalY: '2', globalZ: '3', coordinateBasisNode: 'N10' }, { sourceId: 'A' });
assert.equal(sideload.mode, 'sideload-global');
assert.equal(sideload.basis, 'N10');
assert.equal(sideload.comparableForDelta, true);

const synthetic = buildCoordinateFrameStatus({ uid: 'c', coordinateFrameMode: 'synthetic-disconnected-layout' }, { sourceId: 'A' });
assert.equal(synthetic.mode, 'synthetic-disconnected-layout');
assert.equal(synthetic.comparableForDelta, false);

const unknown = buildCoordinateFrameStatus({ uid: 'd' }, { sourceId: 'A' });
assert.equal(unknown.mode, 'unknown');
assert.equal(unknown.warnings.some((item) => item.includes('unknown')), true);

const summary = buildCoordinateFrameStatusSummary([
  { position: { x: 0, y: 0, z: 0 } },
  { globalX: '1', globalY: '2', globalZ: '3', coordinateBasisNode: 'N1' },
  { coordinateFrameMode: 'synthetic-disconnected-layout' },
  {},
], { sourceId: 'A' });
assert.equal(summary.recordCount, 4);
assert.equal(summary.absoluteCount, 1);
assert.equal(summary.sideloadGlobalCount, 1);
assert.equal(summary.syntheticLayoutCount, 1);
assert.equal(summary.unknownCount, 1);
assert.equal(summary.comparableForDeltaCount, 2);
assert.equal(summary.notComparableForDeltaCount, 2);
assert.equal(coordinateFrameReadyForConnector(summary), true);

console.log('XML coordinate frame status tests passed');
