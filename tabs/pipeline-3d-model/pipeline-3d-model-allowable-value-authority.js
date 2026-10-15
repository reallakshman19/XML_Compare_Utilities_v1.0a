export const PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA = 'PipelineAllowableValueAuthorityPlan.v1';
export const PIPELINE_ALLOWABLE_VALUE_AUTHORITY_SCHEMA = 'PipelineAllowableValueAuthority.v1';
export const PIPELINE_ALLOWABLE_VALUE_CASE_AUTHORITY_SCHEMA = 'PipelineAllowableValueCaseAuthority.v1';
export const PIPELINE_ELEMENT_ALLOWABLE_VALUE_BINDING_SCHEMA = 'PipelineElementAllowableValueBinding.v1';
export const PIPELINE_CODE_SOURCE_AUTHORITY_SCHEMA = 'PipelineCodeSourceAuthority.v1';
export const PIPELINE_APPROVED_SOURCE_IDENTITY_SCHEMA = 'PipelineApprovedSourceIdentity.v1';
export const PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_SCHEMA = 'PipelineMaterialAllowableCatalogEntry.v1';
export const PIPELINE_ALLOWABLE_VALUE_DISPOSITIONS = Object.freeze(['VALUE', 'ZERO', 'SENTINEL']);
const PROFILE_PLAN_SCHEMA = 'PipelineInputXmlProfileAuthorityPlan.v1';
const PIPING_CODE_PLAN_SCHEMA = 'PipelinePipingCodeAuthorityPlan.v1';
const SHA256 = /^[a-f0-9]{64}$/i;
const text = (value) => String(value ?? '').trim();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value); }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))); }
function diagnostic(code, message, details = {}) { return freeze({ severity: 'BLOCKING', code, message, details: freeze({ ...details }) }); }
function positive(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function profileReady(plan) { return plain(plan) && plan.schema === PROFILE_PLAN_SCHEMA && plan.ready === true && Array.isArray(plan.sectionAuthorities) && !(plan.blockerCodes || []).length; }
function pipingCodeReady(plan) { return plain(plan) && plan.schema === PIPING_CODE_PLAN_SCHEMA && plan.ready === true && Array.isArray(plan.elements) && Array.isArray(plan.authorities) && !(plan.blockerCodes || []).length; }
function own(source, keys) { return keys.find((key) => Object.hasOwn(source, key)); }
export function approvedSourceReferenceKey(source) { return `${text(source?.sourceId)}@${text(source?.revision)}#sha256:${text(source?.sha256).toLowerCase()}`; }
function sourceIdentity(source, role, authorityIndex, diagnostics) {
  if (!plain(source)) { diagnostics.push(diagnostic('PIPELINE_APPROVED_SOURCE_IDENTITY_INVALID', 'An approved source identity must be a plain object.', { authorityIndex, role })); return null; }
  const sourceId = text(source.sourceId), title = text(source.title), revision = text(source.revision);
  const approvalReference = text(source.approvalReference), sha256 = text(source.sha256).toLowerCase();
  if (!sourceId || !title || !revision || !approvalReference) diagnostics.push(diagnostic('PIPELINE_APPROVED_SOURCE_IDENTITY_INVALID', 'Approved source identity fields must be nonblank.', { authorityIndex, role, sourceId, title, revision, approvalReference }));
  if (!SHA256.test(sha256)) diagnostics.push(diagnostic('PIPELINE_APPROVED_SOURCE_SHA256_INVALID', 'Approved source identity requires a 64-hex SHA-256 digest.', { authorityIndex, role, sha256 }));
  if (!sourceId || !title || !revision || !approvalReference || !SHA256.test(sha256)) return null;
  const identity = { schema: PIPELINE_APPROVED_SOURCE_IDENTITY_SCHEMA, role, sourceId, title, revision, approvalReference, sha256 };
  return freeze({ ...identity, referenceKey: approvedSourceReferenceKey(identity) });
}
function codeSourceAuthority(source, authorityIndex, diagnostics) {
  const codeFamily = text(source.codeFamily), codeEdition = text(source.codeEdition);
  if (!codeFamily || !codeEdition) diagnostics.push(diagnostic('PIPELINE_CODE_SOURCE_FIELD_INVALID', 'Code family and code edition must be nonblank.', { authorityIndex, codeFamily, codeEdition }));
  const codeSource = sourceIdentity(source.codeSource, 'CODE', authorityIndex, diagnostics);
  const allowableSource = sourceIdentity(source.allowableSource, 'ALLOWABLE', authorityIndex, diagnostics);
  if (!codeFamily || !codeEdition || !codeSource || !allowableSource) return null;
  return freeze({ schema: PIPELINE_CODE_SOURCE_AUTHORITY_SCHEMA, codeFamily, codeEdition, codeSource, allowableSource });
}
function provenanceMatches(authority, source) { return text(authority?.sourceAuthority) === source?.sourceId && text(authority?.sourceReference) === source?.referenceKey; }
function pipingCatalogMatches(authority, codeSource) { const catalog = authority?.catalogEntry; return plain(catalog) && catalog.codeFamily === codeSource?.codeFamily && catalog.codeEdition === codeSource?.codeEdition && catalog.caesarVersion === '14.00'; }
function authorityValue(source, keys, diagnostics, details) {
  const key = own(source, keys);
  if (!key) { diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_FIELD_REQUIRED', 'Every governed allowable field requires an explicit authority disposition.', { ...details, field: keys[0] })); return null; }
  const raw = source[key];
  if (plain(raw)) {
    const disposition = text(raw.disposition).toUpperCase(), number = finite(raw.value);
    const valid = disposition === 'SENTINEL' || disposition === 'ZERO' || (disposition === 'VALUE' && number != null && number > 0);
    if (!valid) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_FIELD_INVALID', 'Allowable field disposition must be VALUE, ZERO, or SENTINEL with a valid value.', { ...details, field: keys[0] }));
    if (!valid) return null;
    return freeze({ disposition, value: disposition === 'SENTINEL' ? null : disposition === 'ZERO' ? 0 : number });
  }
  if (raw == null) return freeze({ disposition: 'SENTINEL', value: null });
  const number = finite(raw);
  if (number == null || number < 0) { diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_FIELD_INVALID', 'Allowable field values must be finite non-negative numbers or explicit sentinel.', { ...details, field: keys[0], value: raw })); return null; }
  return freeze({ disposition: number === 0 ? 'ZERO' : 'VALUE', value: number });
}
function normalizedValues(source, diagnostics, details) { return freeze({ COLD_ALLOW: authorityValue(source, ['coldAllow', 'COLD_ALLOW'], diagnostics, details), SY: authorityValue(source, ['sy', 'SY'], diagnostics, details), SU: authorityValue(source, ['su', 'SU'], diagnostics, details) }); }
function normalizedCase(source, authorityIndex, caseIndex, expectedSource, diagnostics) {
  if (!plain(source)) { diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CASE_INVALID', 'An allowable-value case authority must be a plain object.', { authorityIndex, caseIndex })); return null; }
  const num = Number(source.num ?? source.caseNumber), temperature = finite(source.temperature);
  const sourceAuthority = text(source.sourceAuthority) || expectedSource?.sourceId;
  const sourceReference = text(source.sourceReference) || expectedSource?.referenceKey;
  if (!Number.isInteger(num) || num < 1 || num > 9) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CASE_NUMBER_INVALID', 'Case authority number must be 1 through 9.', { authorityIndex, caseIndex, num: source.num ?? source.caseNumber }));
  if (temperature == null) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_TEMPERATURE_INVALID', 'Case authority temperature must be finite.', { authorityIndex, caseIndex, num }));
  if (sourceAuthority !== expectedSource?.sourceId || sourceReference !== expectedSource?.referenceKey) diagnostics.push(diagnostic('PIPELINE_CODE_SOURCE_ALLOWABLE_PROVENANCE_MISMATCH', 'Case allowable provenance must match the approved allowable source identity.', { authorityIndex, caseIndex, num }));
  const values = freeze({ HOT_ALLOW: authorityValue(source, ['hotAllow', 'HOT_ALLOW'], diagnostics, { authorityIndex, caseIndex, num }), HOT_SY: authorityValue(source, ['hotSy', 'HOT_SY'], diagnostics, { authorityIndex, caseIndex, num }), HOT_SU: authorityValue(source, ['hotSu', 'HOT_SU'], diagnostics, { authorityIndex, caseIndex, num }) });
  if (!Number.isInteger(num) || num < 1 || num > 9 || temperature == null || sourceAuthority !== expectedSource?.sourceId || sourceReference !== expectedSource?.referenceKey || Object.values(values).some((item) => !item)) return null;
  return freeze({ schema: PIPELINE_ALLOWABLE_VALUE_CASE_AUTHORITY_SCHEMA, num, temperature, values, sourceAuthority, sourceReference });
}
function normalizedCases(source, authorityIndex, expectedSource, diagnostics) {
  const byNumber = new Map(), inputs = Array.isArray(source.cases) ? source.cases : [];
  if (!Array.isArray(source.cases)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CASES_INVALID', 'Allowable-value authority cases must be an array.', { authorityIndex }));
  inputs.forEach((item, caseIndex) => { const normalized = normalizedCase(item, authorityIndex, caseIndex, expectedSource, diagnostics); if (!normalized) return; if (byNumber.has(normalized.num)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CASE_DUPLICATE', 'Case authority numbers must be unique.', { authorityIndex, num: normalized.num })); else byNumber.set(normalized.num, normalized); });
  return byNumber;
}
function normalizedCatalogEntry(source, authorityIndex, codeSource, diagnostics) {
  const raw = source.catalogEntry ?? source.materialAllowableCatalogEntry;
  if (!plain(raw)) { diagnostics.push(diagnostic('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_REQUIRED', 'An allowable-value authority requires one selected material/allowable catalog entry.', { authorityIndex })); return null; }
  const catalogEntryId = text(raw.catalogEntryId ?? raw.id), codeFamily = text(raw.codeFamily), codeEdition = text(raw.codeEdition), caesarVersion = text(raw.caesarVersion);
  const materialNumber = positive(raw.materialNumber), materialName = text(raw.materialName), sourceAuthority = text(raw.sourceAuthority), sourceReference = text(raw.sourceReference);
  if (!catalogEntryId || !codeFamily || !codeEdition || !caesarVersion || materialNumber == null || !materialName || !sourceAuthority || !sourceReference) diagnostics.push(diagnostic('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_INVALID', 'Selected material/allowable catalog entry fields must be complete and valid.', { authorityIndex, catalogEntryId, codeFamily, codeEdition, caesarVersion, materialNumber: raw.materialNumber, materialName, sourceAuthority, sourceReference }));
  if (caesarVersion && caesarVersion !== '14.00') diagnostics.push(diagnostic('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_VERSION_INVALID', 'Selected material/allowable catalog entry must target the CAESAR 14 writer profile.', { authorityIndex, catalogEntryId, caesarVersion }));
  const values = normalizedValues(raw, diagnostics, { authorityIndex, catalogEntryId });
  const cases = normalizedCases(raw, authorityIndex, codeSource?.allowableSource, diagnostics);
  if (!catalogEntryId || !codeFamily || !codeEdition || caesarVersion !== '14.00' || materialNumber == null || !materialName || !sourceAuthority || !sourceReference || Object.values(values).some((item) => !item) || !codeSource) return null;
  return freeze({ schema: PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ENTRY_SCHEMA, catalogEntryId, codeFamily, codeEdition, caesarVersion, materialNumber, materialName, values, sourceAuthority, sourceReference, cases: freeze([...cases.values()].sort((left, right) => left.num - right.num)) });
}
function effectiveMaterial(element) { return { materialNumber: positive(element?.properties?.materialNumber), materialName: text(element?.mechanicalProperties?.materialName ?? element?.emittedMechanicalProperties?.materialName ?? element?.properties?.materialName ?? element?.emittedProperties?.materialName) }; }
function effectiveTemperatures(element) { const source = element?.properties?.temperatures ?? element?.emittedProperties?.temperatures ?? []; return Array.from({ length: 9 }, (_, index) => finite(source?.[index])); }
function requiredSections(elements) { return new Set(elements.filter((element) => element?.allowableStress).map((element) => text(element.analysisSectionId)).filter(Boolean)); }
function normalizedAuthority(source, authorityIndex, sectionById, pipingBySection, diagnostics) {
  if (!plain(source)) { diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_INVALID', 'An allowable-value authority record must be a plain object.', { authorityIndex })); return null; }
  const analysisSectionId = text(source.analysisSectionId), section = sectionById.get(analysisSectionId), profileId = text(source.profileId), resolvedMode = text(source.resolvedMode);
  const materialNumber = positive(source.materialNumber), materialName = text(source.materialName), sourceAuthority = text(source.sourceAuthority), sourceReference = text(source.sourceReference);
  const codeSource = codeSourceAuthority(source, authorityIndex, diagnostics);
  const catalogEntry = normalizedCatalogEntry(source, authorityIndex, codeSource, diagnostics);
  if (!section) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_SECTION_INVALID', 'Allowable-value authority must reference an existing analysis section.', { authorityIndex, analysisSectionId }));
  if (section && (profileId !== section.profileId || resolvedMode !== section.resolvedMode)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_PROFILE_MISMATCH', 'Allowable-value authority must match the section profile and resolved mode.', { authorityIndex, analysisSectionId, profileId, resolvedMode }));
  if (materialNumber == null || !materialName) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_MATERIAL_INVALID', 'Allowable-value authority requires positive materialNumber and nonblank materialName.', { authorityIndex, analysisSectionId }));
  const pipingAuthority = pipingBySection.get(analysisSectionId);
  if (codeSource && !provenanceMatches(pipingAuthority, codeSource.codeSource)) diagnostics.push(diagnostic('PIPELINE_CODE_SOURCE_PIPING_PROVENANCE_MISMATCH', 'Piping-code provenance must match the approved code source identity.', { authorityIndex, analysisSectionId }));
  if (codeSource && !pipingCatalogMatches(pipingAuthority, codeSource)) diagnostics.push(diagnostic('PIPELINE_CODE_SOURCE_PIPING_CATALOG_MISMATCH', 'Approved code family and edition must match the selected piping-code catalog entry.', { authorityIndex, analysisSectionId }));
  if (codeSource && (sourceAuthority !== codeSource.allowableSource.sourceId || sourceReference !== codeSource.allowableSource.referenceKey)) diagnostics.push(diagnostic('PIPELINE_CODE_SOURCE_ALLOWABLE_PROVENANCE_MISMATCH', 'Allowable-value provenance must match the approved allowable source identity.', { authorityIndex, analysisSectionId }));
  const values = normalizedValues(source, diagnostics, { authorityIndex, analysisSectionId });
  const cases = normalizedCases(source, authorityIndex, codeSource?.allowableSource, diagnostics);
  const caseList = freeze([...cases.values()].sort((left, right) => left.num - right.num));
  const catalogConflict = catalogEntry && codeSource && (catalogEntry.codeFamily !== codeSource.codeFamily || catalogEntry.codeEdition !== codeSource.codeEdition || catalogEntry.materialNumber !== materialNumber || catalogEntry.materialName !== materialName || catalogEntry.sourceAuthority !== sourceAuthority || catalogEntry.sourceReference !== sourceReference || !same(catalogEntry.values, values) || !same(catalogEntry.cases, caseList));
  if (catalogConflict) diagnostics.push(diagnostic('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_CONFLICT', 'Allowable-value authority must exactly match the selected material/allowable catalog entry.', { authorityIndex, analysisSectionId, catalogEntryId: catalogEntry.catalogEntryId }));
  const invalid = !section || profileId !== section.profileId || resolvedMode !== section.resolvedMode || materialNumber == null || !materialName || !codeSource || !catalogEntry || catalogConflict || !provenanceMatches(pipingAuthority, codeSource.codeSource) || !pipingCatalogMatches(pipingAuthority, codeSource) || sourceAuthority !== codeSource.allowableSource.sourceId || sourceReference !== codeSource.allowableSource.referenceKey || Object.values(values).some((item) => !item);
  if (invalid) return null;
  return freeze({ schema: PIPELINE_ALLOWABLE_VALUE_AUTHORITY_SCHEMA, authorityIndex, analysisSectionId, profileId, resolvedMode, catalogEntryId: catalogEntry.catalogEntryId, catalogEntry, materialNumber, materialName, values, sourceAuthority, sourceReference, codeSourceAuthority: codeSource, cases: caseList });
}
function authorityMap(inputs, sectionById, pipingBySection, required, diagnostics) {
  const bySection = new Map(), catalogOwners = new Map();
  inputs.forEach((source, authorityIndex) => {
    const item = normalizedAuthority(source, authorityIndex, sectionById, pipingBySection, diagnostics); if (!item) return;
    if (bySection.has(item.analysisSectionId)) { diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_DUPLICATE', 'An analysis section may have only one allowable-value authority record.', { analysisSectionId: item.analysisSectionId })); return; }
    const prior = catalogOwners.get(item.catalogEntryId);
    if (prior && !same(prior.catalogEntry, item.catalogEntry)) { diagnostics.push(diagnostic('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ID_CONFLICT', 'A reused material/allowable catalog entry ID must resolve to identical normalized evidence.', { catalogEntryId: item.catalogEntryId, analysisSectionIds: [prior.analysisSectionId, item.analysisSectionId] })); diagnostics.push(diagnostic('PIPELINE_MATERIAL_ALLOWABLE_CATALOG_ID_DUPLICATE', 'Conflicting catalog identity reuse retains the legacy duplicate-ID blocker.', { catalogEntryId: item.catalogEntryId, analysisSectionIds: [prior.analysisSectionId, item.analysisSectionId] })); return; }
    bySection.set(item.analysisSectionId, item); if (!prior) catalogOwners.set(item.catalogEntryId, item);
  });
  for (const id of required) if (!bySection.has(id)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_REQUIRED', 'Every section containing ALLOWABLESTRESS requires allowable-value authority.', { analysisSectionId: id }));
  for (const id of bySection.keys()) if (!required.has(id)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_UNUSED', 'Allowable-value authority cannot target a section without ALLOWABLESTRESS.', { analysisSectionId: id }));
  return bySection;
}
function validateSectionContext(authority, sectionElements, diagnostics) {
  const caseByNumber = new Map(authority.cases.map((item) => [item.num, item]));
  sectionElements.forEach((element) => {
    const material = effectiveMaterial(element);
    if (material.materialNumber !== authority.materialNumber || material.materialName !== authority.materialName) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_MATERIAL_MISMATCH', 'Authority material identity must match every governed element.', { elementId: element.id, analysisSectionId: authority.analysisSectionId, materialNumber: material.materialNumber, materialName: material.materialName }));
    effectiveTemperatures(element).forEach((temperature, index) => { const num = index + 1, caseAuthority = caseByNumber.get(num); if (temperature == null && caseAuthority) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CASE_UNUSED', 'Case authority cannot target an inactive effective temperature slot.', { elementId: element.id, analysisSectionId: authority.analysisSectionId, num })); if (temperature != null && (!caseAuthority || caseAuthority.temperature !== temperature)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_TEMPERATURE_MISMATCH', 'Every active temperature slot requires an exact matching case authority.', { elementId: element.id, analysisSectionId: authority.analysisSectionId, num, temperature })); });
  });
}
function conflict(value, expected) { return expected == null ? value != null && value !== '' : value != null && value !== '' && Number(value) !== expected; }
function boundAllowable(allowable, authority, diagnostics) {
  if (!allowable || !authority) return allowable || null;
  Object.entries(authority.values).forEach(([field, evidence]) => { if (conflict(allowable.attributes?.[field], evidence.value)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CONFLICT', 'Raw allowable value conflicts with approved authority.', { elementId: allowable.elementId, field, supplied: allowable.attributes[field], expected: evidence.value })); });
  const caseByNumber = new Map(authority.cases.map((item) => [item.num, item]));
  const cases = freeze((allowable.cases || []).map((caseItem) => {
    const caseAuthority = caseByNumber.get(caseItem.num) || null;
    if (!caseAuthority) { ['HOT_ALLOW', 'HOT_SY', 'HOT_SU'].forEach((field) => { const supplied = caseItem.attributes?.[field]; if (supplied != null && supplied !== '') diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_UNGOVERNED_CASE_VALUE', 'An inactive temperature slot cannot carry governed hot allowable values.', { elementId: allowable.elementId, num: caseItem.num, field, supplied })); }); return caseItem; }
    const expected = Object.fromEntries(Object.entries(caseAuthority.values).map(([field, evidence]) => [field, evidence.value]));
    Object.entries(expected).forEach(([field, value]) => { if (conflict(caseItem.attributes?.[field], value)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_CONFLICT', 'Raw case value conflicts with approved authority.', { elementId: allowable.elementId, num: caseItem.num, field, supplied: caseItem.attributes[field], expected: value })); });
    return freeze({ ...caseItem, attributes: freeze({ ...(caseItem.attributes || {}), ...expected }), allowableValueCaseAuthority: caseAuthority });
  }));
  const cold = Object.fromEntries(Object.entries(authority.values).map(([field, evidence]) => [field, evidence.value]));
  return freeze({ ...allowable, attributes: freeze({ ...(allowable.attributes || {}), ...cold }), cases, allowableValueAuthority: authority });
}
function bindings(elements, bySection, diagnostics) { return freeze(elements.map((element, index) => { const authority = element?.allowableStress ? bySection.get(element.analysisSectionId) || null : null; return freeze({ schema: PIPELINE_ELEMENT_ALLOWABLE_VALUE_BINDING_SCHEMA, elementId: element?.id || `E${index + 1}`, elementIndex: index, analysisSectionId: text(element?.analysisSectionId), authority, allowableStress: boundAllowable(element?.allowableStress, authority, diagnostics) }); })); }
function finalPlan(active, authorities, elements, required, diagnostics) { const frozenDiagnostics = freeze(diagnostics); return freeze({ schema: PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA, active, authorityCount: authorities.length, requiredSectionCount: required.size, authorities: freeze(authorities), elements, diagnostics: frozenDiagnostics, blockerCodes: freeze([...new Set(frozenDiagnostics.map((item) => item.code))]), ready: frozenDiagnostics.length === 0 }); }
export function resolvePipelineAllowableValueAuthorityPlan({ profileAuthorityPlan = null, pipingCodeAuthorityPlan = null, elements = [], allowableValueAuthorities = [] } = {}) {
  const inputs = Array.isArray(allowableValueAuthorities) ? allowableValueAuthorities : [];
  const active = inputs.length > 0 || (profileReady(profileAuthorityPlan) && elements.some((element) => element?.allowableStress));
  if (!active) return finalPlan(false, [], Object.freeze([]), new Set(), []);
  const diagnostics = [];
  if (!Array.isArray(allowableValueAuthorities)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_AUTHORITY_INVALID', 'Allowable-value authority input must be an array.'));
  if (!profileReady(profileAuthorityPlan)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_PROFILE_AUTHORITY_REQUIRED', 'Allowable-value authority requires a ready profile authority plan.'));
  if (!pipingCodeReady(pipingCodeAuthorityPlan)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_PIPING_CODE_AUTHORITY_REQUIRED', 'Allowable-value authority requires a ready piping-code authority plan.'));
  if (!Array.isArray(elements)) diagnostics.push(diagnostic('PIPELINE_ALLOWABLE_VALUE_ELEMENTS_INVALID', 'Allowable-value authority elements must be an array.'));
  if (!profileReady(profileAuthorityPlan) || !pipingCodeReady(pipingCodeAuthorityPlan) || !Array.isArray(elements)) return finalPlan(true, [], Object.freeze([]), new Set(), diagnostics);
  const required = requiredSections(elements), sectionById = new Map(profileAuthorityPlan.sectionAuthorities.map((item) => [item.analysisSectionId, item]));
  const pipingBySection = new Map(pipingCodeAuthorityPlan.authorities.map((item) => [item.analysisSectionId, item]));
  const bySection = authorityMap(inputs, sectionById, pipingBySection, required, diagnostics);
  bySection.forEach((authority, id) => validateSectionContext(authority, elements.filter((element) => element.analysisSectionId === id), diagnostics));
  const elementBindings = bindings(elements, bySection, diagnostics);
  const authorities = [...bySection.values()].sort((left, right) => left.analysisSectionId.localeCompare(right.analysisSectionId));
  return finalPlan(true, authorities, elementBindings, required, diagnostics);
}
export const buildPipelineAllowableValueAuthorityPlanJson = (plan) => JSON.stringify(plan, null, 2);
