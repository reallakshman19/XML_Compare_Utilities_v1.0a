import assert from 'node:assert/strict';
import { createPipelineKeyPlanRenderSession } from '../tabs/pipeline-3d-model/pipeline-3d-model-keyplan-render-session.js';

const calls = [];
const session = createPipelineKeyPlanRenderSession((...args) => calls.push(args));
const canvasA = { id: 'a' };
const canvasB = { id: 'b' };
const points = [{ globalX: 1, globalY: 2 }];
const sheets = [{ sheetIndex: 0, startIndex: 0, endIndex: 0 }];
const markers = [{ id: 'm1', globalX: 1, globalY: 2 }];

assert.equal(session.render(canvasA, points, sheets, null, markers, 1), true);
assert.equal(session.render(canvasA, structuredClone(points), structuredClone(sheets), null,
  structuredClone(markers), 1), false);
assert.equal(calls.length, 1);
assert.equal(session.render(canvasA, points, sheets, null, [...markers, { id: 'm2' }], 1), true);
assert.equal(session.render(canvasA, points, sheets, null, markers, 2), true);
assert.equal(session.render(canvasB, points, sheets, null, markers, 2), true);
session.reset();
assert.equal(session.render(canvasB, points, sheets, null, markers, 2), true);
assert.equal(calls.length, 5);

let attempts = 0;
const retry = createPipelineKeyPlanRenderSession(() => {
  attempts += 1;
  if (attempts === 1) throw new Error('paint failed');
});
assert.throws(() => retry.render(canvasA, points, sheets, null, markers, 1), /paint failed/);
assert.equal(retry.render(canvasA, points, sheets, null, markers, 1), true);
assert.equal(attempts, 2, 'failed paint must not cache the signature');

console.log('pipeline-3d-model key-plan render session: PASS');
