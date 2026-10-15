export const PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA = 'PipelineAllowableStressPlan.v1';
export const PIPELINE_ALLOWABLE_STRESS_SCHEMA = 'PipelineAllowableStress.v1';
export const PIPELINE_ALLOWABLE_CASE_SCHEMA = 'PipelineAllowableStressCase.v1';
export const PIPELINE_ELEMENT_ALLOWABLE_STRESS_SCHEMA = 'PipelineElementAllowableStressResolution.v1';
export const PIPELINE_ALLOWABLE_CASE_COUNT = 9;

export const PIPELINE_ALLOWABLE_TEXT_FIELDS = Object.freeze([
  ['ALLOWBL_STRESS_INDICATOR', ['allowableStressIndicator']],
  ['DESIGN_FACTOR', ['designFactor']],
]);
export const PIPELINE_ALLOWABLE_NUMERIC_FIELDS = Object.freeze([
  ['HOOP_STRESS_FACTOR', ['hoopStressFactor']], ['COLD_ALLOW', ['coldAllow']],
  ['EFF', ['eff', 'efficiency']], ['SY', ['sy']], ['SU', ['su']],
  ['FAC', ['fac']], ['PMAX', ['pmax']], ['PIPING_CODE', ['pipingCode']],
  ['ALPHA_H', ['alphaH']], ['ALPHA_FAB', ['alphaFab']],
  ['GAMMA_C', ['gammaC']], ['R', ['r']], ['ALPHA_GW', ['alphaGw']],
  ['DESIGN_LT', ['designLt']], ['CHEMICAL_RES', ['chemicalRes', 'chemicalResistance']],
  ['CURVE_RADIUS', ['curveRadius']], ['EHB', ['ehb']], ['DF', ['df']],
  ['YD', ['yd']], ['Y_COEFF', ['yCoeff']], ['Mf', ['mf']], ['Hf', ['hf']],
  ['F_DSGN_FACTOR', ['fDsgnFactor', 'fDesignFactor']],
]);
export const PIPELINE_ALLOWABLE_INTEGER_FIELDS = Object.freeze([
  ['SUPP_RQR', ['suppRqr', 'supportRequired']], ['MAT_LP', ['matLp', 'materialLp']],
  ['BURST_OPE', ['burstOpe', 'burstOperating']], ['BURST_TEST', ['burstTest']],
  ['COLLAPSE', ['collapse']], ['PROPBUCK', ['propBuck', 'propagationBuckling']],
  ['LCC', ['lcc']], ['DCC', ['dcc']], ['BURIED', ['buried']],
  ['EXP_ALLOW', ['expAllow', 'expansionAllow']],
]);
export const PIPELINE_ALLOWABLE_CASE_NUMERIC_FIELDS = Object.freeze([
  ['HOT_ALLOW', ['hotAllow']], ['HOT_SY', ['hotSy']], ['HOT_SU', ['hotSu']],
  ['CYC_RED_FACTOR', ['cycRedFactor']], ['BUTTWELDCYCLES', ['buttWeldCycles']],
  ['BUTTWELDSTRESS', ['buttWeldStress']], ['FILLETWELDCYCLES', ['filletWeldCycles']],
  ['FILLETWELDSTRESS', ['filletWeldStress']],
  ['APP_P_OPE_ALL_REDUCTION', ['appPOpeAllReduction']],
  ['CLASSWCYCLES', ['classWCycles']], ['CLASSWSTRESS', ['classWStress']],
  ['CLASSGCYCLES', ['classGCycles']], ['CLASSGSTRESS', ['classGStress']],
  ['CLASSFCYCLES', ['classFCycles']], ['CLASSFSTRESS', ['classFStress']],
  ['T_DERATING', ['tDerating']],
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
    elementId: `E${index + 1}`, elementIndex: index,
    fromNode: positiveInteger(coordinateRows[index]?.nodeNumber),
    toNode: positiveInteger(toRow?.nodeNumber),
  })));
}
function ownerCandidates(source, elements) {
  const elementId = text(source.elementId), elementIndex = Number(source.elementIndex);
  if (elementId) return elements.filter((item) => item.elementId === elementId);
  if (Number.isInteger(elementIndex) && elementIndex >= 0) {
    return elements.filter((item) => item.elementIndex === elementIndex);
  }
  const node = positiveInteger(source.node);
  return node == null ? [] : elements.filter((item) => item.toNode === node);
}
function resolveOwner(source, elements, allowableIndex, diagnostics) {
  const candidates = ownerCandidates(source, elements);
  if (candidates.length > 1) diagnostics.push(diagnostic(
    'PIPELINE_ALLOWABLE_OWNERSHIP_AMBIGUOUS',
    'An allowable-stress node must resolve to exactly one owning PIPINGELEMENT.',
    { allowableIndex, node: source.node, elementIds: candidates.map((item) => item.elementId) },
  ));
  if (candidates.length !== 1) {
    if (!candidates.length) diagnostics.push(diagnostic(
      'PIPELINE_ALLOWABLE_OWNERSHIP_INVALID',
      'An allowable-stress block requires an existing elementId, elementIndex, or unique TO_NODE.',
      { allowableIndex, elementId: text(source.elementId), elementIndex: source.elementIndex, node: source.node },
    ));
    return null;
  }
  const owner = candidates[0];
  const node = source.node == null || source.node === '' ? owner.toNode : positiveInteger(source.node);
  if (node !== owner.toNode) {
    diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_NODE_MISMATCH',
      'An allowable-stress node must equal its owning element TO_NODE.',
      { allowableIndex, elementId: owner.elementId, node: source.node, toNode: owner.toNode }));
    return null;
  }
  return owner;
}
function readValue(source, name, aliases) {
  for (const key of [name, ...aliases]) if (Object.hasOwn(source, key)) return source[key];
  return undefined;
}
function normalizeTextFields(source, fields, diagnostics, details) {
  const result = {};
  fields.forEach(([name, aliases]) => {
    const raw = readValue(source, name, aliases);
    if (raw != null && typeof raw === 'object') diagnostics.push(diagnostic(
      'PIPELINE_ALLOWABLE_FIELD_INVALID', 'An allowable-stress text field must be scalar.',
      { ...details, field: name }));
    result[name] = raw == null ? '' : String(raw);
  });
  return result;
}
function normalizeNumericFields(source, fields, integer, diagnostics, details) {
  const result = {};
  fields.forEach(([name, aliases]) => {
    const raw = readValue(source, name, aliases);
    if (raw == null || raw === '') { result[name] = null; return; }
    const value = Number(raw), valid = Number.isFinite(value) && (!integer || Number.isInteger(value));
    if (!valid) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_FIELD_INVALID',
      `An allowable-stress ${integer ? 'integer' : 'numeric'} field is invalid.`,
      { ...details, field: name, value: raw }));
    result[name] = valid ? value : null;
  });
  return result;
}
function normalizedCase(source, allowableIndex, caseIndex, diagnostics) {
  const rawNum = source?.num ?? source?.caseNumber ?? source?.NUM;
  const num = Number(rawNum);
  if (!Number.isInteger(num) || num < 1 || num > PIPELINE_ALLOWABLE_CASE_COUNT) {
    diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_CASE_NUMBER_INVALID',
      'An allowable-stress CASE number must be an integer from 1 through 9.',
      { allowableIndex, caseIndex, num: rawNum }));
    return null;
  }
  const attributes = normalizeNumericFields(source || {}, PIPELINE_ALLOWABLE_CASE_NUMERIC_FIELDS,
    false, diagnostics, { allowableIndex, caseIndex, num });
  return freeze({ schema: PIPELINE_ALLOWABLE_CASE_SCHEMA, num, placeholder: false,
    attributes: freeze(attributes) });
}
function caseSlots(sourceCases, allowableIndex, diagnostics) {
  const byNumber = new Map();
  (Array.isArray(sourceCases) ? sourceCases : []).forEach((source, caseIndex) => {
    const item = normalizedCase(source || {}, allowableIndex, caseIndex, diagnostics);
    if (!item) return;
    if (byNumber.has(item.num)) diagnostics.push(diagnostic(
      'PIPELINE_ALLOWABLE_CASE_NUMBER_DUPLICATE',
      'An allowable-stress block cannot contain duplicate CASE numbers.',
      { allowableIndex, num: item.num }));
    else byNumber.set(item.num, item);
  });
  return freeze(Array.from({ length: PIPELINE_ALLOWABLE_CASE_COUNT }, (_, index) => {
    const num = index + 1;
    return byNumber.get(num) || freeze({ schema: PIPELINE_ALLOWABLE_CASE_SCHEMA,
      num, placeholder: true, attributes: freeze(Object.fromEntries(
        PIPELINE_ALLOWABLE_CASE_NUMERIC_FIELDS.map(([name]) => [name, null]))) });
  }));
}
function normalizedAllowable(source, owner, allowableIndex, diagnostics) {
  const attributes = {
    ...normalizeTextFields(source, PIPELINE_ALLOWABLE_TEXT_FIELDS, diagnostics, { allowableIndex }),
    ...normalizeNumericFields(source, PIPELINE_ALLOWABLE_NUMERIC_FIELDS, false, diagnostics, { allowableIndex }),
    ...normalizeNumericFields(source, PIPELINE_ALLOWABLE_INTEGER_FIELDS, true, diagnostics, { allowableIndex }),
  };
  const cases = caseSlots(source.cases ?? source.caseSlots, allowableIndex, diagnostics);
  return freeze({ schema: PIPELINE_ALLOWABLE_STRESS_SCHEMA, allowableIndex,
    elementId: owner.elementId, elementIndex: owner.elementIndex, node: owner.toNode,
    attributes: freeze(attributes), cases });
}
function elementResolution(element, items, diagnostics) {
  if (items.length > 1) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_DUPLICATE_ELEMENT',
    'A PIPINGELEMENT may own at most one ALLOWABLESTRESS block.',
    { elementId: element.elementId, allowableIndexes: items.map((item) => item.allowableIndex) }));
  return freeze({ schema: PIPELINE_ELEMENT_ALLOWABLE_STRESS_SCHEMA,
    elementId: element.elementId, elementIndex: element.elementIndex, toNode: element.toNode,
    allowableStress: items[0] || null });
}
export function resolvePipelineAllowableStressPlan({ allowableStresses = [], coordinateRows = [] } = {}) {
  const diagnostics = [], elements = elementRows(coordinateRows), normalized = [];
  allowableStresses.forEach((source, allowableIndex) => {
    const owner = resolveOwner(source || {}, elements, allowableIndex, diagnostics);
    if (owner) normalized.push(normalizedAllowable(source || {}, owner, allowableIndex, diagnostics));
  });
  const resolutions = freeze(elements.map((element) => elementResolution(element,
    normalized.filter((item) => item.elementId === element.elementId), diagnostics)));
  const frozenDiagnostics = freeze(diagnostics);
  return freeze({ schema: PIPELINE_ALLOWABLE_STRESS_PLAN_SCHEMA,
    active: allowableStresses.length > 0,
    caseCount: PIPELINE_ALLOWABLE_CASE_COUNT,
    allowableCount: resolutions.filter((item) => item.allowableStress != null).length,
    elements: resolutions, diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0 });
}
export const buildPipelineAllowableStressPlanJson = (plan) => JSON.stringify(plan, null, 2);
