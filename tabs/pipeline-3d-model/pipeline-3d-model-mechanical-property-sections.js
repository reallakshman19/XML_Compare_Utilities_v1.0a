export const PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA = 'PipelineMechanicalPropertyPlan.v1';
export const PIPELINE_MECHANICAL_PROPERTY_SECTION_SCHEMA = 'PipelineMechanicalPropertySection.v1';
export const PIPELINE_ELEMENT_MECHANICAL_PROPERTY_SCHEMA = 'PipelineElementMechanicalPropertyResolution.v1';

const NUMBER_FIELDS = Object.freeze([
  Object.freeze({ key: 'modulus', xml: 'MODULUS', aliases: ['modulus'], domain: 'positive' }),
  ...Array.from({ length: 9 }, (_, index) => Object.freeze({
    key: `hotMod${index + 1}`, xml: `HOT_MOD${index + 1}`,
    aliases: [`hotMod${index + 1}`], domain: 'positive',
  })),
  Object.freeze({ key: 'poissons', xml: 'POISSONS', aliases: ['poissons', 'poissonRatio'], domain: 'poisson' }),
  Object.freeze({ key: 'pipeDensity', xml: 'PIPE_DENSITY', aliases: ['pipeDensity'], domain: 'nonNegative' }),
]);
const TEXT_FIELDS = Object.freeze([
  Object.freeze({ key: 'materialName', xml: 'MATERIAL_NAME', aliases: ['materialName'] }),
]);
const FIELD_DEFS = Object.freeze([...NUMBER_FIELDS, ...TEXT_FIELDS]);
const text = (value) => String(value ?? '').trim();
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}
function candidateValue(source, definition) {
  for (const alias of definition.aliases) if (Object.hasOwn(source, alias)) return source[alias];
  return undefined;
}
function normalizedSource(input = {}) {
  const source = { ...(input?.mechanicalProperties || {}), ...(input?.properties || {}), ...(input || {}) };
  const hot = Array.isArray(input?.mechanicalProperties?.hotModuli)
    ? input.mechanicalProperties.hotModuli
    : (Array.isArray(input?.hotModuli) ? input.hotModuli : []);
  hot.forEach((value, index) => { source[`hotMod${index + 1}`] = value; });
  return source;
}
function validNumber(value, domain) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (domain === 'positive' && number <= 0) return null;
  if (domain === 'nonNegative' && number < 0) return null;
  if (domain === 'poisson' && (number < 0 || number >= 0.5)) return null;
  return number;
}
function parseExplicit(input, sourceName) {
  const source = normalizedSource(input), values = {}, diagnostics = [];
  for (const definition of NUMBER_FIELDS) {
    const raw = candidateValue(source, definition);
    if (raw === undefined || raw === null || text(raw) === '') continue;
    const value = validNumber(raw, definition.domain);
    if (value === null) diagnostics.push(diagnostic('PIPELINE_MECHANICAL_PROPERTY_VALUE_INVALID',
      `${definition.xml} has an invalid value.`, { propertyName: definition.xml, value: raw, source: sourceName }));
    else values[definition.key] = value;
  }
  for (const definition of TEXT_FIELDS) {
    const raw = candidateValue(source, definition);
    if (raw === undefined || raw === null) continue;
    const value = text(raw);
    if (value) values[definition.key] = value;
  }
  return freeze({ values: freeze(values), diagnostics: freeze(diagnostics) });
}
function propertyShape(flat = {}) {
  return freeze({
    modulus: flat.modulus ?? null,
    hotModuli: freeze(Array.from({ length: 9 }, (_, index) => flat[`hotMod${index + 1}`] ?? null)),
    poissons: flat.poissons ?? null,
    pipeDensity: flat.pipeDensity ?? null,
    materialName: text(flat.materialName),
  });
}
function explicitNames(values) {
  return freeze(FIELD_DEFS.filter((item) => Object.hasOwn(values, item.key)).map((item) => item.xml));
}
function rawSectionSource(propertySections, startElementIndex) {
  return (propertySections || []).find((item) => Number(item?.startElementIndex) === startElementIndex) || {};
}
function sourceRows(branchInfo, propertySections, propertySectionPlan) {
  return (propertySectionPlan?.sections || []).map((section, index) => ({
    section,
    source: index === 0 ? branchInfo : rawSectionSource(propertySections, section.startElementIndex),
    sourceName: index === 0 ? 'BASE_BRANCH_INFO' : 'SECTION_OVERRIDE',
  }));
}
function buildSections(branchInfo, propertySections, propertySectionPlan, diagnostics) {
  const sections = [];
  let effective = {}, sources = {};
  for (const row of sourceRows(branchInfo, propertySections, propertySectionPlan)) {
    const parsed = parseExplicit(row.source, row.sourceName);
    diagnostics.push(...parsed.diagnostics);
    effective = { ...effective, ...parsed.values };
    sources = { ...sources, ...Object.fromEntries(Object.keys(parsed.values).map((key) => [key, row.sourceName])) };
    sections.push(freeze({
      schema: PIPELINE_MECHANICAL_PROPERTY_SECTION_SCHEMA,
      sectionId: row.section.sectionId,
      analysisSectionId: row.section.analysisSectionId || '',
      startElementIndex: row.section.startElementIndex,
      startNode: row.section.startNode,
      explicitProperties: propertyShape(parsed.values),
      effectiveProperties: propertyShape(effective),
      effectiveSources: freeze({ ...sources }),
      explicitPropertyNames: explicitNames(parsed.values),
    }));
  }
  return freeze(sections);
}
function elementResolutions(sections, elementCount) {
  const result = [];
  let sectionIndex = 0;
  for (let elementIndex = 0; elementIndex < elementCount; elementIndex += 1) {
    if (sectionIndex + 1 < sections.length
      && sections[sectionIndex + 1].startElementIndex === elementIndex) sectionIndex += 1;
    const section = sections[sectionIndex];
    result.push(freeze({
      schema: PIPELINE_ELEMENT_MECHANICAL_PROPERTY_SCHEMA,
      elementIndex,
      elementId: `E${elementIndex + 1}`,
      sectionId: section?.sectionId || '',
      propertyDisposition: section?.startElementIndex === elementIndex
        ? 'SECTION_START_REPEATED' : 'INHERITED_REPEATED',
      properties: section?.effectiveProperties || propertyShape(),
      emittedProperties: section?.effectiveProperties || propertyShape(),
      effectiveSources: section?.effectiveSources || freeze({}),
    }));
  }
  return freeze(result);
}
function planCompatible(propertySectionPlan) {
  const sections = propertySectionPlan?.sections;
  const elements = propertySectionPlan?.elements;
  return Array.isArray(sections) && Array.isArray(elements)
    && sections.every((section, index) => section?.sectionId === `S${index + 1}`
      && Number.isInteger(section.startElementIndex) && section.startElementIndex >= 0)
    && elements.every((element, index) => element?.elementId === `E${index + 1}`);
}
export function resolvePipelineMechanicalPropertyPlan({
  branchInfo = {}, propertySections = [], propertySectionPlan = null,
} = {}) {
  const diagnostics = [];
  if (!planCompatible(propertySectionPlan)) diagnostics.push(diagnostic(
    'PIPELINE_MECHANICAL_PROPERTY_SECTION_PLAN_INVALID',
    'Mechanical properties require an authenticated property-section plan.'));
  const sections = diagnostics.length ? freeze([])
    : buildSections(branchInfo, propertySections, propertySectionPlan, diagnostics);
  const elements = elementResolutions(sections, propertySectionPlan?.elements?.length || 0);
  const frozenDiagnostics = freeze(diagnostics);
  const active = sections.some((section) => section.explicitPropertyNames.length > 0)
    || frozenDiagnostics.some((item) => item.code === 'PIPELINE_MECHANICAL_PROPERTY_VALUE_INVALID');
  return freeze({
    schema: PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA,
    propertySectionPlanSchema: propertySectionPlan?.schema || '',
    active,
    sectionCount: sections.length,
    sections,
    elements,
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0,
  });
}
export const buildPipelineMechanicalPropertyPlanJson = (plan) => JSON.stringify(plan, null, 2);
export const _internal = Object.freeze({ FIELD_DEFS, normalizedSource, parseExplicit, propertyShape });
