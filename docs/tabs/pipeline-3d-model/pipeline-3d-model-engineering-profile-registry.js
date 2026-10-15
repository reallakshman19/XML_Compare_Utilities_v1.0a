export const PIPELINE_ENGINEERING_PROFILE_REGISTRY_SCHEMA = 'PipelineEngineeringProfileRegistry.v1';
export const PIPELINE_ENGINEERING_PROFILE_SCHEMA = 'PipelineEngineeringProfile.v1';
export const PIPELINE_ENGINEERING_PROFILE_RESOLUTION_SCHEMA = 'PipelineEngineeringProfileResolution.v1';
export const PIPELINE_ENGINEERING_PROFILE_IDS = Object.freeze({
  NORMAL_METALLIC: 'normal-metallic', ASME_B31_4: 'asme-b31.4', GRE: 'gre',
});
export const PIPELINE_ENGINEERING_PROFILE_MODES = Object.freeze({
  NORMAL: 'NORMAL', ASME_B31_4: 'ASME_B31_4', GRE: 'GRE',
});
const PROFILE_ORDER = Object.freeze(Object.values(PIPELINE_ENGINEERING_PROFILE_IDS));
const MODE_ORDER = Object.freeze(Object.values(PIPELINE_ENGINEERING_PROFILE_MODES));
const BLOCKER_ORDER = Object.freeze([
  'PIPELINE_PROFILE_ID_INVALID',
  'PIPELINE_PROFILE_REGISTRY_DUPLICATE',
  'PIPELINE_PROFILE_REGISTRY_INCOMPLETE',
  'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
  'PIPELINE_PROFILE_MODE_INVALID',
]);
const REQUIRED_FIELDS = Object.freeze([
  'schema', 'profileId', 'displayName', 'resolvedMode', 'legacyDesignBasis',
  'materialState', 'materialFamilyPolicy', 'pipingCode', 'codeEditionPolicy',
  'fittingPolicyId', 'fittingResolverId', 'allowedDiameterBases',
  'requiredPropertySeedNames', 'sourceAuthority', 'status',
]);
const CANONICAL_FIELDS = Object.freeze(['schema', 'resolvedMode', 'legacyDesignBasis', 'materialState', 'materialFamilyPolicy', 'pipingCode', 'codeEditionPolicy', 'fittingPolicyId', 'fittingResolverId', 'status']);
const DEFAULT_DESCRIPTORS = Object.freeze([
  Object.freeze({
    schema: PIPELINE_ENGINEERING_PROFILE_SCHEMA,
    profileId: 'normal-metallic',
    displayName: 'Normal Metallic',
    resolvedMode: 'NORMAL',
    legacyDesignBasis: 'default-metallic',
    materialState: 'METALLIC',
    materialFamilyPolicy: 'PROJECT_DEFINED',
    pipingCode: 'PROJECT_DEFINED',
    codeEditionPolicy: 'PROJECT_DEFINED',
    fittingPolicyId: 'NORMAL_METALLIC_FITTING_POLICY',
    fittingResolverId: 'NOT_BOUND',
    allowedDiameterBases: Object.freeze(['PROJECT_DEFINED']),
    requiredPropertySeedNames: Object.freeze([]),
    sourceAuthority: 'P3D-PROF-040',
    status: 'CONTRACT_ONLY',
  }),
  Object.freeze({
    schema: PIPELINE_ENGINEERING_PROFILE_SCHEMA,
    profileId: 'asme-b31.4',
    displayName: 'ASME B31.4',
    resolvedMode: 'ASME_B31_4',
    legacyDesignBasis: 'asme-b31.4',
    materialState: 'METALLIC',
    materialFamilyPolicy: 'PROJECT_DEFINED',
    pipingCode: 'ASME B31.4',
    codeEditionPolicy: 'EXPLICIT_OR_APPROVED_LEGACY',
    fittingPolicyId: 'ASME_B31_4_FITTING_POLICY',
    fittingResolverId: 'NOT_BOUND',
    allowedDiameterBases: Object.freeze(['PROJECT_DEFINED']),
    requiredPropertySeedNames: Object.freeze([]),
    sourceAuthority: 'P3D-PROF-040',
    status: 'CONTRACT_ONLY',
  }),
  Object.freeze({
    schema: PIPELINE_ENGINEERING_PROFILE_SCHEMA,
    profileId: 'gre',
    displayName: 'GRE',
    resolvedMode: 'GRE',
    legacyDesignBasis: 'gre',
    materialState: 'COMPOSITE',
    materialFamilyPolicy: 'VENDOR_QUALIFIED',
    pipingCode: 'VENDOR_QUALIFIED',
    codeEditionPolicy: 'NOT_APPLICABLE',
    fittingPolicyId: 'GRE_VENDOR_SERIES_POLICY',
    fittingResolverId: 'NOT_BOUND',
    allowedDiameterBases: Object.freeze(['VENDOR_DEFINED']),
    requiredPropertySeedNames: Object.freeze([]),
    sourceAuthority: 'P3D-PROF-040',
    status: 'CONTRACT_ONLY',
  }),
]);
function text(value) {
  return String(value ?? '').trim();
}
function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function cloneJson(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!plainObject(value)) throw new TypeError('Contract input must be JSON-safe plain data.');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)]));
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function diagnostic(code, message, details = {}) {
  return deepFreeze({ severity: 'BLOCKING', code, message, details: cloneJson(details) });
}
function blockerRank(code) {
  const index = BLOCKER_ORDER.indexOf(code);
  return index < 0 ? BLOCKER_ORDER.length : index;
}
function orderedDiagnostics(items) {
  const keyed = new Map();
  for (const item of items) keyed.set(`${item.code}:${JSON.stringify(item.details)}`, item);
  return Object.freeze([...keyed.values()].sort((left, right) =>
    blockerRank(left.code) - blockerRank(right.code)
    || compareText(left.code, right.code)
    || compareText(JSON.stringify(left.details), JSON.stringify(right.details))));
}
function orderedCodes(diagnostics) {
  const codes = [...new Set(diagnostics.map((item) => item.code))];
  return Object.freeze(codes.sort((left, right) =>
    blockerRank(left) - blockerRank(right) || compareText(left, right)));
}
function validStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && text(item));
}
function canonicalDescriptor(profileId) {
  return DEFAULT_DESCRIPTORS.find((profile) => profile.profileId === profileId) || null;
}
function canonicalDiagnostics(source) {
  const canonical = canonicalDescriptor(source.profileId);
  if (!canonical) return [];
  const differences = CANONICAL_FIELDS.filter((field) =>
    JSON.stringify(source[field]) !== JSON.stringify(canonical[field]));
  const diagnostics = [];
  if (differences.includes('resolvedMode')) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_MODE_INVALID',
    'Engineering profile resolved mode does not match its canonical profile ID.',
    { profileId: source.profileId, expectedMode: canonical.resolvedMode, actualMode: source.resolvedMode },
  ));
  const descriptorFields = differences.filter((field) => field !== 'resolvedMode');
  if (descriptorFields.length) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
    'Engineering profile descriptor does not match canonical profile semantics.',
    { profileId: source.profileId, mismatchedFields: descriptorFields },
  ));
  return diagnostics;
}
function descriptorDiagnostics(source) {
  const diagnostics = [];
  const missing = REQUIRED_FIELDS.filter((field) => source[field] === undefined || source[field] === null);
  if (missing.length) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
    'Engineering profile descriptor is missing required fields.',
    { profileId: text(source.profileId), missingFields: missing },
  ));
  if (!PROFILE_ORDER.includes(source.profileId)) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_ID_INVALID',
    'Engineering profile ID is not one of the registered exact identifiers.',
    { profileId: text(source.profileId) },
  ));
  if (!MODE_ORDER.includes(source.resolvedMode)) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_MODE_INVALID',
    'Engineering profile resolved mode is unsupported.',
    { profileId: text(source.profileId), resolvedMode: text(source.resolvedMode) },
  ));
  const stringFields = REQUIRED_FIELDS.filter((field) =>
    !['allowedDiameterBases', 'requiredPropertySeedNames'].includes(field));
  const blank = stringFields.filter((field) => typeof source[field] !== 'string' || !text(source[field]));
  if (blank.length) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
    'Engineering profile descriptor contains blank or non-string required values.',
    { profileId: text(source.profileId), invalidFields: blank },
  ));
  const arraysValid = validStringArray(source.allowedDiameterBases)
    && validStringArray(source.requiredPropertySeedNames);
  if (!arraysValid) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
    'Engineering profile descriptor array fields must contain only nonblank strings.',
    { profileId: text(source.profileId) },
  ));
  if (!missing.length && !blank.length && arraysValid
    && PROFILE_ORDER.includes(source.profileId) && MODE_ORDER.includes(source.resolvedMode)) {
    diagnostics.push(...canonicalDiagnostics(source));
  }
  return diagnostics;
}
function normalizeDescriptor(input) {
  let source;
  try { source = cloneJson(input); }
  catch {
    return { profile: null, diagnostics: [diagnostic(
      'PIPELINE_PROFILE_DESCRIPTOR_INVALID',
      'Engineering profile descriptor is not JSON-safe plain data.',
    )] };
  }
  if (!plainObject(source)) return { profile: null, diagnostics: [diagnostic(
    'PIPELINE_PROFILE_DESCRIPTOR_INVALID', 'Engineering profile descriptor must be a plain object.',
  )] };
  const diagnostics = descriptorDiagnostics(source);
  if (diagnostics.length) return { profile: null, diagnostics };
  const profile = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, cloneJson(source[field])]));
  return { profile: deepFreeze(profile), diagnostics: [] };
}
export function createPipelineEngineeringProfileRegistry(descriptors = DEFAULT_DESCRIPTORS) {
  const inputs = Array.isArray(descriptors) ? descriptors : [];
  const diagnostics = [];
  const profiles = [];
  const counts = Object.create(null);
  if (!Array.isArray(descriptors)) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_DESCRIPTOR_INVALID', 'Engineering profile registry input must be an array.',
  ));
  for (const input of inputs) {
    const id = plainObject(input) ? text(input.profileId) : '';
    if (id) counts[id] = (counts[id] || 0) + 1;
    const normalized = normalizeDescriptor(input);
    diagnostics.push(...normalized.diagnostics);
    if (normalized.profile) profiles.push(normalized.profile);
  }
  for (const profileId of Object.keys(counts).sort(compareText)) {
    if (counts[profileId] > 1) diagnostics.push(diagnostic(
      'PIPELINE_PROFILE_REGISTRY_DUPLICATE',
      'Engineering profile registry contains a duplicate profile ID.',
      { profileId, count: counts[profileId] },
    ));
  }
  const byId = Object.create(null);
  for (const profileId of PROFILE_ORDER) {
    const matches = profiles.filter((profile) => profile.profileId === profileId);
    if (matches.length) byId[profileId] = matches[0];
  }
  const orderedProfiles = Object.freeze(PROFILE_ORDER.filter((id) => byId[id]).map((id) => byId[id]));
  const missingProfileIds = PROFILE_ORDER.filter((id) => !byId[id]);
  if (missingProfileIds.length || inputs.length !== PROFILE_ORDER.length) diagnostics.push(diagnostic(
    'PIPELINE_PROFILE_REGISTRY_INCOMPLETE',
    'Engineering profile registry must contain exactly the three canonical profiles.',
    { missingProfileIds, descriptorCount: inputs.length },
  ));
  const frozenDiagnostics = orderedDiagnostics(diagnostics);
  return deepFreeze({
    schema: PIPELINE_ENGINEERING_PROFILE_REGISTRY_SCHEMA,
    profiles: orderedProfiles,
    diagnostics: frozenDiagnostics,
    blockerCodes: orderedCodes(frozenDiagnostics),
    ready: frozenDiagnostics.length === 0,
  });
}
export const PIPELINE_ENGINEERING_PROFILE_REGISTRY = createPipelineEngineeringProfileRegistry();
export function getPipelineEngineeringProfile(profileId, registry = PIPELINE_ENGINEERING_PROFILE_REGISTRY) {
  const requested = text(profileId);
  return (registry?.profiles || []).find((profile) => profile.profileId === requested) || null;
}
function resolutionBase(requestedProfileId, options) {
  return {
    schema: PIPELINE_ENGINEERING_PROFILE_RESOLUTION_SCHEMA,
    requestedProfileId: text(requestedProfileId),
    sourceAuthority: text(options?.sourceAuthority) || 'CALLER',
    sourceReference: text(options?.sourceReference),
    fallbackApplied: false,
  };
}
export function resolvePipelineEngineeringProfile(requestedProfileId, options = {}) {
  const registry = options.registry || PIPELINE_ENGINEERING_PROFILE_REGISTRY;
  const base = resolutionBase(requestedProfileId, options);
  if (!base.requestedProfileId) return deepFreeze({
    ...base, resolvedProfileId: '', resolvedMode: '', status: 'UNRESOLVED_LEGACY',
    resolutionReason: 'LEGACY_PROFILE_NOT_SPECIFIED', fallbackEligible: true,
    profile: null,
    diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]), ready: false,
  });
  if (registry?.ready !== true) return deepFreeze({
    ...base, resolvedProfileId: '', resolvedMode: '', status: 'BLOCKED',
    resolutionReason: 'PROFILE_REGISTRY_NOT_READY', fallbackEligible: false,
    profile: null,
    diagnostics: registry?.diagnostics || Object.freeze([]),
    blockerCodes: registry?.blockerCodes || Object.freeze(['PIPELINE_PROFILE_REGISTRY_INCOMPLETE']),
    ready: false,
  });
  const profile = getPipelineEngineeringProfile(base.requestedProfileId, registry);
  if (!profile) {
    const diagnostics = orderedDiagnostics([diagnostic(
      'PIPELINE_PROFILE_ID_INVALID',
      'Explicit engineering profile ID is not registered.',
      { requestedProfileId: base.requestedProfileId },
    )]);
    return deepFreeze({
      ...base, resolvedProfileId: '', resolvedMode: '', status: 'BLOCKED',
      resolutionReason: 'PROFILE_ID_NOT_REGISTERED', fallbackEligible: false,
      profile: null, diagnostics, blockerCodes: orderedCodes(diagnostics), ready: false,
    });
  }
  return deepFreeze({
    ...base, resolvedProfileId: profile.profileId, resolvedMode: profile.resolvedMode,
    status: 'RESOLVED', resolutionReason: 'EXPLICIT_PROFILE_ID_RESOLVED',
    fallbackEligible: false, profile,
    diagnostics: Object.freeze([]), blockerCodes: Object.freeze([]), ready: true,
  });
}