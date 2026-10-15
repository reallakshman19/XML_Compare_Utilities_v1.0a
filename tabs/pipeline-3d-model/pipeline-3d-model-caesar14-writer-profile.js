export const PIPELINE_CAESAR_WRITER_PROFILE_SCHEMA = 'PipelineCaesarInputXmlWriterProfile.v1';
export const PIPELINE_CAESAR_14_VERSION = '14.00';
export const PIPELINE_CAESAR_STANDARD_SENTINEL = '-1.010100';

export const PIPELINE_CAESAR_NUMERIC_DISPOSITIONS = Object.freeze([
  'VALUE', 'ZERO', 'SENTINEL', 'OMITTED',
]);
const COUNT_FIELDS = Object.freeze([
  ['NUMELT', 'numElt'], ['NUMNOZ', 'numNoz'], ['NOHGRS', 'noHgrs'],
  ['NUMBEND', 'numBend'], ['NUMRIGID', 'numRigid'], ['NUMEXPJNT', 'numExpJnt'],
  ['NUMREST', 'numRest'], ['NUMFORCMNT', 'numForcMnt'], ['NUMUNFLOAD', 'numUnfLoad'],
  ['NUMWIND', 'numWind'], ['NUMELEOFF', 'numEleOff'], ['NUMALLOW', 'numAllow'],
  ['NUMISECT', 'numISect'],
]);
const ELEMENT_PREFIX_FIELDS = Object.freeze([
  ['DIAMETER', 'diameter'], ['WALL_THICK', 'wallThickness'],
  ['INSUL_THICK', 'insulationThickness'], ['CORR_ALLOW', 'corrosionAllowance'],
]);
const ELEMENT_REPEATED_MECHANICAL_FIELDS = Object.freeze([
  ['POISSONS', 'poissons'], ['PIPE_DENSITY', 'pipeDensity'],
]);
const ELEMENT_EMITTED_MATERIAL_FIELDS = Object.freeze([
  ['INSUL_DENSITY', 'insulationDensity'], ['FLUID_DENSITY', 'fluidDensity'],
  ['REFRACTORY_DENSITY', 'refractoryDensity'], ['REFRACTORY_THK', 'refractoryThickness'],
  ['CLADDING_DEN', 'claddingDensity'], ['CLADDING_THK', 'claddingThickness'],
  ['INSUL_CLAD_UNIT_WEIGHT', 'insulationCladUnitWeight'],
]);
const ELEMENT_SUFFIX_FIELDS = Object.freeze([
  ['MILL_TOL_PLUS', 'millTolerancePlus'], ['MILL_TOL_MINUS', 'millToleranceMinus'],
  ['SEAM_WELD', 'seamWeld'],
]);
export const PIPELINE_CAESAR_14_ROOT_ATTRIBUTE_ORDER = Object.freeze([
  'xmlns', 'VERSION', 'XML_TYPE',
]);
export const PIPELINE_CAESAR_14_MODEL_ATTRIBUTE_ORDER = Object.freeze([
  'xmlns', 'JOBNAME', 'TIME', 'ISSUE_NO', ...COUNT_FIELDS.map(([name]) => name),
  'NORTH_Z', 'NORTH_Y', 'NORTH_X',
]);
export const PIPELINE_CAESAR_14_ELEMENT_ATTRIBUTE_ORDER = Object.freeze([
  'FROM_NODE', 'TO_NODE', 'DELTA_X', 'DELTA_Y', 'DELTA_Z',
  ...ELEMENT_PREFIX_FIELDS.map(([name]) => name),
  ...Array.from({ length: 9 }, (_, index) => `TEMP_EXP_C${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `PRESSURE${index + 1}`),
  'HYDRO_PRESSURE', 'MODULUS',
  ...Array.from({ length: 9 }, (_, index) => `HOT_MOD${index + 1}`),
  ...ELEMENT_REPEATED_MECHANICAL_FIELDS.map(([name]) => name),
  ...ELEMENT_EMITTED_MATERIAL_FIELDS.map(([name]) => name),
  'MATERIAL_NUM', 'MATERIAL_NAME',
  ...ELEMENT_SUFFIX_FIELDS.map(([name]) => name), 'NAME',
]);
export const PIPELINE_CAESAR_14_RESTRAINT_ATTRIBUTE_ORDER = Object.freeze([
  'NUM', 'NODE', 'TYPE', 'STIFFNESS', 'GAP', 'FRIC_COEF', 'CNODE',
  'XCOSINE', 'YCOSINE', 'ZCOSINE', 'TAG', 'GUID',
]);
export const PIPELINE_CAESAR_14_RIGID_ATTRIBUTE_ORDER = Object.freeze([
  'WEIGHT', 'TYPE',
]);
export const PIPELINE_CAESAR_14_ALLOWABLE_ATTRIBUTE_ORDER = Object.freeze([
  'ALLOWBL_STRESS_INDICATOR', 'DESIGN_FACTOR', 'HOOP_STRESS_FACTOR',
  'COLD_ALLOW', 'EFF', 'SY', 'SU', 'FAC', 'PMAX', 'PIPING_CODE',
  'SUPP_RQR', 'MAT_LP', 'ALPHA_H', 'ALPHA_FAB', 'BURST_OPE',
  'BURST_TEST', 'COLLAPSE', 'PROPBUCK', 'LCC', 'DCC', 'GAMMA_C', 'R',
  'ALPHA_GW', 'DESIGN_LT', 'CHEMICAL_RES', 'CURVE_RADIUS', 'BURIED',
  'EHB', 'DF', 'YD', 'Y_COEFF', 'Mf', 'Hf', 'F_DSGN_FACTOR', 'EXP_ALLOW',
]);
export const PIPELINE_CAESAR_14_CASE_ATTRIBUTE_ORDER = Object.freeze([
  'NUM', 'HOT_ALLOW', 'HOT_SY', 'HOT_SU', 'CYC_RED_FACTOR',
  'BUTTWELDCYCLES', 'BUTTWELDSTRESS', 'FILLETWELDCYCLES',
  'FILLETWELDSTRESS', 'APP_P_OPE_ALL_REDUCTION', 'CLASSWCYCLES',
  'CLASSWSTRESS', 'CLASSGCYCLES', 'CLASSGSTRESS', 'CLASSFCYCLES',
  'CLASSFSTRESS', 'T_DERATING',
]);
const ALLOWABLE_TEXT_FIELDS = new Set(['ALLOWBL_STRESS_INDICATOR', 'DESIGN_FACTOR']);
const ALLOWABLE_INTEGER_FIELDS = new Set([
  'SUPP_RQR', 'MAT_LP', 'BURST_OPE', 'BURST_TEST', 'COLLAPSE',
  'PROPBUCK', 'LCC', 'DCC', 'BURIED', 'EXP_ALLOW',
]);

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};
const text = (value) => String(value ?? '').trim();
const pair = (name, value) => Object.freeze([name, String(value)]);
const hasNumber = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value));

function cleanFixed(value) {
  const fixed = Number(value).toFixed(6);
  return fixed === '-0.000000' ? '0.000000' : fixed;
}

export function formatCaesar14Number(value, disposition = 'VALUE') {
  if (!PIPELINE_CAESAR_NUMERIC_DISPOSITIONS.includes(disposition)) {
    throw new TypeError(`Unsupported CAESAR numeric disposition: ${disposition}`);
  }
  if (disposition === 'OMITTED') return null;
  if (disposition === 'SENTINEL') return PIPELINE_CAESAR_STANDARD_SENTINEL;
  if (disposition === 'ZERO') return '0.000000';
  if (value === null || value === undefined || value === ''
    || !Number.isFinite(Number(value))) return PIPELINE_CAESAR_STANDARD_SENTINEL;
  return cleanFixed(value);
}

export function formatCaesar14Integer(value, sentinel = -1) {
  if (value === null || value === undefined || value === '') return String(sentinel);
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(sentinel);
}

export function resolvePipelineCaesarWriterProfile(version) {
  const versionText = text(version);
  const isCaesar14 = versionText === PIPELINE_CAESAR_14_VERSION;
  return freeze({
    schema: PIPELINE_CAESAR_WRITER_PROFILE_SCHEMA,
    version: versionText,
    mode: isCaesar14 ? 'CAESAR_14' : 'LEGACY',
    numericScale: isCaesar14 ? 6 : null,
    standardSentinel: isCaesar14 ? PIPELINE_CAESAR_STANDARD_SENTINEL : '',
    pressureFieldPattern: isCaesar14 ? 'PRESSURE{n}' : 'PRESSURE_C{n}',
    rootAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_ROOT_ATTRIBUTE_ORDER : Object.freeze([]),
    modelAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_MODEL_ATTRIBUTE_ORDER : Object.freeze([]),
    elementAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_ELEMENT_ATTRIBUTE_ORDER : Object.freeze([]),
    restraintAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_RESTRAINT_ATTRIBUTE_ORDER : Object.freeze([]),
    rigidAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_RIGID_ATTRIBUTE_ORDER : Object.freeze([]),
    allowableAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_ALLOWABLE_ATTRIBUTE_ORDER : Object.freeze([]),
    caseAttributeOrder: isCaesar14 ? PIPELINE_CAESAR_14_CASE_ATTRIBUTE_ORDER : Object.freeze([]),
    suppressExtensionAttributes: isCaesar14,
    ready: Boolean(versionText),
  });
}

function numericEntry(name, value, disposition = 'VALUE') {
  const lexical = formatCaesar14Number(value, disposition);
  return lexical == null ? null : pair(name, lexical);
}

function numericValueEntry(name, value) {
  const present = hasNumber(value);
  return numericEntry(name, value, present ? 'VALUE' : 'SENTINEL');
}

function integerValueEntry(name, value) {
  return pair(name, formatCaesar14Integer(value));
}

function arrayEntries(prefix, values, count) {
  return Array.from({ length: count }, (_, index) =>
    numericValueEntry(`${prefix}${index + 1}`, values?.[index]));
}

function fieldEntries(definitions, properties) {
  return definitions.map(([name, key]) => numericValueEntry(name, properties?.[key]));
}

export function caesar14RootAttributeEntries(plan) {
  return freeze([
    pair('xmlns', plan?.namespace || 'COADE'),
    pair('VERSION', text(plan?.version) || PIPELINE_CAESAR_14_VERSION),
    pair('XML_TYPE', text(plan?.xmlType) || 'Input'),
  ]);
}

export function caesar14ModelAttributeEntries(plan) {
  const metadata = plan?.metadata || {};
  const counts = plan?.counts || {};
  const result = [
    pair('xmlns', ''), pair('JOBNAME', metadata.jobName ?? ''),
    pair('TIME', metadata.timeText ?? ''), pair('ISSUE_NO', metadata.issueNo ?? ''),
    ...COUNT_FIELDS.map(([name, key]) => pair(name, Number.isSafeInteger(counts[key]) ? counts[key] : 0)),
    pair('NORTH_Z', Number.isFinite(Number(metadata.northZ)) ? Number(metadata.northZ) : 0),
    pair('NORTH_Y', Number.isFinite(Number(metadata.northY)) ? Number(metadata.northY) : 0),
    pair('NORTH_X', Number.isFinite(Number(metadata.northX)) ? Number(metadata.northX) : 0),
  ];
  return freeze(result);
}

export function caesar14ElementAttributeEntries(element) {
  const emitted = element?.emittedProperties ?? element?.properties ?? {};
  const effective = element?.properties ?? emitted;
  const mechanical = element?.emittedMechanicalProperties
    ?? element?.mechanicalProperties ?? emitted;
  const result = [
    numericValueEntry('FROM_NODE', element?.fromNode),
    numericValueEntry('TO_NODE', element?.toNode),
    numericValueEntry('DELTA_X', element?.deltaX),
    numericValueEntry('DELTA_Y', element?.deltaY),
    numericValueEntry('DELTA_Z', element?.deltaZ),
    ...fieldEntries(ELEMENT_PREFIX_FIELDS, emitted),
    ...arrayEntries('TEMP_EXP_C', emitted.temperatures, 9),
    ...arrayEntries('PRESSURE', emitted.pressures, 9),
    numericValueEntry('HYDRO_PRESSURE', emitted.hydroPressure),
    numericValueEntry('MODULUS', mechanical.modulus),
    ...arrayEntries('HOT_MOD', mechanical.hotModuli, 9),
    ...fieldEntries(ELEMENT_REPEATED_MECHANICAL_FIELDS, mechanical),
    ...fieldEntries(ELEMENT_EMITTED_MATERIAL_FIELDS, emitted),
    numericValueEntry('MATERIAL_NUM', effective.materialNumber),
    pair('MATERIAL_NAME', mechanical.materialName ?? emitted.materialName ?? ''),
    ...fieldEntries(ELEMENT_SUFFIX_FIELDS, emitted),
    pair('NAME', emitted.name ?? element?.name ?? ''),
  ].filter(Boolean);
  return freeze(result);
}

export function caesar14BendAttributeEntries(bend, curvatureNodes = []) {
  const radius = Number(bend?.radiusMm);
  if (!Number.isFinite(radius) || radius <= 0) return Object.freeze([]);
  const result = [numericValueEntry('RADIUS', radius)];
  if (hasNumber(bend?.bendTypeCode) && Number.isInteger(Number(bend.bendTypeCode))) {
    result.push(numericValueEntry('TYPE', bend.bendTypeCode));
  }
  curvatureNodes.forEach((node, index) => {
    result.push(numericValueEntry(`ANGLE${index + 1}`, node.angleDeg));
    result.push(numericValueEntry(`NODE${index + 1}`, node.nodeNumber));
  });
  result.push(numericEntry('NUM_MITER', 0, 'ZERO'));
  if (hasNumber(bend?.fittingThicknessMm)) {
    result.push(numericValueEntry('FITTINGTHICKNESS', bend.fittingThicknessMm));
  }
  if (hasNumber(bend?.kfactor)) result.push(numericValueEntry('KFACTOR', bend.kfactor));
  return freeze(result.filter(Boolean));
}

export function caesar14RestraintAttributeEntries(restraint) {
  const slot = Number(restraint?.slot);
  const placeholder = restraint?.placeholder === true;
  return freeze([
    pair('NUM', Number.isInteger(slot) && slot > 0 ? slot : 1),
    numericValueEntry('NODE', restraint?.node),
    numericValueEntry('TYPE', restraint?.type),
    numericValueEntry('STIFFNESS', restraint?.stiffness),
    numericValueEntry('GAP', restraint?.gap),
    numericValueEntry('FRIC_COEF', restraint?.frictionCoefficient),
    numericValueEntry('CNODE', restraint?.cnode),
    numericEntry('XCOSINE', restraint?.xCosine, placeholder ? 'ZERO' : 'VALUE'),
    numericEntry('YCOSINE', restraint?.yCosine, placeholder ? 'ZERO' : 'VALUE'),
    numericEntry('ZCOSINE', restraint?.zCosine, placeholder ? 'ZERO' : 'VALUE'),
    pair('TAG', restraint?.tag ?? ''),
    pair('GUID', restraint?.guid ?? ''),
  ]);
}

export function caesar14RigidAttributeEntries(rigid) {
  return freeze([
    numericValueEntry('WEIGHT', rigid?.weight),
    pair('TYPE', rigid?.type ?? ''),
  ]);
}

export function caesar14AllowableStressAttributeEntries(allowable) {
  const attributes = allowable?.attributes ?? allowable ?? {};
  return freeze(PIPELINE_CAESAR_14_ALLOWABLE_ATTRIBUTE_ORDER.map((name) => {
    if (ALLOWABLE_TEXT_FIELDS.has(name)) return pair(name, attributes[name] ?? '');
    if (ALLOWABLE_INTEGER_FIELDS.has(name)) return integerValueEntry(name, attributes[name]);
    return numericValueEntry(name, attributes[name]);
  }));
}

export function caesar14AllowableCaseAttributeEntries(caseItem) {
  const attributes = caseItem?.attributes ?? caseItem ?? {};
  return freeze(PIPELINE_CAESAR_14_CASE_ATTRIBUTE_ORDER.map((name) =>
    name === 'NUM' ? pair(name, formatCaesar14Integer(caseItem?.num, 1))
      : numericValueEntry(name, attributes[name])));
}
