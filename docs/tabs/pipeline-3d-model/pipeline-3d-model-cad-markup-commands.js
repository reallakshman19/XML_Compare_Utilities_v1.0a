import { CommandHistory, SnapshotCommand } from './pipeline-3d-model-cad-commands.js';
import {
  createPipelineCadMarkupDocument,
  parsePipelineCadMarkupDocument,
  serializePipelineCadMarkupDocument,
} from './pipeline-3d-model-cad-markup-contracts.js';
import { createPipelineCadMarkupModel } from './pipeline-3d-model-cad-markup-model.js';
import {
  buildPipelineCadMarkupEntityIndex,
  reconcilePipelineCadMarkupDocument,
} from './pipeline-3d-model-cad-markup-reconciliation.js';
import {
  buildPipelineCadMarkupProjection,
  emptyPipelineCadMarkupProjection,
} from './pipeline-3d-model-cad-markup-renderer.js';

function command(model, description, mutation) {
  return new SnapshotCommand(model, description, mutation);
}
export function createPipelineCadDimensionCommand(model, payload) {
  return command(model, 'Create Pipeline CAD dimension', (target) => target.createDimension(payload));
}
export function updatePipelineCadDimensionCommand(model, id, patch) {
  return command(model, `Update Pipeline CAD dimension ${id}`, (target) => target.updateDimension(id, patch));
}
export function deletePipelineCadDimensionCommand(model, id) {
  return command(model, `Delete Pipeline CAD dimension ${id}`, (target) => target.deleteDimension(id));
}
export function createPipelineCadAnnotationCommand(model, payload) {
  return command(model, 'Create Pipeline CAD annotation', (target) => target.createAnnotation(payload));
}
export function updatePipelineCadAnnotationCommand(model, id, patch) {
  return command(model, `Update Pipeline CAD annotation ${id}`, (target) => target.updateAnnotation(id, patch));
}
export function deletePipelineCadAnnotationCommand(model, id) {
  return command(model, `Delete Pipeline CAD annotation ${id}`, (target) => target.deleteAnnotation(id));
}
export function replacePipelineCadMarkupDocumentCommand(model, document) {
  return command(model, 'Replace imported Pipeline CAD markup',
    (target) => target.replaceDocument(document, 'import'));
}
export function reconcilePipelineCadMarkupCommand(model, document) {
  return command(model, 'Reconcile Pipeline CAD markup source',
    (target) => target.replaceDocument(document, 'reconcile'));
}

function setProjection(graphs, projection) {
  graphs?.table2x?.setMarkupProjection?.(projection);
  graphs?.table3x?.setMarkupProjection?.(projection);
}
function initialDocument(getProfileModel, document) {
  const index = buildPipelineCadMarkupEntityIndex(getProfileModel());
  if (!document) return createPipelineCadMarkupDocument({ sourceFingerprint: index.sourceFingerprint });
  return reconcilePipelineCadMarkupDocument(document, index).document;
}
function rejectSharedHistory(options) {
  if (Object.hasOwn(options, 'history')) {
    throw new TypeError('Pipeline CAD markup runtime owns an independent command history.');
  }
}

export function createPipelineCadMarkupRuntime(options = {}) {
  rejectSharedHistory(options);
  const getProfileModel = typeof options.getProfileModel === 'function'
    ? options.getProfileModel : () => options.profileModel;
  if (!getProfileModel()) throw new TypeError('Pipeline CAD markup requires a current profile model.');
  const model = createPipelineCadMarkupModel(initialDocument(getProfileModel, options.initialDocument));
  const history = new CommandHistory(options.historyLimit || 100);
  const listeners = new Set(); const graphs = options.graphs || {};
  let destroyed = false; let report = null; let projection = null;

  function assertActive() {
    if (destroyed) throw new Error('Pipeline CAD markup runtime is destroyed.');
  }
  const publish = (reason) => {
    projection = buildPipelineCadMarkupProjection(model.getDocument(), graphs);
    setProjection(graphs, projection);
    const detail = Object.freeze({
      reason, document: model.getDocument(), evidence: projection.evidence, report,
    });
    listeners.forEach((listener) => listener(detail)); options.onPublish?.(detail); return detail;
  };
  const onHistory = (event) => publish(event.detail?.action || 'history');
  history.addEventListener('historyChanged', onHistory); publish('mount');
  const execute = (next) => {
    assertActive(); history.execute(next); return model.getDocument();
  };
  const reconcile = () => {
    assertActive();
    const result = reconcilePipelineCadMarkupDocument(model.getDocument(), getProfileModel());
    report = result.report;
    if (!result.report.changed) return false;
    execute(reconcilePipelineCadMarkupCommand(model, result.document)); return report;
  };
  const undo = () => { assertActive(); return history.undo(); };
  const redo = () => { assertActive(); return history.redo(); };

  return Object.freeze({
    getDocument: () => model.getDocument(),
    getEvidence: () => projection?.evidence || Object.freeze([]),
    getReconciliationReport: () => report,
    subscribe(listener) {
      assertActive();
      if (typeof listener !== 'function') throw new TypeError('Markup listener must be a function.');
      listeners.add(listener); let active = true;
      return () => { if (active) { active = false; listeners.delete(listener); } };
    },
    createDimension: (payload) => execute(createPipelineCadDimensionCommand(model, payload)),
    updateDimension: (id, patch) => execute(updatePipelineCadDimensionCommand(model, id, patch)),
    deleteDimension: (id) => execute(deletePipelineCadDimensionCommand(model, id)),
    createAnnotation: (payload) => execute(createPipelineCadAnnotationCommand(model, payload)),
    updateAnnotation: (id, patch) => execute(updatePipelineCadAnnotationCommand(model, id, patch)),
    deleteAnnotation: (id) => execute(deletePipelineCadAnnotationCommand(model, id)),
    export: () => serializePipelineCadMarkupDocument(model.getDocument()),
    import(text) {
      assertActive();
      const parsed = parsePipelineCadMarkupDocument(text);
      const result = reconcilePipelineCadMarkupDocument(parsed, getProfileModel()); report = result.report;
      return execute(replacePipelineCadMarkupDocumentCommand(model, result.document));
    },
    reconcile, undo, redo,
    get canUndo() { return destroyed ? false : history.canUndo; },
    get canRedo() { return destroyed ? false : history.canRedo; },
    destroy() {
      if (destroyed) return false; destroyed = true;
      history.removeEventListener('historyChanged', onHistory);
      listeners.clear(); setProjection(graphs, emptyPipelineCadMarkupProjection()); return true;
    },
  });
}
