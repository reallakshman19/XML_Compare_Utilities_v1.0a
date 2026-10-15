export const PIPELINE_RESTRAINT_PLAN_SCHEMA = 'PipelineRestraintPlan.v1';
export const PIPELINE_RESTRAINT_SCHEMA = 'PipelineRestraint.v1';
export const PIPELINE_RESTRAINT_SLOT_SCHEMA = 'PipelineRestraintSlot.v1';
export const PIPELINE_ELEMENT_RESTRAINT_SCHEMA = 'PipelineElementRestraintResolution.v1';
export const PIPELINE_RESTRAINT_SLOT_COUNT = 6;

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
function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function optionalScalar(source, keys) {
  for (const key of keys) if (Object.hasOwn(source, key)) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === '') return { present: false, valid: true, value: null };
    const value = finite(raw);
    return { present: true, valid: value != null, value };
  }
  return { present: false, valid: true, value: null };
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
function resolveOwner(source, elements, restraintIndex, diagnostics) {
  const candidates = ownerCandidates(source, elements);
  if (candidates.length > 1) diagnostics.push(diagnostic(
    'PIPELINE_RESTRAINT_OWNERSHIP_AMBIGUOUS',
    'A restraint node must resolve to exactly one owning PIPINGELEMENT.',
    { restraintIndex, node: source.node, elementIds: candidates.map((item) => item.elementId) },
  ));
  if (candidates.length !== 1) {
    if (!candidates.length) diagnostics.push(diagnostic(
      'PIPELINE_RESTRAINT_OWNERSHIP_INVALID',
      'A restraint requires an existing elementId, elementIndex, or unique TO_NODE.',
      { restraintIndex, elementId: text(source.elementId), elementIndex: source.elementIndex, node: source.node },
    ));
    return null;
  }
  const owner = candidates[0], node = source.node == null || source.node === ''
    ? owner.toNode : positiveInteger(source.node);
  if (node !== owner.toNode) {
    diagnostics.push(diagnostic('PIPELINE_RESTRAINT_NODE_MISMATCH',
      'A restraint node must equal its owning element TO_NODE.',
      { restraintIndex, elementId: owner.elementId, node: source.node, toNode: owner.toNode }));
    return null;
  }
  return owner;
}
function validScalar(value, domain) {
  if (value == null) return true;
  if (domain === 'positive') return value > 0;
  if (domain === 'nonNegative') return value >= 0;
  if (domain === 'cosine') return value >= -1 && value <= 1;
  return true;
}
function normalizedRestraint(source, owner, restraintIndex, diagnostics) {
  const type = Number(source.type ?? source.typeCode);
  const stiffnessValue = optionalScalar(source, ['stiffness']);
  const gapValue = optionalScalar(source, ['gap']);
  const frictionValue = optionalScalar(source,
    ['frictionCoefficient', 'fricCoef', 'fricCoefficient', 'friction']);
  const cnodeSupplied = source.cnode != null && source.cnode !== '';
  const cnode = cnodeSupplied ? positiveInteger(source.cnode) : null;
  const direction = source.directionCosines || source.cosines || {};
  const directionSource = { ...direction, ...source };
  const xValue = optionalScalar(directionSource, ['xCosine', 'x', 'xcosine']);
  const yValue = optionalScalar(directionSource, ['yCosine', 'y', 'ycosine']);
  const zValue = optionalScalar(directionSource, ['zCosine', 'z', 'zcosine']);
  const stiffness = stiffnessValue.value, gap = gapValue.value;
  const frictionCoefficient = frictionValue.value;
  const xCosine = xValue.present ? xValue.value : 0;
  const yCosine = yValue.present ? yValue.value : 0;
  const zCosine = zValue.present ? zValue.value : 0;
  const valuesValid = Number.isInteger(type) && type !== 0
    && stiffnessValue.valid && gapValue.valid && frictionValue.valid
    && [xValue, yValue, zValue].every((item) => item.valid)
    && validScalar(stiffness, 'positive') && validScalar(gap, 'nonNegative')
    && validScalar(frictionCoefficient, 'nonNegative') && (!cnodeSupplied || cnode != null)
    && [xCosine, yCosine, zCosine].every((value) => validScalar(value, 'cosine'));
  if (!valuesValid) diagnostics.push(diagnostic('PIPELINE_RESTRAINT_VALUE_INVALID',
    'A restraint contains an invalid type, stiffness, gap, friction, CNode, or direction cosine.',
    { restraintIndex, elementId: owner.elementId }));
  return freeze({
    schema: PIPELINE_RESTRAINT_SCHEMA,
    restraintIndex,
    elementId: owner.elementId,
    elementIndex: owner.elementIndex,
    node: owner.toNode,
    type: Number.isInteger(type) ? type : null,
    stiffness,
    gap,
    frictionCoefficient,
    cnode,
    xCosine,
    yCosine,
    zCosine,
    tag: text(source.tag),
    guid: text(source.guid),
    requestedSlot: source.slot ?? source.num ?? null,
    valid: valuesValid,
  });
}
function assignSlots(items, elementId, diagnostics) {
  const slots = new Map();
  for (const item of items) {
    let slot = item.requestedSlot == null || item.requestedSlot === ''
      ? null : positiveInteger(item.requestedSlot);
    if (slot != null && slot > PIPELINE_RESTRAINT_SLOT_COUNT) slot = null;
    if (item.requestedSlot != null && item.requestedSlot !== '' && slot == null) {
      diagnostics.push(diagnostic('PIPELINE_RESTRAINT_SLOT_INVALID',
        'A restraint slot must be an integer from 1 through 6.',
        { elementId, restraintIndex: item.restraintIndex, slot: item.requestedSlot }));
      continue;
    }
    if (slot == null) {
      slot = Array.from({ length: PIPELINE_RESTRAINT_SLOT_COUNT }, (_, index) => index + 1)
        .find((candidate) => !slots.has(candidate)) ?? null;
    }
    if (slot == null) {
      diagnostics.push(diagnostic('PIPELINE_RESTRAINT_SLOT_LIMIT_EXCEEDED',
        'A PIPINGELEMENT may own at most six restraints.', { elementId }));
      continue;
    }
    if (slots.has(slot)) {
      diagnostics.push(diagnostic('PIPELINE_RESTRAINT_SLOT_DUPLICATE',
        'A PIPINGELEMENT cannot contain duplicate restraint slot numbers.',
        { elementId, slot, restraintIndexes: [slots.get(slot).restraintIndex, item.restraintIndex] }));
      continue;
    }
    slots.set(slot, freeze({ ...item, slot }));
  }
  return slots;
}
function placeholder(element, slot) {
  return freeze({
    schema: PIPELINE_RESTRAINT_SLOT_SCHEMA,
    elementId: element.elementId,
    elementIndex: element.elementIndex,
    slot,
    placeholder: true,
    node: null,
    type: null,
    stiffness: null,
    gap: null,
    frictionCoefficient: null,
    cnode: null,
    xCosine: 0,
    yCosine: 0,
    zCosine: 0,
    tag: '',
    guid: '',
  });
}
function elementResolution(element, items, diagnostics) {
  const assigned = assignSlots(items, element.elementId, diagnostics);
  const realRestraints = [...assigned.values()].sort((left, right) => left.slot - right.slot)
    .map((item) => freeze({ ...item, schema: PIPELINE_RESTRAINT_SLOT_SCHEMA, placeholder: false }));
  const slotByNumber = new Map(realRestraints.map((item) => [item.slot, item]));
  const slots = realRestraints.length ? Array.from({ length: PIPELINE_RESTRAINT_SLOT_COUNT }, (_, index) =>
    slotByNumber.get(index + 1) || placeholder(element, index + 1)) : [];
  return freeze({
    schema: PIPELINE_ELEMENT_RESTRAINT_SCHEMA,
    elementId: element.elementId,
    elementIndex: element.elementIndex,
    toNode: element.toNode,
    realRestraintCount: realRestraints.length,
    realRestraints: freeze(realRestraints),
    slots: freeze(slots),
  });
}
export function resolvePipelineRestraintPlan({ restraints = [], coordinateRows = [] } = {}) {
  const diagnostics = [], elements = elementRows(coordinateRows);
  const normalized = [];
  restraints.forEach((source, restraintIndex) => {
    const owner = resolveOwner(source || {}, elements, restraintIndex, diagnostics);
    if (owner) normalized.push(normalizedRestraint(source || {}, owner, restraintIndex, diagnostics));
  });
  const resolutions = freeze(elements.map((element) => elementResolution(element,
    normalized.filter((item) => item.elementId === element.elementId), diagnostics)));
  const frozenDiagnostics = freeze(diagnostics);
  return freeze({
    schema: PIPELINE_RESTRAINT_PLAN_SCHEMA,
    active: restraints.length > 0,
    slotCount: PIPELINE_RESTRAINT_SLOT_COUNT,
    restraintCount: resolutions.reduce((sum, item) => sum + item.realRestraintCount, 0),
    elements: resolutions,
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0,
  });
}
export const buildPipelineRestraintPlanJson = (plan) => JSON.stringify(plan, null, 2);
