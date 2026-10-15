import assert from 'node:assert/strict';

import { applyXmlCompareCanvasAction, createXmlCompareCanvasState } from '../xml-compare/XmlCompareCanvasStateController.js';
import { createValidationCandidateSet } from '../xml-compare/XmlCompareManualValidationBuilderModel.js';
import { renderXmlCompareManualValidationBuilderHtml } from '../xml-compare/XmlCompareManualValidationBuilderPanel.js';
import { manualValidationActionFromChange, manualValidationActionFromClick, manualValidationActionFromInput, manualValidationStatusMessage } from '../tabs/xml-compare-manual-validation-builder-actions.js';

const source = { uid: 'SRC-N10', displayName: 'FROM 10', globalX: '100.0', globalY: '200.0', globalZ: '300.0', tag: 'PS-100-A' };
const target = { uid: 'TGT-N1000', displayName: 'FROM 1000', globalX: '90.0', globalY: '190.0', globalZ: '310.0', tag: 'ps-100-a' };
const fields = ['globalX', 'globalY', 'globalZ'];
const control = (selector, patch = {}) => ({ value: '', checked: false, dataset: {}, matches: (query) => query === selector, ...patch });
const click = (action) => ({ dataset: { xmlCompareAction: action }, matches: (query) => query.includes(`[data-xml-compare-action="${action}"]`) });
const modeTab = (fieldType) => ({ dataset: { xmlCompareValidationBuilderFieldTypeTab: fieldType }, matches: (query) => query === '[data-xml-compare-validation-builder-field-type-tab]' });

let textState = createXmlCompareCanvasState({ selectedRecords: { source, target }, compareFields: ['tag'] });
const initialHtml = renderXmlCompareManualValidationBuilderHtml({ builder: textState.validationBuilder, compareFields: ['tag'], selectedRecords: { source, target }, validation: textState.validation });
assert.ok(initialHtml.includes('Validation Rule Configuration'));
assert.ok(initialHtml.includes('Context & Action'));
assert.ok(initialHtml.includes('Compare / Validate Selection'));
assert.ok(initialHtml.includes('Validation candidates'));
assert.ok(initialHtml.includes('Selected Validation Basis'));

textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromClick(modeTab('numeric')));
assert.equal(textState.validationBuilder.fieldType, 'numeric', 'native helper switches to numeric mode');
textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromClick(modeTab('text')));
assert.equal(textState.validationBuilder.fieldType, 'text', 'native helper switches back to text mode');
textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromChange(control('[data-xml-compare-validation-text-mode]', { value: 'regex', dataset: { validationField: 'tag' } })));
textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromInput(control('[data-xml-compare-validation-text-pattern]', { value: '^PS-', dataset: { validationField: 'tag' } })));
textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromInput(control('[data-xml-compare-validation-text-group-spec]', { value: '1', dataset: { validationField: 'tag' } })));
textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromChange(control('[data-xml-compare-validation-text-direction]', { value: 'either-contains', dataset: { validationField: 'tag' } })));
textState = applyXmlCompareCanvasAction(textState, manualValidationActionFromChange(control('[data-xml-compare-validation-text-case-sensitive]', { checked: true, dataset: { validationField: 'tag' } })));
assert.equal(textState.validation.textRules.tag.mode, 'regex');
assert.equal(textState.validation.textRules.tag.pattern, '^PS-');
assert.equal(textState.validation.textRules.tag.groupSpec, '1');
assert.equal(textState.validation.textRules.tag.direction, 'either-contains');
assert.equal(textState.validation.textRules.tag.caseSensitive, true);
assert.equal(manualValidationStatusMessage({ type: 'compare-validate-selection' }), 'Validation candidates created.');

let state = createXmlCompareCanvasState({ selectedRecords: { source, target }, compareFields: fields });
state = applyXmlCompareCanvasAction(state, manualValidationActionFromClick(modeTab('numeric')));
state = applyXmlCompareCanvasAction(state, manualValidationActionFromChange(control('[data-xml-compare-validation-auto-anchor]', { checked: true })));
state = applyXmlCompareCanvasAction(state, manualValidationActionFromInput(control('[data-xml-compare-validation-numeric-regex-position]', { value: '1' })));
state = applyXmlCompareCanvasAction(state, manualValidationActionFromInput(control('[data-xml-compare-validation-numeric-round-off]', { value: '2' })));
state = applyXmlCompareCanvasAction(state, manualValidationActionFromInput(control('[data-xml-compare-validation-bulk-numeric-threshold]', { value: '0.1' })));
assert.equal(state.validationBuilder.fieldType, 'numeric');
assert.equal(state.validationBuilder.numeric.autoAnchorSelectedNodes, true);
assert.equal(state.validationBuilder.numeric.regexPosition, 1);
assert.equal(state.validationBuilder.numeric.roundOff, 2);
assert.equal(state.validationBuilder.numericDeltaThreshold, 0.1);
state = applyXmlCompareCanvasAction(state, manualValidationActionFromClick(click('compare-validate-selection')));
assert.equal(state.validationBuilder.candidateSet.schema, 'validation-candidate-set/v1');
assert.equal(state.validationBuilder.candidateSet.fieldType, 'numeric');
assert.equal(state.validationBuilder.candidateSet.transformPolicy.autoAnchorSelectedNodes, true);
assert.ok(state.validationBuilder.candidateSet.candidates.some((row) => row.targetVariant === 'transformed'));
assert.ok(state.validationBuilder.candidateSet.selectedCandidateIds.length >= 3);
assert.equal(state.approvedMatchSet, null, 'validation candidates do not auto-approve links');
const first = state.validationBuilder.candidateSet.selectedCandidateIds[0];
state = applyXmlCompareCanvasAction(state, manualValidationActionFromChange(control('[data-xml-compare-validation-candidate-toggle]', { checked: false, dataset: { xmlCompareValidationCandidateToggle: first } })));
assert.equal(state.validationBuilder.selectedCandidateIds.includes(first), false, 'native toggle updates candidate selection');
state = applyXmlCompareCanvasAction(state, manualValidationActionFromClick(click('approve-all-valid-candidates')));
assert.ok(state.validationBuilder.selectedCandidateIds.length >= 3, 'approve all valid restores valid numeric basis');

const numericHtml = renderXmlCompareManualValidationBuilderHtml({ builder: state.validationBuilder, compareFields: fields, selectedRecords: { source, target }, validation: state.validation });
assert.ok(numericHtml.includes('Regex position for numeric extraction'));
assert.ok(numericHtml.includes('Auto anchor selected nodes'));
assert.ok(numericHtml.includes('transformed'));

let textCompareState = createXmlCompareCanvasState({ selectedRecords: { source, target }, compareFields: ['tag'] });
textCompareState = applyXmlCompareCanvasAction(textCompareState, manualValidationActionFromInput(control('[data-xml-compare-validation-bulk-text-threshold]', { value: '90' })));
textCompareState = applyXmlCompareCanvasAction(textCompareState, manualValidationActionFromClick(click('compare-validate-selection')));
assert.equal(textCompareState.validationBuilder.candidateSet.fieldType, 'text');
assert.equal(textCompareState.validationBuilder.candidateSet.summary.selectedCount, 1);
textCompareState = applyXmlCompareCanvasAction(textCompareState, manualValidationActionFromClick(click('approve-all-valid-candidates')));
assert.equal(textCompareState.validationBuilder.selectedCandidateIds.includes('text:tag->tag'), true, 'approve all valid works for text basis');
const textHtml = renderXmlCompareManualValidationBuilderHtml({ builder: textCompareState.validationBuilder, compareFields: ['tag'], selectedRecords: { source, target }, validation: textCompareState.validation });
assert.ok(textHtml.includes('Text mode'));
assert.ok(textHtml.includes('Pattern'));
assert.ok(textHtml.includes('Group spec'));
assert.ok(textHtml.includes('Direction'));
assert.ok(textHtml.includes('Case-sensitive'));

const blocked = createValidationCandidateSet({ sourceRecord: null, targetRecord: target, compareFields: fields });
assert.equal(blocked.summary.blockerCount > 0, true);
console.log('XML Compare manual validation builder tests passed');
