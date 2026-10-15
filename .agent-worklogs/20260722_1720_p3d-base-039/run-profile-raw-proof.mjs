import assert from 'node:assert/strict';
import { PipelineProfileModel } from '../../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const raw={
 table2a:'H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text\n0\t0\t100\t0+000.0\t100.0\n100\t0\t100\t0+100.0\t101.0',
 table3a:'From H(coor)\tTo H(coor)\tText Position X\tHLength Text\n0\t100\t50\t100',
 table3b:'From H(coor)\tTo H(coor)\tText Position X\tZ Text\n0\t100\t50\t1.5M',
 table3c:'Text Position X\tMarker Text\n50\tPMS-001',
};
const model=PipelineProfileModel.fromRaw(raw);
assert.equal(model.table2Rows.length,2);
assert.equal(model.table3LengthRows.length,1);
assert.equal(model.table3DepthRows.length,1);
assert.equal(model.table3MarkerRows.length,1);
assert.equal(model.table3MarkerRows[0].markerText,'PMS-001');
const source=readFileSync(new URL('tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation.js', root), 'utf8');
assert.match(source,/PipelineProfileModel\.fromRaw\(input\.profileRaw\)/);
assert.match(source,/routeStartStation: context\.routeStartStation,/);
assert.doesNotMatch(source,/routeStartStation: context\.routeStartStation:/);
console.log('P3D-BASE-039 authoritative profileRaw parse proof passed.');
