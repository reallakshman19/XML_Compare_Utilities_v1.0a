/** Narrow controller decorator for immutable junction-definition preservation export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologyJunctionDefinitionPreservation,
  topologyJunctionDefinitionPreservationFileName,
} from './topology-junction-definition-preservation.js';

export const TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_CONTROLLER_SCHEMA =
  'TopologyJunctionDefinitionPreservationController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function selectedJunctionIntent(evidence) {
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const junctions = rows.filter((row) => row?.kind === 'junction' && String(row.id || '').trim());
  if (rows.length !== 1 || junctions.length !== 1) {
    throw new RangeError('Junction preservation export requires exactly one selected junction.');
  }
  return Object.freeze({ junctionId: junctions[0].id });
}
function currentCanonical(evidence) {
  return evidence.editedArtifacts?.canonicalTopology
    ?? evidence.baseArtifacts?.canonicalTopology
    ?? null;
}
function preservationInput(evidence, intent, createdAt) {
  return { canonical: currentCanonical(evidence), draft: evidence.draft,
    commandAuthority: evidence.commandAuthority, projectDocument: evidence.projectDocument,
    junctionId: intent.junctionId, createdAt };
}
function exportPreservation(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const artifact = createTopologyJunctionDefinitionPreservation(
    preservationInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologyJunctionDefinitionPreservationFileName(artifact, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(artifact, null, 2)}\n`,
    'application/json;charset=utf-8');
  return artifact;
}
export function createTopologyJunctionDefinitionPreservationController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation,
    'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Junction preservation controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString()); requiredFunction(now, 'now');
  function exportJunctionDefinitionPreservation(intent = selectedJunctionIntent(evidence())) {
    return exportPreservation(baseController, documentRef, intent, now);
  }
  function runOperation(operation) {
    if (operation === 'JUNCTION_PRESERVATION_EXPORT') return exportJunctionDefinitionPreservation();
    return baseRunOperation.call(baseController, operation);
  }
  return Object.freeze({ ...baseController,
    schema: TOPOLOGY_JUNCTION_DEFINITION_PRESERVATION_CONTROLLER_SCHEMA,
    runOperation, exportJunctionDefinitionPreservation });
}
export const _test = Object.freeze({ selectedJunctionIntent, currentCanonical, preservationInput });
