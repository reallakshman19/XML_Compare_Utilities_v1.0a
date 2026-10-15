export const XML_COMPARE_CATEGORIZED_CONVERTER_RUNTIME_SCHEMA = 'xml-compare-categorized-converter-runtime/v5-inert';

export {
  ensureCategorized,
  ensureInputXml,
  previewText,
  linewiseAuditJson,
  linewiseCategorizedCanvasPayload,
  applyLinewiseAction,
  applyLinewiseSideload,
  importLinewiseText,
  regexSandboxResult,
} from '../xml-compare/XmlCompareLinewiseWorkflowActions.js';

export {
  createLinewiseWorkflowState,
  resetLinewiseWorkflowState,
  updateLinewiseWorkflowState,
} from '../xml-compare/XmlCompareLinewiseWorkflowState.js';

export {
  renderLinewiseWorkflowPopupHtml,
  renderLinewiseWorkflowToolbarButtonHtml,
} from '../xml-compare/XmlCompareLinewiseWorkflowView.js';

export function installXmlCompareCategorizedConverterRuntime() {
  return false;
}

export const _test = Object.freeze({ installXmlCompareCategorizedConverterRuntime });
