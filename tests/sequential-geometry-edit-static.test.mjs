import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function source(relative) {
  return readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
}
const paths = [
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-journal.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-history.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-history-service.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-history-feature.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-projection.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-effective-geometry-read-model.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-application.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-application-panel.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-feature.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js',
  'tabs/sequential-sketcher/sequential-sketcher-tab.js',
];
const sources = Object.fromEntries(paths.map((path) => [path, source(path)]));
for (const [path, value] of Object.entries(sources)) {
  assert(value.split(/\r?\n/).length - 1 <= 300, `${path} must remain at or below 300 lines`);
  assert.doesNotMatch(value, /export\s+default|module\.exports|exports\./);
}
const [journalPath, historyPath, historyServicePath, historyFeaturePath,
  projectionPath, effectivePath, boundaryPath, applicationPath, panelPath,
  readModelPath, sceneAdapterPath, topologyPath, targetPath, featurePath,
  controllerPath, tabPath] = paths;
const journal = sources[journalPath];
const history = sources[historyPath];
const historyService = sources[historyServicePath];
const historyFeature = sources[historyFeaturePath];
const projection = sources[projectionPath];
const effective = sources[effectivePath];
const boundary = sources[boundaryPath];
const application = sources[applicationPath];
const panel = sources[panelPath];
const readModel = sources[readModelPath];
const sceneAdapter = sources[sceneAdapterPath];
const topology = sources[topologyPath];
const target = sources[targetPath];
const feature = sources[featurePath];
const controller = sources[controllerPath];
const tab = sources[tabPath];
const index = source('tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-index.js');
assert.match(journal, /SequentialGeometryEditJournal\.v1/);
assert.match(journal, /previousHeadFingerprint/);
assert.match(journal, /OPERATION_REPLAY/);
assert.match(journal, /before\/after identity sets must match/);
assert.match(history, /SequentialGeometryEditHistory\.v1/);
assert.match(history, /entries\.slice\(0, selectedCursor\)/);
assert.match(history, /GEOMETRY_HISTORY_TRANSITION_REPLAY/);
assert.match(history, /cursor: history\.cursor [+-] 1/);
assert.match(historyService, /expectedHistoryFingerprint/);
assert.match(historyService, /expectedActiveHeadFingerprint/);
assert.match(historyService, /independent current-state regeneration/);
assert.match(historyFeature, /Undo geometry/);
assert.match(historyFeature, /Redo geometry/);
assert.match(historyFeature, /undoBlockedReason/);
assert.match(projection, /applySequentialGeometryEditJournalToScene/);
assert.match(projection, /applySequentialGeometryEditJournalToTopology/);
assert.match(projection, /node is stale or shared/);
assert.match(effective, /SequentialEffectiveGeometryReadModel\.v1/);
assert.match(effective, /geometryEditJournalHeadFingerprint/);
assert.match(boundary, /consumedByBranch/);
assert.match(boundary, /Prepared geometry edit has already been consumed/);
assert.match(boundary, /publishHistoryCandidate/);
assert.match(boundary, /geometryEditHistoryCursor/);
assert.match(application, /PREVIEW_ONLY_RIGID_TRANSLATION_CLEAR|aggregateDisposition !== 'PRESERVED'/);
assert.match(application, /publicationState: 'NOT_PUBLISHED'/);
assert.match(application, /publicationState: 'COMMITTED'/);
assert.match(panel, /Prepare move/);
assert.match(panel, /Apply prepared/);
assert.match(panel, /Actor/);
assert.match(readModel, /isSequentialEffectiveGeometryReadModel/);
assert.match(sceneAdapter, /applySequentialGeometryEditJournalToScene/);
assert.match(topology, /createEffectiveSnapshot/);
assert.match(target, /supportAttachmentIds/);
assert.match(target, /componentNodeIds/);
assert.match(feature, /createSequentialSingleEntityMoveApplicationService/);
assert.match(feature, /geometryEditBoundary/);
assert.match(controller, /state\.geometryEditBoundary\.readView\(\)/);
assert.match(controller, /geometryMoveAppliedAtProvider/);
assert.match(tab, /createSequentialGeometryEditBoundary/);
assert(tab.indexOf('draftEdit3dController?.destroy()')
  < tab.indexOf('geometryEditBoundary?.destroy()'));
assert(tab.indexOf('geometryEditBoundary?.destroy()')
  < tab.indexOf('supportAdjustmentBoundary?.destroy()'));
for (const moduleName of [
  'sequential-geometry-edit-journal', 'sequential-geometry-edit-projection',
  'sequential-effective-geometry-read-model', 'sequential-geometry-edit-boundary',
  'sequential-single-entity-move-application',
  'sequential-single-entity-move-application-panel',
]) assert.match(index, new RegExp(moduleName));
for (const value of [journal, history, historyService, historyFeature, projection,
  effective, boundary, application, panel]) {
  assert.doesNotMatch(value,
    /localStorage|sessionStorage|indexedDB|restorePackage|commandGateway|transactionLedger|undoStack|redoStack/);
}
assert.doesNotMatch(application, /createSequentialCommandService|applyConstructionDecision/);
assert.doesNotMatch(boundary, /writer|canvas|exportPackage|download/);
console.log('Sequential SSK-TS-3N geometry edit containment: ok');