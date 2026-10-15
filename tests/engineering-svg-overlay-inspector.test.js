import assert from 'node:assert/strict';
import {
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
} from '../core/engineering-scene/index.js';
import {
  aggregateEngineeringSvgProperties,
  createEngineeringSvgDraftStore,
} from '../core/engineering-svg/edit-runtime.js';
import { buildEngineeringSvgInspectorModel } from '../core/engineering-svg/overlay-runtime.js';

const revision = createEngineeringRevisionToken({ geometry: 2, properties: 8 });
const propertySets = [
  createEngineeringPropertySet({
    id: 'a-properties', revision, ownerIds: ['a'], fields: [
      { key: 'pressure', label: 'Pressure', type: 'number', value: 10, min: 0, max: 100 },
      { key: 'mode', label: 'Mode', type: 'enum', value: 'A', options: ['A', 'B'] },
      { key: 'tag', label: 'Tag', type: 'text', value: 'A-1' },
    ],
  }),
  createEngineeringPropertySet({
    id: 'b-properties', revision, ownerIds: ['b'], fields: [
      { key: 'pressure', label: 'Pressure', type: 'number', value: 20, min: 0, max: 100 },
      { key: 'mode', label: 'Mode', type: 'enum', value: 'A', options: ['A', 'B'] },
    ],
  }),
  createEngineeringPropertySet({
    id: 'c-properties', revision, ownerIds: ['c'], fields: [
      { key: 'ownerOnly', label: 'Owner Only', type: 'text', value: 'C' },
    ],
  }),
  createEngineeringPropertySet({
    id: 'shared-properties', revision, ownerIds: [], fields: [
      { key: 'material', label: 'Material', type: 'text', scope: 'REFERENCE', value: 'A106' },
      { key: 'reviewed', label: 'Reviewed', type: 'boolean', scope: 'SELECTION', value: false },
    ],
  }),
];
const views = aggregateEngineeringSvgProperties(['a', 'b'], propertySets);
const row = (model, key) => model.rows.find((value) => value.key === key);

const cleanModel = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: {},
});
assert.equal(row(cleanModel, 'pressure').display.state, 'mixed');
assert.equal(row(cleanModel, 'mode').display.state, 'uniform');
assert.equal(row(cleanModel, 'tag').display.state, 'unavailable');
assert.equal(row(cleanModel, 'ownerOnly').display.state, 'not-applicable');
assert.equal(row(cleanModel, 'material').field.editable, false);
assert.equal(cleanModel.dirtyCount, 0);
assert.equal(cleanModel.applyEligible, false);
assert.deepEqual(JSON.parse(JSON.stringify(cleanModel)), cleanModel);

const validDraft = createEngineeringSvgDraftStore();
validDraft.begin({ operationId: 'inspector-valid', baseRevision: revision });
validDraft.stageProperty('a', 'pressure', { original: 10, draft: 15 });
validDraft.stageProperty('b', 'pressure', { original: 20, draft: 15 });
validDraft.stageProperty('a', 'reviewed', { original: false, draft: true });
validDraft.stageProperty('b', 'reviewed', { original: false, draft: true });
const validModel = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: validDraft.getSnapshot(),
});
assert.deepEqual(row(validModel, 'pressure').display, { state: 'uniform', value: 15 });
assert.equal(row(validModel, 'pressure').dirty, true);
assert.equal(row(validModel, 'pressure').applyEligible, true);
assert.equal(row(validModel, 'reviewed').display.value, true);
assert.equal(validModel.dirtyCount, 2);
assert.equal(validModel.invalidCount, 0);
assert.equal(validModel.applyEligible, true);

const partialDraft = createEngineeringSvgDraftStore();
partialDraft.begin({ operationId: 'inspector-partial', baseRevision: revision });
partialDraft.stageProperty('a', 'mode', { original: 'A', draft: 'B' });
const partialModel = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: partialDraft.getSnapshot(),
});
assert.equal(row(partialModel, 'mode').display.state, 'mixed');
assert.equal(row(partialModel, 'mode').valid, false);
assert.match(row(partialModel, 'mode').messages.join(' '), /only part of the selection/);
assert.equal(partialModel.applyEligible, false);

const invalidDraft = createEngineeringSvgDraftStore();
invalidDraft.begin({ operationId: 'inspector-invalid', baseRevision: revision });
invalidDraft.stageProperty('a', 'pressure', { original: 10, draft: 101 });
invalidDraft.stageProperty('b', 'pressure', { original: 20, draft: 101 });
invalidDraft.stageProperty('a', 'material', { original: 'A106', draft: 'B31' });
invalidDraft.stageProperty('b', 'material', { original: 'A106', draft: 'B31' });
const invalidModel = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: invalidDraft.getSnapshot(),
});
assert.match(row(invalidModel, 'pressure').messages.join(' '), /above its maximum/);
assert.match(row(invalidModel, 'material').messages.join(' '), /read-only/);
assert.equal(row(invalidModel, 'material').applyEligible, false);
assert.equal(invalidModel.invalidCount, 2);
assert.equal(invalidModel.applyEligible, false);

const unchangedDraft = createEngineeringSvgDraftStore();
unchangedDraft.begin({ operationId: 'inspector-unchanged', baseRevision: revision });
unchangedDraft.stageProperty('a', 'pressure', { original: 10, draft: 10 });
unchangedDraft.stageProperty('b', 'pressure', { original: 20, draft: 20 });
const unchangedModel = buildEngineeringSvgInspectorModel({
  selectedIds: ['a', 'b'], propertyViews: views, draft: unchangedDraft.getSnapshot(),
});
assert.equal(row(unchangedModel, 'pressure').dirty, false);
assert.equal(row(unchangedModel, 'pressure').display.state, 'mixed');
assert.equal(unchangedModel.applyEligible, false);

console.log('engineering SVG overlay inspector: ok');
