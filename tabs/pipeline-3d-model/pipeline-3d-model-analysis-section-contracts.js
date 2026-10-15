import {
  PIPELINE_ENGINEERING_PROFILE_MODES,
  getPipelineEngineeringProfile,
} from './pipeline-3d-model-engineering-profile-registry.js';

export const PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA = 'PipelineAnalysisSectionPlan.v1';
export const PIPELINE_ANALYSIS_SECTION_SCHEMA = 'PipelineAnalysisSection.v1';
export const PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA = 'PipelineElementSectionResolution.v1';

const MODES = Object.freeze(Object.values(PIPELINE_ENGINEERING_PROFILE_MODES));
const ORDER = Object.freeze([
  'PIPELINE_PROFILE_ID_INVALID',
  'PIPELINE_ANALYSIS_SECTION_ID_INVALID',
  'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID',
  'PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID',
]);
const text = (value) => String(value ?? '').trim();
const validAS = (value) => /^AS[1-9]\d*$/.test(value);
const validE = (value) => /^E[1-9]\d*$/.test(value);

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('Input must be JSON-safe plain data.');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function rank(code) {
  const index = ORDER.indexOf(code);
  return index < 0 ? ORDER.length : index;
}

function compare(left, right) {
  return rank(left) - rank(right) || (left < right ? -1 : left > right ? 1 : 0);
}

function diagnostic(code, message, details = {}) {
  return deepFreeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}

function normalizeDiagnostics(values) {
  const keyed = Object.create(null);
  for (const value of values) {
    if (!plain(value) || !text(value.code)) continue;
    const item = deepFreeze({
      severity: text(value.severity) || 'BLOCKING',
      code: text(value.code),
      message: text(value.message),
      details: deepFreeze(plain(value.details) ? clone(value.details) : {}),
    });
    keyed[`${item.code}:${JSON.stringify(item.details)}`] = item;
  }
  return Object.freeze(Object.values(keyed).sort((left, right) => {
    const codeOrder = compare(left.code, right.code);
    if (codeOrder) return codeOrder;
    const a = JSON.stringify(left.details);
    const b = JSON.stringify(right.details);
    return a < b ? -1 : a > b ? 1 : 0;
  }));
}

function finalize(source, generated) {
  const supplied = Array.isArray(source.diagnostics) ? source.diagnostics : [];
  const diagnostics = normalizeDiagnostics([...supplied, ...generated]);
  const suppliedCodes = Array.isArray(source.blockerCodes) ? source.blockerCodes : [];
  const blockerCodes = Object.freeze([...new Set([
    ...suppliedCodes.map(text).filter(Boolean),
    ...diagnostics.map((item) => item.code),
  ])].sort(compare));
  return { diagnostics, blockerCodes };
}

function safeInput(input, code) {
  try {
    const source = clone(input || {});
    if (plain(source)) return { source, errors: [] };
  } catch { /* Return a deterministic blocked contract. */ }
  return { source: {}, errors: [diagnostic(code, 'Input is not JSON-safe plain data.')] };
}

function exactProfile(profileId) {
  return getPipelineEngineeringProfile(profileId);
}

function profileDiagnostic(profileId) {
  return diagnostic(
    'PIPELINE_PROFILE_ID_INVALID',
    'profileId must be one of the exact canonical engineering profile identifiers.',
    { profileId },
  );
}

export function createPipelineAnalysisSection(input = {}) {
  const safe = safeInput(input, 'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID');
  const source = safe.source;
  const errors = [...safe.errors];
  const analysisSectionId = text(source.analysisSectionId);
  const startElementIndex = source.startElementIndex;
  const profileId = text(source.profileId);
  if (!validAS(analysisSectionId)) errors.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_ID_INVALID', 'analysisSectionId must use AS1, AS2, ...', { analysisSectionId },
  ));
  if (!Number.isInteger(startElementIndex) || startElementIndex < 0) errors.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID', 'startElementIndex must be a nonnegative integer.',
    { startElementIndex: source.startElementIndex },
  ));
  if (!exactProfile(profileId)) errors.push(profileDiagnostic(profileId));
  const final = finalize(source, errors);
  return deepFreeze({
    schema: PIPELINE_ANALYSIS_SECTION_SCHEMA,
    analysisSectionId,
    startElementIndex: Number.isInteger(startElementIndex) ? startElementIndex : null,
    profileId,
    boundaryAuthority: text(source.boundaryAuthority),
    boundarySourceReference: text(source.boundarySourceReference),
    sourceAuthority: text(source.sourceAuthority),
    sourceReference: text(source.sourceReference),
    status: final.blockerCodes.length ? 'BLOCKED' : (text(source.status) || 'CONTRACT_ONLY'),
    diagnostics: final.diagnostics,
    blockerCodes: final.blockerCodes,
  });
}

export function createPipelineElementSectionResolution(input = {}) {
  const safe = safeInput(input, 'PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID');
  const source = safe.source;
  const errors = [...safe.errors];
  const elementIndex = source.elementIndex;
  const elementId = text(source.elementId);
  const analysisSectionId = text(source.analysisSectionId);
  const profileId = text(source.profileId);
  const resolvedMode = text(source.resolvedMode);
  const sectionDisposition = text(source.sectionDisposition);
  const profile = exactProfile(profileId);
  if (!Number.isInteger(elementIndex) || elementIndex < 0 || !validE(elementId)) errors.push(diagnostic(
    'PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID', 'elementIndex and E-prefixed elementId are required.',
    { elementIndex: source.elementIndex, elementId },
  ));
  if (!validAS(analysisSectionId)) errors.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_ID_INVALID', 'analysisSectionId must be AS-prefixed.', { analysisSectionId },
  ));
  if (!profile) errors.push(profileDiagnostic(profileId));
  if (!MODES.includes(resolvedMode) || !sectionDisposition) errors.push(diagnostic(
    'PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID', 'resolvedMode and sectionDisposition are required.',
    { resolvedMode, sectionDisposition },
  ));
  if (profile && MODES.includes(resolvedMode) && resolvedMode !== profile.resolvedMode) errors.push(diagnostic(
    'PIPELINE_ELEMENT_SECTION_RESOLUTION_INVALID',
    'resolvedMode does not match the canonical engineering profile.',
    { profileId, expectedMode: profile.resolvedMode, actualMode: resolvedMode },
  ));
  const final = finalize(source, errors);
  return deepFreeze({
    schema: PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA,
    elementIndex: Number.isInteger(elementIndex) ? elementIndex : null,
    elementId,
    analysisSectionId,
    profileId,
    resolvedMode,
    sectionDisposition,
    boundaryNode: source.boundaryNode === undefined ? null : clone(source.boundaryNode),
    sourceAuthority: text(source.sourceAuthority),
    sourceReference: text(source.sourceReference),
    diagnostics: final.diagnostics,
    blockerCodes: final.blockerCodes,
    ready: final.blockerCodes.length === 0,
  });
}

function duplicateDiagnostics(sections) {
  const counts = Object.create(null);
  for (const section of sections) {
    const id = section.analysisSectionId;
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  return Object.keys(counts).sort().filter((id) => counts[id] > 1).map((id) => diagnostic(
    'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID', 'Duplicate analysisSectionId.',
    { analysisSectionId: id, count: counts[id] },
  ));
}

export function createPipelineAnalysisSectionPlan(input = {}) {
  const safe = safeInput(input, 'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID');
  const source = safe.source;
  const errors = [...safe.errors];
  if (source.sections !== undefined && !Array.isArray(source.sections)) errors.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID', 'sections must be an array.',
  ));
  if (source.elementResolutions !== undefined && !Array.isArray(source.elementResolutions)) errors.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID', 'elementResolutions must be an array.',
  ));
  const sections = Object.freeze((Array.isArray(source.sections) ? source.sections : []).map(createPipelineAnalysisSection));
  const elementResolutions = Object.freeze((Array.isArray(source.elementResolutions) ? source.elementResolutions : [])
    .map(createPipelineElementSectionResolution));
  const final = finalize(source, [
    ...errors,
    ...duplicateDiagnostics(sections),
    ...sections.flatMap((section) => section.diagnostics),
    ...elementResolutions.flatMap((resolution) => resolution.diagnostics),
  ]);
  const blockerCodes = Object.freeze([...new Set([
    ...final.blockerCodes,
    ...sections.flatMap((section) => section.blockerCodes),
    ...elementResolutions.flatMap((resolution) => resolution.blockerCodes),
  ])].sort(compare));
  return deepFreeze({
    schema: PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA,
    sections,
    elementResolutions,
    diagnostics: final.diagnostics,
    blockerCodes,
    ready: blockerCodes.length === 0
      && sections.every((section) => section.status !== 'BLOCKED')
      && elementResolutions.every((resolution) => resolution.ready),
  });
}

export function isPipelineAnalysisSection(value) {
  return plain(value) && value.schema === PIPELINE_ANALYSIS_SECTION_SCHEMA
    && typeof value.analysisSectionId === 'string'
    && Array.isArray(value.diagnostics) && Array.isArray(value.blockerCodes);
}

export function isPipelineAnalysisSectionPlan(value) {
  return plain(value) && value.schema === PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    && Array.isArray(value.sections) && Array.isArray(value.elementResolutions)
    && typeof value.ready === 'boolean';
}

export function isPipelineElementSectionResolution(value) {
  return plain(value) && value.schema === PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA
    && typeof value.elementId === 'string' && typeof value.ready === 'boolean';
}
