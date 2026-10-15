export const XML_COMPARE_LINEWISE_TOOLBAR_GATE_SCHEMA = 'xml-compare-linewise-toolbar-gate/v8-inert';
export const LINEWISE_WORKFLOW_BUTTON_ATTR = 'data-xml-compare-categorized-open';
export const LINEWISE_WORKFLOW_BUTTON_LABEL = 'Line-wise XML Enrichment / Categorized XML';

export function toolbarStyleCss() {
  return '';
}

export function converterTabKeys() {
  return Object.freeze([]);
}

export function converterTabLabels() {
  return Object.freeze([]);
}

export function openWorkflow() {
  return null;
}

export function openConverterWorkflow() {
  return null;
}

export function selectWorkflowTab() {
  return null;
}

export function tabMatches() {
  return false;
}

export function clickShortcut() {
  return false;
}

export function installXmlCompareLinewiseToolbarGate() {
  return false;
}

export const _test = Object.freeze({
  openWorkflow,
  openConverterWorkflow,
  selectWorkflowTab,
  tabMatches,
  converterTabKeys,
  converterTabLabels,
  clickShortcut,
  installXmlCompareLinewiseToolbarGate,
  toolbarStyleCss,
  getToolbarObserver: () => null,
});
