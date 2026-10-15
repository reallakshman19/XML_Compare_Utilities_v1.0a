import { categorizedDiagnostic } from './categorized-diagnostics.js';

export const CATEGORIZED_EXPORT_CONTRACT_SCHEMA = 'table-categorizer-export-contract/v1';

export function validateExportArtifactContract(artifact = {}) {
  const diagnostics = [];
  if (typeof artifact.xmlText !== 'string' || !artifact.xmlText.trim()) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'export_xml_missing', 'xmlText is required.'));
  }
  if (artifact.xmlText && !/^<\?xml|^<[A-Za-z_]/.test(artifact.xmlText.trim())) {
    diagnostics.push(categorizedDiagnostic('ERROR', 'export_xml_root_missing', 'xmlText must start with a root element.'));
  }
  if (typeof artifact.graphJson !== 'string') {
    diagnostics.push(categorizedDiagnostic('WARNING', 'export_graph_json_missing', 'graphJson should be present.'));
  }
  return result(diagnostics);
}

function result(diagnostics) {
  return Object.freeze({ ok: !diagnostics.some((item) => item.severity === 'BLOCKER' || item.severity === 'ERROR'), diagnostics: Object.freeze(diagnostics) });
}
