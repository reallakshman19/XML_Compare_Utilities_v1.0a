export const XML_COMPARE_LOAD_DIAGNOSTICS_RUNTIME_SCHEMA = 'xml-compare-load-diagnostics-runtime/v2-inert';

export {
  appendLoadDiagnosticRow,
  clearLoadDiagnosticsState,
  createLoadDiagnosticsState,
  renderXmlCompareLoadDiagnosticsPanelHtml,
} from '../xml-compare/XmlCompareLoadDiagnosticsPanel.js';

export function installXmlCompareLoadDiagnosticsRuntime() {
  return false;
}

export const _test = Object.freeze({ installXmlCompareLoadDiagnosticsRuntime });
