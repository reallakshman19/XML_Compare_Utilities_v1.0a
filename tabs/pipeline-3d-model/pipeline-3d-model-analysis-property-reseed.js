export const PIPELINE_ANALYSIS_PROPERTY_RESEED_PLAN_SCHEMA = 'PipelineAnalysisPropertyReseedPlan.v1';
export const PIPELINE_ANALYSIS_PROPERTY_RESEED_RESOLUTION_SCHEMA = 'PipelineAnalysisPropertyReseedResolution.v1';
const ANALYSIS_PLAN_SCHEMA = 'PipelineAnalysisSectionPlan.v1';
const PROPERTY_PLAN_SCHEMA = 'PipelinePropertySectionPlan.v1';
const PROPERTY_KEYS = Object.freeze([
  'diameter', 'wallThickness', 'insulationThickness', 'corrosionAllowance',
  'temperatures', 'pressures', 'hydroPressure', 'insulationDensity',
  'fluidDensity', 'materialNumber',
]);
const ORDER = Object.freeze([
  'PIPELINE_PROPERTY_RESEED_PLAN_INVALID',
  'PIPELINE_PROPERTY_RESEED_ELEMENT_MISSING',
]);
const text = (value) => String(value ?? '').trim();
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function cloneJson(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!plain(value)) throw new TypeError('Reseed input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, cloneJson(value[key])]));
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return deepFreeze({ severity: 'BLOCKING', code, message, details: cloneJson(details) });
}
function rank(code) {
  const index = ORDER.indexOf(code);
  return index < 0 ? ORDER.length : index;
}
function orderedDiagnostics(values) {
  const keyed = Object.create(null);
  values.forEach((item) => { keyed[`${item.code}:${JSON.stringify(item.details)}`] = item; });
  return Object.freeze(Object.values(keyed).sort((left, right) => rank(left.code) - rank(right.code)
    || compareText(left.code, right.code) || compareText(JSON.stringify(left.details), JSON.stringify(right.details))));
}
function orderedCodes(diagnostics) {
  const keyed = Object.create(null);
  diagnostics.forEach((item) => { keyed[item.code] = true; });
  return Object.freeze(Object.keys(keyed).sort((left, right) => rank(left) - rank(right) || compareText(left, right)));
}
function propertyShape(value) {
  if (!plain(value)) return deepFreeze({});
  const result = {};
  PROPERTY_KEYS.filter((key) => Object.hasOwn(value, key)).forEach((key) => { result[key] = cloneJson(value[key]); });
  Object.keys(value).filter((key) => !PROPERTY_KEYS.includes(key)).sort(compareText)
    .forEach((key) => { result[key] = cloneJson(value[key]); });
  return deepFreeze(result);
}
function sourceMap(value) {
  if (!plain(value)) return deepFreeze({});
  return deepFreeze(Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, cloneJson(value[key])] )));
}
function normalizedElement(source, reseed) {
  return deepFreeze({
    schema: text(source.schema),
    elementIndex: Number.isInteger(source.elementIndex) ? source.elementIndex : null,
    elementId: text(source.elementId),
    sectionId: text(source.sectionId),
    propertyDisposition: text(source.propertyDisposition),
    properties: propertyShape(source.properties),
    emittedProperties: reseed ? propertyShape(source.properties) : propertyShape(source.emittedProperties),
    effectiveSources: sourceMap(source.effectiveSources),
  });
}
function normalizedPropertyPlan(source, reseedIndexes) {
  const lookup = Object.create(null);
  reseedIndexes.forEach((index) => { lookup[index] = true; });
  const elements = Object.freeze((Array.isArray(source.elements) ? source.elements : [])
    .map((item) => normalizedElement(item, lookup[item.elementIndex] === true)));
  return deepFreeze({
    schema: text(source.schema),
    lineNo: text(source.lineNo),
    sectionCount: Number.isInteger(source.sectionCount) ? source.sectionCount : 0,
    sections: Object.freeze((Array.isArray(source.sections) ? source.sections : []).map(cloneJson).map(deepFreeze)),
    elements,
    diagnostics: Object.freeze((Array.isArray(source.diagnostics) ? source.diagnostics : []).map(cloneJson).map(deepFreeze)),
    blockerCodes: Object.freeze((Array.isArray(source.blockerCodes) ? source.blockerCodes : []).map(text)),
    ready: source.ready === true,
  });
}
function planInputs(input, diagnostics) {
  let source;
  try { source = cloneJson(input); } catch {
    diagnostics.push(diagnostic('PIPELINE_PROPERTY_RESEED_PLAN_INVALID', 'Reseed input is not JSON-safe plain data.'));
    return { analysis: {}, property: {} };
  }
  if (!plain(source)) {
    diagnostics.push(diagnostic('PIPELINE_PROPERTY_RESEED_PLAN_INVALID', 'Reseed input must be a plain object.'));
    return { analysis: {}, property: {} };
  }
  return { analysis: source.analysisSectionPlan || {}, property: source.propertySectionPlan || {} };
}
function validatePlans(analysis, property, diagnostics) {
  if (analysis.schema !== ANALYSIS_PLAN_SCHEMA || !Array.isArray(analysis.elementResolutions)) diagnostics.push(diagnostic(
    'PIPELINE_PROPERTY_RESEED_PLAN_INVALID', 'A valid PipelineAnalysisSectionPlan.v1 is required.',
    { analysisSectionPlanSchema: text(analysis.schema) }));
  if (property.schema !== PROPERTY_PLAN_SCHEMA || !Array.isArray(property.elements)) diagnostics.push(diagnostic(
    'PIPELINE_PROPERTY_RESEED_PLAN_INVALID', 'A valid PipelinePropertySectionPlan.v1 is required.',
    { propertySectionPlanSchema: text(property.schema) }));
  if (analysis.ready !== true || property.ready !== true) diagnostics.push(diagnostic(
    'PIPELINE_PROPERTY_RESEED_PLAN_INVALID', 'Both source plans must be ready before property reseeding.',
    { analysisReady: analysis.ready === true, propertyReady: property.ready === true }));
}
function sectionStarts(analysis, diagnostics) {
  const starts = (Array.isArray(analysis.elementResolutions) ? analysis.elementResolutions : [])
    .filter((item) => item.sectionDisposition === 'SECTION_START')
    .slice().sort((left, right) => Number(left.elementIndex) - Number(right.elementIndex));
  const counts = Object.create(null);
  starts.forEach((item) => { counts[item.elementIndex] = (counts[item.elementIndex] || 0) + 1; });
  Object.keys(counts).filter((key) => counts[key] > 1).sort(compareText).forEach((key) => diagnostics.push(diagnostic(
    'PIPELINE_PROPERTY_RESEED_PLAN_INVALID', 'Analysis plan contains duplicate section-start elements.',
    { elementIndex: Number(key), count: counts[key] })));
  const accepted = [];
  const seen = Object.create(null);
  for (const item of starts) if (!seen[item.elementIndex]) { seen[item.elementIndex] = true; accepted.push(item); }
  return accepted;
}
function propertyByIndex(property) {
  const grouped = Object.create(null);
  for (const item of Array.isArray(property.elements) ? property.elements : []) {
    const key = String(item.elementIndex);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}
function resolutionFor(start, grouped, diagnostics) {
  const matches = grouped[String(start.elementIndex)] || [];
  if (!matches.length) {
    diagnostics.push(diagnostic('PIPELINE_PROPERTY_RESEED_ELEMENT_MISSING',
      'Analysis-section start has no corresponding property resolution.',
      { elementIndex: start.elementIndex, elementId: text(start.elementId) }));
    return null;
  }
  if (matches.length !== 1 || text(matches[0].elementId) !== text(start.elementId) || !text(matches[0].sectionId)) {
    diagnostics.push(diagnostic('PIPELINE_PROPERTY_RESEED_PLAN_INVALID',
      'Property resolution identity does not match the analysis-section element.',
      { elementIndex: start.elementIndex, analysisElementId: text(start.elementId),
        propertyElementIds: matches.map((item) => text(item.elementId)).sort(compareText) }));
    return null;
  }
  const property = matches[0];
  const properties = propertyShape(property.properties);
  return deepFreeze({
    schema: PIPELINE_ANALYSIS_PROPERTY_RESEED_RESOLUTION_SCHEMA,
    elementIndex: start.elementIndex,
    elementId: text(start.elementId),
    analysisSectionId: text(start.analysisSectionId),
    propertySectionId: text(property.sectionId),
    boundaryNode: start.boundaryNode === undefined ? null : cloneJson(start.boundaryNode),
    disposition: 'ANALYSIS_SECTION_RESEED',
    emittedPropertyNames: Object.freeze(Object.keys(properties)),
    ready: true,
  });
}
export function resolvePipelineAnalysisPropertyReseedPlan(input = {}) {
  const diagnostics = [];
  const plans = planInputs(input, diagnostics);
  validatePlans(plans.analysis, plans.property, diagnostics);
  const starts = sectionStarts(plans.analysis, diagnostics);
  const grouped = propertyByIndex(plans.property);
  const reseedResolutions = Object.freeze(starts.map((start) => resolutionFor(start, grouped, diagnostics)).filter(Boolean));
  const reseedElementIndexes = Object.freeze(reseedResolutions.map((item) => item.elementIndex));
  const propertySectionPlan = normalizedPropertyPlan(plans.property, reseedElementIndexes);
  const frozenDiagnostics = orderedDiagnostics(diagnostics);
  const blockerCodes = orderedCodes(frozenDiagnostics);
  return deepFreeze({
    schema: PIPELINE_ANALYSIS_PROPERTY_RESEED_PLAN_SCHEMA,
    analysisSectionPlanSchema: text(plans.analysis.schema),
    propertySectionPlanSchema: text(plans.property.schema),
    reseedElementIndexes,
    reseedResolutions,
    propertySectionPlan,
    diagnostics: frozenDiagnostics,
    blockerCodes,
    ready: blockerCodes.length === 0,
  });
}
export function buildPipelineAnalysisPropertyReseedPlanJson(plan) {
  return JSON.stringify(plan, null, 2);
}
const cell = (value) => value == null ? '' : String(value).replace(/[\t\r\n]/g, ' ');
export function buildPipelineAnalysisPropertyReseedLedgerText(plan) {
  const header = ['Schema', 'ElementIndex', 'ElementId', 'AnalysisSectionId',
    'PropertySectionId', 'BoundaryNode', 'Disposition', 'EmittedPropertyNames', 'Ready'];
  const rows = (plan?.reseedResolutions || []).map((item) => [item.schema, item.elementIndex,
    item.elementId, item.analysisSectionId, item.propertySectionId, item.boundaryNode,
    item.disposition, item.emittedPropertyNames.join(','), item.ready ? 'YES' : 'NO']);
  return [header, ...rows].map((row) => row.map(cell).join('\t')).join('\n');
}
