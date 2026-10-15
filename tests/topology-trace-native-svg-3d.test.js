import assert from 'node:assert/strict';
import { projectTopologyPoint } from '../tabs/topology-trace-validator/topology-svg-projections.js';
import { effectiveTopologySvgState } from '../tabs/topology-trace-validator/topology-svg-view-state.js';
import { _test as markupTest } from '../tabs/topology-trace-validator/topology-workspace-markup.js';
import { readFileSync } from 'node:fs';

const point = { x: 12, y: -4, z: 8 };
assert.deepEqual(projectTopologyPoint(point, '3D'), projectTopologyPoint(point, 'ISO'), '3D must use the native ISO SVG projection');
assert.deepEqual(projectTopologyPoint(point, '3D'), {
  x: Number(((point.x - point.y) * Math.cos(Math.PI / 6)).toFixed(12)),
  y: Number((point.z + (point.x + point.y) * Math.sin(Math.PI / 6)).toFixed(12)),
});

const isolated = effectiveTopologySvgState({ types: ['PIPE', 'SUPPORT'], showComponentSymbols: false, isolateSupports: true });
assert.deepEqual(isolated.types, ['SUPPORT']);
assert.equal(isolated.showComponentSymbols, true);
assert.equal(isolated.isolateSupports, true);
const normal = effectiveTopologySvgState({ types: ['PIPE'], showComponentSymbols: false, isolateSupports: false });
assert.deepEqual(normal.types, ['PIPE']);
assert.equal(normal.showComponentSymbols, false);

const markup = markupTest.traceMarkup();
for (const text of ['Isolate Supports', 'Symbol Overlays', 'data-ttv-canvas-fit', 'data-ttv-canvas-projection="ISO"', 'data-ttv-axis-compass']) assert.match(markup, new RegExp(text));
for (const axis of ['x', 'y', 'z']) assert.match(markup, new RegExp(`data-ttv-axis="${axis}"`));

const controller = readFileSync(new URL('../tabs/topology-trace-validator/topology-validator-controller.js', import.meta.url), 'utf8');
assert.doesNotMatch(controller, /topology-3d-viewer-bridge|render3dViewer|select3dObject|dispose3dViewer|workbench-viewer/);
assert.match(controller, /renderTopologySvg/);
assert.match(controller, /wireTopologySvgNavigation/);
assert.match(controller, /wireTopologySvgInteractions/);

console.log('topology trace native SVG 3D tests passed');
