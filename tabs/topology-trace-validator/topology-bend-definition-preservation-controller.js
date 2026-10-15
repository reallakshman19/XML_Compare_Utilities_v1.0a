/** Narrow controller decorator for immutable bend-definition preservation export. */
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologyBendDefinitionPreservation,
  topologyBendDefinitionPreservationFileName,
} from './topology-bend-definition-preservation.js';

export const TOPOLOGY_BEND_DEFINITION_PRESERVATION_CONTROLLER_SCHEMA =
  'TopologyBendDefinitionPreservationController.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function selectedBendIntent(evidence) {
  const rows = Array.isArray(evidence?.selection) ? evidence.selection : [];
  const bends = rows.filter((row) => row?.kind === 'bend' && String(row.id || '').trim());
  if (rows.length !== 1 || bends.length !== 1) {
    throw new RangeError('Bend preservation export requires exactly one selected bend.');
  }
  return Object.freeze({ bendId: bends[0].id });
}
function currentCanonical(evidence) {
  return evidence.editedArtifacts?.canonicalTopology
    ?? evidence.baseArtifacts?.canonicalTopology
    ?? null;
}
function preservationInput(evidence, intent, createdAt) {
  return { canonical: currentCanonical(evidence), draft: evidence.draft,
    commandAuthority: evidence.commandAuthority, projectDocument: evidence.projectDocument,
    bendId: intent.bendId, createdAt };
}
function exportPreservation(baseController, documentRef, intent, now) {
  const evidence = baseController.evidence();
  const artifact = createTopologyBendDefinitionPreservation(
    preservationInput(evidence, intent, now()),
  );
  const stem = outputStem(evidence.projectDocument?.fileName || 'topology');
  const fileName = topologyBendDefinitionPreservationFileName(artifact, stem);
  downloadText(documentRef, fileName, `${JSON.stringify(artifact, null, 2)}\n`,
    'application/json;charset=utf-8');
  return artifact;
}
export function createTopologyBendDefinitionPreservationController(baseController, options = {}) {
  const evidence = requiredFunction(baseController?.evidence, 'baseController.evidence');
  const baseRunOperation = requiredFunction(baseController?.runOperation,
    'baseController.runOperation');
  const documentRef = options.documentRef;
  if (!documentRef?.createElement) throw new TypeError('Bend preservation controller requires documentRef.');
  const now = options.now ?? (() => new Date().toISOString()); requiredFunction(now, 'now');
  function exportBendDefinitionPreservation(intent = selectedBendIntent(evidence())) {
    return exportPreservation(baseController, documentRef, intent, now);
  }
  function runOperation(operation) {
    if (operation === 'BEND_PRESERVATION_EXPORT') return exportBendDefinitionPreservation();
    return baseRunOperation.call(baseController, operation);
  }
  return Object.freeze({ ...baseController,
    schema: TOPOLOGY_BEND_DEFINITION_PRESERVATION_CONTROLLER_SCHEMA,
    runOperation, exportBendDefinitionPreservation });
}
export const _test = Object.freeze({ selectedBendIntent, currentCanonical, preservationInput });
