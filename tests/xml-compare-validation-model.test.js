import assert from 'node:assert/strict';

import { createXmlCompareValidationModel } from '../xml-compare/XmlCompareValidationModel.js';

// Covers validation-model routing: coordinate triples keep nearest-target SRSS
// behavior, while non-coordinate fields produce numeric and text rows together.

const sourceAnchor = {
  uid: 'source-node-1',
  levelId: 'node',
  displayName: 'Source 1',
  globalX: 0,
  globalY: 0,
  globalZ: 0,
  pressure: '10',
  MATERIAL_NAME: ' A  B ',
};
const targetAnchor = {
  uid: 'target-node-1',
  levelId: 'node',
  displayName: 'Target 1',
  globalX: 10,
  globalY: 0,
  globalZ: 0,
  pressure: '12',
  MATERIAL_NAME: 'a b',
};

const fieldModel = createXmlCompareValidationModel({
  source: { records: [sourceAnchor] },
  target: { records: [targetAnchor] },
  matchMap: { request: { sourceUid: sourceAnchor.uid, targetUid: targetAnchor.uid } },
  compareFields: ['pressure', 'MATERIAL_NAME'],
  textRules: { MATERIAL_NAME: { field: 'MATERIAL_NAME', mode: 'exact-normalized' } },
});

assert.equal(fieldModel.mode, 'field-compare');
assert.equal(fieldModel.rows.length, 2);
assert.equal(fieldModel.rows.find((row) => row.rowType === 'numeric').delta, 2);
assert.equal(fieldModel.rows.find((row) => row.rowType === 'text').status, 'OK');

const sourceOffsetNode = {
  uid: 'source-node-2',
  levelId: 'node',
  displayName: 'Source 2',
  globalX: 1,
  globalY: 2,
  globalZ: 3,
};
const targetOffsetNode = {
  uid: 'target-node-2',
  levelId: 'node',
  displayName: 'Target 2',
  globalX: 11,
  globalY: 2,
  globalZ: 3,
};

const coordinateModel = createXmlCompareValidationModel({
  source: { records: [sourceAnchor, sourceOffsetNode] },
  target: { records: [targetAnchor, targetOffsetNode] },
  matchMap: { request: { sourceUid: sourceAnchor.uid, targetUid: targetAnchor.uid } },
  compareFields: ['globalX', 'globalY', 'globalZ'],
  toleranceMm: 1,
});

assert.equal(coordinateModel.mode, 'coordinate-transform-nearest');
assert.equal(coordinateModel.summary.okCount, 2);
assert.equal(coordinateModel.summary.maxSrss, 0);
assert.equal(coordinateModel.rows.every((row) => row.status === 'OK'), true);

console.log('XML Compare validation model tests passed');
