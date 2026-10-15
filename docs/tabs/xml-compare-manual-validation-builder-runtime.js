export const XML_COMPARE_MANUAL_VALIDATION_BUILDER_RUNTIME_SCHEMA = 'xml-compare-manual-validation-builder-runtime/v2-inert';

export {
  manualValidationActionFromChange,
  manualValidationActionFromClick,
  manualValidationActionFromEvent,
  manualValidationActionFromInput,
  manualValidationStatusMessage,
} from './xml-compare-manual-validation-builder-actions.js';

export function installXmlCompareManualValidationBuilderRuntime() {
  return false;
}

export const _test = Object.freeze({ installXmlCompareManualValidationBuilderRuntime });
