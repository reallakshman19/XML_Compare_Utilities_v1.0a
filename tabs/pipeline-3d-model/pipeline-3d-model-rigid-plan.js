export const PIPELINE_RIGID_PLAN_SCHEMA = 'PipelineRigidPlan.v1';
export const PIPELINE_RIGID_SCHEMA = 'PipelineRigid.v1';
export const PIPELINE_ELEMENT_RIGID_SCHEMA = 'PipelineElementRigidResolution.v1';
export const PIPELINE_RIGID_TYPES = Object.freeze([
  'Flange', 'Flange Pair', 'Valve', 'Rigid',
]);

const text = (value) => String(value ?? '').trim();
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}
function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function elementRows(coordinateRows) {
  return freeze(coordinateRows.slice(1).map((toRow, index) => freeze({
    elementId: `E${index + 1}`,
    elementIndex: index,
    fromNode: positiveInteger(coordinateRows[index]?.nodeNumber),
    toNode: positiveInteger(toRow?.nodeNumber),
  })));
}
function ownerCandidates(source, elements) {
  const elementId = text(source.elementId);
  const elementIndex = Number(source.elementIndex);
  if (elementId) return elements.filter((item) => item.elementId === elementId);
  if (Number.isInteger(elementIndex) && elementIndex >= 0) {
    return elements.filter((item) => item.elementIndex === elementIndex);
  }
  const node = positiveInteger(source.node);
  return node == null ? [] : elements.filter((item) => item.toNode === node);
}
function resolveOwner(source, elements, rigidIndex, diagnostics) {
  const candidates = ownerCandidates(source, elements);
  if (candidates.length > 1) diagnostics.push(diagnostic(
    'PIPELINE_RIGID_OWNERSHIP_AMBIGUOUS',
    'A rigid node must resolve to exactly one owning PIPINGELEMENT.',
    { rigidIndex, node: source.node, elementIds: candidates.map((item) => item.elementId) },
  ));
  if (candidates.length !== 1) {
    if (!candidates.length) diagnostics.push(diagnostic(
      'PIPELINE_RIGID_OWNERSHIP_INVALID',
      'A rigid requires an existing elementId, elementIndex, or unique TO_NODE.',
      { rigidIndex, elementId: text(source.elementId), elementIndex: source.elementIndex, node: source.node },
    ));
    return null;
  }
  const owner = candidates[0];
  const node = source.node == null || source.node === '' ? owner.toNode : positiveInteger(source.node);
  if (node !== owner.toNode) {
    diagnostics.push(diagnostic('PIPELINE_RIGID_NODE_MISMATCH',
      'A rigid node must equal its owning element TO_NODE.',
      { rigidIndex, elementId: owner.elementId, node: source.node, toNode: owner.toNode }));
    return null;
  }
  return owner;
}
function normalizedType(value) {
  const key = text(value).toUpperCase().replace(/[\s_-]+/g, ' ');
  const aliases = {
    FLANGE: 'Flange',
    FLG: 'Flange',
    'FLANGE PAIR': 'Flange Pair',
    'PAIR OF FLANGES': 'Flange Pair',
    VALVE: 'Valve',
    VALV: 'Valve',
    RIGID: 'Rigid',
    'RIGID ELEMENT': 'Rigid',
  };
  return aliases[key] || '';
}
function normalizedRigid(source, owner, rigidIndex, diagnostics) {
  const type = normalizedType(source.type ?? source.rigidType);
  const rawWeight = source.weight ?? source.weightKg;
  const weight = rawWeight === null || rawWeight === undefined || rawWeight === ''
    ? null : Number(rawWeight);
  if (!type) diagnostics.push(diagnostic('PIPELINE_RIGID_TYPE_UNSUPPORTED',
    'A rigid type must resolve to Flange, Flange Pair, Valve, or Rigid.',
    { rigidIndex, elementId: owner.elementId, type: source.type ?? source.rigidType }));
  if (!Number.isFinite(weight) || weight < 0) diagnostics.push(diagnostic(
    'PIPELINE_RIGID_WEIGHT_INVALID',
    'A rigid requires a finite non-negative WEIGHT.',
    { rigidIndex, elementId: owner.elementId, weight: rawWeight },
  ));
  return freeze({
    schema: PIPELINE_RIGID_SCHEMA,
    rigidIndex,
    elementId: owner.elementId,
    elementIndex: owner.elementIndex,
    node: owner.toNode,
    weight: Number.isFinite(weight) && weight >= 0 ? weight : null,
    type,
    valid: Boolean(type) && Number.isFinite(weight) && weight >= 0,
  });
}
function elementResolution(element, items, diagnostics) {
  if (items.length > 1) diagnostics.push(diagnostic(
    'PIPELINE_RIGID_DUPLICATE',
    'A PIPINGELEMENT may own at most one RIGID child.',
    { elementId: element.elementId, rigidIndexes: items.map((item) => item.rigidIndex) },
  ));
  return freeze({
    schema: PIPELINE_ELEMENT_RIGID_SCHEMA,
    elementId: element.elementId,
    elementIndex: element.elementIndex,
    toNode: element.toNode,
    rigid: items.length === 1 ? items[0] : null,
  });
}
export function resolvePipelineRigidPlan({ rigids = [], coordinateRows = [] } = {}) {
  const diagnostics = [], elements = elementRows(coordinateRows), normalized = [];
  rigids.forEach((source, rigidIndex) => {
    const owner = resolveOwner(source || {}, elements, rigidIndex, diagnostics);
    if (owner) normalized.push(normalizedRigid(source || {}, owner, rigidIndex, diagnostics));
  });
  const resolutions = freeze(elements.map((element) => elementResolution(element,
    normalized.filter((item) => item.elementId === element.elementId), diagnostics)));
  const frozenDiagnostics = freeze(diagnostics);
  return freeze({
    schema: PIPELINE_RIGID_PLAN_SCHEMA,
    active: rigids.length > 0,
    supportedTypes: PIPELINE_RIGID_TYPES,
    rigidCount: resolutions.filter((item) => item.rigid != null).length,
    elements: resolutions,
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0,
  });
}
export const buildPipelineRigidPlanJson = (plan) => JSON.stringify(plan, null, 2);
