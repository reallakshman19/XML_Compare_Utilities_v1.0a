import { deepFreeze, stableStringify } from './cii-workspace-contracts.js';
import {
  CII_WRITER_1C_SIF_IN_PLANE_POLICY, CII_WRITER_1C_SIF_OUT_PLANE_POLICY,
} from './cii-workspace-writer1c-sif.js';

export const CII_TRANSFER_ACTIONS = Object.freeze({ COPY: 'COPY', CREATE: 'CREATE', DELETE: 'DELETE', KEEP: 'KEEP', BLOCKED: 'BLOCKED' });
export const CII_TRANSFER_STATUSES = Object.freeze({ PREVIEW_READY: 'PREVIEW_READY', BLOCKED: 'BLOCKED', PROTECTED: 'PROTECTED' });

const PROTECTED_CATEGORIES = new Set(['GEOMETRY']);
const RESTRAINT_PROPERTIES = new Set([
  'Restraint presence', 'Restraint code set', 'Restraint gap values', 'Restraint friction values', 'Restraint stiffness values',
  'Restraint direction-cosine set', 'Qualified restraint numeric record set', 'Qualified restraint record pairing', 'Qualified restraint slot mutation',
]);
const HANGER_PROPERTIES = new Set(['Hanger presence', 'Hanger record count at node']);
const SIF_TEE_PROPERTIES = new Set(['SIF/Tee record presence', 'SIF/Tee raw code (field 2)', 'SIF/Tee normalized raw payload']);
const SIF_SELECTED_PROPERTIES = new Map([
  ['SIF/Tee slot 1 In-Plane SIF (ii)', Object.freeze({ slot: 1, item: 3, fieldKey: 'ii', policyAuthority: CII_WRITER_1C_SIF_IN_PLANE_POLICY })],
  ['SIF/Tee slot 1 Out-Plane SIF (io)', Object.freeze({ slot: 1, item: 4, fieldKey: 'io', policyAuthority: CII_WRITER_1C_SIF_OUT_PLANE_POLICY })],
  ['SIF/Tee slot 2 In-Plane SIF (ii)', Object.freeze({ slot: 2, item: 3, fieldKey: 'ii', policyAuthority: CII_WRITER_1C_SIF_IN_PLANE_POLICY })],
  ['SIF/Tee slot 2 Out-Plane SIF (io)', Object.freeze({ slot: 2, item: 4, fieldKey: 'io', policyAuthority: CII_WRITER_1C_SIF_OUT_PLANE_POLICY })],
]);
const NODENAME_WRITER_1C_AUTHORITY = 'CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD';
const SIF_FIELD_AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
const SIF_CONTEXT_AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';
const PROCESS_AUTHORITIES = Object.freeze({
  P1: 'PROTECTED_WRITER_ELEMENT_ROW4_P1_FIXED_FIELD', P2: 'PROTECTED_WRITER_ELEMENT_ROW4_P2_FIXED_FIELD',
  P3: 'PROTECTED_WRITER_ELEMENT_ROW4_P3_FIXED_FIELD', P4: 'PROTECTED_WRITER_ELEMENT_ROW4_P4_FIXED_FIELD',
  P5: 'PROTECTED_WRITER_ELEMENT_ROW4_P5_FIXED_FIELD', P6: 'PROTECTED_WRITER_ELEMENT_ROW4_P6_FIXED_FIELD',
  P7: 'PROTECTED_WRITER_ELEMENT_ROW5_P7_FIXED_FIELD', P8: 'PROTECTED_WRITER_ELEMENT_ROW5_P8_FIXED_FIELD',
  P9: 'PROTECTED_WRITER_ELEMENT_ROW5_P9_FIXED_FIELD',
  T1: 'PROTECTED_WRITER_ELEMENT_ROW2_T1_FIXED_FIELD', T2: 'PROTECTED_WRITER_ELEMENT_ROW2_T2_FIXED_FIELD',
  T3: 'PROTECTED_WRITER_ELEMENT_ROW2_T3_FIXED_FIELD', T4: 'PROTECTED_WRITER_ELEMENT_ROW3_T4_FIXED_FIELD',
  T5: 'PROTECTED_WRITER_ELEMENT_ROW3_T5_FIXED_FIELD', T6: 'PROTECTED_WRITER_ELEMENT_ROW3_T6_FIXED_FIELD',
  T7: 'PROTECTED_WRITER_ELEMENT_ROW3_T7_FIXED_FIELD', T8: 'PROTECTED_WRITER_ELEMENT_ROW3_T8_FIXED_FIELD',
  T9: 'PROTECTED_WRITER_ELEMENT_ROW3_T9_FIXED_FIELD',
  'Insulation thickness': 'PROTECTED_WRITER_ELEMENT_ROW2_INSULATION_FIXED_FIELD',
  'Corrosion allowance': 'PROTECTED_WRITER_ELEMENT_ROW2_CORROSION_FIXED_FIELD',
  'Insulation density': 'PROTECTED_WRITER_ELEMENT_ROW6_INSULATION_DENSITY_FIXED_FIELD',
  'Fluid density': 'PROTECTED_WRITER_ELEMENT_ROW6_FLUID_DENSITY_FIXED_FIELD',
  'Hydro pressure': 'PROTECTED_WRITER_ELEMENT_ROW6_HYDRO_PRESSURE_FIXED_FIELD',
});

function sameValue(a, b) { return stableStringify(a) === stableStringify(b); }
function bool(value) { return value === true; }
function actionFromPresence(sourceValue, targetValue) {
  const source = bool(sourceValue); const target = bool(targetValue);
  if (source === target) return CII_TRANSFER_ACTIONS.KEEP;
  return source ? CII_TRANSFER_ACTIONS.CREATE : CII_TRANSFER_ACTIONS.DELETE;
}
function common(delta, family, action, status, blockers = [], extra = {}) {
  return deepFreeze({
    family, action, status, blockers: Object.freeze([...new Set(blockers)]), sourceValue: delta.sourceValue, targetValue: delta.targetValue,
    proposedValue: delta.sourceValue, evidenceStatus: delta.evidenceStatus || 'UNSPECIFIED', evidenceAuthority: delta.authority || null,
    semanticChange: delta.semanticChange || (delta.changed ? 'CHANGED' : 'UNCHANGED'), ...extra,
  });
}
function statusFromBlockers(blockers, ready = CII_TRANSFER_STATUSES.PREVIEW_READY) { return blockers.length ? CII_TRANSFER_STATUSES.BLOCKED : ready; }
function normalizedCode(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase(); }
function sifCodeContext(options, blockers) {
  const supplied = options?.sifEngineeringContext || {}; const sourceCode = normalizedCode(supplied.sourceCode); const targetCode = normalizedCode(supplied.targetCode);
  if (supplied.authority !== SIF_CONTEXT_AUTHORITY) blockers.push('SIF_TEE_PIPING_CODE_CONTEXT_ATTESTATION_REQUIRED');
  if (!sourceCode || !targetCode) blockers.push('SIF_TEE_PIPING_CODE_CONTEXT_REQUIRED');
  else if (sourceCode !== targetCode) blockers.push(`SIF_TEE_PIPING_CODE_CONTEXT_MISMATCH:${sourceCode}:${targetCode}`);
  return deepFreeze({
    status: blockers.some((item) => String(item).startsWith('SIF_TEE_PIPING_CODE_CONTEXT')) ? 'BLOCKED' : 'QUALIFIED',
    authority: supplied.authority || null, sourceCode: sourceCode || null, targetCode: targetCode || null,
  });
}
function writerSifSelected(delta, options) {
  const spec = SIF_SELECTED_PROPERTIES.get(delta.property); if (!spec) return null;
  const blockers = []; const meta = delta.sifField || {};
  if (options.writerVersion !== '1C') blockers.push('SIF_TEE_SELECTED_FIELD_REQUIRES_WRITER_1C');
  if (!String(delta.authority || '').includes(SIF_FIELD_AUTHORITY)) blockers.push('SIF_TEE_SELECTED_FIELD_AUTHORITY_REQUIRED');
  if (Number(meta.slot) !== spec.slot || Number(meta.item) !== spec.item || meta.fieldKey !== spec.fieldKey) blockers.push('SIF_TEE_SELECTED_FIELD_METADATA_MISMATCH');
  if (Number(meta.sourceNeutralVersion) !== 11 || Number(meta.targetNeutralVersion) !== 11) blockers.push('SIF_TEE_NEUTRAL_VERSION_11_REQUIRED');
  if (!(Number(meta.sourcePointer) > 0) || !(Number(meta.targetPointer) > 0)) blockers.push('SIF_TEE_EXISTING_POINTER_REQUIRED');
  if (meta.nodeMappingQualified !== true) blockers.push('SIF_TEE_SLOT_NODE_CORRESPONDENCE_REQUIRED');
  if (String(meta.sourceNode || '') !== '' && String(meta.targetNode || '') !== '' && Number(meta.sourceType) !== Number(meta.targetType)) blockers.push('SIF_TEE_TYPE_CONTEXT_MISMATCH');
  const source = Number(delta.sourceValue); const target = Number(delta.targetValue);
  if (!Number.isFinite(source) || source < 1.0 || !Number.isFinite(target) || target < 1.0) blockers.push('SIF_TEE_EXPLICIT_GE_1_VALUE_REQUIRED');
  const sifContext = sifCodeContext(options, blockers);
  return common(delta, 'SIF_TEE', delta.changed ? CII_TRANSFER_ACTIONS.COPY : CII_TRANSFER_ACTIONS.KEEP,
    statusFromBlockers(blockers), blockers, {
      policyAuthority: spec.policyAuthority, sifContext, sifField: meta,
      rawSemanticsOnly: false, fieldQualified: true,
    });
}
function writerWall(delta) {
  if (delta.property !== 'Wall thickness') return null;
  const blockers = [];
  if (!String(delta.authority || '').includes('PROTECTED_WRITER_ELEMENT_ROW2_WT_FIXED_FIELD')) blockers.push('WALL_FIXED_FIELD_AUTHORITY_REQUIRED');
  return common(delta, 'WALL', delta.changed ? CII_TRANSFER_ACTIONS.COPY : CII_TRANSFER_ACTIONS.KEEP, statusFromBlockers(blockers), blockers,
    { policyAuthority: 'CII_WRITER_1A_CARDINALITY_PRESERVING_ELEMENT_FIELD' });
}
function writerProcess(delta) {
  const token = PROCESS_AUTHORITIES[delta.property];
  if (!token) return common(delta, 'PROCESS', CII_TRANSFER_ACTIONS.BLOCKED, CII_TRANSFER_STATUSES.BLOCKED, ['PROCESS_FIELD_NOT_QUALIFIED_FOR_WRITER_1B']);
  const blockers = [];
  if (!String(delta.authority || '').includes(token)) blockers.push('PROCESS_FIXED_FIELD_AUTHORITY_REQUIRED');
  const writer = ['P1', 'T1', 'T2'].includes(delta.property) ? '1A' : '1B';
  return common(delta, 'PROCESS', delta.changed ? CII_TRANSFER_ACTIONS.COPY : CII_TRANSFER_ACTIONS.KEEP, statusFromBlockers(blockers), blockers,
    { policyAuthority: `CII_WRITER_${writer}_CARDINALITY_PRESERVING_ELEMENT_FIELD` });
}
function writerOd(delta) {
  if (delta.property !== 'OD') return common(delta, 'PIPE_SIZE', CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PROTECTED,
    delta.changed ? ['PIPE_SIZE_PROPERTY_NOT_QUALIFIED_FOR_WRITER_1B'] : [], { protected: true });
  const qualified = String(delta.authority || '').includes('PROTECTED_WRITER_ELEMENT_ROW1_OD_FIXED_FIELD:WRITER_1B_PLAIN_PIPE_NO_REDUCER');
  if (!qualified) return common(delta, 'PIPE_SIZE', CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PROTECTED,
    delta.changed ? ['OD_WRITER_1B_PLAIN_PIPE_NO_REDUCER_AUTHORITY_REQUIRED', ...(delta.limitations || [])] : [],
    { protected: true, policyAuthority: 'CII_WRITER_1B_OD_CONDITIONAL_GATE' });
  return common(delta, 'PIPE_SIZE', delta.changed ? CII_TRANSFER_ACTIONS.COPY : CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PREVIEW_READY, [],
    { policyAuthority: 'CII_WRITER_1B_CONDITIONAL_OD_FIXED_FIELD' });
}
function writerRestraint(delta, options = {}) {
  if (options.writerVersion === '1A' && delta.property === 'Restraint presence' && delta.changed) {
    return common(delta, 'RESTRAINT', actionFromPresence(delta.sourceValue, delta.targetValue), CII_TRANSFER_STATUSES.BLOCKED,
      ['RESTRAINT_RECORD_CARDINALITY_CHANGE_WRITER_1A'], { policyAuthority: 'CII_WRITER_1A_EQUAL_CARDINALITY_ONLY' });
  }
  if (delta.property === 'Qualified restraint record pairing') {
    const pairing = delta.sourceValue || {}; const blockers = [];
    if (!String(delta.authority || '').includes('PROTECTED_WRITER_RESTRANT_POINTER_SLOT_PAIRING')) blockers.push('RESTRAINT_POINTER_SLOT_PAIRING_AUTHORITY_REQUIRED');
    if (pairing.status !== 'QUALIFIED') blockers.push(...(pairing.blockers || ['RESTRAINT_RECORD_PAIRING_NOT_QUALIFIED']));
    return common(delta, 'RESTRAINT', delta.changed ? CII_TRANSFER_ACTIONS.COPY : CII_TRANSFER_ACTIONS.KEEP, statusFromBlockers(blockers), blockers, {
      policyAuthority: 'CII_WRITER_1A_CARDINALITY_PRESERVING_RESTRAINT_SLOT', proposedValue: pairing, restraintPairing: true,
    });
  }
  if (delta.property === 'Qualified restraint slot mutation') {
    const plan = delta.sourceValue || {}; const blockers = [];
    if (!String(delta.authority || '').includes('PROTECTED_WRITER_RESTRANT_SLOT_MUTATION')) blockers.push('RESTRAINT_SLOT_MUTATION_AUTHORITY_REQUIRED');
    if (plan.status !== 'QUALIFIED') blockers.push(...(plan.blockers || ['RESTRAINT_SLOT_MUTATION_NOT_QUALIFIED']));
    const action = plan.mode === 'CREATE' ? CII_TRANSFER_ACTIONS.CREATE : plan.mode === 'CLEAR' ? CII_TRANSFER_ACTIONS.DELETE : CII_TRANSFER_ACTIONS.BLOCKED;
    if (action === CII_TRANSFER_ACTIONS.BLOCKED) blockers.push('RESTRAINT_SLOT_MUTATION_MODE_UNSUPPORTED');
    return common(delta, 'RESTRAINT', action, statusFromBlockers(blockers), blockers, {
      policyAuthority: 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT', proposedValue: plan, restraintSlotMutation: true,
    });
  }
  return common(delta, 'RESTRAINT', CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PROTECTED, [], {
    protected: true, evidenceOnly: true, rawNumericSemantics: true, policyAuthority: 'CII_RESTRAINT_AGGREGATE_EVIDENCE_ONLY',
  });
}

export function classifyCiiTransferDelta(delta, options = {}) {
  if (!delta) return null;
  if (PROTECTED_CATEGORIES.has(delta.category)) {
    return common(delta, delta.category, CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PROTECTED,
      delta.changed ? ['TARGET_PROPERTY_PROTECTED_BY_DEFAULT'] : [], { protected: true, policyAuthority: 'CII_TRANSFER_PROTECTED_MODEL_DEFINING_PROPERTIES' });
  }
  if (delta.category === 'PIPE_SIZE') return writerOd(delta);
  if (delta.category === 'WALL') return writerWall(delta)
    || common(delta, 'WALL', CII_TRANSFER_ACTIONS.BLOCKED, CII_TRANSFER_STATUSES.BLOCKED, ['WALL_FIELD_NOT_QUALIFIED_FOR_WRITER_1A']);
  if (delta.category === 'NODE_NAME' && delta.property === 'Node name / to-name') {
    if (!delta.changed) return common(delta, 'NODE_NAME', CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PREVIEW_READY);
    const source = String(delta.sourceValue || ''); const target = String(delta.targetValue || ''); const blockers = [];
    if (!String(delta.authority || '').includes('CII_NODENAME_FIXED_LAYOUT')) blockers.push('NODENAME_FIXED_LAYOUT_AUTHORITY_REQUIRED');
    if (!source && target) return common(delta, 'NODE_NAME', CII_TRANSFER_ACTIONS.DELETE, CII_TRANSFER_STATUSES.BLOCKED,
      [...blockers, 'NODE_NAME_DELETE_REQUIRES_EXPLICIT_POLICY']);
    if (source && target && source !== target && options.allowNodeNameOverwrite !== true) blockers.push('TARGET_NODENAME_NONBLANK');
    return common(delta, 'NODE_NAME', CII_TRANSFER_ACTIONS.COPY, statusFromBlockers(blockers), blockers,
      { policyAuthority: NODENAME_WRITER_1C_AUTHORITY });
  }
  if (delta.category === 'RESTRAINT' && RESTRAINT_PROPERTIES.has(delta.property)) return writerRestraint(delta, options);
  if (delta.category === 'HANGER' && HANGER_PROPERTIES.has(delta.property)) {
    const blockers = [];
    if (!String(delta.authority || '').includes('CONTROL_NOHGRS_PLUS_MISCEL_1_IHGRNODE')) blockers.push('HANGER_NODE_PRESENCE_AUTHORITY_REQUIRED');
    if (delta.property === 'Hanger presence') {
      const action = actionFromPresence(delta.sourceValue, delta.targetValue);
      if (action === CII_TRANSFER_ACTIONS.CREATE) blockers.push('HANGER_CREATE_PAYLOAD_NOT_QUALIFIED');
      return common(delta, 'HANGER', action, statusFromBlockers(blockers), blockers, { nodePresenceOnly: true });
    }
    if (delta.changed) blockers.push('HANGER_RECORD_COUNT_IS_EVIDENCE_ONLY');
    return common(delta, 'HANGER', delta.changed ? CII_TRANSFER_ACTIONS.BLOCKED : CII_TRANSFER_ACTIONS.KEEP, statusFromBlockers(blockers), blockers,
      { nodePresenceOnly: true });
  }
  if (delta.category === 'SIF_TEE') {
    const selected = writerSifSelected(delta, options); if (selected) return selected;
    if (SIF_TEE_PROPERTIES.has(delta.property)) {
      if (!delta.changed) return common(delta, 'SIF_TEE', CII_TRANSFER_ACTIONS.KEEP, CII_TRANSFER_STATUSES.PREVIEW_READY, [], { rawSemanticsOnly: true });
      const blockers = [];
      if (!String(delta.authority || '').includes('ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD')) blockers.push('SIF_TEE_POINTER_AUTHORITY_REQUIRED');
      if (delta.property === 'SIF/Tee record presence') {
        const action = actionFromPresence(delta.sourceValue, delta.targetValue);
        blockers.push('SIF_TEE_CARDINALITY_OR_SEMANTIC_REWRITE_REQUIRES_FUTURE_QUALIFICATION');
        return common(delta, 'SIF_TEE', action, CII_TRANSFER_STATUSES.BLOCKED, blockers, { rawSemanticsOnly: true });
      }
      blockers.push('SIF_TEE_FIELD_SEMANTICS_UNQUALIFIED');
      return common(delta, 'SIF_TEE', CII_TRANSFER_ACTIONS.COPY, CII_TRANSFER_STATUSES.BLOCKED, blockers, { rawSemanticsOnly: true });
    }
  }
  if (delta.category === 'WEIGHT_RIGID' && delta.property === 'Rigid weight') {
    const blockers = [];
    if (!String(delta.authority || '').includes('ELEMENT_RIGID_POINTER_TO_RIGID_RECORD')) blockers.push('RIGID_POINTER_WEIGHT_AUTHORITY_REQUIRED');
    return common(delta, 'WEIGHT_RIGID', sameValue(delta.sourceValue, delta.targetValue) ? CII_TRANSFER_ACTIONS.KEEP : CII_TRANSFER_ACTIONS.COPY,
      statusFromBlockers(blockers), blockers, { policyAuthority: 'CII_WRITER_1A_CARDINALITY_PRESERVING_RIGID_RECORD' });
  }
  if (delta.category === 'PROCESS') return writerProcess(delta);
  return common(delta, delta.category || 'UNKNOWN', CII_TRANSFER_ACTIONS.BLOCKED, CII_TRANSFER_STATUSES.BLOCKED, ['TRANSFER_FAMILY_NOT_QUALIFIED']);
}

export function ciiTransferPolicySummary(classifications) {
  const rows = classifications || [];
  const byAction = Object.fromEntries(Object.values(CII_TRANSFER_ACTIONS).map((action) => [action, 0]));
  for (const row of rows) byAction[row.action] = (byAction[row.action] || 0) + 1;
  return deepFreeze({ byAction: deepFreeze(byAction), protectedCount: rows.filter((row) => row.status === CII_TRANSFER_STATUSES.PROTECTED).length,
    blockedCount: rows.filter((row) => row.status === CII_TRANSFER_STATUSES.BLOCKED).length,
    previewReadyCount: rows.filter((row) => row.status === CII_TRANSFER_STATUSES.PREVIEW_READY).length });
}

export const CII_WRITER_1C_SIF_CONTEXT_AUTHORITY = SIF_CONTEXT_AUTHORITY;
