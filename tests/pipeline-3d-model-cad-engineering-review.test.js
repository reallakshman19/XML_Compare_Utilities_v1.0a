import assert from 'node:assert/strict';

import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import {
  PIPELINE_CAD_TABLE2_X_AXIS_LABEL,
  PIPELINE_CAD_TABLE2_Y_AXIS_LABEL,
  PIPELINE_CAD_TABLE3_X_AXIS_LABEL,
  PIPELINE_CAD_TABLE3_Y_AXIS_LABEL,
  buildEngineeringTicks,
  buildPipelineCadInspection,
  interpolateEngineeringProfile,
  niceEngineeringTickStep,
  resolvePipelineCadLengthSegment,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-engineering-review.js';

const RAW = Object.freeze({
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t-715.825 → -650.258\t65.567\t0+006.7\t230.95
680.803\t-715.825 → -650.258\t65.567\t0+019.0\t230.82
693.658\t-715.825 → -650.258\t65.567\t0+031.9\t230.82
704.382\t-715.825 → -650.258\t65.567\t0+042.6\t231.38
715.911\t-715.825 → -650.258\t65.567\t0+054.1\t231.79
728.077\t-715.825 → -650.258\t65.567\t0+066.3\t232.28
739.546\t-715.825 → -650.258\t65.567\t0+077.8\t231.92`,
  table3a: `From H(coor)\tTo H(coor)\tText Position X\tHLength Text
661.791\t682.337\t671.704\t20.5
682.337\t716.683\t700.435\t34.3
716.683\t732.683\t723.927\t16.0`,
  table3b: `From H(coor)\tTo H(coor)\tText Position X\tZ Text
—\t—\t665.621\tA/G
682.337\t732.683\t708.374\t1.5M`,
  table3c: `Text Position X\tMarker Text
688.135\tPM-001`,
});

assert.equal(PIPELINE_CAD_TABLE2_X_AXIS_LABEL, 'Station / Chainage (m)');
assert.equal(PIPELINE_CAD_TABLE2_Y_AXIS_LABEL, 'Elevation (m)');
assert.equal(PIPELINE_CAD_TABLE3_X_AXIS_LABEL, 'HLength Cumulative (m)');
assert.equal(PIPELINE_CAD_TABLE3_Y_AXIS_LABEL, 'Depth / Z (m)');

assert.equal(niceEngineeringTickStep(70.8, 7), 20);
assert.equal(niceEngineeringTickStep(2.25, 6), 0.5);
assert.deepEqual(buildEngineeringTicks(-1.5, 0.75, 6), [-1.5, -1, -0.5, 0, 0.5]);
assert.deepEqual(buildEngineeringTicks(0, 70.8, 7), [0, 20, 40, 60]);

assert.equal(interpolateEngineeringProfile([
  { x: 0, y: 10 },
  { x: 20, y: 20 },
], 5), 12.5);
assert.equal(interpolateEngineeringProfile([{ x: 0, y: 10 }], 100), 10);
assert.equal(interpolateEngineeringProfile([], 5), null);

const segment = resolvePipelineCadLengthSegment([
  { id: 'a', sourceLine: 1, fromH: 100, toH: 120, hLength: 20 },
  { id: 'b', sourceLine: 2, fromH: 120, toH: 150, hLength: 30 },
], 26.3);
assert.equal(segment.id, 'b');
assert.equal(segment.cumulativeFrom, 20);
assert.equal(segment.cumulativeTo, 50);
assert.equal(segment.hLength, 30);

const model = PipelineProfileModel.fromRaw(RAW);
const inspection = buildPipelineCadInspection(model, 26.3, { sourceGraph: 'table2x' });
assert.equal(inspection.schema, 'PipelineCadCoordinateInspection.v1');
assert.equal(inspection.sourceGraph, 'table2x');
assert.equal(inspection.stationText, '0+026.3');
assert.ok(Math.abs(inspection.cumulative - 26.3) < 1e-9);
assert.ok(inspection.absoluteH > 688 && inspection.absoluteH < 689);
assert.ok(Math.abs(inspection.elevation - 230.82) < 1e-9);
assert.ok(Number.isFinite(inspection.depthZ));
assert.equal(inspection.segment.sourceLine, 2);
assert.equal(inspection.segment.fromH, 682.337);
assert.equal(inspection.segment.toH, 716.683);
assert.equal(inspection.segment.hLength, 34.3);
assert.equal(inspection.marker.markerText, 'PM-001');
assert.ok(inspection.marker.delta < 0.1);

const clamped = buildPipelineCadInspection(model, 9999);
assert.equal(clamped.cumulative, model.coordinateMap.cumulativeMax);
assert.equal(clamped.segment.sourceLine, 3);

console.log('pipeline-3d-model CAD engineering review tests passed');
