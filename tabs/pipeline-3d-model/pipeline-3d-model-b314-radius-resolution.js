import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import {
  PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA,
  PIPELINE_ANALYSIS_SECTION_SCHEMA,
  PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA,
} from './pipeline-3d-model-analysis-section-contracts.js';
import {
  PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA,
  PIPELINE_ANALYSIS_DIAMETER_RESOLUTION_SCHEMA,
  PIPELINE_ELEMENT_DIAMETER_RESOLUTION_SCHEMA,
  PIPELINE_DIAMETER_MIGRATION_SCHEMA,
  PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA,
  parsePipelinePositiveScalar,
} from './pipeline-3d-model-diameter-contracts.js';
import {
  PIPELINE_BEND_RESOLUTION_SCHEMA,
  PIPELINE_B314_RADIUS_POLICY_IDS,
  createPipelineB314RadiusMigration,
  createPipelineB314RadiusPlan,
  createPipelineB314RadiusResolution,
  getPipelineB314RadiusPolicy,
} from './pipeline-3d-model-b314-radius-contracts.js';

const text = (value) => String(value ?? '').trim();
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const supplied = (source, field) => plain(source) && Object.hasOwn(source, field)
  && source[field] !== null && !(typeof source[field] === 'string' && !source[field].trim());
const meaningful = (source, field) => supplied(source, field) && source[field] !== false;
const code = (suffix) => `PIPELINE_B314_RADIUS_${suffix}`;
const diagnostic = (suffix, message = 'Invalid B31.4 radius evidence.', details = {}) => ({
  severity: 'BLOCKING', code: code(suffix), message, details,
});

function cloneJson(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!plain(value)) throw new TypeError('Resolver input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, cloneJson(value[key])]));
}
function safeInput(input, diagnostics) {
  try { const source = cloneJson(input); if (plain(source)) return source; } catch { /* blocked */ }
  diagnostics.push(diagnostic('INPUT_INVALID', 'Resolver input must be JSON-safe plain data.'));
  return {};
}
function blocked(record) {
  return (Array.isArray(record?.blockerCodes) && record.blockerCodes.length > 0)
    || (Array.isArray(record?.diagnostics)
      && record.diagnostics.some((item) => text(item?.severity) === 'BLOCKING'));
}
function exactRecord(record, schema, requireReady = true) {
  return plain(record) && record.schema === schema && (!requireReady || record.ready === true)
    && Array.isArray(record.diagnostics) && Array.isArray(record.blockerCodes) && !blocked(record);
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort(compare)
    .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function positiveField(record, field, errors, suffix) {
  if (!supplied(record, field)) return null;
  const value = parsePipelinePositiveScalar(record[field]);
  if (!value) errors.push(diagnostic(suffix, `${field} must be a positive scalar when supplied.`,
    { field, value: record[field] }));
  return value;
}

function authenticateAnalysisPlan(source, errors) {
  const plan = source.analysisSectionPlan;
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  const elements = Array.isArray(plan?.elementResolutions) ? plan.elementResolutions : [];
  const rootValid = plain(plan) && plan.schema === PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    && plan.ready === true && Array.isArray(plan.diagnostics) && Array.isArray(plan.blockerCodes)
    && !blocked(plan) && sections.length > 0 && elements.length > 0;
  if (!rootValid) errors.push(diagnostic('INPUT_INVALID', 'Analysis-section plan is not authentic and ready.'));
  const sectionById = Object.create(null), elementByIndex = Object.create(null);
  sections.forEach((section, index) => {
    const previousStart = index ? sections[index - 1]?.startElementIndex : null;
    const validStart = Number.isInteger(section?.startElementIndex) && section.startElementIndex >= 0
      && section.startElementIndex < elements.length
      && (index === 0 ? section.startElementIndex === 0 : section.startElementIndex > previousStart);
    const profile = getPipelineEngineeringProfile(section?.profileId);
    const valid = exactRecord(section, PIPELINE_ANALYSIS_SECTION_SCHEMA, false)
      && section.status !== 'BLOCKED' && section.analysisSectionId === `AS${index + 1}`
      && validStart && Boolean(profile) && !Object.hasOwn(sectionById, section.analysisSectionId);
    if (!valid) errors.push(diagnostic('OWNERSHIP_INVALID',
      'Analysis sections require canonical nonempty intervals within the element range.',
      { analysisSectionId: text(section?.analysisSectionId), startElementIndex: section?.startElementIndex,
        elementCount: elements.length }));
    if (plain(section)) sectionById[section.analysisSectionId] = section;
  });
  elements.forEach((element, index) => {
    const owner = [...sections].filter((section) => section.startElementIndex <= index).at(-1);
    const profile = getPipelineEngineeringProfile(owner?.profileId);
    const valid = exactRecord(element, PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA)
      && owner && element.elementIndex === index && element.elementId === `E${index + 1}`
      && element.analysisSectionId === owner.analysisSectionId && element.profileId === owner.profileId
      && element.resolvedMode === profile?.resolvedMode
      && element.sectionDisposition === (owner.startElementIndex === index ? 'SECTION_START' : 'INHERITED');
    if (!valid) errors.push(diagnostic('OWNERSHIP_INVALID',
      'Analysis element identity, profile, mode and interval ownership must be canonical.', { elementIndex: index }));
    if (plain(element)) elementByIndex[index] = element;
  });
  return { plan, sections, elements, sectionById, elementByIndex };
}

function authenticateDiameterMigration(migration) {
  return exactRecord(migration, PIPELINE_DIAMETER_MIGRATION_SCHEMA)
    && Array.isArray(migration.outsideDiameterSourceKinds)
    && Array.isArray(migration.nominalPipeSizeSourceKinds)
    && Array.isArray(migration.greVendorNominalBoreSourceKinds)
    && migration.npsToOutsideDiameterConversionApplied === false
    && migration.greVendorBoreToOutsideDiameterConversionApplied === false
    && !(migration.legacyDiameterEvidenceObserved === true
      && migration.legacyDiameterBasisConfirmed !== true);
}
function validateSectionQuantities(record, errors) {
  const profile = getPipelineEngineeringProfile(record?.profileId);
  const outside = positiveField(record, 'outsideDiameterMm', errors, 'DIAMETER_PLAN_INVALID');
  const nps = positiveField(record, 'nominalPipeSizeNps', errors, 'DIAMETER_PLAN_INVALID');
  const vendorBore = positiveField(record, 'greVendorNominalBoreMm', errors, 'DIAMETER_PLAN_INVALID');
  const caesar = positiveField(record, 'caesarDiameterMm', errors, 'DIAMETER_PLAN_INVALID');
  const metallic = profile?.materialState === 'METALLIC';
  if (!profile || (metallic && !outside) || (!metallic && !vendorBore)
    || (metallic && vendorBore) || caesar !== outside
    || record.physicalDiameterReady !== Boolean(outside)
    || record.sizeBandInputReady !== Boolean(nps)
    || record.vendorSeriesInputReady !== Boolean(vendorBore)
    || !text(record.sourceKind) || !plain(record.quantitySources)) errors.push(diagnostic(
    'DIAMETER_PLAN_INVALID', 'Diameter section quantities and readiness flags must match canonical semantics.',
    { analysisSectionId: text(record?.analysisSectionId) }));
  return { outside, nps, vendorBore, caesar };
}
function validateElementQuantities(record, owner, errors) {
  const profile = getPipelineEngineeringProfile(record?.profileId);
  const outside = positiveField(record, 'outsideDiameterMm', errors, 'DIAMETER_PLAN_INVALID');
  const nps = positiveField(record, 'nominalPipeSizeNps', errors, 'DIAMETER_PLAN_INVALID');
  const vendorBore = positiveField(record, 'greVendorNominalBoreMm', errors, 'DIAMETER_PLAN_INVALID');
  const caesar = positiveField(record, 'caesarDiameterMm', errors, 'DIAMETER_PLAN_INVALID');
  positiveField(record, 'propertyDiameterMm', errors, 'DIAMETER_PLAN_INVALID');
  const metallic = profile?.materialState === 'METALLIC';
  const quantitiesMatch = owner && ['outsideDiameterMm', 'nominalPipeSizeNps',
    'greVendorNominalBoreMm', 'caesarDiameterMm'].every((field) => record[field] === owner[field]);
  if (!profile || (metallic && !outside) || (!metallic && !vendorBore)
    || (metallic && vendorBore) || caesar !== outside || !text(record.sourceKind) || !quantitiesMatch
    || Boolean(nps) !== Boolean(parsePipelinePositiveScalar(owner?.nominalPipeSizeNps))) errors.push(diagnostic(
    'DIAMETER_PLAN_INVALID', 'Diameter element quantities must be canonical and equal the owning section.',
    { elementIndex: record?.elementIndex }));
}
function authenticateDiameterPlan(source, analysis, errors) {
  const plan = source.analysisDiameterPlan;
  const sections = Array.isArray(plan?.sectionResolutions) ? plan.sectionResolutions : [];
  const elements = Array.isArray(plan?.elementResolutions) ? plan.elementResolutions : [];
  const rootValid = plain(plan) && plan.schema === PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA
    && plan.ready === true && Array.isArray(plan.diagnostics) && Array.isArray(plan.blockerCodes)
    && !blocked(plan) && plan.analysisSectionPlanSchema === PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
    && plan.propertySectionPlanSchema === PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA
    && authenticateDiameterMigration(plan.migration)
    && sections.length === analysis.sections.length && elements.length === analysis.elements.length;
  if (!rootValid) errors.push(diagnostic('DIAMETER_PLAN_INVALID', 'Diameter plan is not authentic and ready.'));
  const sectionById = Object.create(null), elementByIndex = Object.create(null);
  sections.forEach((section, index) => {
    const owner = analysis.sections[index], profile = getPipelineEngineeringProfile(section?.profileId);
    const valid = exactRecord(section, PIPELINE_ANALYSIS_DIAMETER_RESOLUTION_SCHEMA)
      && section.status === 'RESOLVED' && owner
      && section.analysisSectionId === owner.analysisSectionId
      && section.startElementIndex === owner.startElementIndex && section.profileId === owner.profileId
      && section.resolvedMode === profile?.resolvedMode && !Object.hasOwn(sectionById, section.analysisSectionId);
    validateSectionQuantities(section, errors);
    if (!valid) errors.push(diagnostic('DIAMETER_PLAN_INVALID',
      'Diameter section identity, profile and interval start must match the analysis plan.',
      { analysisSectionId: text(section?.analysisSectionId) }));
    if (plain(section)) sectionById[section.analysisSectionId] = section;
  });
  elements.forEach((element, index) => {
    const analysisElement = analysis.elementByIndex[index];
    const owner = sectionById[analysisElement?.analysisSectionId];
    const valid = exactRecord(element, PIPELINE_ELEMENT_DIAMETER_RESOLUTION_SCHEMA)
      && analysisElement && owner && element.elementIndex === index && element.elementId === `E${index + 1}`
      && element.analysisSectionId === analysisElement.analysisSectionId
      && element.profileId === analysisElement.profileId
      && element.diameterDisposition === (owner.startElementIndex === index ? 'SECTION_START' : 'INHERITED');
    validateElementQuantities(element, owner, errors);
    if (!valid) errors.push(diagnostic('DIAMETER_PLAN_INVALID',
      'Diameter element identity and disposition must match analysis ownership.', { elementIndex: index }));
    if (plain(element)) elementByIndex[index] = element;
  });
  return { plan, sections, elements, sectionById, elementByIndex };
}
function authenticateBendResolution(source, errors) {
  const plan = source.bendResolution;
  if (!plain(plan) || plan.schema !== PIPELINE_BEND_RESOLUTION_SCHEMA
    || !Array.isArray(plan.candidates) || !plan.candidates.every(plain)) errors.push(diagnostic(
    'INPUT_INVALID', 'A canonical PipelineBendResolution.v3 candidate array is required.'));
  return plain(plan) && Array.isArray(plan.candidates) ? plan : { schema: '', candidates: [] };
}
function authenticatePlans(source, errors) {
  const analysis = authenticateAnalysisPlan(source, errors);
  const diameter = authenticateDiameterPlan(source, analysis, errors);
  const bend = authenticateBendResolution(source, errors);
  return { analysis, diameter, bend };
}

function candidateOwner(candidate, plans) {
  const incoming = plans.analysis.elementByIndex[candidate.incomingElementIndex];
  const outgoing = plans.analysis.elementByIndex[candidate.outgoingElementIndex];
  const section = incoming && plans.analysis.sectionById[incoming.analysisSectionId];
  const diameterSection = section && plans.diameter.sectionById[section.analysisSectionId];
  const incomingDiameter = plans.diameter.elementByIndex[candidate.incomingElementIndex];
  const outgoingDiameter = plans.diameter.elementByIndex[candidate.outgoingElementIndex];
  const errors = [];
  if (!incoming || !outgoing || !section || candidate.outgoingElementIndex !== candidate.incomingElementIndex + 1
    || incoming.analysisSectionId !== outgoing.analysisSectionId) errors.push(diagnostic(
    'OWNERSHIP_INVALID', 'Candidate incoming and outgoing elements must occupy one analysis section.',
    { candidateId: text(candidate.id) }));
  if (section?.profileId === 'asme-b31.4' && (!diameterSection || !incomingDiameter || !outgoingDiameter
    || incomingDiameter.analysisSectionId !== section.analysisSectionId
    || outgoingDiameter.analysisSectionId !== section.analysisSectionId)) errors.push(diagnostic(
    'DIAMETER_PLAN_INVALID', 'B31.4 candidate requires authenticated section and element diameter evidence.',
    { candidateId: text(candidate.id) }));
  return { incoming, outgoing, section, diameterSection, incomingDiameter, outgoingDiameter, errors };
}
function validateCandidateSet(candidates, errors) {
  const ids = Object.create(null), owners = Object.create(null), corners = Object.create(null);
  candidates.forEach((candidate) => {
    const candidateId = text(candidate.id), owner = candidate.incomingElementIndex;
    const valid = candidateId && Number.isInteger(owner) && owner >= 0
      && candidate.outgoingElementIndex === owner + 1 && Number.isInteger(candidate.cornerNode)
      && Number.isInteger(candidate.previousNode) && Number.isInteger(candidate.nextNode)
      && Number.isFinite(candidate.turnAngleDeg) && text(candidate.classification)
      && text(candidate.sourceBasis) && text(candidate.status);
    if (!valid) errors.push(diagnostic('INPUT_INVALID', 'Bend candidate identity and evidence are invalid.'));
    if (ids[candidateId] || owners[owner] || corners[candidate.cornerNode]) errors.push(diagnostic(
      'CANDIDATE_COVERAGE_INVALID', 'Candidate ID, incoming owner and corner node must be unique.',
      { candidateId, incomingElementIndex: owner, cornerNode: candidate.cornerNode }));
    ids[candidateId] = true; owners[owner] = true; corners[candidate.cornerNode] = true;
  });
}

const POLICY_FIELDS = Object.freeze({
  elastic: Object.freeze(['formulaEnabled', 'youngsModulusMpa', 'allowableBendingStressMpa',
    'practicalEnabled', 'practicalRadiusD']),
  sizeBand: Object.freeze(['qualifiedAlternativeRequested', 'qualificationEvidenceId',
    'projectMinimumEnabled', 'projectMinimumRadiusD', 'procedureMinimumRadiusD']),
  project: Object.freeze(['projectRadiusD']),
});
function booleanField(record, field, fallback, errors, suffix) {
  if (!supplied(record, field)) return fallback;
  if (typeof record[field] === 'boolean') return record[field];
  if (/^(true|1|yes|on)$/i.test(text(record[field]))) return true;
  if (/^(false|0|no|off)$/i.test(text(record[field]))) return false;
  errors.push(diagnostic(suffix, `${field} must be boolean-compatible.`, { field, value: record[field] }));
  return fallback;
}
function rejectIncompatible(record, allowedFields, errors) {
  const all = [...POLICY_FIELDS.elastic, ...POLICY_FIELDS.sizeBand, ...POLICY_FIELDS.project];
  const incompatible = [...new Set(all.filter((field) => !allowedFields.includes(field)))]
    .filter((field) => meaningful(record, field));
  if (incompatible.length) errors.push(diagnostic('POLICY_INVALID',
    'Explicit policy contains fields incompatible with its radiusPolicyId.', { fields: incompatible }));
}
function normalizePolicy(record, requiredClass = '') {
  const errors = [];
  if (!plain(record)) return { value: null, errors: [diagnostic('TARGET_INVALID', 'Policy must be a plain object.')] };
  const radiusPolicyId = text(record.radiusPolicyId), descriptor = getPipelineB314RadiusPolicy(radiusPolicyId);
  const bendClass = text(record.bendClass) || requiredClass;
  if (!descriptor) errors.push(diagnostic('POLICY_INVALID', 'radiusPolicyId must be exact and canonical.'));
  if (!['elastic', 'cold-field'].includes(bendClass) || (requiredClass && bendClass !== requiredClass)
    || (descriptor && descriptor.bendClass !== bendClass)) errors.push(diagnostic(
    'BEND_CLASS_INCOMPATIBLE', 'Policy bendClass must match its target and canonical descriptor.'));
  const value = { radiusPolicyId, bendClass, sourceAuthority: text(record.sourceAuthority),
    sourceReference: text(record.sourceReference) };
  if (radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.ELASTIC_SCREENING) {
    rejectIncompatible(record, POLICY_FIELDS.elastic, errors);
    value.formulaEnabled = booleanField(record, 'formulaEnabled', false, errors, 'ELASTIC_INPUT_INVALID');
    value.youngsModulusMpa = positiveField(record, 'youngsModulusMpa', errors, 'ELASTIC_INPUT_INVALID');
    value.allowableBendingStressMpa = positiveField(record, 'allowableBendingStressMpa', errors,
      'ELASTIC_INPUT_INVALID');
    value.practicalEnabled = booleanField(record, 'practicalEnabled', false, errors, 'ELASTIC_INPUT_INVALID');
    value.practicalRadiusD = positiveField(record, 'practicalRadiusD', errors, 'ELASTIC_INPUT_INVALID');
    if (!value.formulaEnabled && !value.practicalEnabled) errors.push(diagnostic(
      'CRITERIA_UNRESOLVED', 'Elastic policy must enable formula or practical criteria.'));
    if (value.formulaEnabled && (!value.youngsModulusMpa || !value.allowableBendingStressMpa)) errors.push(diagnostic(
      'ELASTIC_INPUT_INVALID', 'Enabled formula authority requires E and allowable bending stress.'));
    if (value.practicalEnabled && !value.practicalRadiusD) errors.push(diagnostic(
      'ELASTIC_INPUT_INVALID', 'Enabled practical authority requires practicalRadiusD.'));
  } else if (radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_SIZE_BAND) {
    rejectIncompatible(record, POLICY_FIELDS.sizeBand, errors);
    value.qualifiedAlternativeRequested = booleanField(record, 'qualifiedAlternativeRequested', false,
      errors, 'COLD_FIELD_INPUT_INVALID');
    value.qualificationEvidenceId = text(record.qualificationEvidenceId);
    value.projectMinimumEnabled = booleanField(record, 'projectMinimumEnabled', false,
      errors, 'COLD_FIELD_INPUT_INVALID');
    value.projectMinimumRadiusD = positiveField(record, 'projectMinimumRadiusD', errors,
      'COLD_FIELD_INPUT_INVALID');
    value.procedureMinimumRadiusD = positiveField(record, 'procedureMinimumRadiusD', errors,
      'COLD_FIELD_INPUT_INVALID');
    if (value.qualifiedAlternativeRequested && !value.qualificationEvidenceId) errors.push(diagnostic(
      'QUALIFICATION_EVIDENCE_REQUIRED', 'Requested qualified alternative requires nonblank evidence.'));
    if (value.projectMinimumEnabled && !value.projectMinimumRadiusD) errors.push(diagnostic(
      'COLD_FIELD_INPUT_INVALID', 'Enabled project minimum requires projectMinimumRadiusD.'));
  } else if (radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_PROJECT_RADIUS_D) {
    rejectIncompatible(record, POLICY_FIELDS.project, errors);
    value.projectRadiusD = positiveField(record, 'projectRadiusD', errors, 'COLD_FIELD_INPUT_INVALID');
    if (!value.projectRadiusD) errors.push(diagnostic(
      'COLD_FIELD_INPUT_INVALID', 'Project-radius policy requires positive projectRadiusD.'));
  }
  return { value, errors };
}
function groupPolicies(records, requiredClass) {
  const normalized = records.map((record) => normalizePolicy(record, requiredClass));
  const errors = normalized.flatMap((item) => item.errors);
  if (errors.length) return { present: true, value: null, errors };
  const values = normalized.map((item) => item.value).sort((a, b) => compare(stable(a), stable(b)));
  if (new Set(values.map(stable)).size > 1) errors.push(diagnostic(
    'SOURCE_CONFLICT', 'Policy conflict after normalization, including provenance.'));
  return { present: true, value: errors.length ? null : values[0], errors };
}
function inventory(source, candidates, plans, errors) {
  const overrides = Object.create(null), sections = Object.create(null), globals = Object.create(null);
  for (const field of ['b314RadiusOverrides', 'b314RadiusSections', 'b314RadiusPolicies']) {
    if (source[field] !== undefined && !Array.isArray(source[field])) errors.push(diagnostic(
      'INPUT_INVALID', `${field} must be an array when supplied.`));
  }
  for (const record of Array.isArray(source.b314RadiusOverrides) ? source.b314RadiusOverrides : []) {
    if (!plain(record)) { errors.push(diagnostic('TARGET_INVALID', 'Candidate override must be a plain object.')); continue; }
    const identityFields = ['candidateId', 'incomingElementIndex', 'cornerNode'].filter((field) => supplied(record, field));
    const matches = candidates.filter((candidate) => identityFields.length && identityFields.every((field) =>
      field === 'candidateId' ? text(candidate.id) === text(record[field]) : candidate[field] === record[field]));
    if (matches.length !== 1) {
      errors.push(diagnostic('TARGET_INVALID', 'Candidate override must target exactly one candidate.'));
      continue;
    }
    const ownership = candidateOwner(matches[0], plans);
    if (ownership.section?.profileId !== 'asme-b31.4') {
      errors.push(diagnostic('TARGET_INVALID', 'Candidate overrides may target only exact B31.4 candidates.'));
      continue;
    }
    (overrides[text(matches[0].id)] ??= []).push(record);
  }
  for (const record of Array.isArray(source.b314RadiusSections) ? source.b314RadiusSections : []) {
    const section = plain(record) ? plans.analysis.sectionById[text(record.analysisSectionId)] : null;
    if (!section || section.profileId !== 'asme-b31.4' || !['elastic', 'cold-field'].includes(text(record?.bendClass))) {
      errors.push(diagnostic('TARGET_INVALID', 'Section policy must target an existing B31.4 section and bend class.'));
      continue;
    }
    (sections[`${section.analysisSectionId}:${text(record.bendClass)}`] ??= []).push(record);
  }
  for (const record of Array.isArray(source.b314RadiusPolicies) ? source.b314RadiusPolicies : []) {
    if (!plain(record) || !['elastic', 'cold-field'].includes(text(record.bendClass))) {
      errors.push(diagnostic('TARGET_INVALID', 'Global policy requires an exact bendClass.'));
      continue;
    }
    (globals[text(record.bendClass)] ??= []).push(record);
  }
  const pack = (groups, classForKey) => Object.fromEntries(Object.keys(groups).sort(compare).map((key) => {
    const group = groupPolicies(groups[key], classForKey(key));
    errors.push(...group.errors);
    return [key, group];
  }));
  return {
    overrides: pack(overrides, (key) => text(candidates.find((candidate) => text(candidate.id) === key)?.bendClass)),
    sections: pack(sections, (key) => key.split(':').at(-1)),
    globals: pack(globals, (key) => key),
  };
}

function legacyPolicy(source, bendClass) {
  const settings = plain(source.settings) ? source.settings : {};
  if (!supplied(settings, 'designBasis')) return { seen: false, value: null, errors: [] };
  if (settings.designBasis !== 'asme-b31.4' || source.legacyB314RadiusBasisConfirmed !== true) return {
    seen: true, value: null, errors: [diagnostic('LEGACY_AUTHORITY_UNCONFIRMED',
      'Observed legacy B31.4 authority requires explicit confirmation.')],
  };
  const base = { bendClass, sourceAuthority: text(source.sourceAuthority),
    sourceReference: text(source.sourceReference) };
  let raw = null;
  if (bendClass === 'elastic') raw = { ...base,
    radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.ELASTIC_SCREENING,
    formulaEnabled: settings.useFormulaMinimum === true,
    youngsModulusMpa: settings.youngsModulusMpa,
    allowableBendingStressMpa: settings.allowableBendingStressMpa,
    practicalEnabled: settings.usePracticalMinimum === true,
    practicalRadiusD: settings.practicalRadiusMultiplierD };
  else if (settings.coldFieldRadiusMode === 'project-multiplier') raw = { ...base,
    radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_PROJECT_RADIUS_D,
    projectRadiusD: settings.coldFieldRadiusMultiplierD };
  else if (settings.coldFieldRadiusMode === 'b31.4-size-band') raw = { ...base,
    radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_SIZE_BAND,
    qualifiedAlternativeRequested: settings.useQualified18DAlternative === true,
    qualificationEvidenceId: settings.qualificationEvidenceId,
    projectMinimumEnabled: settings.useColdFieldProjectMinimum === true,
    projectMinimumRadiusD: settings.coldFieldProjectRadiusMultiplierD,
    procedureMinimumRadiusD: settings.coldFieldProcedureMinimumRadiusD };
  if (!raw) return { seen: true, value: null,
    errors: [diagnostic('LEGACY_AUTHORITY_UNCONFIRMED', 'Legacy B31.4 radius mode is unsupported.')] };
  const normalized = normalizePolicy(raw, bendClass);
  return { seen: true, value: normalized.errors.length ? null : normalized.value, errors: normalized.errors };
}
function selectPolicy(source, candidate, sectionId, records) {
  const priorities = [
    [records.overrides[text(candidate.id)], 'EXPLICIT_CANDIDATE_OVERRIDE'],
    [records.sections[`${sectionId}:${candidate.bendClass}`], 'EXPLICIT_ANALYSIS_SECTION_POLICY'],
    [records.globals[candidate.bendClass], 'EXPLICIT_GLOBAL_B31_4_POLICY'],
  ];
  for (const [group, sourceKind] of priorities) {
    if (group?.present) return { authority: group.value, sourceKind, legacySeen: false, errors: [] };
  }
  const legacy = legacyPolicy(source, candidate.bendClass);
  return { authority: legacy.value, sourceKind: legacy.value ? 'CONFIRMED_LEGACY_B31_4' : 'UNRESOLVED',
    legacySeen: legacy.seen, errors: legacy.errors };
}
const sizeBandRadiusD = (nps) => !nps ? null : nps <= 12 ? 18 : nps === 14 ? 21
  : nps === 16 ? 24 : nps === 18 ? 27 : nps >= 20 ? 30 : null;
function resolveCriteria(authority, diameter, source, sourceKind) {
  const errors = [], outsideDiameterMm = parsePipelinePositiveScalar(diameter?.outsideDiameterMm);
  const nominalPipeSizeNps = parsePipelinePositiveScalar(diameter?.nominalPipeSizeNps);
  const value = { ...authority, outsideDiameterMm, nominalPipeSizeNps,
    sizeBandInputReady: diameter?.sizeBandInputReady === true };
  let legacyNpsObserved = null, legacyNpsMatchedCanonical = true;
  if (sourceKind === 'CONFIRMED_LEGACY_B31_4' && supplied(source.settings || {}, 'nominalPipeSizeNps')) {
    legacyNpsObserved = parsePipelinePositiveScalar(source.settings.nominalPipeSizeNps);
    legacyNpsMatchedCanonical = Boolean(legacyNpsObserved && nominalPipeSizeNps
      && legacyNpsObserved === nominalPipeSizeNps);
    if (!legacyNpsMatchedCanonical) errors.push(diagnostic(
      'NPS_CONFLICT', 'Legacy settings NPS must match canonical diameter-plan NPS.'));
  }
  if (authority.radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.ELASTIC_SCREENING) {
    value.formulaRadiusD = authority.formulaEnabled
      ? authority.youngsModulusMpa / (2 * authority.allowableBendingStressMpa) : null;
    value.formulaRadiusMm = value.formulaRadiusD ? value.formulaRadiusD * outsideDiameterMm : null;
    value.practicalRadiusMm = authority.practicalEnabled ? authority.practicalRadiusD * outsideDiameterMm : null;
    const criteria = [value.formulaRadiusMm, value.practicalRadiusMm].filter(Boolean);
    value.governingRadiusMm = criteria.length ? Math.max(...criteria) : null;
    value.governingRadiusD = value.governingRadiusMm && outsideDiameterMm
      ? value.governingRadiusMm / outsideDiameterMm : null;
    value.radiusBasis = 'B31_4_ELASTIC_GOVERNING';
  } else if (authority.radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_PROJECT_RADIUS_D) {
    value.projectMinimumEnabled = false;
    value.governingRadiusD = authority.projectRadiusD;
    value.governingRadiusMm = authority.projectRadiusD * outsideDiameterMm;
    value.radiusBasis = 'B31_4_COLD_FIELD_PROJECT_RADIUS_D';
  } else {
    value.normalCodeRadiusD = sizeBandRadiusD(nominalPipeSizeNps);
    if (!nominalPipeSizeNps || !value.sizeBandInputReady) errors.push(diagnostic(
      'NPS_REQUIRED', 'Size-band policy requires canonical ready NPS evidence.'));
    if (nominalPipeSizeNps && !value.normalCodeRadiusD) errors.push(diagnostic(
      'NPS_UNSUPPORTED', 'Canonical NPS is unsupported by the B31.4 size bands.'));
    value.qualificationEligible = Boolean(nominalPipeSizeNps && nominalPipeSizeNps >= 14);
    value.qualifiedAlternativeApplied = Boolean(authority.qualifiedAlternativeRequested
      && value.qualificationEligible && authority.qualificationEvidenceId);
    if (authority.qualifiedAlternativeRequested && !value.qualifiedAlternativeApplied) errors.push(diagnostic(
      'QUALIFICATION_EVIDENCE_REQUIRED', 'Requested qualified alternative must be eligible and evidenced.'));
    value.selectedCodeRadiusD = value.qualifiedAlternativeApplied ? 18 : value.normalCodeRadiusD;
    const criteria = [value.selectedCodeRadiusD,
      authority.projectMinimumEnabled ? authority.projectMinimumRadiusD : null,
      authority.procedureMinimumRadiusD].filter(Boolean);
    value.governingRadiusD = criteria.length ? Math.max(...criteria) : null;
    value.governingRadiusMm = value.governingRadiusD ? value.governingRadiusD * outsideDiameterMm : null;
    value.radiusBasis = 'B31_4_COLD_FIELD_SIZE_BAND_GOVERNING';
  }
  return { value, errors, legacyNpsObserved, legacyNpsMatchedCanonical };
}
function candidateDisposition(candidate, outsideDiameterMm, authorityRadiusMm) {
  const hasD = supplied(candidate, 'radiusD'), hasMm = supplied(candidate, 'radiusMm');
  const observedD = hasD ? parsePipelinePositiveScalar(candidate.radiusD) : null;
  const observedMm = hasMm ? parsePipelinePositiveScalar(candidate.radiusMm) : null;
  const normalizedMm = observedMm || (observedD && outsideDiameterMm ? observedD * outsideDiameterMm : null);
  const dualConflict = Boolean(observedD && observedMm && outsideDiameterMm
    && Math.abs(observedMm - observedD * outsideDiameterMm) > 0.000001);
  const mismatch = dualConflict
    || Boolean(observedD && authorityRadiusMm
      && Math.abs(observedD * outsideDiameterMm - authorityRadiusMm) > 0.000001)
    || Boolean(observedMm && authorityRadiusMm && Math.abs(observedMm - authorityRadiusMm) > 0.000001);
  return mismatch ? 'REQUIRES_RECOMPUTE' : !normalizedMm || !authorityRadiusMm
    ? 'NOT_AVAILABLE' : 'MATCHES_AUTHORITY';
}
function resolutionBase(candidate, ownership, sourceKind) {
  return { candidateId: text(candidate.id), incomingElementIndex: candidate.incomingElementIndex,
    incomingElementId: `E${candidate.incomingElementIndex + 1}`,
    outgoingElementIndex: candidate.outgoingElementIndex,
    outgoingElementId: `E${candidate.outgoingElementIndex + 1}`,
    analysisSectionId: text(ownership.section?.analysisSectionId), profileId: text(ownership.section?.profileId),
    cornerNode: candidate.cornerNode, previousNode: candidate.previousNode, nextNode: candidate.nextNode,
    geometricClass: text(candidate.classification), turnAngleDeg: candidate.turnAngleDeg,
    sourceBasis: text(candidate.sourceBasis), bendClass: text(candidate.bendClass),
    outsideDiameterMm: parsePipelinePositiveScalar(ownership.diameterSection?.outsideDiameterMm),
    observedCandidateRadiusD: candidate.radiusD, observedCandidateRadiusMm: candidate.radiusMm,
    candidateStatus: text(candidate.status), sourceKind };
}
function blockedResolution(candidate, ownership, selection, localErrors) {
  const base = resolutionBase(candidate, ownership, selection.sourceKind || 'UNRESOLVED');
  const disposition = candidateDisposition(candidate, base.outsideDiameterMm, null);
  return createPipelineB314RadiusResolution({ ...base, radiusPolicyId: '', radiusBasis: '', status: 'BLOCKED',
    candidateRadiusDisposition: disposition, geometryRecheckRequired: disposition === 'REQUIRES_RECOMPUTE',
    diagnostics: localErrors.length ? localErrors : [diagnostic(
      'AUTHORITY_UNRESOLVED', 'No explicit or confirmed legacy B31.4 radius authority resolved.')],
  });
}
function resolveCandidate(source, candidate, ownership, selection) {
  const localErrors = [...ownership.errors, ...selection.errors];
  if (!selection.authority) return { resolution: blockedResolution(candidate, ownership, selection, localErrors),
    legacyNpsObserved: null, legacyNpsMatchedCanonical: true };
  const criteria = resolveCriteria(selection.authority, ownership.diameterSection, source, selection.sourceKind);
  localErrors.push(...criteria.errors);
  const base = resolutionBase(candidate, ownership, selection.sourceKind);
  const disposition = candidateDisposition(candidate, base.outsideDiameterMm, criteria.value.governingRadiusMm);
  return { resolution: createPipelineB314RadiusResolution({ ...base, ...criteria.value,
    candidateRadiusDisposition: disposition, geometryRecheckRequired: disposition === 'REQUIRES_RECOMPUTE',
    sourceAuthority: selection.authority.sourceAuthority, sourceReference: selection.authority.sourceReference,
    diagnostics: localErrors }), legacyNpsObserved: criteria.legacyNpsObserved,
    legacyNpsMatchedCanonical: criteria.legacyNpsMatchedCanonical };
}

export function resolvePipelineB314RadiusPlan(input = {}) {
  const diagnostics = [], source = safeInput(input, diagnostics);
  const plans = authenticatePlans(source, diagnostics);
  const candidates = plans.bend.candidates.slice().sort((a, b) =>
    a.incomingElementIndex - b.incomingElementIndex || compare(text(a.id), text(b.id)));
  validateCandidateSet(candidates, diagnostics);
  const records = inventory(source, candidates, plans, diagnostics);
  const radiusResolutions = [], notApplicableCandidateIds = [], legacyStates = [];
  for (const candidate of candidates) {
    const ownership = candidateOwner(candidate, plans);
    diagnostics.push(...ownership.errors);
    if (!ownership.section) continue;
    if (ownership.section.profileId !== 'asme-b31.4') {
      notApplicableCandidateIds.push(text(candidate.id));
      continue;
    }
    const selection = selectPolicy(source, candidate, ownership.section.analysisSectionId, records);
    const result = resolveCandidate(source, candidate, ownership, selection);
    radiusResolutions.push(result.resolution);
    legacyStates.push({ seen: selection.legacySeen, nps: result.legacyNpsObserved,
      matched: result.legacyNpsMatchedCanonical });
  }
  const b314Count = candidates.filter((candidate) => {
    const incoming = plans.analysis.elementByIndex[candidate.incomingElementIndex];
    return plans.analysis.sectionById[incoming?.analysisSectionId]?.profileId === 'asme-b31.4';
  }).length;
  if (radiusResolutions.length !== b314Count) diagnostics.push(diagnostic(
    'CANDIDATE_COVERAGE_INVALID', 'Every B31.4 candidate must receive exactly one radius resolution.',
    { b314CandidateCount: b314Count, resolutionCount: radiusResolutions.length }));
  const observedLegacy = legacyStates.some((state) => state.seen);
  const legacyNps = legacyStates.map((state) => state.nps).filter(Boolean)[0] || null;
  const migration = createPipelineB314RadiusMigration({
    sourceKinds: radiusResolutions.map((item) => item.sourceKind),
    legacyEvidenceObserved: observedLegacy,
    legacyB314RadiusBasisConfirmed: observedLegacy && source.legacyB314RadiusBasisConfirmed === true,
    legacySettingsNpsObserved: legacyNps,
    legacySettingsNpsMatchedCanonical: legacyNps ? legacyStates.filter((state) => state.nps)
      .every((state) => state.matched) : false,
    sourceAuthority: source.sourceAuthority, sourceReference: source.sourceReference,
  });
  return createPipelineB314RadiusPlan({
    analysisSectionPlanSchema: plans.analysis.plan?.schema,
    analysisDiameterPlanSchema: plans.diameter.plan?.schema,
    bendResolutionSchema: plans.bend.schema,
    migration, radiusResolutions, notApplicableCandidateIds, diagnostics,
    blockerCodes: diagnostics.map((item) => item.code),
  });
}

export const buildPipelineB314RadiusPlanJson = (plan) => JSON.stringify(plan, null, 2);
const cell = (value) => value == null ? '' : String(value).replace(/[\t\r\n]/g, ' ');
export function buildPipelineB314RadiusLedgerText(plan) {
  const header = ['Schema', 'CandidateId', 'IncomingElementId', 'OutgoingElementId', 'AnalysisSectionId',
    'BendClass', 'RadiusPolicyId', 'RadiusBasis', 'OutsideDiameterMm', 'NominalPipeSizeNps',
    'GoverningRadiusD', 'GoverningRadiusMm', 'ObservedCandidateRadiusD', 'ObservedCandidateRadiusMm',
    'CandidateRadiusDisposition', 'GeometryRecheckRequired', 'SourceKind', 'Ready'];
  const rows = (plan?.radiusResolutions || []).map((item) => [item.schema, item.candidateId,
    item.incomingElementId, item.outgoingElementId, item.analysisSectionId, item.bendClass,
    item.radiusPolicyId, item.radiusBasis, item.outsideDiameterMm, item.nominalPipeSizeNps,
    item.governingRadiusD, item.governingRadiusMm, item.observedCandidateRadiusD,
    item.observedCandidateRadiusMm, item.candidateRadiusDisposition,
    item.geometryRecheckRequired ? 'YES' : 'NO', item.sourceKind, item.ready ? 'YES' : 'NO']);
  return [header, ...rows].map((row) => row.map(cell).join('\t')).join('\n');
}
