export const PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA = 'PipelinePipingCodeAuthorityPlan.v1';
export const PIPELINE_PIPING_CODE_AUTHORITY_SCHEMA = 'PipelinePipingCodeAuthority.v1';
export const PIPELINE_ELEMENT_PIPING_CODE_BINDING_SCHEMA = 'PipelineElementPipingCodeBinding.v1';
export const PIPELINE_PIPING_CODE_CATALOG_ENTRY_SCHEMA = 'PipelinePipingCodeCatalogEntry.v1';

const PROFILE_PLAN_SCHEMA = 'PipelineInputXmlProfileAuthorityPlan.v1';
const ALLOWABLE_PLAN_SCHEMA = 'PipelineAllowableStressPlan.v1';
const text = (value) => String(value ?? '').trim();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function plain(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
}

function diagnostic(code, message, details = {}) {
  return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) });
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function profileReady(plan) {
  return plain(plan) && plan.schema === PROFILE_PLAN_SCHEMA && plan.ready === true
    && Array.isArray(plan.sectionAuthorities) && Array.isArray(plan.elementAuthorities)
    && !(plan.blockerCodes || []).length;
}

function allowableReady(plan) {
  return plain(plan) && plan.schema === ALLOWABLE_PLAN_SCHEMA
    && Array.isArray(plan.elements) && plan.ready === true;
}

function requiredSectionIds(allowableStressPlan, profileAuthorityPlan, diagnostics) {
  const required = new Set();
  allowableStressPlan.elements.forEach((item, index) => {
    if (!item?.allowableStress) return;
    const authority = profileAuthorityPlan.elementAuthorities[index];
    if (!authority || authority.elementIndex !== index || authority.elementId !== item.elementId
      || !text(authority.analysisSectionId)) {
      diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_ELEMENT_AUTHORITY_INVALID',
        'An allowable-stress element requires matching profile element authority.',
        { elementIndex: index, elementId: item?.elementId }));
      return;
    }
    required.add(authority.analysisSectionId);
  });
  return required;
}

function normalizedCatalogEntry(source, authorityIndex, diagnostics) {
  const raw = source?.catalogEntry;
  if (!plain(raw)) {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CATALOG_ENTRY_REQUIRED',
      'A piping-code authority requires one selected catalog entry.', { authorityIndex }));
    return null;
  }
  const catalogEntryId = text(raw.catalogEntryId ?? raw.id);
  const codeFamily = text(raw.codeFamily);
  const codeEdition = text(raw.codeEdition);
  const caesarVersion = text(raw.caesarVersion);
  const caesarPipingCode = positiveInteger(raw.caesarPipingCode ?? raw.pipingCode);
  const sourceAuthority = text(raw.sourceAuthority);
  const sourceReference = text(raw.sourceReference);
  if (!catalogEntryId || !codeFamily || !codeEdition || !caesarVersion
    || caesarPipingCode == null || !sourceAuthority || !sourceReference) {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CATALOG_ENTRY_INVALID',
      'Selected catalog entry fields must be complete and valid.',
      { authorityIndex, catalogEntryId, codeFamily, codeEdition, caesarVersion,
        caesarPipingCode: raw.caesarPipingCode ?? raw.pipingCode,
        sourceAuthority, sourceReference }));
    return null;
  }
  if (caesarVersion !== '14.00') {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CATALOG_VERSION_INVALID',
      'Selected catalog entry must target the CAESAR 14 writer profile.',
      { authorityIndex, catalogEntryId, caesarVersion }));
    return null;
  }
  return freeze({
    schema: PIPELINE_PIPING_CODE_CATALOG_ENTRY_SCHEMA,
    catalogEntryId,
    codeFamily,
    codeEdition,
    caesarVersion,
    caesarPipingCode,
    sourceAuthority,
    sourceReference,
  });
}

function normalizedAuthority(source, authorityIndex, sectionById, diagnostics) {
  if (!plain(source)) {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_AUTHORITY_INVALID',
      'A piping-code authority record must be a plain object.', { authorityIndex }));
    return null;
  }
  const analysisSectionId = text(source.analysisSectionId);
  const section = sectionById.get(analysisSectionId);
  const profileId = text(source.profileId);
  const resolvedMode = text(source.resolvedMode);
  const caesarPipingCode = positiveInteger(source.caesarPipingCode ?? source.pipingCode);
  const sourceAuthority = text(source.sourceAuthority);
  const sourceReference = text(source.sourceReference);
  const catalogEntry = normalizedCatalogEntry(source, authorityIndex, diagnostics);
  const mismatched = section && (profileId !== section.profileId || resolvedMode !== section.resolvedMode);
  if (!section) diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_SECTION_INVALID',
    'A piping-code authority must reference an existing analysis section.',
    { authorityIndex, analysisSectionId }));
  if (mismatched) diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_PROFILE_MISMATCH',
    'A piping-code authority must match the owning section profile and resolved mode.',
    { authorityIndex, analysisSectionId, profileId, resolvedMode,
      expectedProfileId: section.profileId, expectedResolvedMode: section.resolvedMode }));
  if (caesarPipingCode == null) diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_VALUE_INVALID',
    'A piping-code authority requires a positive integer CAESAR PIPING_CODE.',
    { authorityIndex, analysisSectionId, caesarPipingCode: source.caesarPipingCode ?? source.pipingCode }));
  if (!sourceAuthority || !sourceReference) diagnostics.push(diagnostic(
    'PIPELINE_PIPING_CODE_SOURCE_REQUIRED',
    'A piping-code authority requires nonblank source authority and source reference.',
    { authorityIndex, analysisSectionId }));
  const catalogConflict = catalogEntry && (caesarPipingCode !== catalogEntry.caesarPipingCode
    || sourceAuthority !== catalogEntry.sourceAuthority
    || sourceReference !== catalogEntry.sourceReference);
  if (catalogConflict) diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CATALOG_CONFLICT',
    'Piping-code authority value and provenance must match the selected catalog entry.',
    { authorityIndex, analysisSectionId, catalogEntryId: catalogEntry.catalogEntryId }));
  if (!section || mismatched || caesarPipingCode == null || !sourceAuthority || !sourceReference
    || !catalogEntry || catalogConflict) return null;
  return freeze({
    schema: PIPELINE_PIPING_CODE_AUTHORITY_SCHEMA,
    authorityIndex,
    analysisSectionId,
    profileId,
    resolvedMode,
    catalogEntryId: catalogEntry.catalogEntryId,
    catalogEntry,
    caesarPipingCode,
    sourceAuthority,
    sourceReference,
  });
}

function authorityMap(inputs, sectionById, required, diagnostics) {
  const bySection = new Map();
  const catalogOwners = new Map();
  inputs.forEach((source, authorityIndex) => {
    const item = normalizedAuthority(source, authorityIndex, sectionById, diagnostics);
    if (!item) return;
    if (bySection.has(item.analysisSectionId)) {
      diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_AUTHORITY_DUPLICATE',
        'An analysis section may have only one piping-code authority record.',
        { analysisSectionId: item.analysisSectionId,
          authorityIndexes: [bySection.get(item.analysisSectionId).authorityIndex, authorityIndex] }));
      return;
    }
    const prior = catalogOwners.get(item.catalogEntryId);
    if (prior && !same(prior.catalogEntry, item.catalogEntry)) {
      diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CATALOG_ID_CONFLICT',
        'A reused piping-code catalog entry ID must resolve to identical normalized evidence.',
        { catalogEntryId: item.catalogEntryId,
          analysisSectionIds: [prior.analysisSectionId, item.analysisSectionId] }));
      diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CATALOG_ID_DUPLICATE',
        'Conflicting catalog identity reuse retains the legacy duplicate-ID blocker.',
        { catalogEntryId: item.catalogEntryId,
          analysisSectionIds: [prior.analysisSectionId, item.analysisSectionId] }));
      return;
    }
    bySection.set(item.analysisSectionId, item);
    if (!prior) catalogOwners.set(item.catalogEntryId, item);
  });
  for (const analysisSectionId of required) if (!bySection.has(analysisSectionId)) {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_AUTHORITY_REQUIRED',
      'Every section containing ALLOWABLESTRESS requires piping-code authority.',
      { analysisSectionId }));
  }
  for (const analysisSectionId of bySection.keys()) if (!required.has(analysisSectionId)) {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_AUTHORITY_UNUSED',
      'A piping-code authority cannot target a section without ALLOWABLESTRESS.',
      { analysisSectionId }));
  }
  return bySection;
}

function boundAllowable(allowable, authority, elementAuthority, diagnostics) {
  if (!allowable || !authority || !elementAuthority) return allowable || null;
  const supplied = allowable.attributes?.PIPING_CODE;
  if (supplied != null && supplied !== '' && Number(supplied) !== authority.caesarPipingCode) {
    diagnostics.push(diagnostic('PIPELINE_PIPING_CODE_CONFLICT',
      'ALLOWABLESTRESS PIPING_CODE conflicts with section authority.',
      { elementId: allowable.elementId, analysisSectionId: authority.analysisSectionId,
        suppliedPipingCode: supplied, authorityPipingCode: authority.caesarPipingCode }));
  }
  return freeze({
    ...allowable,
    attributes: freeze({ ...(allowable.attributes || {}), PIPING_CODE: authority.caesarPipingCode }),
    pipingCodeAuthority: authority,
  });
}

function elementBindings(allowableStressPlan, profileAuthorityPlan, bySection, diagnostics) {
  return freeze(allowableStressPlan.elements.map((item, index) => {
    const elementAuthority = profileAuthorityPlan.elementAuthorities[index] || null;
    const analysisSectionId = text(elementAuthority?.analysisSectionId);
    const authority = item?.allowableStress ? bySection.get(analysisSectionId) || null : null;
    return freeze({
      schema: PIPELINE_ELEMENT_PIPING_CODE_BINDING_SCHEMA,
      elementId: item?.elementId || `E${index + 1}`,
      elementIndex: index,
      analysisSectionId,
      profileId: text(elementAuthority?.profileId),
      resolvedMode: text(elementAuthority?.resolvedMode),
      authority,
      allowableStress: boundAllowable(item?.allowableStress, authority, elementAuthority, diagnostics),
    });
  }));
}

function finalPlan(active, authorities, elements, required, diagnostics) {
  const frozenDiagnostics = freeze(diagnostics);
  return freeze({
    schema: PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA,
    active,
    authorityCount: authorities.length,
    requiredSectionCount: required.size,
    authorities: freeze(authorities),
    elements,
    diagnostics: frozenDiagnostics,
    blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]),
    ready: frozenDiagnostics.length === 0,
  });
}

export function resolvePipelinePipingCodeAuthorityPlan({
  profileAuthorityPlan = null,
  allowableStressPlan = null,
  pipingCodeAuthorities = [],
} = {}) {
  const inputs = Array.isArray(pipingCodeAuthorities) ? pipingCodeAuthorities : [];
  const active = inputs.length > 0 || (profileReady(profileAuthorityPlan) && allowableStressPlan?.active === true);
  if (!active) return finalPlan(false, [], Object.freeze([]), new Set(), []);
  const diagnostics = [];
  if (!Array.isArray(pipingCodeAuthorities)) diagnostics.push(diagnostic(
    'PIPELINE_PIPING_CODE_AUTHORITY_INVALID', 'Piping-code authority input must be an array.'));
  if (!profileReady(profileAuthorityPlan)) diagnostics.push(diagnostic(
    'PIPELINE_PIPING_CODE_PROFILE_AUTHORITY_REQUIRED',
    'Piping-code authority requires a ready profile authority plan.'));
  if (!allowableReady(allowableStressPlan)) diagnostics.push(diagnostic(
    'PIPELINE_PIPING_CODE_ALLOWABLE_PLAN_INVALID',
    'Piping-code authority requires a ready allowable-stress plan.'));
  if (!profileReady(profileAuthorityPlan) || !allowableReady(allowableStressPlan)) {
    return finalPlan(true, [], Object.freeze([]), new Set(), diagnostics);
  }
  const sectionById = new Map(profileAuthorityPlan.sectionAuthorities
    .map((item) => [item.analysisSectionId, item]));
  const required = requiredSectionIds(allowableStressPlan, profileAuthorityPlan, diagnostics);
  const bySection = authorityMap(inputs, sectionById, required, diagnostics);
  const elements = elementBindings(allowableStressPlan, profileAuthorityPlan, bySection, diagnostics);
  const authorities = [...bySection.values()].sort((left, right) =>
    left.analysisSectionId.localeCompare(right.analysisSectionId));
  return finalPlan(true, authorities, elements, required, diagnostics);
}

export const buildPipelinePipingCodeAuthorityPlanJson = (plan) => JSON.stringify(plan, null, 2);
