import {
  PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA,
  createPipelineConfigurationDiagnostic,
  createPipelineEngineeringConfigurationDraft,
  createPipelineEngineeringConfigurationField,
} from './pipeline-3d-model-engineering-configuration-contracts.js';
import {
  createEmptyPipelineEngineeringConfigurationDraft,
  setPipelineEngineeringConfigurationField,
  updatePipelineEngineeringConfigurationDraftCollections,
} from './pipeline-3d-model-engineering-configuration-fields.js';

export const PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY = 'pipeline-engineering-configuration-v1';
export const PIPELINE_ENGINEERING_CONFIGURATION_LEGACY_KEYS = Object.freeze([
  'pipeline-3d-model-bend-settings-v3',
  'pipeline-3d-model-elastic-bend-settings-v2',
  'pipeline-3d-model-elastic-bend-settings-v1',
]);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const map = Object.freeze({
  designBasis: 'profileId', explicitOutsideDiameterMm: 'outsideDiameterMm',
  standardRadiusMultiplierD: 'normalRadiusD', youngsModulusMpa: 'b314YoungsModulusMpa',
  allowableBendingStressMpa: 'b314AllowableBendingStressMpa', practicalRadiusMultiplierD: 'b314PracticalRadiusD',
  qualificationEvidenceId: 'b314QualificationEvidenceId', greNominalBoreMm: 'greVendorNominalBoreMm',
  greBendRadiusMm: 'greBendRadiusMm', greBendBreakMultiplierBore: 'greBendBreakMultiplierBore',
  greBendLocalThicknessMm: 'greBendLocalThicknessMm', greTeeBreakLengthMm: 'greTeeBreakLengthMm',
  greTeeLocalThicknessMm: 'greTeeLocalThicknessMm', greRequirementReference: 'greRequirementReference',
  minimumPlanTurnAngleDeg: 'minimumPlanTurnAngleDeg', minimumProfileTurnAngleDeg: 'minimumProfileTurnAngleDeg',
  maximumTurnAngleDeg: 'maximumTurnAngleDeg', preferredStraightTangentMm: 'preferredStraightTangentMm',
});
const profiles = Object.freeze({
  'default-metallic': 'normal-metallic', 'asme-b31.4': 'asme-b31.4', gre: 'gre',
});
function storageInvalid() {
  return createPipelineEngineeringConfigurationDraft({
    ...createEmptyPipelineEngineeringConfigurationDraft(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY),
    diagnostics: [createPipelineConfigurationDiagnostic('PIPELINE_CONFIGURATION_STORAGE_INVALID',
      'Stored engineering configuration is not valid JSON or a valid draft.')],
  });
}
function legacyEntries(value) {
  return Object.entries(map).filter(([key]) => value?.[key] !== undefined && value[key] !== '')
    .map(([key, fieldId]) => [fieldId, key === 'designBasis' ? profiles[value[key]] : value[key]]);
}
function migrateLegacy(value, storageKey) {
  let draft = createEmptyPipelineEngineeringConfigurationDraft(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY);
  for (const [fieldId, rawValue] of legacyEntries(value)) draft = setPipelineEngineeringConfigurationField(
    draft, fieldId, rawValue, { state: 'LEGACY_UNCONFIRMED', sourceKind: 'NONE',
      legacyObserved: true, originalLegacyValue: rawValue, originalStorageKey: storageKey,
      sourceReference: storageKey });
  return draft;
}
export function loadPipelineEngineeringConfigurationDraft(storage = globalThis.localStorage) {
  if (!storage?.getItem) return createEmptyPipelineEngineeringConfigurationDraft(
    PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY);
  const current = storage.getItem(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY);
  if (current) {
    try {
      const value = JSON.parse(current);
      return value?.schema === PIPELINE_ENGINEERING_CONFIGURATION_DRAFT_SCHEMA
        ? createPipelineEngineeringConfigurationDraft(value) : storageInvalid();
    } catch { return storageInvalid(); }
  }
  for (const key of PIPELINE_ENGINEERING_CONFIGURATION_LEGACY_KEYS) {
    const raw = storage.getItem(key); if (!raw) continue;
    try { return migrateLegacy(JSON.parse(raw), key); } catch { return storageInvalid(); }
  }
  return createEmptyPipelineEngineeringConfigurationDraft(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY);
}
export function savePipelineEngineeringConfigurationDraft(draftInput, storage = globalThis.localStorage) {
  const draft = createPipelineEngineeringConfigurationDraft({ ...draftInput,
    storageKey: PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY });
  if (storage?.setItem) storage.setItem(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY, JSON.stringify(draft));
  return draft;
}
export function confirmPipelineEngineeringConfigurationFields(draftInput, fieldIds = []) {
  let draft = createPipelineEngineeringConfigurationDraft(draftInput);
  for (const fieldId of [...new Set(fieldIds)].sort(compare)) {
    const current = draft.fields[fieldId];
    if (!current || current.state !== 'LEGACY_UNCONFIRMED') continue;
    draft = setPipelineEngineeringConfigurationField(draft, fieldId, current.value, {
      state: 'CONFIRMED', sourceKind: 'CONFIRMED_LEGACY_STORAGE', userConfirmed: true,
      legacyObserved: true, legacyConfirmed: true, sourceReference: current.sourceReference,
      originalLegacyValue: current.originalLegacyValue, originalStorageKey: current.originalStorageKey,
    });
  }
  return draft;
}
function rejectedField(current) {
  return createPipelineEngineeringConfigurationField({ fieldId: current.fieldId,
    value: null, valueType: current.valueType, unit: current.unit,
    state: 'NOT_APPLICABLE', sourceKind: 'NONE', sourceReference: current.sourceReference,
    userConfirmed: true, legacyObserved: current.legacyObserved,
    legacyConfirmed: false, originalLegacyValue: current.originalLegacyValue ?? current.value,
    originalStorageKey: current.originalStorageKey });
}
export function rejectPipelineEngineeringConfigurationFields(draftInput, fieldIds = []) {
  let draft = createPipelineEngineeringConfigurationDraft(draftInput);
  const rejected = new Set(draft.legacyRejectedFields);
  for (const fieldId of [...new Set(fieldIds)].sort(compare)) {
    const current = draft.fields[fieldId]; if (!current) continue;
    rejected.add(fieldId);
    draft = updatePipelineEngineeringConfigurationDraftCollections(draft, {
      fields: { ...draft.fields, [fieldId]: rejectedField(current) },
    });
  }
  return updatePipelineEngineeringConfigurationDraftCollections(draft, {
    legacyRejectedFields: [...rejected].sort(compare),
  });
}
export function rejectAllPipelineEngineeringLegacyFields(draftInput) {
  const draft = createPipelineEngineeringConfigurationDraft(draftInput);
  return rejectPipelineEngineeringConfigurationFields(draft,
    Object.values(draft.fields).filter((item) => item.legacyObserved).map((item) => item.fieldId));
}
