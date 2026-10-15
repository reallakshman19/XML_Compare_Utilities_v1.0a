import { getPipelineEngineeringProfile as profile } from './pipeline-3d-model-engineering-profile-registry.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA as AS_SCHEMA } from './pipeline-3d-model-analysis-section-contracts.js';
import { PIPELINE_DIAMETER_BASIS_IDS as BASIS, PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA as PS_SCHEMA,
  createPipelineAnalysisDiameterPlan as planContract, createPipelineAnalysisDiameterResolution as sectionContract,
  createPipelineDiameterMigration as migrationContract, createPipelineElementDiameterResolution as elementContract,
  parsePipelinePositiveScalar as scalar } from './pipeline-3d-model-diameter-contracts.js';

const RESEED = 'PipelineAnalysisPropertyReseedPlan.v1';
const txt = (value) => String(value ?? '').trim();
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const obj = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
};
function copy(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(copy);
  if (!obj(value)) throw new TypeError('JSON-safe plain data required.');
  return Object.fromEntries(Object.keys(value).sort(cmp).map((key) => [key, copy(value[key])]));
}
const diag = (code, details = {}) => ({ severity: 'BLOCKING', code, message: code, details: copy(details) });
const has = (value, key) => obj(value) && Object.hasOwn(value, key) && value[key] !== undefined
  && value[key] !== null && !(typeof value[key] === 'string' && !txt(value[key]));
const evidence = (sourceKind, value, sourceAuthority = '', sourceReference = '') => ({
  sourceKind, value, sourceAuthority: txt(sourceAuthority), sourceReference: txt(sourceReference),
});
function unique(values, sorter = cmp) {
  const found = Object.create(null);
  values.forEach((value) => { found[`${typeof value}:${String(value)}`] = value; });
  return Object.values(found).sort(sorter);
}
function invalid(raw, code, field, diagnostics) {
  diagnostics.push(diag(code, { field, value: raw }));
  return evidence('INVALID_EXPLICIT_SOURCE', null);
}
function explicit(owner, key, kind, code, diagnostics, authority, reference) {
  if (!has(owner, key)) return null;
  const value = scalar(owner[key]);
  return value == null ? invalid(owner[key], code, key, diagnostics)
    : evidence(kind, value, owner.sourceAuthority || authority, owner.sourceReference || reference);
}
function planIsReady(value, schema) {
  return obj(value) && value.schema === schema && value.ready === true
    && (!Array.isArray(value.blockerCodes) || value.blockerCodes.length === 0);
}
function analysisPlan(value, diagnostics) {
  if (!planIsReady(value, AS_SCHEMA) || !Array.isArray(value.sections) || !Array.isArray(value.elementResolutions)) {
    diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { source: 'analysisSectionPlan' }));
    return { schema: txt(value?.schema), sections: [], elementResolutions: [], ready: false };
  }
  const sections = value.sections.filter((item, index) => {
    if (obj(item)) return true;
    diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { sectionIndex: index })); return false;
  }).sort((a, b) => Number(a.startElementIndex) - Number(b.startElementIndex)
    || cmp(txt(a.analysisSectionId), txt(b.analysisSectionId)));
  const elements = value.elementResolutions.filter((item, index) => {
    if (obj(item)) return true;
    diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { elementEntryIndex: index })); return false;
  }).sort((a, b) => Number(a.elementIndex) - Number(b.elementIndex));
  const starts = Object.create(null);
  sections.forEach((section, index) => {
    if (section.analysisSectionId !== `AS${index + 1}` || !Number.isInteger(section.startElementIndex)
      || section.startElementIndex < 0 || (index === 0 && section.startElementIndex !== 0)
      || !profile(txt(section.profileId)) || starts[section.startElementIndex]) {
      diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { analysisSectionId: section.analysisSectionId }));
    }
    starts[section.startElementIndex] = true;
  });
  elements.forEach((element, index) => {
    const owner = sections.filter((section) => section.startElementIndex <= element.elementIndex).at(-1);
    const expectedProfile = profile(txt(element.profileId));
    if (element.elementIndex !== index || element.elementId !== `E${index + 1}` || !owner
      || element.analysisSectionId !== owner.analysisSectionId || element.profileId !== owner.profileId
      || !expectedProfile || txt(element.resolvedMode) !== expectedProfile?.resolvedMode
      || element.sectionDisposition !== (owner.startElementIndex === index ? 'SECTION_START' : 'INHERITED')) {
      diagnostics.push(diag('PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', { elementIndex: element.elementIndex }));
    }
  });
  if (sections.some((section) => section.startElementIndex >= elements.length)) diagnostics.push(diag(
    'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', { reason: 'SECTION_START_OUT_OF_RANGE' }));
  return { ...value, sections, elementResolutions: elements };
}
function validPropertyPlan(value) {
  return planIsReady(value, PS_SCHEMA) && Array.isArray(value.elements) && value.elements.every((item) =>
    obj(item) && Number.isInteger(item.elementIndex) && item.elementIndex >= 0
    && item.elementId === `E${item.elementIndex + 1}` && txt(item.sectionId) && obj(item.properties));
}
const propertyKey = (plan) => plan.elements.slice().sort((a, b) => a.elementIndex - b.elementIndex)
  .map((item) => [item.elementIndex, item.elementId, item.sectionId, item.properties.diameter]);
function propertyPlan(input, diagnostics) {
  const direct = input.propertySectionPlan, reseed = input.analysisPropertyReseedPlan;
  const directReady = direct !== undefined && validPropertyPlan(direct);
  if (direct !== undefined && !directReady) diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { source: 'propertySectionPlan' }));
  let derivative = null;
  if (reseed !== undefined) {
    if (!planIsReady(reseed, RESEED) || !validPropertyPlan(reseed.propertySectionPlan)) diagnostics.push(diag(
      'PIPELINE_DIAMETER_INPUT_INVALID', { source: 'analysisPropertyReseedPlan' }));
    else derivative = reseed.propertySectionPlan;
  }
  if (directReady && derivative && JSON.stringify(propertyKey(direct)) !== JSON.stringify(propertyKey(derivative))) {
    diagnostics.push(diag('PIPELINE_DIAMETER_SOURCE_CONFLICT', { source: 'PROPERTY_PLAN_DISAGREEMENT' }));
  }
  const selected = derivative || (directReady ? direct : null);
  return selected ? { ...selected, elements: selected.elements.slice().sort((a, b) => a.elementIndex - b.elementIndex) }
    : { schema: txt(direct?.schema), ready: false, elements: [] };
}
function propertyMap(properties, analysis, diagnostics) {
  const map = Object.create(null);
  properties.elements.forEach((item) => { (map[String(item.elementIndex)] ||= []).push(item); });
  analysis.elementResolutions.forEach((item) => {
    const matches = map[String(item.elementIndex)] || [];
    if (matches.length !== 1 || matches[0].elementId !== item.elementId) diagnostics.push(diag(
      'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', { elementIndex: item.elementIndex }));
  });
  if (properties.elements.length !== analysis.elementResolutions.length) diagnostics.push(diag(
    'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', { reason: 'PROPERTY_ANALYSIS_COUNT_MISMATCH' }));
  return map;
}
function targetMap(entries, sections, diagnostics) {
  const result = Object.create(null), byId = Object.fromEntries(sections.map((item) => [item.analysisSectionId, item]));
  const byStart = Object.fromEntries(sections.map((item) => [String(item.startElementIndex), item]));
  if (entries !== undefined && !Array.isArray(entries)) diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { source: 'diameterSections' }));
  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    if (!obj(entry)) { diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { diameterEntryIndex: index })); return; }
    const idSupplied = has(entry, 'analysisSectionId'), startSupplied = has(entry, 'startElementIndex');
    const idTarget = idSupplied ? byId[txt(entry.analysisSectionId)] : null;
    const startTarget = startSupplied && Number.isInteger(entry.startElementIndex)
      ? byStart[String(entry.startElementIndex)] : null;
    if ((!idSupplied && !startSupplied) || (idSupplied && !idTarget) || (startSupplied && !startTarget)
      || (idTarget && startTarget && idTarget !== startTarget)) {
      diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID', { diameterEntryIndex: index })); return;
    }
    const section = idTarget || startTarget;
    (result[section.analysisSectionId] ||= []).push(entry);
  });
  return result;
}
function sectionValue(entries, key, code, diagnostics, authority, reference) {
  const candidates = entries.filter((entry) => has(entry, key));
  if (!candidates.length) return null;
  const values = candidates.map((entry) => scalar(entry[key]));
  if (values.some((value) => value == null)) return invalid(
    candidates.find((entry) => scalar(entry[key]) == null)?.[key], code, key, diagnostics);
  const distinct = unique(values, (a, b) => a - b);
  if (distinct.length > 1) {
    diagnostics.push(diag('PIPELINE_DIAMETER_SOURCE_CONFLICT', { field: key, values: distinct }));
    return evidence('CONFLICTING_EXPLICIT_SECTION', null);
  }
  const chosen = candidates.slice().sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)))[0];
  return evidence('EXPLICIT_ANALYSIS_SECTION', distinct[0], chosen.sourceAuthority || authority,
    chosen.sourceReference || reference);
}
function legacyDiameter(section, map, input, diagnostics, authority, reference) {
  const propertyElement = map[String(section.startElementIndex)]?.[0];
  const candidates = [];
  if (has(propertyElement?.properties, 'diameter')) candidates.push({ kind: 'PROPERTY', raw: propertyElement.properties.diameter,
    authority: propertyElement.effectiveSources?.diameter || authority, reference: `E${section.startElementIndex + 1}` });
  for (const key of ['boreMm', 'diameter']) if (has(input.branchInfo, key)) candidates.push({
    kind: 'BRANCH', raw: input.branchInfo[key], authority, reference });
  if (!candidates.length) return { candidate: null, observed: false };
  if (input.settings?.diameterSource !== 'branch-diameter' || input.settings?.diameterBasisConfirmed !== true) {
    diagnostics.push(diag('PIPELINE_DIAMETER_BASIS_UNCONFIRMED', { analysisSectionId: section.analysisSectionId }));
    return { candidate: evidence('UNCONFIRMED_LEGACY_DIAMETER', null, authority, reference), observed: true };
  }
  const values = candidates.map((item) => scalar(item.raw));
  if (values.some((value) => value == null)) return { candidate: invalid(
    candidates.find((item) => scalar(item.raw) == null)?.raw, 'PIPELINE_OUTSIDE_DIAMETER_INVALID',
    'legacyDiameter', diagnostics), observed: true };
  const distinct = unique(values, (a, b) => a - b);
  if (distinct.length > 1) {
    diagnostics.push(diag('PIPELINE_OUTSIDE_DIAMETER_CONFLICT', { values: distinct }));
    return { candidate: evidence('CONFLICTING_LEGACY_DIAMETER', null), observed: true };
  }
  const chosen = candidates.find((item) => item.kind === 'PROPERTY') || candidates[0];
  return { candidate: evidence(chosen.kind === 'PROPERTY' ? 'CONFIRMED_LEGACY_PROPERTY_DIAMETER'
    : 'CONFIRMED_LEGACY_BRANCH_DIAMETER', distinct[0], chosen.authority, chosen.reference), observed: true };
}
function outsideDiameter(section, entries, input, map, diagnostics) {
  const authority = txt(input.sourceAuthority) || 'CALLER', reference = txt(input.sourceReference);
  const local = sectionValue(entries, 'outsideDiameterMm', 'PIPELINE_OUTSIDE_DIAMETER_INVALID', diagnostics, authority, reference);
  if (local) return { ...local, legacyObserved: false };
  const global = explicit(input, 'outsideDiameterMm', 'EXPLICIT_GLOBAL', 'PIPELINE_OUTSIDE_DIAMETER_INVALID', diagnostics, authority, reference);
  if (global) return { ...global, legacyObserved: false };
  const settings = obj(input.settings) ? input.settings : {};
  if (settings.diameterSource === 'explicit-od') {
    const selected = explicit(settings, 'explicitOutsideDiameterMm', 'SETTINGS_EXPLICIT_OD',
      'PIPELINE_OUTSIDE_DIAMETER_INVALID', diagnostics, authority, reference)
      || invalid(settings.explicitOutsideDiameterMm, 'PIPELINE_OUTSIDE_DIAMETER_INVALID', 'explicitOutsideDiameterMm', diagnostics);
    return { ...selected, legacyObserved: false };
  }
  if (txt(settings.diameterSource) && !['branch-diameter', 'explicit-od'].includes(txt(settings.diameterSource))) {
    diagnostics.push(diag('PIPELINE_DIAMETER_BASIS_INVALID', { diameterSource: settings.diameterSource }));
    return { ...evidence('INVALID_DIAMETER_BASIS', null, authority, reference), legacyObserved: false };
  }
  const found = legacyDiameter(section, map, { ...input, settings,
    branchInfo: obj(input.branchInfo) ? input.branchInfo : {} }, diagnostics, authority, reference);
  return { ...(found.candidate || evidence('UNRESOLVED', null, authority, reference)), legacyObserved: found.observed };
}
function independent(entries, input, key, settingsKey, code, diagnostics) {
  const authority = txt(input.sourceAuthority) || 'CALLER', reference = txt(input.sourceReference);
  return sectionValue(entries, key, code, diagnostics, authority, reference)
    || explicit(input, key, 'EXPLICIT_GLOBAL', code, diagnostics, authority, reference)
    || explicit(obj(input.settings) ? input.settings : {}, settingsKey, 'SETTINGS_SEMANTIC_INPUT', code,
      diagnostics, authority, reference) || evidence('UNRESOLVED', null, authority, reference);
}
function propertyChecks(section, analysis, map, outside, settings, diagnostics) {
  if (settings?.diameterSource !== 'branch-diameter' || settings?.diameterBasisConfirmed !== true) return;
  let previous = null;
  analysis.elementResolutions.filter((item) => item.analysisSectionId === section.analysisSectionId).forEach((item) => {
    const raw = map[String(item.elementIndex)]?.[0]?.properties?.diameter;
    if (raw === undefined || raw === null || (typeof raw === 'string' && !txt(raw))) return;
    const value = scalar(raw);
    if (value == null) { diagnostics.push(diag('PIPELINE_OUTSIDE_DIAMETER_INVALID', { elementIndex: item.elementIndex, value: raw })); return; }
    if (previous != null && value !== previous) diagnostics.push(diag(
      'PIPELINE_DIAMETER_CHANGE_REQUIRES_ANALYSIS_SECTION', { elementIndex: item.elementIndex }));
    if (outside != null && value !== outside) diagnostics.push(diag(
      'PIPELINE_DIAMETER_PROPERTY_MISMATCH', { elementIndex: item.elementIndex, propertyDiameterMm: value, outsideDiameterMm: outside }));
    previous = value;
  });
}
function resolveSection(section, entries, input, analysis, map, allDiagnostics) {
  const diagnostics = [], outside = outsideDiameter(section, entries, input, map, diagnostics);
  const nps = independent(entries, input, 'nominalPipeSizeNps', 'nominalPipeSizeNps', 'PIPELINE_NPS_INVALID', diagnostics);
  const vendor = independent(entries, input, 'greVendorNominalBoreMm', 'greNominalBoreMm', 'PIPELINE_GRE_VENDOR_BORE_INVALID', diagnostics);
  propertyChecks(section, analysis, map, outside.value, obj(input.settings) ? input.settings : {}, diagnostics);
  const sources = { outsideDiameterMm: { ...outside, basisId: BASIS.OUTSIDE_DIAMETER_MM },
    nominalPipeSizeNps: { ...nps, basisId: BASIS.NOMINAL_PIPE_SIZE_NPS },
    greVendorNominalBoreMm: { ...vendor, basisId: BASIS.GRE_VENDOR_NOMINAL_BORE_MM } };
  const kinds = unique(Object.values(sources).filter((item) => item.value != null).map((item) => item.sourceKind));
  const authority = [outside, nps, vendor].find((item) => item.value != null) || outside;
  allDiagnostics.push(...diagnostics);
  return sectionContract({ analysisSectionId: section.analysisSectionId, profileId: section.profileId,
    resolvedMode: profile(section.profileId)?.resolvedMode || '', startElementIndex: section.startElementIndex,
    outsideDiameterMm: outside.value, nominalPipeSizeNps: nps.value, greVendorNominalBoreMm: vendor.value,
    caesarDiameterMm: outside.value, sourceKind: kinds.length === 0 ? 'UNRESOLVED'
      : kinds.length === 1 ? kinds[0] : 'MIXED_SEMANTIC_SOURCES',
    sourceAuthority: authority.sourceAuthority, sourceReference: authority.sourceReference,
    quantitySources: sources, diagnostics });
}
function resolveElements(analysis, sections, map, diagnostics) {
  const bySection = Object.fromEntries(sections.map((item) => [item.analysisSectionId, item]));
  return analysis.elementResolutions.map((item) => {
    const section = bySection[item.analysisSectionId], properties = map[String(item.elementIndex)] || [];
    if (!section || properties.length !== 1) diagnostics.push(diag(
      'PIPELINE_DIAMETER_SECTION_COVERAGE_INVALID', { elementIndex: item.elementIndex }));
    return elementContract({ elementIndex: item.elementIndex, elementId: item.elementId,
      analysisSectionId: item.analysisSectionId, profileId: item.profileId,
      outsideDiameterMm: section?.outsideDiameterMm, nominalPipeSizeNps: section?.nominalPipeSizeNps,
      greVendorNominalBoreMm: section?.greVendorNominalBoreMm, caesarDiameterMm: section?.caesarDiameterMm,
      propertyDiameterMm: scalar(properties[0]?.properties?.diameter), diameterDisposition: item.sectionDisposition,
      sourceKind: section?.sourceKind || 'UNRESOLVED', diagnostics: section?.diagnostics || [] });
  });
}
export function resolvePipelineAnalysisDiameterPlan(input = {}) {
  const diagnostics = []; let source;
  try { source = copy(input); if (!obj(source)) throw new TypeError(); }
  catch { source = {}; diagnostics.push(diag('PIPELINE_DIAMETER_INPUT_INVALID')); }
  const analysis = analysisPlan(source.analysisSectionPlan, diagnostics);
  const properties = propertyPlan(source, diagnostics), map = propertyMap(properties, analysis, diagnostics);
  const targets = targetMap(source.diameterSections, analysis.sections, diagnostics);
  const sections = analysis.sections.map((section) => resolveSection(section,
    targets[section.analysisSectionId] || [], source, analysis, map, diagnostics));
  const elements = resolveElements(analysis, sections, map, diagnostics);
  const migration = migrationContract({
    outsideDiameterSourceKinds: sections.map((item) => item.quantitySources.outsideDiameterMm?.sourceKind),
    nominalPipeSizeSourceKinds: sections.map((item) => item.quantitySources.nominalPipeSizeNps?.sourceKind),
    greVendorNominalBoreSourceKinds: sections.map((item) => item.quantitySources.greVendorNominalBoreMm?.sourceKind),
    legacyDiameterEvidenceObserved: sections.some((item) => item.quantitySources.outsideDiameterMm?.legacyObserved === true),
    legacyDiameterBasisConfirmed: source.settings?.diameterSource === 'branch-diameter'
      && source.settings?.diameterBasisConfirmed === true,
    sourceAuthority: source.sourceAuthority, sourceReference: source.sourceReference,
  });
  return planContract({ analysisSectionPlanSchema: analysis.schema, propertySectionPlanSchema: properties.schema,
    migration, sectionResolutions: sections, elementResolutions: elements,
    diagnostics, blockerCodes: diagnostics.map((item) => item.code) });
}
export const buildPipelineAnalysisDiameterPlanJson = (plan) => JSON.stringify(plan, null, 2);
const cell = (value) => value == null ? '' : String(value).replace(/[\t\r\n]/g, ' ');
export function buildPipelineAnalysisDiameterLedgerText(plan) {
  const header = ['RecordType', 'Schema', 'AnalysisSectionId', 'ElementIndex', 'ElementId', 'ProfileId',
    'OutsideDiameterMm', 'NominalPipeSizeNps', 'GreVendorNominalBoreMm', 'CaesarDiameterMm',
    'PropertyDiameterMm', 'Disposition', 'SourceKind', 'Ready'];
  const sections = (plan?.sectionResolutions || []).map((item) => ['SECTION', item.schema,
    item.analysisSectionId, item.startElementIndex, '', item.profileId, item.outsideDiameterMm,
    item.nominalPipeSizeNps, item.greVendorNominalBoreMm, item.caesarDiameterMm, '',
    'SECTION_START', item.sourceKind, item.ready ? 'YES' : 'NO']);
  const elements = (plan?.elementResolutions || []).map((item) => ['ELEMENT', item.schema,
    item.analysisSectionId, item.elementIndex, item.elementId, item.profileId, item.outsideDiameterMm,
    item.nominalPipeSizeNps, item.greVendorNominalBoreMm, item.caesarDiameterMm,
    item.propertyDiameterMm, item.diameterDisposition, item.sourceKind, item.ready ? 'YES' : 'NO']);
  return [header, ...sections, ...elements].map((row) => row.map(cell).join('\t')).join('\n');
}
