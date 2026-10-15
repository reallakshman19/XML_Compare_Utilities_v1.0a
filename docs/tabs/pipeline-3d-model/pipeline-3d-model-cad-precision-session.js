import {
  editTable2NodeCommand,
  editTable3DepthCommand,
  editTable3MarkerCommand,
} from './pipeline-3d-model-cad-commands.js';
import {
  precisionCanvasValues,
  precisionCommandReason,
  precisionMoveDetail,
  readPipelineCadPrecisionBefore,
  resultForPrecisionSession,
  stagePipelineCadPrecisionEdit,
} from './pipeline-3d-model-cad-precision-adapters.js';

let sessionSequence = 0;

function commandFor(controller, session) {
  if (session.graph === 'table2x') return editTable2NodeCommand(controller.model, session.entityId, session.staged);
  if (session.entityType === 'marker') return editTable3MarkerCommand(controller.model, session.entityId, session.staged);
  return editTable3DepthCommand(controller.model, session.entityId, session.staged);
}

function previewPoint(session, graph) {
  if (session.graph === 'table2x') return { x: session.staged.station, y: session.staged.elevation };
  if (session.entityType === 'marker') return { x: session.staged.cumulative, y: graph.markerRailY, label: session.staged.label };
  return { x: session.staged.cumulative, y: session.staged.z };
}

function previewDetail(session) {
  return Object.freeze({
    graph: session.graph,
    entityId: session.entityId,
    entityType: session.entityType,
    before: precisionCanvasValues(session, session.before),
    after: precisionCanvasValues(session, session.staged),
    source: session.source,
  });
}

class PipelineCadPrecisionSessions {
  constructor(controller, graphs) {
    this.controller = controller;
    this.graphs = graphs;
    this.identity = null;
    this.before = null;
    this.session = null;
  }

  graph() {
    return this.identity ? this.graphs[this.identity.graph] : null;
  }

  clearPreview(reason = null) {
    const graph = this.graph();
    if (!graph) return;
    graph.clearPrecisionPreview?.();
    if (reason) graph.dispatchGraphEvent?.('interactionCancelled', { graph: this.identity.graph, reason });
  }

  begin(nextIdentity, source = 'typed') {
    if (this.identity) {
      this.clearPreview();
      const changed = this.identity.graph !== nextIdentity.graph || this.identity.entityId !== nextIdentity.entityId;
      if (changed) this.graph()?.setPrecisionGrip?.(null);
    }
    this.identity = Object.freeze({ ...nextIdentity, source });
    this.before = readPipelineCadPrecisionBefore(this.controller.model, this.identity);
    this.session = null;
    this.graph()?.setPrecisionGrip?.(this.identity.entityId);
    return Object.freeze({ identity: this.identity, before: this.before });
  }

  stage(fields, source = this.identity?.source || 'typed') {
    if (!this.identity) throw new Error('Select an entity before precision editing.');
    const revision = this.session?.sourceRevision ?? this.controller.model.revision;
    if (this.controller.model.revision !== revision) this.session = null;
    this.session = stagePipelineCadPrecisionEdit({
      model: this.controller.model,
      identity: this.identity,
      fields,
      source,
      sessionId: `pcad-precision-${++sessionSequence}`,
    });
    const graph = this.graphs[this.session.graph];
    graph.setPrecisionPreview?.(this.session.entityId, previewPoint(this.session, graph));
    graph.dispatchGraphEvent?.('nodePreviewMoved', previewDetail(this.session));
    return this.session;
  }

  commit() {
    if (!this.session) throw new Error('No valid staged precision edit is available.');
    if (this.controller.model.revision !== this.session.sourceRevision) {
      throw new Error('The model changed; reopen the precision editor.');
    }
    const detail = precisionMoveDetail(this.session);
    this.controller.canvasManager?.captureCommit?.(detail);
    this.controller.execute(commandFor(this.controller, this.session), precisionCommandReason(this.session));
    const result = resultForPrecisionSession(this.session);
    this.graphs[this.session.graph].clearPrecisionPreview?.();
    this.before = result.after;
    this.session = null;
    return result;
  }

  cancel(reason = 'precision-cancel') {
    this.clearPreview(reason);
    this.session = null;
    return true;
  }

  refresh() {
    if (!this.identity) return null;
    this.clearPreview();
    this.session = null;
    this.before = readPipelineCadPrecisionBefore(this.controller.model, this.identity);
    return Object.freeze({ identity: this.identity, before: this.before });
  }

  reset() {
    this.clearPreview('precision-reset');
    return this.refresh();
  }

  close() {
    this.clearPreview('precision-close');
    this.graph()?.setPrecisionGrip?.(null);
    this.identity = null;
    this.before = null;
    this.session = null;
  }
}

export function createPipelineCadPrecisionSessionController(options = {}) {
  const { controller, graphs } = options;
  if (!controller || !graphs?.table2x || !graphs?.table3x) {
    throw new TypeError('Precision sessions require controller and both graphs.');
  }
  return new PipelineCadPrecisionSessions(controller, graphs);
}

export const _test = Object.freeze({ commandFor, previewPoint, previewDetail });
