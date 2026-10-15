import { categorizedDiagnostic } from './categorized-diagnostics.js';

export const CATEGORIZED_GRAPH_CONTRACT_SCHEMA = 'table-categorizer-graph-contract/v1';

export function validateCategorizedGraphContract(graph = {}) {
  const diagnostics = [];
  if (!Array.isArray(graph.nodes)) diagnostics.push(categorizedDiagnostic('BLOCKER', 'graph_nodes_missing', 'nodes must be an array.'));
  if (!Array.isArray(graph.edges)) diagnostics.push(categorizedDiagnostic('BLOCKER', 'graph_edges_missing', 'edges must be an array.'));
  if ((graph.documentRootNodeIds || []).length !== 1) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'graph_document_root_count', 'Graph must have one document root.'));
  }
  for (const node of graph.nodes || []) validateNode(node, diagnostics);
  return result(diagnostics);
}

function validateNode(node, diagnostics) {
  for (const field of ['id', 'levelId', 'key', 'fields']) {
    if (node[field] == null) diagnostics.push(categorizedDiagnostic('ERROR', 'graph_node_field_missing', `Node is missing ${field}.`, node.id || ''));
  }
}

function result(diagnostics) {
  return Object.freeze({ ok: !diagnostics.some((item) => item.severity === 'BLOCKER' || item.severity === 'ERROR'), diagnostics: Object.freeze(diagnostics) });
}
