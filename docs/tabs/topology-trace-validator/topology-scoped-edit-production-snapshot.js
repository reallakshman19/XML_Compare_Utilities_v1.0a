/** Immutable extraction of the live accepted Topology edit authority for P4B shadow observation. */
import { immutableJson } from '../../contracts/contract-values.js';
import { loadTopologyProducerCore } from './topology-producer-loader.js';
import { producerOptions, producerSourceText } from './topology-edit-controller-helpers.js';
import {
  TOPOLOGY_COMMAND_AUTHORITY_MODE,
  createTopologyScopedEditCommandScope,
} from './topology-scoped-edit-command-scope.js';
import { asArray, cleanText, objectRecord, semanticHash } from './topology-validator-values.js';

export const TOPOLOGY_PRODUCTION_SHADOW_SNAPSHOT_V1 = 'TopologyProductionShadowSnapshot.v1';

function traceEvidence(controller) {
  return objectRecord(objectRecord(controller.evidence()).trace);
}

function editEvidence(controller) {
  return objectRecord(controller.edit.evidence());
}

function sourceRaw(controller) {
  return objectRecord(objectRecord(traceEvidence(controller).artifacts).source).raw ?? null;
}

function currentCanonical(evidence) {
  return objectRecord(evidence.editedArtifacts).canonicalTopology
    ?? objectRecord(evidence.baseArtifacts).canonicalTopology
    ?? null;
}

function entityPopulation(canonical) {
  return ['nodes', 'edges', 'supports', 'rigids', 'junctions', 'boundaries', 'bends', 'pointFeatures']
    .flatMap((key) => asArray(objectRecord(canonical)[key]).map((row) => cleanText(objectRecord(row).id)))
    .filter(Boolean);
}

function commandScopeInput(controller, root, evidence) {
  const mode = controller.modelMode(root);
  const authorityMode = mode?.kind === 'LARGE_SCOPED' || evidence.editScope
    ? TOPOLOGY_COMMAND_AUTHORITY_MODE.LARGE_SCOPED
    : TOPOLOGY_COMMAND_AUTHORITY_MODE.SMALL_FULL;
  return immutableJson({ authorityMode, editScope: evidence.editScope ?? null },
    'Topology production shadow command-scope input');
}

function selectedEntityIds(evidence, canonical, scope) {
  const population = new Set(entityPopulation(canonical));
  const selected = [...new Set(asArray(evidence.selection)
    .map((row) => cleanText(objectRecord(row).id)).filter((id) => population.has(id)))];
  const pointCollections = ['nodes', 'supports', 'junctions', 'boundaries', 'bends', 'pointFeatures'];
  const editable = new Set(scope.editableEntityIds);
  const geometric = new Set(pointCollections.flatMap((key) => asArray(objectRecord(canonical)[key]))
    .map((row) => cleanText(objectRecord(row).id)));
  const hasEditableGeometry = selected.some((id) => editable.has(id) && geometric.has(id));
  const fallback = hasEditableGeometry ? null : [...geometric].find((id) => editable.has(id));
  if (fallback) selected.push(fallback);
  return selected.sort();
}

function artifactHash(evidence, canonical) {
  return semanticHash({ editDraft: evidence.draft, canonicalTopology: canonical,
    editLedger: objectRecord(evidence.editedArtifacts).editLedger,
    editValidation: objectRecord(evidence.editedArtifacts).editValidation });
}


function selectionKey(evidence) {
  return asArray(evidence.selection).map((row) => {
    const record = objectRecord(row);
    return `${cleanText(record.kind)}:${cleanText(record.id)}`;
  }).filter((value) => !value.endsWith(':')).sort();
}

export function topologyProductionShadowSourceKey(input = {}) {
  const evidence = editEvidence(input.controller);
  const authorityId = cleanText(objectRecord(evidence.commandAuthority).authorityId);
  if (!authorityId) return '';
  return semanticHash({ authorityId, selection: selectionKey(evidence),
    editScope: evidence.editScope ?? null, modelMode: input.controller.modelMode(input.root)?.kind ?? '' });
}

function requireReady(evidence, raw, canonical) {
  const ready = raw && canonical && evidence.draft && evidence.commandJournal
    && evidence.commandAuthority && evidence.projectDocument && evidence.projectSession
    && evidence.attributeLedger && evidence.remarks;
  return Boolean(ready);
}

async function createWithCore(input, core) {
  const { controller, root } = input;
  const evidence = editEvidence(controller), raw = sourceRaw(controller), canonical = currentCanonical(evidence);
  if (!requireReady(evidence, raw, canonical)) return null;
  const trace = traceEvidence(controller), sourceText = producerSourceText(raw), options = producerOptions(trace);
  const baseCanonical = objectRecord(evidence.baseArtifacts).canonicalTopology;
  const baseDraft = core.createTopologyEditDraft(baseCanonical,
    { projection: 'XY', snapToleranceMm: Number(options.toleranceMm), showOriginal: true });
  const scopeInput = commandScopeInput(controller, root, evidence);
  const scopeBasis = createTopologyScopedEditCommandScope({ canonical, ...scopeInput });
  const authority = evidence.commandAuthority, document = evidence.projectDocument;
  const canonicalContentHash = semanticHash(canonical);
  const ancestry = immutableJson({ authorityId: authority.authorityId,
    documentId: document.documentId, sourceHash: document.sourceHash,
    draftHash: evidence.draft.topologyEditDraftHash,
    canonicalTopologyHash: canonical.canonicalTopologyHash,
    canonicalContentHash, artifactsHash: artifactHash(evidence, canonical) },
  'Topology production shadow canonical ancestry');
  return immutableJson({ schema: TOPOLOGY_PRODUCTION_SHADOW_SNAPSHOT_V1,
    authority, projectDocument: document, sessionId: evidence.projectSession.sessionId,
    sourceText, canonicalTopology: canonical, canonicalAncestry: ancestry,
    coordinateSystemEvidence: { frame: canonical.coordinateFrame?.schema,
      handedness: 'right', authority: 'CanonicalTopology.v1' },
    baseDraft, editDraft: evidence.draft, commandJournal: evidence.commandJournal,
    replayState: { draft: evidence.draft, attributeLedger: evidence.attributeLedger,
      remarks: evidence.remarks }, attributeLedger: evidence.attributeLedger, remarks: evidence.remarks,
    commandScopeInput: scopeInput, commandScopeBasis: scopeBasis,
    selectionSnapshot: { authorityId: authority.authorityId,
      entityIds: selectedEntityIds(evidence, canonical, scopeBasis) } },
  'Topology production shadow snapshot');
}

export async function createTopologyScopedEditProductionSnapshot(input = {}) {
  return createWithCore(input, await loadTopologyProducerCore());
}

export const _test = Object.freeze({ createWithCore, entityPopulation, selectedEntityIds, artifactHash, selectionKey });
