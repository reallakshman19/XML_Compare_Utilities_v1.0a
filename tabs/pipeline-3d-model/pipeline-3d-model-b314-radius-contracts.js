import { getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js'; import {
PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA, } from './pipeline-3d-model-analysis-section-contracts.js';
import { PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA,
parsePipelinePositiveScalar, } from './pipeline-3d-model-diameter-contracts.js';
export const PIPELINE_BEND_RESOLUTION_SCHEMA = 'PipelineBendResolution.v3';
export const PIPELINE_B314_RADIUS_POLICY_REGISTRY_SCHEMA = 'PipelineB314RadiusPolicyRegistry.v1'; export const PIPELINE_B314_RADIUS_POLICY_DESCRIPTOR_SCHEMA = 'PipelineB314RadiusPolicyDescriptor.v1';
export const PIPELINE_B314_RADIUS_MIGRATION_SCHEMA = 'PipelineB314RadiusMigration.v1'; export const PIPELINE_B314_RADIUS_PLAN_SCHEMA = 'PipelineB314RadiusPlan.v1';
export const PIPELINE_B314_RADIUS_RESOLUTION_SCHEMA = 'PipelineB314RadiusResolution.v1'; export const PIPELINE_B314_RADIUS_POLICY_IDS = Object.freeze({
ELASTIC_SCREENING: 'b31.4-elastic-screening', COLD_FIELD_SIZE_BAND: 'b31.4-cold-field-size-band',
COLD_FIELD_PROJECT_RADIUS_D: 'b31.4-cold-field-project-radius-d', });
export const PIPELINE_B314_RADIUS_BLOCKER_ORDER = Object.freeze([ 'PIPELINE_B314_RADIUS_INPUT_INVALID', 'PIPELINE_B314_RADIUS_POLICY_INVALID',
'PIPELINE_B314_RADIUS_PROFILE_INCOMPATIBLE', 'PIPELINE_B314_RADIUS_TARGET_INVALID', 'PIPELINE_B314_RADIUS_SOURCE_CONFLICT', 'PIPELINE_B314_RADIUS_AUTHORITY_UNRESOLVED',
'PIPELINE_B314_RADIUS_LEGACY_AUTHORITY_UNCONFIRMED', 'PIPELINE_B314_RADIUS_BEND_CLASS_INCOMPATIBLE', 'PIPELINE_B314_RADIUS_DIAMETER_PLAN_INVALID', 'PIPELINE_B314_RADIUS_NPS_REQUIRED',
'PIPELINE_B314_RADIUS_NPS_UNSUPPORTED', 'PIPELINE_B314_RADIUS_NPS_CONFLICT', 'PIPELINE_B314_RADIUS_ELASTIC_INPUT_INVALID', 'PIPELINE_B314_RADIUS_COLD_FIELD_INPUT_INVALID',
'PIPELINE_B314_RADIUS_QUALIFICATION_EVIDENCE_REQUIRED', 'PIPELINE_B314_RADIUS_CRITERIA_UNRESOLVED', 'PIPELINE_B314_RADIUS_OWNERSHIP_INVALID', 'PIPELINE_B314_RADIUS_CANDIDATE_COVERAGE_INVALID',
'PIPELINE_B314_RADIUS_OBSERVED_BASIS_CONFLICT', 'PIPELINE_B314_RADIUS_EMITTED_RADIUS_CONFLICT', ]);
const DESCRIPTORS = Object.freeze([ Object.freeze({ schema: PIPELINE_B314_RADIUS_POLICY_DESCRIPTOR_SCHEMA,
radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.ELASTIC_SCREENING, bendClass: 'elastic', criteriaAuthority: 'ENABLED_FORMULA_AND_OR_PRACTICAL_MAX', sourceAuthority: 'P3D-PROF-044', status: 'CONTRACT_ONLY' }),
Object.freeze({ schema: PIPELINE_B314_RADIUS_POLICY_DESCRIPTOR_SCHEMA, radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_SIZE_BAND, bendClass: 'cold-field',
criteriaAuthority: 'SIZE_BAND_QUALIFIED_PROJECT_PROCEDURE_MAX', sourceAuthority: 'P3D-PROF-044', status: 'CONTRACT_ONLY' }), Object.freeze({ schema: PIPELINE_B314_RADIUS_POLICY_DESCRIPTOR_SCHEMA,
radiusPolicyId: PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_PROJECT_RADIUS_D, bendClass: 'cold-field', criteriaAuthority: 'EXPLICIT_PROJECT_RADIUS_D', sourceAuthority: 'P3D-PROF-044', status: 'CONTRACT_ONLY' }),
]); const text = (value) => String(value ?? '').trim();
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0; const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
&& [Object.prototype, null].includes(Object.getPrototypeOf(value))); function clone(value) {
if (value === undefined) return null; if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
if (typeof value === 'number' && Number.isFinite(value)) return value; if (Array.isArray(value)) return value.map(clone);
if (!plain(value)) throw new TypeError('B31.4 radius input must be JSON-safe plain data.'); return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, clone(value[key])]));
} function freeze(value) {
if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.values(value).forEach(freeze); return Object.freeze(value);
} function diagnostic(code, message, details = {}) {
return freeze({ severity: 'BLOCKING', code, message, details: clone(details) }); }
const rank = (code) => { const index = PIPELINE_B314_RADIUS_BLOCKER_ORDER.indexOf(code);
return index < 0 ? PIPELINE_B314_RADIUS_BLOCKER_ORDER.length : index; };
function diagnostics(values = []) { const keyed = Object.create(null);
values.filter(plain).filter((item) => text(item.code)).forEach((item) => { const normalized = freeze({ severity: text(item.severity) || 'BLOCKING', code: text(item.code),
message: text(item.message), details: plain(item.details) ? clone(item.details) : {} }); keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
}); return Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
|| compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details)))); }
function codes(items, supplied = []) { const keyed = Object.create(null);
[...supplied, ...items.map((item) => item.code)].map(text).filter(Boolean).forEach((code) => { keyed[code] = true; }); return Object.freeze(Object.keys(keyed).sort((a, b) => rank(a) - rank(b) || compare(a, b)));
} function safe(input, code) {
try { const source = clone(input); if (plain(source)) return { source, errors: [] }; } catch { /* blocked */ } return { source: {}, errors: [diagnostic(code, 'Input must be JSON-safe plain data.')] };
} function final(source, generated, extra = []) {
const items = diagnostics([...(Array.isArray(source.diagnostics) ? source.diagnostics : []), ...generated]); const blockerCodes = codes(items, [...(Array.isArray(source.blockerCodes) ? source.blockerCodes : []), ...extra]);
return { diagnostics: items, blockerCodes, ready: blockerCodes.length === 0 }; }
const canonical = (value) => JSON.stringify(Object.fromEntries( Object.keys(value || {}).sort(compare).map((key) => [key, value[key]]),
)); export function createPipelineB314RadiusPolicyRegistry(descriptors = DESCRIPTORS) {
const safeValue = safe({ descriptors }, 'PIPELINE_B314_RADIUS_POLICY_INVALID'); const values = Array.isArray(safeValue.source.descriptors) ? safeValue.source.descriptors : [];
const valid = values.length === DESCRIPTORS.length && values.every((item, index) => plain(item) && item.radiusPolicyId === DESCRIPTORS[index].radiusPolicyId && canonical(item) === canonical(DESCRIPTORS[index]));
const errors = [...safeValue.errors]; if (!valid) errors.push(diagnostic('PIPELINE_B314_RADIUS_POLICY_INVALID',
'Registry must contain exactly the three canonical B31.4 radius policies in canonical order.')); const state = final({}, errors);
return freeze({ schema: PIPELINE_B314_RADIUS_POLICY_REGISTRY_SCHEMA, descriptors: Object.freeze((valid ? values : []).map(clone).map(freeze)),
diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready }); }
export const PIPELINE_B314_RADIUS_POLICY_REGISTRY = createPipelineB314RadiusPolicyRegistry(); export function getPipelineB314RadiusPolicy(policyId, registry = PIPELINE_B314_RADIUS_POLICY_REGISTRY) {
if (registry?.schema !== PIPELINE_B314_RADIUS_POLICY_REGISTRY_SCHEMA || registry.ready !== true) return null; return registry.descriptors.find((item) => item.radiusPolicyId === text(policyId)) || null;
} export function createPipelineB314RadiusMigration(input = {}) {
const safeValue = safe(input, 'PIPELINE_B314_RADIUS_INPUT_INVALID'), source = safeValue.source; const errors = [...safeValue.errors];
if (source.schema !== undefined && source.schema !== PIPELINE_B314_RADIUS_MIGRATION_SCHEMA) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_INPUT_INVALID', 'Migration schema must be PipelineB314RadiusMigration.v1.'));
if (source.sourceKinds !== undefined && !Array.isArray(source.sourceKinds)) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_INPUT_INVALID', 'sourceKinds must be an array when supplied.'));
const suppliedNps = source.legacySettingsNpsObserved !== undefined && source.legacySettingsNpsObserved !== null && text(source.legacySettingsNpsObserved) !== '';
const legacyNps = suppliedNps ? parsePipelinePositiveScalar(source.legacySettingsNpsObserved) : null; if (suppliedNps && !legacyNps) errors.push(diagnostic('PIPELINE_B314_RADIUS_NPS_CONFLICT',
'Observed legacy settings NPS must be a positive scalar.')); if (source.legacyEvidenceObserved === true && source.legacyB314RadiusBasisConfirmed !== true) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_LEGACY_AUTHORITY_UNCONFIRMED', 'Observed legacy B31.4 authority requires explicit confirmation.')); if (suppliedNps && source.legacySettingsNpsMatchedCanonical !== true) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_NPS_CONFLICT', 'Observed legacy settings NPS must be confirmed to match canonical NPS.')); const state = final(source, errors);
const sourceKinds = Object.freeze(Object.keys(Object.fromEntries( (Array.isArray(source.sourceKinds) ? source.sourceKinds : []).map(text).filter(Boolean).map((value) => [value, true]),
)).sort(compare)); return freeze({ schema: PIPELINE_B314_RADIUS_MIGRATION_SCHEMA, sourceKinds,
legacyEvidenceObserved: source.legacyEvidenceObserved === true, legacyB314RadiusBasisConfirmed: source.legacyB314RadiusBasisConfirmed === true,
legacySettingsNpsObserved: legacyNps, legacySettingsNpsMatchedCanonical: source.legacySettingsNpsMatchedCanonical === true,
sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference), diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
} function identityErrors(source) {
const errors = []; if (!text(source.candidateId) || !Number.isInteger(source.incomingElementIndex) || source.incomingElementIndex < 0
|| text(source.incomingElementId) !== `E${source.incomingElementIndex + 1}` || source.outgoingElementIndex !== source.incomingElementIndex + 1
|| text(source.outgoingElementId) !== `E${source.outgoingElementIndex + 1}` || !/^AS[1-9]\d*$/.test(text(source.analysisSectionId))) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_OWNERSHIP_INVALID', 'Canonical candidate, incoming/outgoing E identity and AS identity are required.')); const nodesValid = [source.previousNode, source.cornerNode, source.nextNode]
.every((value) => Number.isInteger(value) && value > 0); if (!nodesValid || !Number.isFinite(source.turnAngleDeg) || !text(source.geometricClass)
|| !text(source.sourceBasis) || !text(source.candidateStatus) || !text(source.sourceKind)) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_INPUT_INVALID', 'Candidate nodes, angle, geometric evidence, status and sourceKind are required.'));
return errors; }
const supplied = (source, field) => source[field] !== undefined && source[field] !== null && !(typeof source[field] === 'string' && source[field].trim() === '');
function rejectFields(source, fields, code, message) { return fields.some((field) => supplied(source, field) && source[field] !== false)
? [diagnostic(code, message, { fields: fields.filter((field) => supplied(source, field) && source[field] !== false) })] : []; }
function policyErrors(source, policy, outsideDiameterMm) { const errors = [], radiusBasis = text(source.radiusBasis);
const governingD = parsePipelinePositiveScalar(source.governingRadiusD); const governingMm = parsePipelinePositiveScalar(source.governingRadiusMm);
if (!governingD || !governingMm || !outsideDiameterMm || Math.abs(governingMm - governingD * outsideDiameterMm) > 0.000001) errors.push(diagnostic(
policy?.bendClass === 'elastic' ? 'PIPELINE_B314_RADIUS_ELASTIC_INPUT_INVALID' : 'PIPELINE_B314_RADIUS_COLD_FIELD_INPUT_INVALID', 'Governing radius must be positive and consistent with canonical physical OD.'));
if (policy?.radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.ELASTIC_SCREENING) { if (radiusBasis !== 'B31_4_ELASTIC_GOVERNING') errors.push(diagnostic('PIPELINE_B314_RADIUS_POLICY_INVALID',
'Elastic screening requires radiusBasis B31_4_ELASTIC_GOVERNING.')); errors.push(...rejectFields(source, ['normalCodeRadiusD', 'qualifiedAlternativeRequested', 'qualificationEligible',
'qualificationEvidenceId', 'qualifiedAlternativeApplied', 'selectedCodeRadiusD', 'projectMinimumEnabled', 'projectMinimumRadiusD', 'procedureMinimumRadiusD', 'projectRadiusD'], 'PIPELINE_B314_RADIUS_POLICY_INVALID',
'Elastic resolution cannot claim cold-field criteria.')); const formulaD = parsePipelinePositiveScalar(source.formulaRadiusD), formulaMm = parsePipelinePositiveScalar(source.formulaRadiusMm);
const e = parsePipelinePositiveScalar(source.youngsModulusMpa), sb = parsePipelinePositiveScalar(source.allowableBendingStressMpa); const practicalD = parsePipelinePositiveScalar(source.practicalRadiusD), practicalMm = parsePipelinePositiveScalar(source.practicalRadiusMm);
const expected = []; if (source.formulaEnabled === true) {
const expectedD = e && sb ? e / (2 * sb) : null; if (!expectedD || !formulaD || !formulaMm || Math.abs(formulaD - expectedD) > 0.000001
|| Math.abs(formulaMm - expectedD * outsideDiameterMm) > 0.000001) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_ELASTIC_INPUT_INVALID', 'Formula criterion must match E / (2 × Sb) and canonical OD.'));
else expected.push(formulaMm); }
if (source.practicalEnabled === true) { if (!practicalD || !practicalMm || Math.abs(practicalMm - practicalD * outsideDiameterMm) > 0.000001) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_ELASTIC_INPUT_INVALID', 'Practical criterion must equal practicalRadiusD × canonical OD.')); else expected.push(practicalMm);
} if (!expected.length || Math.abs(Math.max(...expected) - governingMm) > 0.000001) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_CRITERIA_UNRESOLVED', 'Elastic governing radius must equal the maximum enabled valid criterion.')); } else if (policy?.radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_PROJECT_RADIUS_D) {
if (radiusBasis !== 'B31_4_COLD_FIELD_PROJECT_RADIUS_D') errors.push(diagnostic('PIPELINE_B314_RADIUS_POLICY_INVALID', 'Project-radius policy requires radiusBasis B31_4_COLD_FIELD_PROJECT_RADIUS_D.'));
const projectD = parsePipelinePositiveScalar(source.projectRadiusD); if (!projectD || governingD !== projectD) errors.push(diagnostic('PIPELINE_B314_RADIUS_COLD_FIELD_INPUT_INVALID',
'Project-radius governing radius must equal explicit projectRadiusD.')); errors.push(...rejectFields(source, ['formulaEnabled', 'youngsModulusMpa', 'allowableBendingStressMpa',
'formulaRadiusD', 'formulaRadiusMm', 'practicalEnabled', 'practicalRadiusD', 'practicalRadiusMm', 'normalCodeRadiusD', 'qualifiedAlternativeRequested', 'qualificationEligible', 'qualificationEvidenceId',
'qualifiedAlternativeApplied', 'selectedCodeRadiusD', 'projectMinimumEnabled', 'projectMinimumRadiusD', 'procedureMinimumRadiusD'], 'PIPELINE_B314_RADIUS_POLICY_INVALID',
'Project-radius resolution cannot claim elastic, size-band, qualification, project-minimum or procedure criteria.')); } else if (policy?.radiusPolicyId === PIPELINE_B314_RADIUS_POLICY_IDS.COLD_FIELD_SIZE_BAND) {
if (radiusBasis !== 'B31_4_COLD_FIELD_SIZE_BAND_GOVERNING') errors.push(diagnostic('PIPELINE_B314_RADIUS_POLICY_INVALID', 'Size-band policy requires radiusBasis B31_4_COLD_FIELD_SIZE_BAND_GOVERNING.'));
errors.push(...rejectFields(source, ['formulaEnabled', 'youngsModulusMpa', 'allowableBendingStressMpa', 'formulaRadiusD', 'formulaRadiusMm', 'practicalEnabled', 'practicalRadiusD', 'practicalRadiusMm', 'projectRadiusD'],
'PIPELINE_B314_RADIUS_POLICY_INVALID', 'Size-band resolution cannot claim elastic or project-radius criteria.')); const nps = parsePipelinePositiveScalar(source.nominalPipeSizeNps);
const normalD = !nps ? null : nps <= 12 ? 18 : nps === 14 ? 21 : nps === 16 ? 24 : nps === 18 ? 27 : nps >= 20 ? 30 : null; if (!nps || source.sizeBandInputReady !== true) errors.push(diagnostic('PIPELINE_B314_RADIUS_NPS_REQUIRED',
'Size-band policy requires ready canonical NPS evidence.')); if (nps && !normalD) errors.push(diagnostic('PIPELINE_B314_RADIUS_NPS_UNSUPPORTED', 'Canonical NPS is unsupported.'));
if (normalD !== parsePipelinePositiveScalar(source.normalCodeRadiusD)) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_COLD_FIELD_INPUT_INVALID', 'normalCodeRadiusD must match canonical NPS size band.'));
const eligible = Boolean(nps && nps >= 14), evidence = text(source.qualificationEvidenceId); const applied = source.qualifiedAlternativeRequested === true && eligible && Boolean(evidence);
if (source.qualificationEligible !== eligible || source.qualifiedAlternativeApplied !== applied) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_COLD_FIELD_INPUT_INVALID', 'Qualification evidence fields are inconsistent.'));
if (source.qualifiedAlternativeRequested === true && !applied) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_QUALIFICATION_EVIDENCE_REQUIRED', 'Requested qualified alternative must be eligible and evidenced.'));
const selectedD = parsePipelinePositiveScalar(source.selectedCodeRadiusD); if (selectedD !== (applied ? 18 : normalD)) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_COLD_FIELD_INPUT_INVALID', 'selectedCodeRadiusD does not match qualification authority.')); const projectD = source.projectMinimumEnabled === true ? parsePipelinePositiveScalar(source.projectMinimumRadiusD) : null;
const procedureD = parsePipelinePositiveScalar(source.procedureMinimumRadiusD); const criteria = [selectedD, projectD, procedureD].filter(Boolean);
if (!criteria.length || governingD !== Math.max(...criteria)) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_CRITERIA_UNRESOLVED', 'Cold-field governing radius must equal the maximum selected criterion.'));
} return errors;
} function observed(source, outsideDiameterMm, authorityRadiusMm) {
const errors = [], hasD = supplied(source, 'observedCandidateRadiusD'), hasMm = supplied(source, 'observedCandidateRadiusMm'); const rawD = hasD ? parsePipelinePositiveScalar(source.observedCandidateRadiusD) : null;
const rawMm = hasMm ? parsePipelinePositiveScalar(source.observedCandidateRadiusMm) : null; if ((hasD && !rawD) || (hasMm && !rawMm)) errors.push(diagnostic('PIPELINE_B314_RADIUS_INPUT_INVALID',
'Observed candidate radii must be positive scalars when supplied.')); const normalizedD = rawD || (rawMm && outsideDiameterMm ? rawMm / outsideDiameterMm : null);
const normalizedMm = rawMm || (rawD && outsideDiameterMm ? rawD * outsideDiameterMm : null); const dualConflict = Boolean(rawD && rawMm && outsideDiameterMm
&& Math.abs(rawMm - rawD * outsideDiameterMm) > 0.000001); if (dualConflict) errors.push(diagnostic('PIPELINE_B314_RADIUS_OBSERVED_BASIS_CONFLICT',
'Observed radiusD and radiusMm are inconsistent with canonical physical OD.')); const dMismatch = Boolean(rawD && outsideDiameterMm && authorityRadiusMm
&& Math.abs(rawD * outsideDiameterMm - authorityRadiusMm) > 0.000001); const mmMismatch = Boolean(rawMm && authorityRadiusMm && Math.abs(rawMm - authorityRadiusMm) > 0.000001);
const disposition = dualConflict || dMismatch || mmMismatch ? 'REQUIRES_RECOMPUTE' : !normalizedMm || !authorityRadiusMm ? 'NOT_AVAILABLE' : 'MATCHES_AUTHORITY';
return { errors, normalizedD, normalizedMm, disposition }; }
export function createPipelineB314RadiusResolution(input = {}) { const safeValue = safe(input, 'PIPELINE_B314_RADIUS_INPUT_INVALID'), source = safeValue.source;
const errors = [...safeValue.errors, ...identityErrors(source)]; if (source.schema !== undefined && source.schema !== PIPELINE_B314_RADIUS_RESOLUTION_SCHEMA) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_INPUT_INVALID', 'Resolution schema must be PipelineB314RadiusResolution.v1.')); const suppliedBlocking = (Array.isArray(source.blockerCodes) && source.blockerCodes.length > 0)
|| (Array.isArray(source.diagnostics) && source.diagnostics.some((item) => text(item?.severity) === 'BLOCKING')); const blockedAuthority = text(source.status) === 'BLOCKED' && !text(source.radiusPolicyId) && suppliedBlocking;
const profile = getPipelineEngineeringProfile(text(source.profileId)); const policy = getPipelineB314RadiusPolicy(text(source.radiusPolicyId));
const bendClass = text(source.bendClass), outsideDiameterMm = parsePipelinePositiveScalar(source.outsideDiameterMm); if (!profile || profile.profileId !== 'asme-b31.4') errors.push(diagnostic(
'PIPELINE_B314_RADIUS_PROFILE_INCOMPATIBLE', 'B31.4 radius resolution requires profileId asme-b31.4.')); if (!['elastic', 'cold-field'].includes(bendClass)) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_BEND_CLASS_INCOMPATIBLE', 'Candidate bendClass must remain elastic or cold-field.')); if (!outsideDiameterMm) errors.push(diagnostic('PIPELINE_B314_RADIUS_DIAMETER_PLAN_INVALID',
'Canonical positive outsideDiameterMm is required.')); if (!blockedAuthority && !policy) errors.push(diagnostic('PIPELINE_B314_RADIUS_POLICY_INVALID',
'radiusPolicyId must be exact and canonical.')); if (policy && policy.bendClass !== bendClass) errors.push(diagnostic('PIPELINE_B314_RADIUS_BEND_CLASS_INCOMPATIBLE',
'Radius policy is incompatible with the existing candidate bend class.')); if (!blockedAuthority && policy) errors.push(...policyErrors(source, policy, outsideDiameterMm));
const authorityMm = blockedAuthority ? null : parsePipelinePositiveScalar(source.governingRadiusMm); const observedValue = observed(source, outsideDiameterMm, authorityMm); errors.push(...observedValue.errors);
if (text(source.candidateRadiusDisposition) !== observedValue.disposition || source.geometryRecheckRequired !== (observedValue.disposition === 'REQUIRES_RECOMPUTE')) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_INPUT_INVALID', 'Candidate-radius disposition and geometry-recheck evidence are inconsistent.')); if (text(source.candidateStatus) === 'EMITTED' && observedValue.disposition === 'REQUIRES_RECOMPUTE') errors.push(diagnostic(
'PIPELINE_B314_RADIUS_EMITTED_RADIUS_CONFLICT', 'Emitted candidate radius conflicts with resolved B31.4 authority.')); const state = final(source, errors), scalar = (field) => parsePipelinePositiveScalar(source[field]);
return freeze({ schema: PIPELINE_B314_RADIUS_RESOLUTION_SCHEMA, candidateId: text(source.candidateId), incomingElementIndex: Number.isInteger(source.incomingElementIndex) ? source.incomingElementIndex : null,
incomingElementId: text(source.incomingElementId), outgoingElementIndex: Number.isInteger(source.outgoingElementIndex) ? source.outgoingElementIndex : null, outgoingElementId: text(source.outgoingElementId), analysisSectionId: text(source.analysisSectionId), profileId: text(source.profileId),
cornerNode: source.cornerNode ?? null, previousNode: source.previousNode ?? null, nextNode: source.nextNode ?? null, geometricClass: text(source.geometricClass), turnAngleDeg: Number.isFinite(source.turnAngleDeg) ? source.turnAngleDeg : null,
sourceBasis: text(source.sourceBasis), bendClass, radiusPolicyId: text(source.radiusPolicyId), radiusBasis: text(source.radiusBasis), outsideDiameterMm, nominalPipeSizeNps: scalar('nominalPipeSizeNps'), sizeBandInputReady: source.sizeBandInputReady === true,
formulaEnabled: source.formulaEnabled === true, youngsModulusMpa: scalar('youngsModulusMpa'), allowableBendingStressMpa: scalar('allowableBendingStressMpa'), formulaRadiusD: scalar('formulaRadiusD'), formulaRadiusMm: scalar('formulaRadiusMm'),
practicalEnabled: source.practicalEnabled === true, practicalRadiusD: scalar('practicalRadiusD'), practicalRadiusMm: scalar('practicalRadiusMm'), normalCodeRadiusD: scalar('normalCodeRadiusD'), qualifiedAlternativeRequested: source.qualifiedAlternativeRequested === true,
qualificationEligible: source.qualificationEligible === true, qualificationEvidenceId: text(source.qualificationEvidenceId), qualifiedAlternativeApplied: source.qualifiedAlternativeApplied === true, selectedCodeRadiusD: scalar('selectedCodeRadiusD'),
projectMinimumEnabled: source.projectMinimumEnabled === true, projectMinimumRadiusD: scalar('projectMinimumRadiusD'), procedureMinimumRadiusD: scalar('procedureMinimumRadiusD'), projectRadiusD: scalar('projectRadiusD'),
governingRadiusD: scalar('governingRadiusD'), governingRadiusMm: scalar('governingRadiusMm'), observedCandidateRadiusD: observedValue.normalizedD, observedCandidateRadiusMm: observedValue.normalizedMm,
candidateStatus: text(source.candidateStatus), candidateRadiusDisposition: observedValue.disposition, geometryRecheckRequired: observedValue.disposition === 'REQUIRES_RECOMPUTE', sourceKind: text(source.sourceKind),
sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference), status: state.ready ? 'RESOLVED' : 'BLOCKED', diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
} function coverageErrors(resolutions, notApplicable) {
const errors = [], ids = Object.create(null), owners = Object.create(null), corners = Object.create(null), notIds = Object.create(null); resolutions.forEach((item) => {
for (const [key, value] of [['candidateId', item.candidateId], ['incomingElementIndex', item.incomingElementIndex], ['cornerNode', item.cornerNode]]) { const store = key === 'candidateId' ? ids : key === 'incomingElementIndex' ? owners : corners;
if (Object.hasOwn(store, value)) errors.push(diagnostic('PIPELINE_B314_RADIUS_CANDIDATE_COVERAGE_INVALID', `Duplicate ${key} is not permitted.`, { [key]: value }));
store[value] = true; }
}); notApplicable.forEach((id) => {
if (Object.hasOwn(notIds, id) || Object.hasOwn(ids, id)) errors.push(diagnostic( 'PIPELINE_B314_RADIUS_CANDIDATE_COVERAGE_INVALID', 'Candidate coverage must be unique.', { candidateId: id }));
notIds[id] = true; });
return errors; }
export function createPipelineB314RadiusPlan(input = {}) { const safeValue = safe(input, 'PIPELINE_B314_RADIUS_INPUT_INVALID'), source = safeValue.source;
const errors = [...safeValue.errors]; if (source.schema !== undefined && source.schema !== PIPELINE_B314_RADIUS_PLAN_SCHEMA) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_INPUT_INVALID', 'Plan schema must be PipelineB314RadiusPlan.v1.')); if (source.analysisSectionPlanSchema !== PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA
|| source.analysisDiameterPlanSchema !== PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA || source.bendResolutionSchema !== PIPELINE_BEND_RESOLUTION_SCHEMA) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_INPUT_INVALID', 'Exact analysis, diameter and bend schemas are required.')); if (!Array.isArray(source.radiusResolutions) || !Array.isArray(source.notApplicableCandidateIds)) errors.push(diagnostic(
'PIPELINE_B314_RADIUS_CANDIDATE_COVERAGE_INVALID', 'Resolution and not-applicable candidate arrays are required.')); const migration = createPipelineB314RadiusMigration(source.migration || {});
const resolutions = Object.freeze((Array.isArray(source.radiusResolutions) ? source.radiusResolutions : []) .map(createPipelineB314RadiusResolution).sort((a, b) => a.incomingElementIndex - b.incomingElementIndex || compare(a.candidateId, b.candidateId)));
const notApplicable = Object.freeze((Array.isArray(source.notApplicableCandidateIds) ? source.notApplicableCandidateIds : []) .map(text).filter(Boolean).sort(compare));
errors.push(...coverageErrors(resolutions, notApplicable)); const nested = [migration, ...resolutions];
const state = final(source, [...errors, ...nested.flatMap((item) => item.diagnostics)], nested.flatMap((item) => item.blockerCodes)); return freeze({ schema: PIPELINE_B314_RADIUS_PLAN_SCHEMA,
analysisSectionPlanSchema: text(source.analysisSectionPlanSchema), analysisDiameterPlanSchema: text(source.analysisDiameterPlanSchema), bendResolutionSchema: text(source.bendResolutionSchema), migration, radiusResolutions: resolutions,
notApplicableCandidateIds: notApplicable, diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready && migration.ready && resolutions.every((item) => item.ready) });
}
