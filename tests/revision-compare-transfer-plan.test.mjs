import assert from 'node:assert/strict';
import { serializeRevisionCompareTransferPlan } from '../tabs/revision-compare/revision-transfer-contracts.js';
import { createRevisionCompareTransferPlan } from '../tabs/revision-compare/revision-transfer-plan.js';
import {
  cryptoRef, propertyFor, selectionFor, snapshots, stateFor,
} from './revision-compare-transfer-fixtures.mjs';

const valueData = await snapshots('VALUE');
const valueProperty = propertyFor({ targetMode: 'VALUE' });
const valueState = stateFor(valueData.revA, valueData.revB, valueProperty);
const valueSelection = selectionFor(valueProperty);
const replacePlan = await createRevisionCompareTransferPlan(
  valueState, valueSelection, { cryptoRef },
);
assert.equal(replacePlan.status, 'READY');
assert.equal(replacePlan.operations[0].operationType, 'REPLACE_EXISTING_PROPERTY');
assert.equal(replacePlan.operations[0].expectedTargetState, 'PRESENT');
assert.equal(replacePlan.operations[0].beforeValue, 'Old');
assert.equal(replacePlan.operations[0].afterValue, 'New');
assert.equal(replacePlan.summary.replaceExistingCount, 1);
assert.deepEqual(
  await createRevisionCompareTransferPlan(valueState, valueSelection, { cryptoRef }),
  replacePlan,
);

const absentData = await snapshots('ABSENT');
const absentProperty = propertyFor({ targetMode: 'ABSENT' });
const absentState = stateFor(absentData.revA, absentData.revB, absentProperty);
const absentSelection = selectionFor(absentProperty);
const addPlan = await createRevisionCompareTransferPlan(
  absentState, absentSelection, { cryptoRef },
);
assert.equal(addPlan.status, 'READY');
assert.equal(addPlan.operations[0].operationType, 'ADD_MISSING_PROPERTY');
assert.equal(addPlan.operations[0].expectedTargetState, 'ABSENT');
assert.equal(Object.hasOwn(addPlan.operations[0], 'beforeValue'), false);
assert.equal(Object.hasOwn(addPlan.operations[0].targetAddress, 'expectedCurrentValue'), false);
assert.equal(addPlan.summary.addMissingCount, 1);
assert.deepEqual(
  await createRevisionCompareTransferPlan(absentState, absentSelection, { cryptoRef }),
  addPlan,
);

const nullData = await snapshots('NULL');
const nullProperty = propertyFor({ targetMode: 'NULL' });
const nullState = stateFor(nullData.revA, nullData.revB, nullProperty);
const nullSelection = selectionFor(nullProperty);
const nullPlan = await createRevisionCompareTransferPlan(
  nullState, nullSelection, { cryptoRef },
);
assert.equal(nullPlan.status, 'READY');
assert.equal(nullPlan.operations[0].operationType, 'REPLACE_EXISTING_PROPERTY');
assert.equal(nullPlan.operations[0].expectedTargetState, 'PRESENT');
assert.equal(Object.hasOwn(nullPlan.operations[0], 'beforeValue'), true);
assert.equal(nullPlan.operations[0].beforeValue, null);
assert.notEqual(nullPlan.operations[0].operationId, addPlan.operations[0].operationId);
assert.notEqual(nullPlan.planId, addPlan.planId);
assert.notEqual(
  serializeRevisionCompareTransferPlan(nullPlan),
  serializeRevisionCompareTransferPlan(addPlan),
);

const missingParent = await createRevisionCompareTransferPlan(
  absentState, selectionFor(absentProperty, '/attributes/DESCRIPTION'), { cryptoRef },
);
assert.equal(missingParent.status, 'BLOCKED');
assert(missingParent.blockers.some((item) => /parent path resolves to zero/.test(item)));

const protectedPlan = await createRevisionCompareTransferPlan(
  absentState, selectionFor(absentProperty, '/id'), { cryptoRef },
);
assert.equal(protectedPlan.status, 'BLOCKED');
assert(protectedPlan.blockers.some((item) => /protected/.test(item)));

const controlledProperty = propertyFor({ propertyKey: 'supportType', targetMode: 'ABSENT' });
const controlledState = stateFor(absentData.revA, absentData.revB, controlledProperty);
const controlledPlan = await createRevisionCompareTransferPlan(
  controlledState, selectionFor(controlledProperty, '/supportType'), { cryptoRef },
);
assert.equal(controlledPlan.status, 'BLOCKED');
assert(controlledPlan.blockers.some((item) => /Controlled geometry/.test(item)));

const serialized = serializeRevisionCompareTransferPlan(replacePlan);
assert.equal(serialized.endsWith('\n'), true);
assert.equal(serialized.endsWith('\n\n'), false);
assert.equal(serialized.includes('\n  '), false);
console.log('revision-compare-transfer-plan.test.mjs passed');
