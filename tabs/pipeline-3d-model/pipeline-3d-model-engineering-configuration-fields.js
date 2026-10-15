import { PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA, createPipelineConfigurationDiagnostic,
  createPipelineEngineeringConfigurationDraft, createPipelineEngineeringConfigurationField,
} from './pipeline-3d-model-engineering-configuration-contracts.js';
const field = (valueType, unit = '', required = false) => Object.freeze({ valueType, unit, required });
const values = { profileId: field('string'), jobName: field('string', '', true), issueNo: field('string'),
  caesarVersion: field('string', '', true), branchName: field('string', '', true), lineNo: field('string', '', true),
  outsideDiameterMm: field('number', 'mm'), wallThickness: field('number', 'mm'), materialNumber: field('number'),
  corrosionAllowance: field('number', 'mm'), insulationThickness: field('number', 'mm'),
  insulationDensity: field('number'), fluidDensity: field('number'), hydroPressure: field('number'),
  bendScreeningEnabled: field('boolean'), emitToInputXml: field('boolean'), screeningOnlyAcknowledged: field('boolean'),
  detectHorizontal: field('boolean'), detectVertical: field('boolean'), detectCompound: field('boolean'),
  minimumPlanTurnAngleDeg: field('number', 'deg'), minimumProfileTurnAngleDeg: field('number', 'deg'),
  maximumTurnAngleDeg: field('number', 'deg'), shortElementAnglePolicy: field('string'),
  minimumAngleElementLengthMm: field('number', 'mm'), retainedStraightAllowanceMm: field('number', 'mm'),
  preferredStraightTangentMm: field('number', 'mm'), emitNearPointNode: field('boolean'), emitMidpointNode: field('boolean'),
  bendTypeCode: field('number'), normalFittingPolicyId: field('string'), normalRadiusD: field('number', 'D'),
  normalRadiusMm: field('number', 'mm'), b314ElasticFormulaEnabled: field('boolean'),
  b314YoungsModulusMpa: field('number', 'MPa'), b314AllowableBendingStressMpa: field('number', 'MPa'),
  b314ElasticPracticalEnabled: field('boolean'), b314PracticalRadiusD: field('number', 'D'),
  b314ColdPolicyId: field('string'), b314QualifiedAlternativeRequested: field('boolean'),
  b314QualificationEvidenceId: field('string'), b314ProjectMinimumEnabled: field('boolean'),
  b314ProjectMinimumRadiusD: field('number', 'D'), b314ProcedureMinimumRadiusD: field('number', 'D'),
  b314ProjectRadiusD: field('number', 'D'), greVendorId: field('string'), greSeriesId: field('string'),
  greQualificationEvidenceId: field('string'), greRequirementReference: field('string'),
  greSourceAuthority: field('string'), greSourceReference: field('string'),
  greVendorNominalBoreMm: field('number', 'mm'), greBendRadiusMm: field('number', 'mm'),
  greBendBreakLengthBasis: field('string'), greBendBreakMultiplierBore: field('number', 'bore'),
  greBendBreakLengthMm: field('number', 'mm'), greBendLocalThicknessMm: field('number', 'mm'),
  greTeeBreakLengthMm: field('number', 'mm'), greTeeLocalThicknessMm: field('number', 'mm') };
for (let index = 1; index <= 9; index += 1) { values[`pressure${index}`] = field('number'); values[`temperature${index}`] = field('number', 'C'); }
export const PIPELINE_ENGINEERING_FIELD_DEFINITIONS = Object.freeze(values);
const text = (value) => typeof value === 'string' ? value.trim() : '';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function parseValue(raw, definition) { if (raw === '' || raw === undefined || raw === null) return null;
  if (definition.valueType === 'string') return String(raw).trim();
  if (definition.valueType === 'boolean') { if (typeof raw === 'boolean') return raw;
    if (/^(true|1|yes|on)$/i.test(String(raw))) return true; if (/^(false|0|no|off)$/i.test(String(raw))) return false; return undefined; }
  if (definition.valueType === 'number') { const number = Number(raw); return Number.isFinite(number) ? number : undefined; }
  return raw; }
export function emptyPipelineEngineeringConfigurationField(fieldId) { const definition = PIPELINE_ENGINEERING_FIELD_DEFINITIONS[fieldId];
  return createPipelineEngineeringConfigurationField({ fieldId, value: null, valueType: definition.valueType,
    unit: definition.unit, state: 'UNSET', sourceKind: 'NONE' }); }
export function createEmptyPipelineEngineeringConfigurationDraft(storageKey = '') { const fields = Object.fromEntries(Object.keys(PIPELINE_ENGINEERING_FIELD_DEFINITIONS)
  .sort(compare).map((fieldId) => [fieldId, emptyPipelineEngineeringConfigurationField(fieldId)]));
  return createPipelineEngineeringConfigurationDraft({ storageKey, fields, sections: [], normalPolicies: [], b314Policies: [],
    greVendorSeries: [], sectionPropertyAssignments: [], legacyRejectedFields: [] }); }
function updatedDraft(draft, changes) { return createPipelineEngineeringConfigurationDraft({ ...draft, ...changes }); }
export function setPipelineEngineeringConfigurationField(draftInput, fieldId, rawValue, options = {}) {
  const definition = PIPELINE_ENGINEERING_FIELD_DEFINITIONS[fieldId];
  const draft = draftInput?.schema === PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA ? draftInput : createEmptyPipelineEngineeringConfigurationDraft();
  if (!definition) return updatedDraft(draft, { diagnostics: [createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_FIELD_INVALID', 'Unknown configuration field.', { fieldId })] });
  const value = parseValue(rawValue, definition), invalid = value === undefined;
  const state = invalid ? 'INVALID' : value === null ? 'UNSET' : (text(options.state) || 'USER_ENTERED');
  const sourceKind = value === null ? 'NONE' : (text(options.sourceKind) || 'USER_SETTINGS_UI');
  const next = createPipelineEngineeringConfigurationField({ fieldId, value: invalid ? rawValue : value,
    valueType: definition.valueType, unit: definition.unit, state, sourceKind,
    sourceReference: text(options.sourceReference), userConfirmed: options.userConfirmed === true || state === 'USER_ENTERED',
    legacyObserved: options.legacyObserved === true, legacyConfirmed: options.legacyConfirmed === true,
    originalLegacyValue: options.originalLegacyValue, originalStorageKey: options.originalStorageKey });
  return updatedDraft(draft, { fields: { ...draft.fields, [fieldId]: next } }); }
export const pipelineEngineeringConfigurationFieldValue = (draft, fieldId) => draft?.fields?.[fieldId]?.ready ? draft.fields[fieldId].value : null;
export function updatePipelineEngineeringConfigurationDraftCollections(draftInput, changes = {}) { return updatedDraft(createPipelineEngineeringConfigurationDraft(draftInput), changes); }
