/**
 * contracts.js — versioned data contracts for the 3D Data Compare Workbench.
 *
 * Core rule: the 3D viewer never matches; the matcher never renders; the
 * transfer planner never mutates XML; the exporter applies approved plans only.
 * Every stage communicates through the contracts defined here.
 */

export const CONTRACT_VERSIONS = Object.freeze({
  CanonicalObjectGraph: 'CanonicalObjectGraph.v1',
  VisualGeometryModel: 'VisualGeometryModel.v1',
  MatchCandidate: 'MatchCandidate.v1',
  ObjectDiff: 'ObjectDiff.v1',
  TransferPlan: 'TransferPlan.v1',
  ConflictLedger: 'ConflictLedger.v1',
  ManualOverrideLedger: 'ManualOverrideLedger.v1',
  RegistrationAudit: 'RegistrationAudit.v1',
  CompareAudit: 'CompareAudit.v1',
  ViewerStateSnapshot: 'ViewerStateSnapshot.v1',
  ViewerNavigationState: 'ViewerNavigationState.v1',
  RollbackLedger: 'RollbackLedger.v1',
  BenchmarkResult: 'BenchmarkResult.v1',
  GeometryBufferStore: 'GeometryBufferStore.v1',
  ConnectorModel: 'ConnectorModel.v1',
  DrilldownContext: 'DrilldownContext.v1',
});

/** Widget types that may emit a drill-down context (vision doc D2/D5). */
export const DRILLDOWN_WIDGET_TYPES = Object.freeze([
  'KPI_CARD', 'NODE_MARKER', 'HEATMAP_CELL', 'FLOW_LINK', 'GRAPH_NODE',
  'MATRIX_CELL', 'PIVOT_CELL', 'ALERT', 'EXCEPTION_CARD',
]);

export const DRILLDOWN_DOMAINS = Object.freeze(['XML_ELEMENT', 'NODE_SUPPORT', 'GENERIC_NODE']);

/**
 * Connector classes — first-class audit-linked visual objects.
 * Connectors are hidden by default; the viewer shows them only per mode,
 * hover, selection, conflict review, transfer preview, or registration audit.
 */
export const CONNECTOR_TYPES = Object.freeze({
  BASIS_CONNECTOR: 'BASIS_CONNECTOR',
  MATCH_CONNECTOR: 'MATCH_CONNECTOR',
  CANDIDATE_CONNECTOR: 'CANDIDATE_CONNECTOR',
  CONFLICT_CONNECTOR: 'CONFLICT_CONNECTOR',
  TRANSFER_CONNECTOR: 'TRANSFER_CONNECTOR',
  REGISTRATION_ANCHOR_CONNECTOR: 'REGISTRATION_ANCHOR_CONNECTOR',
});

/** Diff statuses — the only vocabulary the viewer and dashboard understand. */
export const DIFF_STATUS = Object.freeze({
  MATCHED_UNCHANGED: 'MATCHED_UNCHANGED',
  PROPERTY_CHANGED: 'PROPERTY_CHANGED',
  GEOMETRY_CHANGED: 'GEOMETRY_CHANGED',
  MISSING_IN_TARGET: 'MISSING_IN_TARGET',
  NEW_IN_TARGET: 'NEW_IN_TARGET',
  AMBIGUOUS: 'AMBIGUOUS',
  SPLIT: 'SPLIT',
  MERGE: 'MERGE',
  CONSUMED: 'CONSUMED',
  CONFLICT: 'CONFLICT',
});

export const PATH_OPS = Object.freeze({
  MATCH: 'MATCH',
  INSERT_TARGET: 'INSERT_TARGET',
  DELETE_SOURCE: 'DELETE_SOURCE',
  SPLIT: 'SPLIT',
  MERGE: 'MERGE',
  POSSIBLE_MATCH: 'POSSIBLE_MATCH',
  AMBIGUOUS: 'AMBIGUOUS',
});

export const CONFIDENCE = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'NONE' });

export const TRANSFER_RULES = Object.freeze({
  FILL_BLANK_ONLY: 'FILL_BLANK_ONLY',
  OVERWRITE: 'OVERWRITE',
  APPEND: 'APPEND',
  CREATE_NEW_PROPERTY: 'CREATE_NEW_PROPERTY',
});

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  BLOCKED: 'BLOCKED',
});

/** Geometry fields that must never transfer unless the explicit flag is on. */
export const GEOMETRY_PROTECTED_FIELDS = Object.freeze([
  'FROM_NODE', 'TO_NODE', 'DELTA_X', 'DELTA_Y', 'DELTA_Z',
]);

function fail(errors, message) {
  errors.push(message);
  return errors;
}

/** CanonicalObjectGraph.v1 validator — the parse/canonicalize output contract. */
export function validateCanonicalObjectGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object') return fail(errors, 'graph missing');
  if (graph.contract !== CONTRACT_VERSIONS.CanonicalObjectGraph) fail(errors, `contract must be ${CONTRACT_VERSIONS.CanonicalObjectGraph}`);
  if (!graph.modelId) fail(errors, 'modelId required');
  if (!Array.isArray(graph.objects)) fail(errors, 'objects[] required');
  const ids = new Set();
  for (const obj of graph.objects ?? []) {
    if (!obj.objectId) { fail(errors, 'object missing objectId'); continue; }
    if (ids.has(obj.objectId)) fail(errors, `duplicate objectId ${obj.objectId}`);
    ids.add(obj.objectId);
    if (!obj.kind) fail(errors, `object ${obj.objectId} missing kind`);
  }
  if (!Array.isArray(graph.nodes)) fail(errors, 'nodes[] required');
  if (!Array.isArray(graph.paths)) fail(errors, 'paths[] required');
  for (const path of graph.paths ?? []) {
    for (const objectId of path.elementIds ?? []) {
      if (!ids.has(objectId)) fail(errors, `path ${path.pathId} references unknown object ${objectId}`);
    }
  }
  return errors;
}

/** VisualGeometryModel.v1 validator — the only thing the viewer renders. */
export function validateVisualGeometryModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') return fail(errors, 'model missing');
  if (model.contract !== CONTRACT_VERSIONS.VisualGeometryModel) fail(errors, `contract must be ${CONTRACT_VERSIONS.VisualGeometryModel}`);
  if (!model.modelId) fail(errors, 'modelId required');
  if (!Array.isArray(model.segments)) fail(errors, 'segments[] required');
  for (const seg of model.segments ?? []) {
    if (!seg.objectId) fail(errors, 'segment missing objectId');
    if (!Array.isArray(seg.start) || seg.start.length !== 3) fail(errors, `segment ${seg.objectId} bad start`);
    if (!Array.isArray(seg.end) || seg.end.length !== 3) fail(errors, `segment ${seg.objectId} bad end`);
  }
  if (!Array.isArray(model.markers)) fail(errors, 'markers[] required');
  return errors;
}

/**
 * CompareAudit.v1 validator — cross-reference integrity.
 * Every diff/conflict/transfer row must reference known object ids and the
 * ledgers must not contain orphan references.
 */
export function validateCompareAudit(audit) {
  const errors = [];
  if (!audit || typeof audit !== 'object') return fail(errors, 'audit missing');
  if (audit.contract !== CONTRACT_VERSIONS.CompareAudit) fail(errors, `contract must be ${CONTRACT_VERSIONS.CompareAudit}`);
  const sourceIds = new Set(audit.sourceObjectIds ?? []);
  const targetIds = new Set(audit.targetObjectIds ?? []);
  const diffIds = new Set();
  for (const row of audit.objectDiff?.rows ?? []) {
    if (!row.diffId) { fail(errors, 'diff row missing diffId'); continue; }
    if (diffIds.has(row.diffId)) fail(errors, `duplicate diffId ${row.diffId}`);
    diffIds.add(row.diffId);
    if (row.sourceObjectId && !sourceIds.has(row.sourceObjectId)) fail(errors, `diff ${row.diffId} orphan source ${row.sourceObjectId}`);
    if (row.targetObjectId && !targetIds.has(row.targetObjectId)) fail(errors, `diff ${row.diffId} orphan target ${row.targetObjectId}`);
    if (!Object.values(DIFF_STATUS).includes(row.status)) fail(errors, `diff ${row.diffId} unknown status ${row.status}`);
  }
  for (const row of audit.conflictLedger?.rows ?? []) {
    if (row.diffId && !diffIds.has(row.diffId)) fail(errors, `conflict ${row.conflictId} orphan diffId ${row.diffId}`);
  }
  for (const row of audit.transferPlan?.rows ?? []) {
    if (row.diffId && !diffIds.has(row.diffId)) fail(errors, `transfer ${row.rowId} orphan diffId ${row.diffId}`);
    if (row.targetObjectId && !targetIds.has(row.targetObjectId)) fail(errors, `transfer ${row.rowId} orphan target ${row.targetObjectId}`);
  }
  return errors;
}

/**
 * GeometryBufferStore.v1 validator — typed-array geometry kept OUTSIDE the
 * JSON contracts (positions are Float32Array, never serialized into audits).
 */
export function validateGeometryBufferStore(store) {
  const errors = [];
  if (!store || typeof store !== 'object') return fail(errors, 'store missing');
  if (store.contract !== CONTRACT_VERSIONS.GeometryBufferStore) fail(errors, `contract must be ${CONTRACT_VERSIONS.GeometryBufferStore}`);
  if (!store.modelId) fail(errors, 'modelId required');
  if (!(store.positions instanceof Float32Array)) fail(errors, 'positions must be a Float32Array');
  if (!Array.isArray(store.objectIdByIndex)) fail(errors, 'objectIdByIndex[] required');
  if (store.positions && store.objectIdByIndex && store.positions.length !== store.objectIdByIndex.length * 6) {
    fail(errors, `positions length ${store.positions.length} must be 6 × segment count ${store.objectIdByIndex.length}`);
  }
  return errors;
}

/** ViewerStateSnapshot.v1 validator — serializable viewer state. */
export function validateViewerStateSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') return fail(errors, 'snapshot missing');
  if (snapshot.contract !== CONTRACT_VERSIONS.ViewerStateSnapshot) fail(errors, `contract must be ${CONTRACT_VERSIONS.ViewerStateSnapshot}`);
  for (const key of ['cameraPosition', 'cameraTarget']) {
    if (!Array.isArray(snapshot[key]) || snapshot[key].length !== 3 || snapshot[key].some((v) => !Number.isFinite(v))) {
      fail(errors, `${key} must be [x,y,z] finite numbers`);
    }
  }
  if (!['overlay', 'side-by-side', 'diff-only'].includes(snapshot.mode)) fail(errors, `unknown mode ${snapshot.mode}`);
  if (!Array.isArray(snapshot.statusFilter)) fail(errors, 'statusFilter[] required');
  return errors;
}

/** ViewerNavigationState.v1 validator for world-space camera restoration. */
export function validateViewerNavigationState(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') return fail(errors, 'navigation state missing');
  if (snapshot.contract !== CONTRACT_VERSIONS.ViewerNavigationState) fail(errors, `contract must be ${CONTRACT_VERSIONS.ViewerNavigationState}`);
  for (const key of ['cameraPositionWorld', 'cameraTargetWorld']) {
    if (!Array.isArray(snapshot[key]) || snapshot[key].length !== 3 || snapshot[key].some((value) => !Number.isFinite(value))) {
      fail(errors, `${key} must be [x,y,z] finite numbers`);
    }
  }
  if (snapshot.pivotWorld !== null && (!Array.isArray(snapshot.pivotWorld)
    || snapshot.pivotWorld.length !== 3 || snapshot.pivotWorld.some((value) => !Number.isFinite(value)))) {
    fail(errors, 'pivotWorld must be null or [x,y,z] finite numbers');
  }
  if (!['Perspective', 'Orthographic'].includes(snapshot.cameraType)) fail(errors, `unknown cameraType ${snapshot.cameraType}`);
  if (!['Y', 'Z'].includes(snapshot.verticalAxis)) fail(errors, `unknown verticalAxis ${snapshot.verticalAxis}`);
  if (!Number.isFinite(snapshot.projectionScale) || snapshot.projectionScale <= 0) fail(errors, 'projectionScale must be positive');
  if (errors.length === 0) {
    const distance = Math.hypot(...snapshot.cameraPositionWorld.map((value, axis) => value - snapshot.cameraTargetWorld[axis]));
    if (distance < 0.01) fail(errors, 'camera target distance must be at least 0.01');
  }
  return errors;
}

/** BenchmarkResult.v1 validator. */
export function validateBenchmarkResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object') return fail(errors, 'result missing');
  if (result.contract !== CONTRACT_VERSIONS.BenchmarkResult) fail(errors, `contract must be ${CONTRACT_VERSIONS.BenchmarkResult}`);
  if (!result.name) fail(errors, 'name required');
  if (!result.metrics || typeof result.metrics !== 'object') fail(errors, 'metrics{} required');
  if (!Array.isArray(result.assertions) || !result.assertions.length) fail(errors, 'assertions[] required');
  for (const assertion of result.assertions ?? []) {
    if (!assertion.id) fail(errors, 'assertion missing id');
    if (typeof assertion.pass !== 'boolean') fail(errors, `assertion ${assertion.id} missing boolean pass`);
  }
  return errors;
}

/**
 * DrilldownContext.v1 validator — the universal click object.
 * Every visual widget emits this instead of opening its own popup.
 */
export function validateDrilldownContext(context) {
  const errors = [];
  if (!context || typeof context !== 'object') return fail(errors, 'context missing');
  if (context.contract !== CONTRACT_VERSIONS.DrilldownContext) fail(errors, `contract must be ${CONTRACT_VERSIONS.DrilldownContext}`);
  if (!DRILLDOWN_WIDGET_TYPES.includes(context.widgetType)) fail(errors, `unknown widgetType ${context.widgetType}`);
  if (!DRILLDOWN_DOMAINS.includes(context.domain)) fail(errors, `unknown domain ${context.domain}`);
  if (!context.title) fail(errors, 'title required');
  if (!context.filter || typeof context.filter !== 'object') fail(errors, 'filter{} required');
  for (const key of ['status', 'confidence', 'severity', 'objectIds', 'diffIds']) {
    if (context.filter[key] !== undefined && !Array.isArray(context.filter[key])) fail(errors, `filter.${key} must be an array`);
  }
  return errors;
}

/** TransferPlan.v1 validator. */
export function validateTransferPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return fail(errors, 'plan missing');
  if (plan.contract !== CONTRACT_VERSIONS.TransferPlan) fail(errors, `contract must be ${CONTRACT_VERSIONS.TransferPlan}`);
  const rowIds = new Set();
  for (const row of plan.rows ?? []) {
    if (!row.rowId) { fail(errors, 'transfer row missing rowId'); continue; }
    if (rowIds.has(row.rowId)) fail(errors, `duplicate transfer rowId ${row.rowId}`);
    rowIds.add(row.rowId);
    if (!row.property) fail(errors, `transfer ${row.rowId} missing property`);
    if (!Object.values(APPROVAL_STATUS).includes(row.approval)) fail(errors, `transfer ${row.rowId} bad approval ${row.approval}`);
    if (!Object.values(TRANSFER_RULES).includes(row.rule)) fail(errors, `transfer ${row.rowId} bad rule ${row.rule}`);
    if (GEOMETRY_PROTECTED_FIELDS.includes(String(row.property).toUpperCase()) && !plan.config?.allowGeometryTransfer && row.approval === APPROVAL_STATUS.APPROVED) {
      fail(errors, `transfer ${row.rowId} approves protected geometry field ${row.property}`);
    }
  }
  return errors;
}
