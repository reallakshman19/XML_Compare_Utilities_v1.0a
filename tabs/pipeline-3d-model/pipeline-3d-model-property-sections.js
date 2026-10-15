export const PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA = 'PipelinePropertySectionPlan.v1';
export const PIPELINE_PROPERTY_SECTION_SCHEMA = 'PipelinePropertySection.v1';
export const PIPELINE_ELEMENT_PROPERTY_RESOLUTION_SCHEMA = 'PipelineElementPropertyResolution.v1';

const FIELD_DEFS = Object.freeze([
  Object.freeze({ key: 'diameter', xml: 'DIAMETER', aliases: ['diameter', 'boreMm'], domain: 'positive' }),
  Object.freeze({ key: 'wallThickness', xml: 'WALL_THICK', aliases: ['wallThickness'], domain: 'nonNegative' }),
  Object.freeze({ key: 'insulationThickness', xml: 'INSUL_THICK', aliases: ['insulationThickness'], domain: 'nonNegative' }),
  Object.freeze({ key: 'corrosionAllowance', xml: 'CORR_ALLOW', aliases: ['corrosionAllowance'], domain: 'nonNegative' }),
  ...Array.from({ length: 9 }, (_, index) => Object.freeze({ key: `temperature${index + 1}`,
    xml: `TEMP_EXP_C${index + 1}`, aliases: [`temperature${index + 1}`, `t${index + 1}`], domain: 'finite' })),
  ...Array.from({ length: 9 }, (_, index) => Object.freeze({ key: `pressure${index + 1}`,
    xml: `PRESSURE_C${index + 1}`, aliases: [`pressure${index + 1}`, `p${index + 1}`], domain: 'nonNegative' })),
  Object.freeze({ key: 'hydroPressure', xml: 'HYDRO_PRESSURE', aliases: ['hydroPressure'], domain: 'nonNegative' }),
  Object.freeze({ key: 'insulationDensity', xml: 'INSUL_DENSITY', aliases: ['insulationDensity'], domain: 'nonNegative' }),
  Object.freeze({ key: 'fluidDensity', xml: 'FLUID_DENSITY', aliases: ['fluidDensity'], domain: 'nonNegative' }),
  Object.freeze({ key: 'materialNumber', xml: 'MATERIAL_NUM', aliases: ['materialNumber', 'materialCode'], domain: 'integerNonNegative' }),
]);
const text = (value) => String(value ?? '').trim();
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value); }
function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}
function candidateValue(source, definition) {
  for (const alias of definition.aliases) if (Object.hasOwn(source, alias)) return source[alias];
  return undefined;
}
function validNumber(value, domain) {
  const number = Number(value); if (!Number.isFinite(number)) return null;
  if (domain === 'positive' && number <= 0) return null;
  if (domain === 'nonNegative' && number < 0) return null;
  if (domain === 'integerNonNegative' && (!Number.isInteger(number) || number < 0)) return null;
  return number;
}
function normalizedSource(input = {}) {
  const source = { ...(input?.properties || {}), ...(input || {}) };
  const temperatures = Array.isArray(input?.properties?.temperatures) ? input.properties.temperatures : input?.temperatures;
  const pressures = Array.isArray(input?.properties?.pressures) ? input.properties.pressures : input?.pressures;
  (temperatures || []).forEach((value, index) => { source[`temperature${index + 1}`] = value; });
  (pressures || []).forEach((value, index) => { source[`pressure${index + 1}`] = value; });
  return source;
}
function parseExplicit(input, sourceName) {
  const source = normalizedSource(input), values = {}, diagnostics = [];
  for (const definition of FIELD_DEFS) {
    const raw = candidateValue(source, definition);
    if (raw === undefined || raw === null || text(raw) === '') continue;
    const value = validNumber(raw, definition.domain);
    if (value === null) diagnostics.push(diagnostic('PIPELINE_PROPERTY_VALUE_INVALID',
      `${definition.xml} has an invalid numeric value.`, { propertyName: definition.xml, value: raw, source: sourceName }));
    else values[definition.key] = value;
  }
  return freeze({ values: freeze(values), diagnostics: freeze(diagnostics) });
}
function propertyShape(flat = {}) {
  return freeze({ diameter: flat.diameter ?? null, wallThickness: flat.wallThickness ?? null,
    insulationThickness: flat.insulationThickness ?? null, corrosionAllowance: flat.corrosionAllowance ?? null,
    temperatures: freeze(Array.from({ length: 9 }, (_, index) => flat[`temperature${index + 1}`] ?? null)),
    pressures: freeze(Array.from({ length: 9 }, (_, index) => flat[`pressure${index + 1}`] ?? null)),
    hydroPressure: flat.hydroPressure ?? null, insulationDensity: flat.insulationDensity ?? null,
    fluidDensity: flat.fluidDensity ?? null, materialNumber: flat.materialNumber ?? null });
}
function changedValues(previous, explicit) {
  return freeze(Object.fromEntries(Object.entries(explicit).filter(([key, value]) => previous[key] !== value)));
}
function sectionStart(input, elementCount, diagnostics) {
  const start = Number(input?.startElementIndex);
  if (!Number.isInteger(start) || start <= 0 || start >= elementCount) {
    diagnostics.push(diagnostic('PIPELINE_PROPERTY_SECTION_START_INVALID',
      'A property-section override must start on an existing element after E1.',
      { startElementIndex: input?.startElementIndex, elementCount })); return null;
  }
  return start;
}
function uniqueOverrides(propertySections, elementCount, diagnostics) {
  const seen = new Set(), accepted = [], forced = propertySections.some((item) => item?.forceSection === true);
  let previous = 0;
  for (const source of propertySections) {
    const start = sectionStart(source, elementCount, diagnostics); if (start === null) continue;
    if (seen.has(start)) diagnostics.push(diagnostic('PIPELINE_PROPERTY_SECTION_DUPLICATE',
      `Property-section element index ${start} is duplicated.`, { startElementIndex: start }));
    else if (forced && start <= previous) diagnostics.push(diagnostic('PIPELINE_PROPERTY_SECTION_START_INVALID',
      'Authenticated property sections must preserve canonical order.', { startElementIndex: start, previousStart: previous }));
    else { seen.add(start); accepted.push({ source, start }); previous = start; }
  }
  return forced ? accepted : accepted.sort((left, right) => left.start - right.start);
}
function baseRequiredDiagnostics(effective, elementCount) {
  if (!elementCount) return [];
  const diagnostics = [];
  if (effective.diameter == null) diagnostics.push(diagnostic('PIPELINE_DIAMETER_REQUIRED',
    'The first element of the LINE scope requires a positive DIAMETER.'));
  if (effective.wallThickness == null) diagnostics.push(diagnostic('PIPELINE_WALL_THICKNESS_REQUIRED',
    'The first element of the LINE scope requires a finite nonnegative WALL_THICK.'));
  return diagnostics;
}
function assignmentSources(source, explicit, diagnostics) {
  const supplied = plain(source.propertySources) ? source.propertySources : {}, result = {};
  Object.keys(explicit).forEach((key) => {
    const evidence = text(supplied[key]);
    if (!evidence || (!evidence.startsWith('AUTHENTICATED_ASSIGNMENT:')
      && !evidence.startsWith('ANALYSIS_SECTION_INPUT:'))) diagnostics.push(diagnostic(
      'PIPELINE_SECTION_PROPERTY_ASSIGNMENT_PROVENANCE_INVALID',
      'Every forced section property requires authenticated provenance.',
      { analysisSectionId: text(source.analysisSectionId), fieldId: key }));
    result[key] = evidence;
  });
  return result;
}
function buildSections(branchInfo, coordinateRows, propertySections, diagnostics) {
  const elementCount = Math.max(0, coordinateRows.length - 1); if (!elementCount) return [];
  const base = parseExplicit(branchInfo, 'BASE_BRANCH_INFO');
  diagnostics.push(...base.diagnostics, ...baseRequiredDiagnostics(base.values, elementCount));
  const sections = []; let effective = { ...base.values };
  let sources = Object.fromEntries(Object.keys(effective).map((key) => [key, 'BASE_BRANCH_INFO']));
  sections.push({ start: 0, analysisSectionId: 'AS1', source: 'BASE_BRANCH_INFO',
    explicit: { ...base.values }, effective: { ...effective }, sources: { ...sources } });
  for (const override of uniqueOverrides(propertySections || [], elementCount, diagnostics)) {
    const parsed = parseExplicit(override.source, 'SECTION_OVERRIDE'); diagnostics.push(...parsed.diagnostics);
    const forced = override.source.forceSection === true;
    const explicit = forced ? { ...parsed.values } : { ...changedValues(effective, parsed.values) };
    if (forced) {
      const missing = Object.keys(effective).filter((key) => !Object.hasOwn(explicit, key));
      if (missing.length) diagnostics.push(diagnostic('PIPELINE_SECTION_PROPERTY_ASSIGNMENT_REQUIRED',
        'A forced canonical section must explicitly evidence every effective property.',
        { analysisSectionId: text(override.source.analysisSectionId), fieldIds: missing }));
    }
    if (!Object.keys(explicit).length && !forced) {
      diagnostics.push(diagnostic('PIPELINE_PROPERTY_SECTION_NO_CHANGE',
        `Property section at element index ${override.start} does not change the effective property set.`,
        { startElementIndex: override.start })); continue;
    }
    const nextSources = forced ? assignmentSources(override.source, explicit, diagnostics)
      : Object.fromEntries(Object.keys(explicit).map((key) => [key, 'SECTION_OVERRIDE']));
    effective = { ...effective, ...explicit }; sources = { ...sources, ...nextSources };
    sections.push({ start: override.start, analysisSectionId: text(override.source.analysisSectionId),
      source: 'SECTION_OVERRIDE', sourceAuthority: text(override.source.sourceAuthority),
      sourceReference: text(override.source.sourceReference), explicit, effective: { ...effective },
      sources: { ...sources } });
  }
  return sections;
}
function frozenSection(section, index, coordinateRows) {
  return freeze({ schema: PIPELINE_PROPERTY_SECTION_SCHEMA, sectionId: `S${index + 1}`,
    analysisSectionId: section.analysisSectionId || '', startElementIndex: section.start,
    startNode: Number(coordinateRows[section.start]?.nodeNumber), source: section.source,
    sourceAuthority: section.sourceAuthority || '', sourceReference: section.sourceReference || '',
    explicitProperties: propertyShape(section.explicit), effectiveProperties: propertyShape(section.effective),
    effectiveSources: freeze({ ...section.sources }), explicitPropertyNames: freeze(FIELD_DEFS
      .filter((item) => Object.hasOwn(section.explicit, item.key)).map((item) => item.xml)) });
}
function elementResolutions(sections, elementCount) {
  const result = []; let sectionIndex = 0;
  for (let elementIndex = 0; elementIndex < elementCount; elementIndex += 1) {
    if (sectionIndex + 1 < sections.length && sections[sectionIndex + 1].startElementIndex === elementIndex) sectionIndex += 1;
    const section = sections[sectionIndex], isStart = section.startElementIndex === elementIndex;
    result.push(freeze({ schema: PIPELINE_ELEMENT_PROPERTY_RESOLUTION_SCHEMA, elementIndex,
      elementId: `E${elementIndex + 1}`, sectionId: section.sectionId,
      propertyDisposition: isStart ? 'SECTION_START' : 'INHERITED', properties: section.effectiveProperties,
      emittedProperties: isStart ? section.explicitProperties : propertyShape(), effectiveSources: section.effectiveSources }));
  }
  return freeze(result);
}
function uniqueDiagnostics(items) {
  const keys = new Set(); return items.filter((item) => {
    const key = `${item.code}:${JSON.stringify(item.details)}`;
    if (keys.has(key)) return false; keys.add(key); return true;
  });
}
export function resolvePipelinePropertySectionPlan({ branchInfo = {}, coordinateRows = [], propertySections = [] } = {}) {
  const diagnostics = [], rawSections = buildSections(branchInfo, coordinateRows, propertySections, diagnostics);
  const sections = freeze(rawSections.map((section, index) => frozenSection(section, index, coordinateRows)));
  const elements = elementResolutions(sections, Math.max(0, coordinateRows.length - 1));
  const frozenDiagnostics = freeze(uniqueDiagnostics(diagnostics));
  return freeze({ schema: PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA, lineNo: text(branchInfo.lineNo),
    sectionCount: sections.length, sections, elements, diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]), ready: frozenDiagnostics.length === 0 });
}
export const buildPipelinePropertySectionPlanJson = (plan) => JSON.stringify(plan, null, 2);
function cell(value) { return value == null ? '' : String(value).replace(/[\t\r\n]/g, ' '); }
export function buildPipelinePropertySectionLedgerText(plan) {
  const header = ['Schema', 'ElementId', 'SectionId', 'StartElementIndex', 'StartNode', 'PropertyName',
    'ExplicitValue', 'EffectiveValue', 'Disposition', 'Source'];
  const rows = [];
  for (const resolution of plan?.elements || []) {
    const section = plan.sections.find((item) => item.sectionId === resolution.sectionId);
    for (const definition of FIELD_DEFS) {
      const effective = normalizedSource(resolution.properties)[definition.key];
      const explicit = normalizedSource(resolution.emittedProperties)[definition.key];
      const disposition = effective == null ? 'UNRESOLVED' : (explicit == null ? 'INHERITED' : 'EXPLICIT');
      rows.push([PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA, resolution.elementId, resolution.sectionId,
        section?.startElementIndex, section?.startNode, definition.xml, explicit, effective,
        disposition, resolution.effectiveSources?.[definition.key] || '']);
    }
  }
  return [header, ...rows].map((row) => row.map(cell).join('\t')).join('\n');
}
export const _internal = Object.freeze({ FIELD_DEFS, parseExplicit, propertyShape, normalizedSource });
