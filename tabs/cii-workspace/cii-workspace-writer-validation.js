import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';

function sameNumber(a, b, tolerance = 1e-9) {
  const left = Number(a); const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= Math.max(tolerance, Math.abs(right) * 1e-12);
}

const ELEMENT_FIELD_MAP = Object.freeze({
  OD: 'od', WT: 'wall', 'Insulation thickness': 'insul', 'Corrosion allowance': 'corrosion',
  P1: 'P1', P2: 'P2', P3: 'P3', P4: 'P4', P5: 'P5', P6: 'P6', P7: 'P7', P8: 'P8', P9: 'P9',
  T1: 'T1', T2: 'T2', T3: 'T3', T4: 'T4', T5: 'T5', T6: 'T6', T7: 'T7', T8: 'T8', T9: 'T9',
  'Insulation density': 'insulationDensity', 'Fluid density': 'fluidDensity', 'Hydro pressure': 'hydroPressure',
});
const MUTABLE_ELEMENT_FIELDS = Object.freeze([...new Set(Object.values(ELEMENT_FIELD_MAP))]);
const RESTRAINT_SCALARS = Object.freeze([
  ['typeCode', 'Restraint typeCode'], ['stiffness', 'Restraint stiffness'], ['gap', 'Restraint gap'],
  ['friction', 'Restraint friction'], ['connectingNode', 'Restraint connectingNode'],
]);
const RESTRAINT_DIRECTIONS = Object.freeze([
  ['x', 'Restraint direction X'], ['y', 'Restraint direction Y'], ['z', 'Restraint direction Z'],
]);

function elementMutationMap(writerResult, targetGraph) {
  const edges = new Map((targetGraph?.edges || []).map((edge) => [String(edge.elementId), edge])); const out = new Map();
  for (const mutation of writerResult?.mutations || []) {
    if (mutation.section !== 'ELEMENTS') continue;
    const edge = edges.get(String(mutation.elementId)); const field = ELEMENT_FIELD_MAP[mutation.field];
    if (!edge || !field) continue;
    const index = Number(edge.parsedElementIndex); if (!out.has(index)) out.set(index, {});
    out.get(index)[field] = Number(mutation.proposed);
  }
  return out;
}
function rigidMutationMap(writerResult) {
  return new Map((writerResult?.mutations || []).filter((item) => item.section === 'RIGID')
    .map((item) => [Number(item.pointer), Number(item.proposed)]));
}
function restraintMutationMap(writerResult) {
  const out = new Map();
  for (const item of writerResult?.mutations || []) {
    if (item.section !== 'RESTRANT') continue;
    out.set(`${Number(item.pointer)}:${Number(item.slot)}:${item.field}`, Number(item.proposed));
  }
  return out;
}
function restraintRecordMap(document) {
  return new Map((document?.auxiliaryEvidence?.restraints?.records || [])
    .map((record) => [`${Number(record.pointer)}:${Number(record.slot)}`, record]));
}
function restraintSlotPlans(transferPlan) {
  const out = new Map();
  for (const operation of transferPlan?.operations || []) {
    if (operation.family !== 'RESTRAINT' || operation.property !== 'Qualified restraint slot mutation') continue;
    const plan = operation.proposed;
    if (operation.status !== 'PREVIEW_READY' || plan?.status !== 'QUALIFIED') continue;
    out.set(`${Number(plan.pointer)}:${Number(plan.slot)}`, plan);
  }
  return out;
}
function metadataText(value) { return typeof value === 'string' ? value.trim() : String(value?.text || '').trim(); }
function metadataEmpty(record) { return !metadataText(record?.tag) && !metadataText(record?.guid); }

function validateElementCustody(beforeDocument, afterDocument, targetGraph, writerResult, errors) {
  const before = beforeDocument?.parsed?.elements || []; const after = afterDocument?.parsed?.elements || [];
  if (before.length !== after.length) { errors.push('ELEMENT_COUNT_CHANGED'); return; }
  const mutations = elementMutationMap(writerResult, targetGraph);
  before.forEach((left, index) => {
    const right = after[index]; const allowed = mutations.get(index) || {};
    for (const field of ['from', 'to', 'dx', 'dy', 'dz']) {
      if (!sameNumber(left[field], right?.[field])) errors.push(`ELEMENT_${index}_${field}_UNEXPECTED_CHANGE`);
    }
    for (const field of MUTABLE_ELEMENT_FIELDS) {
      const expected = Object.hasOwn(allowed, field) ? allowed[field] : left[field];
      if (!sameNumber(expected, right?.[field])) errors.push(`ELEMENT_${index}_${field}_EXPECTED_VALUE_MISMATCH`);
    }
  });
}
function validateRigidCustody(beforeDocument, afterDocument, writerResult, errors) {
  const before = beforeDocument?.auxiliaryEvidence?.rigids?.byPointer || {}; const after = afterDocument?.auxiliaryEvidence?.rigids?.byPointer || {};
  const beforeKeys = Object.keys(before).sort(); const afterKeys = Object.keys(after).sort();
  if (stableStringify(beforeKeys) !== stableStringify(afterKeys)) { errors.push('RIGID_POINTER_SET_CHANGED'); return; }
  const mutations = rigidMutationMap(writerResult);
  for (const key of beforeKeys) {
    const pointer = Number(key); const expected = mutations.has(pointer) ? mutations.get(pointer) : Number(before[key]?.weight);
    if (!sameNumber(expected, after[key]?.weight)) errors.push(`RIGID_${pointer}_EXPECTED_WEIGHT_MISMATCH`);
  }
}
function expectedRestraintKeys(beforeKeys, slotPlans) {
  const expected = new Set(beforeKeys);
  for (const [key, plan] of slotPlans) {
    if (plan.mode === 'CREATE') expected.add(key);
    if (plan.mode === 'CLEAR') expected.delete(key);
  }
  return [...expected].sort();
}
function validateExistingRestraint(key, left, right, mutations, errors) {
  if (!left || !right) { errors.push(`RESTRAINT_${key}_UNEXPECTED_RECORD_STATE`); return; }
  if (String(left.node) !== String(right.node)) errors.push(`RESTRAINT_${key}_NODE_UNEXPECTED_CHANGE`);
  if (stableStringify(left.tag) !== stableStringify(right.tag)) errors.push(`RESTRAINT_${key}_TAG_UNEXPECTED_CHANGE`);
  if (stableStringify(left.guid) !== stableStringify(right.guid)) errors.push(`RESTRAINT_${key}_GUID_UNEXPECTED_CHANGE`);
  for (const [property, mutationField] of RESTRAINT_SCALARS) {
    const mutationKey = `${key}:${mutationField}`;
    const expected = mutations.has(mutationKey) ? mutations.get(mutationKey) : Number(left[property]);
    if (!sameNumber(expected, right?.[property])) errors.push(`RESTRAINT_${key}_${property}_EXPECTED_VALUE_MISMATCH`);
  }
  for (const [axis, mutationField] of RESTRAINT_DIRECTIONS) {
    const mutationKey = `${key}:${mutationField}`;
    const expected = mutations.has(mutationKey) ? mutations.get(mutationKey) : Number(left.directionCosines?.[axis]);
    if (!sameNumber(expected, right?.directionCosines?.[axis])) errors.push(`RESTRAINT_${key}_direction_${axis}_EXPECTED_VALUE_MISMATCH`);
  }
}
function validateCreatedRestraint(key, plan, record, errors) {
  const proposed = plan?.proposedSlot;
  if (!record || !proposed) { errors.push(`RESTRAINT_${key}_CREATE_RECORD_MISSING`); return; }
  if (!metadataEmpty(record)) errors.push(`RESTRAINT_${key}_CREATED_METADATA_NOT_EMPTY`);
  if (String(record.node) !== String(proposed.node)) errors.push(`RESTRAINT_${key}_CREATE_NODE_MISMATCH`);
  for (const [property] of RESTRAINT_SCALARS) {
    if (!sameNumber(proposed[property], record[property])) errors.push(`RESTRAINT_${key}_CREATE_${property}_MISMATCH`);
  }
  for (const [axis] of RESTRAINT_DIRECTIONS) {
    if (!sameNumber(proposed.directionCosines?.[axis], record.directionCosines?.[axis])) errors.push(`RESTRAINT_${key}_CREATE_direction_${axis}_MISMATCH`);
  }
}
function validateRestraintCustody(beforeDocument, afterDocument, writerResult, transferPlan, errors) {
  const before = restraintRecordMap(beforeDocument); const after = restraintRecordMap(afterDocument);
  const beforeKeys = [...before.keys()].sort(); const afterKeys = [...after.keys()].sort();
  const plans = restraintSlotPlans(transferPlan); const mutations = restraintMutationMap(writerResult);
  if (stableStringify(expectedRestraintKeys(beforeKeys, plans)) !== stableStringify(afterKeys)) errors.push('RESTRAINT_POINTER_SLOT_SET_UNEXPECTED_CHANGE');
  if (Number(beforeDocument?.auxiliaryEvidence?.restraints?.sectionRowCount) !== Number(afterDocument?.auxiliaryEvidence?.restraints?.sectionRowCount)) {
    errors.push('RESTRAINT_SECTION_CARDINALITY_CHANGED');
  }
  for (const key of afterKeys) {
    const plan = plans.get(key);
    if (plan?.mode === 'CREATE') validateCreatedRestraint(key, plan, after.get(key), errors);
    else validateExistingRestraint(key, before.get(key), after.get(key), mutations, errors);
  }
  for (const [key, plan] of plans) {
    if (plan.mode === 'CLEAR') {
      if (!before.has(key) || after.has(key)) errors.push(`RESTRAINT_${key}_CLEAR_RECORD_STATE_MISMATCH`);
      if (before.has(key) && !metadataEmpty(before.get(key))) errors.push(`RESTRAINT_${key}_CLEARED_METADATA_WAS_NOT_EMPTY`);
    }
  }
}

export function validateCiiWriterRoundTrip(beforeDocument, afterDocument, targetGraph, writerResult, transferPlan, writerLabel = 'WRITER_1B') {
  const errors = [];
  validateElementCustody(beforeDocument, afterDocument, targetGraph, writerResult, errors);
  validateRigidCustody(beforeDocument, afterDocument, writerResult, errors);
  validateRestraintCustody(beforeDocument, afterDocument, writerResult, transferPlan, errors);
  if (stableStringify(beforeDocument?.parsed?.nodes || {}) !== stableStringify(afterDocument?.parsed?.nodes || {})) errors.push('NODE_GEOMETRY_CHANGED');
  if (stableStringify(beforeDocument?.nodeNames || {}) !== stableStringify(afterDocument?.nodeNames || {})) errors.push('NODE_NAMES_CHANGED');
  const beforePointers = Object.values(beforeDocument?.auxiliaryEvidence?.elements || {}).map((item) => item.pointers);
  const afterPointers = Object.values(afterDocument?.auxiliaryEvidence?.elements || {}).map((item) => item.pointers);
  if (stableStringify(beforePointers) !== stableStringify(afterPointers)) errors.push('AUXILIARY_POINTER_OWNERSHIP_CHANGED');
  if (errors.length) throw new Error(`CII_${writerLabel}_NEGATIVE_ASSURANCE_FAILED:${errors.join('|')}`);
  return deepFreeze({
    schema: `CIIWorkspace${writerLabel}Validation.v1`, status: 'PASS', unexpectedSemanticDeltaCount: 0,
    checks: Object.freeze([
      'ELEMENT_COUNT_UNCHANGED', 'NODE_NUMBERS_AND_GEOMETRY_UNCHANGED', 'FROM_TO_DX_DY_DZ_UNCHANGED',
      'ONLY_EXPLICIT_ELEMENT_FIELDS_CHANGED', 'AUXILIARY_POINTER_OWNERSHIP_UNCHANGED', 'RIGID_POINTER_SET_UNCHANGED',
      'RESTRAINT_SECTION_CARDINALITY_UNCHANGED', 'RESTRAINT_SLOT_SET_CHANGED_ONLY_AS_APPROVED', 'RESTRAINT_TAG_GUID_UNCHANGED',
    ]),
  });
}
