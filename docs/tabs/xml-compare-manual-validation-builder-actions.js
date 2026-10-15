export const XML_COMPARE_MANUAL_VALIDATION_BUILDER_ACTIONS_SCHEMA = 'xml-compare-manual-validation-builder-actions/v1';

const clean = (value) => String(value ?? '').trim();
const field = (target) => clean(target?.dataset?.validationField);
const closest = (target, selector) => target?.closest?.(selector) || null;
const inContainer = (container, target) => Boolean(target && (!container?.contains || container.contains(target)));

export function manualValidationActionFromInput(input = null) {
  if (!input?.dataset) return null;
  if (input.matches?.('[data-xml-compare-validation-text-pattern]')) return { type: 'set-validation-text-pattern', field: field(input), pattern: input.value };
  if (input.matches?.('[data-xml-compare-validation-text-group-spec]')) return { type: 'set-validation-text-group-spec', field: field(input), groupSpec: input.value };
  if (input.matches?.('[data-xml-compare-validation-numeric-regex-position]')) return { type: 'set-validation-numeric-regex-position', regexPosition: input.value };
  if (input.matches?.('[data-xml-compare-validation-numeric-round-off]')) return { type: 'set-validation-numeric-round-off', roundOff: input.value };
  if (input.matches?.('[data-xml-compare-validation-bulk-numeric-threshold]')) return { type: 'set-validation-numeric-delta-threshold', threshold: input.value };
  if (input.matches?.('[data-xml-compare-validation-bulk-text-threshold]')) return { type: 'set-validation-text-similarity-threshold', threshold: input.value };
  return null;
}

export function manualValidationActionFromChange(input = null) {
  if (!input?.dataset) return null;
  if (input.matches?.('[data-xml-compare-validation-text-mode]')) return { type: 'set-validation-text-mode', field: field(input), mode: input.value };
  if (input.matches?.('[data-xml-compare-validation-text-direction]')) return { type: 'set-validation-text-direction', field: field(input), direction: input.value };
  if (input.matches?.('[data-xml-compare-validation-text-case-sensitive]')) return { type: 'set-validation-text-case-sensitive', field: field(input), caseSensitive: Boolean(input.checked) };
  if (input.matches?.('[data-xml-compare-validation-auto-anchor]')) return { type: 'set-validation-auto-anchor', autoAnchorSelectedNodes: Boolean(input.checked) };
  if (input.matches?.('[data-xml-compare-validation-candidate-toggle]')) return { type: 'toggle-validation-candidate', candidateId: input.dataset.xmlCompareValidationCandidateToggle, selected: Boolean(input.checked) };
  return null;
}

export function manualValidationActionFromClick(button = null) {
  if (!button?.dataset) return null;
  if (button.matches?.('[data-xml-compare-validation-builder-field-type-tab]')) return { type: 'set-validation-builder-field-type', fieldType: button.dataset.xmlCompareValidationBuilderFieldTypeTab };
  if (button.dataset.xmlCompareAction === 'compare-validate-selection') return { type: 'compare-validate-selection' };
  if (button.dataset.xmlCompareAction === 'approve-all-valid-candidates') return { type: 'approve-all-valid-candidates' };
  return null;
}

export function manualValidationStatusMessage(action = {}) {
  if (action.type === 'set-validation-builder-field-type') return `Validation builder mode: ${clean(action.fieldType) || 'text'}.`;
  if (action.type === 'compare-validate-selection') return 'Validation candidates created.';
  if (action.type === 'toggle-validation-candidate') return 'Validation candidate updated.';
  if (action.type === 'approve-all-valid-candidates') return 'Approved all valid validation candidates.';
  if (action.type?.startsWith?.('set-validation-text-')) return 'Validation text rule updated.';
  if (action.type?.startsWith?.('set-validation-numeric-')) return 'Validation numeric rule updated.';
  if (action.type === 'set-validation-auto-anchor') return 'Validation numeric rule updated.';
  return 'Validation builder updated.';
}

export function manualValidationActionFromEvent(event = {}, kind = 'input', container = null) {
  const target = event.target;
  const selectors = kind === 'click'
    ? '[data-xml-compare-validation-builder-field-type-tab],[data-xml-compare-action="compare-validate-selection"],[data-xml-compare-action="approve-all-valid-candidates"]'
    : '[data-xml-compare-validation-text-mode],[data-xml-compare-validation-text-pattern],[data-xml-compare-validation-text-group-spec],[data-xml-compare-validation-text-direction],[data-xml-compare-validation-text-case-sensitive],[data-xml-compare-validation-numeric-regex-position],[data-xml-compare-validation-numeric-round-off],[data-xml-compare-validation-auto-anchor],[data-xml-compare-validation-bulk-numeric-threshold],[data-xml-compare-validation-bulk-text-threshold],[data-xml-compare-validation-candidate-toggle]';
  const control = closest(target, selectors);
  if (!inContainer(container, control)) return null;
  if (kind === 'click') return manualValidationActionFromClick(control);
  return kind === 'change' ? manualValidationActionFromChange(control) : manualValidationActionFromInput(control);
}

export const _test = Object.freeze({ clean, field, closest, inContainer });
