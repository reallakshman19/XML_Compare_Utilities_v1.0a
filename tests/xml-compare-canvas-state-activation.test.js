import assert from 'node:assert/strict';

import {
  applyXmlCompareCanvasAction,
  createXmlCompareCanvasState,
} from '../xml-compare/XmlCompareCanvasStateController.js';

// Validates immutable canvas state actions for text-rule setup and auto-map
// request propagation. Inputs are action payloads; outputs are frozen state trees.

const initialState = createXmlCompareCanvasState({
  compareFields: ['MATERIAL_NAME'],
  selectedRecords: {
    source: { uid: 'source-node-1', displayName: 'Source 1' },
    target: { uid: 'target-node-1', displayName: 'Target 1' },
  },
  validation: {
    textRules: { MATERIAL_NAME: { field: 'MATERIAL_NAME', mode: 'exact-normalized' } },
  },
});

const modeState = applyXmlCompareCanvasAction(initialState, {
  type: 'set-validation-text-mode',
  field: 'MATERIAL_NAME',
  mode: 'regex-position',
});
assert.equal(initialState.validation.textRules.MATERIAL_NAME.mode, 'exact-normalized');
assert.equal(modeState.validation.textRules.MATERIAL_NAME.mode, 'regex-position');

const patternState = applyXmlCompareCanvasAction(modeState, {
  type: 'set-validation-text-pattern',
  field: 'MATERIAL_NAME',
  pattern: '^(AREA)-(\\d+)$',
});
assert.equal(patternState.validation.textRules.MATERIAL_NAME.pattern, '^(AREA)-(\\d+)$');

const groupState = applyXmlCompareCanvasAction(patternState, {
  type: 'set-validation-text-group-spec',
  field: 'MATERIAL_NAME',
  groupSpec: 'area:1=1,bore:2=2',
});
assert.equal(groupState.validation.textRules.MATERIAL_NAME.compareGroups.length, 2);

const directionState = applyXmlCompareCanvasAction(groupState, {
  type: 'set-validation-text-direction',
  field: 'MATERIAL_NAME',
  direction: 'source-contains-target',
});
assert.equal(directionState.validation.textRules.MATERIAL_NAME.direction, 'source-contains-target');

const caseState = applyXmlCompareCanvasAction(directionState, {
  type: 'set-validation-text-case-sensitive',
  field: 'MATERIAL_NAME',
  caseSensitive: true,
});
assert.equal(caseState.validation.textRules.MATERIAL_NAME.caseSensitive, true);

const requestState = applyXmlCompareCanvasAction(caseState, { type: 'request-auto-map', scope: 'node' });
assert.equal(requestState.autoMapRequest.textRules.MATERIAL_NAME.mode, 'regex-position');
assert.equal(requestState.autoMapRequest.compareFields.includes('MATERIAL_NAME'), true);

console.log('XML Compare canvas state activation tests passed');
