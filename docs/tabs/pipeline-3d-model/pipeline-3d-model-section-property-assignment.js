export const PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SCHEMA = 'PipelineSectionPropertyAssignment.v1';
export const PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA = 'PipelineSectionPropertyAssignmentPlan.v1';

export const PIPELINE_SECTION_PROPERTY_FIELD_IDS = Object.freeze([
  'wallThickness', 'insulationThickness', 'corrosionAllowance',
  ...Array.from({ length: 9 }, (_, index) => `temperature${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `pressure${index + 1}`),
  'hydroPressure', 'insulationDensity', 'fluidDensity', 'materialNumber',
]);

const ORDER = Object.freeze([
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_INPUT_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SECTION_PLAN_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_IDENTITY_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PROVENANCE_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SOURCE_STALE',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_TARGET_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_FIELD_INVALID',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_CONFIRMATION_REQUIRED',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_DUPLICATE',
  'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED',
]);
const text = (value) => typeof value === 'string' ? value.trim() : '';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
function clone(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new TypeError('Assignment evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function diagnostic(code, message = code, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: clone(details) });
}
function rank(code) { const index = ORDER.indexOf(code); return index < 0 ? ORDER.length : index; }
function finalState(values) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = freeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
      message: text(item.message) || text(item.code), details: plain(item.details) ? clone(item.details) : {} });
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return { diagnostics, blockerCodes, ready: blockerCodes.length === 0 };
}
function safe(input) {
  try { const source = clone(input); if (plain(source)) return { source, errors: [] }; } catch { /* block */ }
  return { source: {}, errors: [diagnostic('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_INPUT_INVALID')] };
}
function fieldOrder(fieldId) {
  const index = PIPELINE_SECTION_PROPERTY_FIELD_IDS.indexOf(fieldId);
  return index < 0 ? PIPELINE_SECTION_PROPERTY_FIELD_IDS.length : index;
}
function orderedFields(values) {
  return Object.freeze([...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))]
    .sort((a, b) => fieldOrder(a) - fieldOrder(b) || compare(a, b)));
}
function orderedSections(values, canonicalIds) {
  const rankById = Object.fromEntries(canonicalIds.map((id, index) => [id, index]));
  return Object.freeze([...new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))]
    .sort((a, b) => (rankById[a] ?? canonicalIds.length) - (rankById[b] ?? canonicalIds.length)
      || compare(a, b)));
}
function sourceMap(branchInfo = {}) {
  const result = {};
  PIPELINE_SECTION_PROPERTY_FIELD_IDS.forEach((fieldId) => {
    let value = branchInfo[fieldId];
    if (/^temperature\d+$/.test(fieldId)) value = branchInfo.temperatures?.[Number(fieldId.slice(11)) - 1] ?? value;
    if (/^pressure\d+$/.test(fieldId)) value = branchInfo.pressures?.[Number(fieldId.slice(8)) - 1] ?? value;
    if (value !== undefined && value !== null && value !== '') result[fieldId] = clone(value);
  });
  return freeze(result);
}
function pick(values, fieldIds) {
  return freeze(Object.fromEntries(fieldIds.filter((fieldId) => Object.hasOwn(values, fieldId))
    .map((fieldId) => [fieldId, clone(values[fieldId])])));
}
function presentPick(values, fieldIds) {
  return freeze(Object.fromEntries(fieldIds.filter((fieldId) => Object.hasOwn(values, fieldId)
    && values[fieldId] !== null && values[fieldId] !== undefined && values[fieldId] !== '')
    .map((fieldId) => [fieldId, clone(values[fieldId])])));
}

function hashText(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
export function pipelineSectionPropertyAssignmentId(input = {}) {
  const identity = { analysisSectionIds: input.analysisSectionIds || [], fieldIds: input.fieldIds || [],
    sourceKind: text(input.sourceKind), sourceReference: text(input.sourceReference),
    sourceValues: input.sourceValues || {}, assignedValues: input.assignedValues || {} };
  return `PSPA-${hashText(JSON.stringify(clone(identity)))}`;
}
export function createPipelineSectionPropertyAssignment(input = {}, context = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors];
  const canonicalIds = Array.isArray(context.canonicalAnalysisSectionIds)
    ? context.canonicalAnalysisSectionIds.map(text) : [];
  const authenticated = plain(context.authenticatedSourceValues) ? clone(context.authenticatedSourceValues) : {};
  const analysisSectionIds = orderedSections(source.analysisSectionIds, canonicalIds);
  const fieldIds = orderedFields(source.fieldIds);
  if (!analysisSectionIds.length || analysisSectionIds.some((id) => !canonicalIds.includes(id))) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_TARGET_INVALID', 'Assignment targets must be canonical analysis sections.',
    { analysisSectionIds }));
  if (!fieldIds.length || fieldIds.some((id) => !PIPELINE_SECTION_PROPERTY_FIELD_IDS.includes(id))) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_FIELD_INVALID', 'Assignment fields must be explicit supported property fields.',
    { fieldIds }));
  const sourceKind = text(source.sourceKind), sourceReference = text(source.sourceReference);
  const expectedSourceKind = text(context.authenticatedSourceKind);
  const expectedSourceReference = text(context.authenticatedSourceReference);
  if (!['BRANCH_INPUT_BLOCK', 'INPUTXML_BRANCH_CONFIGURATION'].includes(sourceKind) || !sourceReference
    || sourceKind !== expectedSourceKind || sourceReference !== expectedSourceReference) errors.push(
    diagnostic('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PROVENANCE_INVALID',
      'Assignment provenance must exactly match the authenticated branch/InputXML source.',
      { expectedSourceKind, expectedSourceReference, suppliedSourceKind: sourceKind,
        suppliedSourceReference: sourceReference }));
  if (source.userConfirmed !== true) errors.push(diagnostic('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_CONFIRMATION_REQUIRED',
    'Assignment requires explicit user confirmation.'));
  const sourceValues = pick(plain(source.sourceValues) ? source.sourceValues : {}, fieldIds);
  const assignedValues = pick(plain(source.assignedValues) ? source.assignedValues : {}, fieldIds);
  const expected = pick(authenticated, fieldIds);
  if (JSON.stringify(sourceValues) !== JSON.stringify(expected)) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SOURCE_STALE', 'Source values changed after assignment review.'));
  if (JSON.stringify(assignedValues) !== JSON.stringify(sourceValues)) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_FIELD_INVALID', 'Assigned values must exactly preserve reviewed source values.'));
  if (fieldIds.some((fieldId) => !Object.hasOwn(sourceValues, fieldId))) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_FIELD_INVALID', 'Blank source fields remain absent and cannot be assigned.'));
  const expectedId = pipelineSectionPropertyAssignmentId({ analysisSectionIds, fieldIds, sourceKind,
    sourceReference, sourceValues, assignedValues });
  if (text(source.transactionId) !== expectedId) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_IDENTITY_INVALID', 'Transaction identity is not deterministic or authentic.',
    { expectedTransactionId: expectedId, suppliedTransactionId: text(source.transactionId) }));
  const state = finalState([...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...errors]);
  return freeze({ schema: PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SCHEMA, transactionId: expectedId,
    analysisSectionIds, fieldIds, sourceKind, sourceReference, userConfirmed: source.userConfirmed === true,
    sourceValues, assignedValues, diagnostics: state.diagnostics, blockerCodes: state.blockerCodes,
    ready: state.ready });
}
function canonicalPlan(input, errors) {
  const plan = input?.canonicalAnalysisSectionPlan;
  const valid = plain(plan) && plan.schema === 'PipelineAnalysisSectionPlan.v1' && plan.ready === true
    && Array.isArray(plan.sections) && Array.isArray(plan.elementResolutions);
  if (!valid) errors.push(diagnostic('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_SECTION_PLAN_INVALID',
    'A ready canonical PipelineAnalysisSectionPlan.v1 is required.'));
  return valid ? plan : { sections: [], elementResolutions: [] };
}
function directMap(input, canonicalIds, errors) {
  const values = plain(input.sectionDirectValues) ? input.sectionDirectValues : {};
  const result = Object.create(null);
  Object.keys(values).sort(compare).forEach((sectionId) => {
    if (!canonicalIds.includes(sectionId) || !plain(values[sectionId])) errors.push(diagnostic(
      'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_TARGET_INVALID', 'Direct section property evidence targets a noncanonical section.',
      { analysisSectionId: sectionId }));
    else result[sectionId] = presentPick(values[sectionId], PIPELINE_SECTION_PROPERTY_FIELD_IDS);
  });
  return result;
}
export function buildPipelineSectionPropertyAssignmentPlan(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.errors];
  const plan = canonicalPlan(source, errors), canonicalIds = plan.sections.map((item) => item.analysisSectionId);
  const authenticatedSourceValues = sourceMap(source.branchInfo || {});
  const authenticatedSourceKind = text(source.sourceKind) || 'INPUTXML_BRANCH_CONFIGURATION';
  const authenticatedSourceReference = text(source.sourceReference);
  if (!authenticatedSourceReference) errors.push(diagnostic(
    'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PROVENANCE_INVALID',
    'The authenticated branch/InputXML source reference is required.'));
  const assignments = Object.freeze((Array.isArray(source.assignments) ? source.assignments : []).map((item) =>
    createPipelineSectionPropertyAssignment(item, { canonicalAnalysisSectionIds: canonicalIds,
      authenticatedSourceValues, authenticatedSourceKind, authenticatedSourceReference })));
  errors.push(...assignments.flatMap((item) => item.diagnostics));
  const direct = directMap(source, canonicalIds, errors), ownership = Object.create(null), resolutions = [];
  for (const section of plan.sections) for (const fieldId of Object.keys(authenticatedSourceValues)) {
    const directValue = direct[section.analysisSectionId]?.[fieldId];
    if (directValue !== undefined) {
      resolutions.push({ analysisSectionId: section.analysisSectionId, fieldId, value: directValue,
        sourceKind: 'ANALYSIS_SECTION_INPUT', sourceReference: `section:${section.analysisSectionId}`, transactionId: '' });
      continue;
    }
    if (section.startElementIndex === 0) {
      resolutions.push({ analysisSectionId: section.analysisSectionId, fieldId,
        value: authenticatedSourceValues[fieldId], sourceKind: 'BRANCH_INPUT_BLOCK',
        sourceReference: text(source.sourceReference) || 'branch-input', transactionId: '' });
      continue;
    }
    const matches = assignments.filter((item) => item.ready && item.analysisSectionIds.includes(section.analysisSectionId)
      && item.fieldIds.includes(fieldId));
    if (matches.length !== 1) errors.push(diagnostic(matches.length ? 'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_DUPLICATE'
      : 'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED', matches.length
      ? 'A section field has more than one assignment transaction.' : 'A later-section property requires an explicit assignment.',
    { analysisSectionId: section.analysisSectionId, fieldId, count: matches.length }));
    if (matches.length === 1) resolutions.push({ analysisSectionId: section.analysisSectionId, fieldId,
      value: matches[0].assignedValues[fieldId], sourceKind: 'AUTHENTICATED_ASSIGNMENT',
      sourceReference: matches[0].sourceReference, transactionId: matches[0].transactionId });
    ownership[`${section.analysisSectionId}:${fieldId}`] = matches.length;
  }
  const state = finalState(errors);
  return freeze({ schema: PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PLAN_SCHEMA,
    canonicalAnalysisSectionPlanSchema: text(plan.schema), assignments,
    sourceValues: authenticatedSourceValues, propertyResolutions: resolutions,
    coverage: { canonicalSectionCount: plan.sections.length,
      laterSectionCount: plan.sections.filter((item) => item.startElementIndex > 0).length,
      sourceFieldCount: Object.keys(authenticatedSourceValues).length, resolutionCount: resolutions.length,
      unresolvedCount: Object.values(ownership).filter((count) => count !== 1).length },
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
export const buildPipelineSectionPropertyAssignmentJson = (plan) => JSON.stringify(plan, null, 2);
export function buildPipelineSectionPropertyAssignmentTsv(plan) {
  const header = ['TransactionId', 'AnalysisSectionId', 'FieldId', 'Value', 'SourceKind', 'SourceReference', 'Ready'];
  const rows = (plan?.propertyResolutions || []).map((item) => [item.transactionId, item.analysisSectionId,
    item.fieldId, item.value ?? '', item.sourceKind, item.sourceReference, plan.ready ? 'YES' : 'NO']);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
