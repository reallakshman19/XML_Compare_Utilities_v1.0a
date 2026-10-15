import { PIPELINE_ENGINEERING_PROFILE_IDS, PIPELINE_ENGINEERING_PROFILE_REGISTRY, getPipelineEngineeringProfile } from './pipeline-3d-model-engineering-profile-registry.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA, PIPELINE_ANALYSIS_SECTION_SCHEMA, PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA,
  createPipelineAnalysisSection, createPipelineAnalysisSectionPlan, createPipelineElementSectionResolution } from './pipeline-3d-model-analysis-section-contracts.js';
export const PIPELINE_ANALYSIS_SECTION_RESOLUTION_SCHEMA = 'PipelineAnalysisSectionResolution.v1';
const ORDER = Object.freeze(['PIPELINE_PROFILE_ID_INVALID', 'PIPELINE_LEGACY_PROFILE_INVALID',   'PIPELINE_SECTION_PROFILE_CONFLICT', 'PIPELINE_LEGACY_PROFILE_FALLBACK_BLOCKED',
  'PIPELINE_ANALYSIS_SECTION_ELEMENT_REQUIRED', 'PIPELINE_ANALYSIS_SECTION_FIRST_BOUNDARY_REQUIRED',
  'PIPELINE_ANALYSIS_SECTION_START_OUT_OF_RANGE', 'PIPELINE_ANALYSIS_SECTION_DUPLICATE_BOUNDARY',
  'PIPELINE_ANALYSIS_SECTION_NO_CHANGE', 'PIPELINE_ANALYSIS_SECTION_ID_INVALID',
  'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID', 'PIPELINE_PROFILE_BOUNDARY_INTERSECTS_FITTING',
'PIPELINE_ELEMENT_SECTION_COVERAGE_INVALID']);
const text = (value) => String(value ?? '').trim();
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function cloneJson(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  if (!plain(value)) throw new TypeError('Planner input must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, cloneJson(value[key])]));
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
function diagnostic(code, message, details = {}) {
  return deepFreeze({ severity: 'BLOCKING', code, message, details: cloneJson(details) });
}
function rank(code) {
  const index = ORDER.indexOf(code);
  return index < 0 ? ORDER.length : index;
}
function orderedDiagnostics(values) {
  const keyed = Object.create(null);
  values.forEach((item) => { keyed[`${item.code}:${JSON.stringify(item.details)}`] = item; });
  return Object.freeze(Object.values(keyed).sort((left, right) => rank(left.code) - rank(right.code)
    || compareText(left.code, right.code) || compareText(JSON.stringify(left.details), JSON.stringify(right.details))));
}
function orderedCodes(diagnostics) {
  const keyed = Object.create(null);
  diagnostics.forEach((item) => { keyed[item.code] = true; });
  return Object.freeze(Object.keys(keyed).sort((left, right) => rank(left) - rank(right) || compareText(left, right)));
}
function exactProfile(profileId) {
  return getPipelineEngineeringProfile(text(profileId));
}
function legacyProfile(legacyDesignBasis) {
  const basis = text(legacyDesignBasis);
  return PIPELINE_ENGINEERING_PROFILE_REGISTRY.profiles.find((item) => item.legacyDesignBasis === basis) || null;
}
function explicitProfileId(input) {
  const context = input.exportContext?.profile || {};
  return text(input.profileId) || (context.fallbackApplied === false ? text(context.resolvedProfileId) : '');
}
function legacyBasis(input) {
  if (text(input.legacyDesignBasis)) return text(input.legacyDesignBasis);
  const context = input.exportContext?.profile || {};
  if (text(context.requestedDesignBasis)) return text(context.requestedDesignBasis);
  return context.fallbackApplied === false ? text(context.resolvedDesignBasis) : '';
}
function legacyMode(input) {
  return text(input.legacyResolvedMode) || text(input.exportContext?.profile?.resolvedMode);
}
function resolveGlobalSource(input, diagnostics) {
  const requestedProfileId = explicitProfileId(input);
  if (requestedProfileId) {
    const resolved = exactProfile(requestedProfileId);
    if (!resolved) diagnostics.push(diagnostic(
      'PIPELINE_PROFILE_ID_INVALID', 'Explicit profile ID is not registered.', { requestedProfileId }));
    return { supplied: true, valid: Boolean(resolved), sourceKind: 'EXPLICIT_PROFILE',
      requestedProfileId, legacyDesignBasis: '', resolved };
  }
  const legacyDesignBasis = legacyBasis(input);
  if (!legacyDesignBasis) return { supplied: false, valid: false, sourceKind: 'UNRESOLVED',
    requestedProfileId: '', legacyDesignBasis: '', resolved: null };
  const resolved = legacyProfile(legacyDesignBasis);
  if (!resolved) diagnostics.push(diagnostic(
    'PIPELINE_LEGACY_PROFILE_INVALID', 'Legacy design basis cannot be migrated.', { legacyDesignBasis }));
  const mode = legacyMode(input);
  if (resolved && mode && mode !== resolved.resolvedMode) diagnostics.push(diagnostic(
    'PIPELINE_LEGACY_PROFILE_INVALID', 'Legacy resolved mode conflicts with canonical mode.',
    { legacyResolvedMode: mode, expectedMode: resolved.resolvedMode }));
  return { supplied: true, valid: Boolean(resolved) && (!mode || mode === resolved?.resolvedMode),
    sourceKind: 'LEGACY_DESIGN_BASIS', requestedProfileId: '', legacyDesignBasis,
    resolved: resolved && (!mode || mode === resolved.resolvedMode) ? resolved : null };
}
function migration(fields) {
  return deepFreeze({
    sourceKind: text(fields.sourceKind) || 'UNRESOLVED', requestedProfileId: text(fields.requestedProfileId),
    legacyDesignBasis: text(fields.legacyDesignBasis), resolvedProfileId: text(fields.resolvedProfileId),
    resolvedMode: text(fields.resolvedMode), fallbackEligible: fields.fallbackEligible === true,
    fallbackApplied: fields.fallbackApplied === true, resolutionReason: text(fields.resolutionReason),
    sourceAuthority: text(fields.sourceAuthority), sourceReference: text(fields.sourceReference),
  });
}
function explicitSeeds(input, authority, reference) {
  return input.analysisSections.map((item) => ({ sourceAuthority: authority, sourceReference: reference, ...cloneJson(item) }))
    .sort((left, right) => Number(left.startElementIndex) - Number(right.startElementIndex)
      || compareText(text(left.profileId), text(right.profileId))
      || compareText(JSON.stringify(left), JSON.stringify(right)));
}
function sourceResolution(input, diagnostics) {
  const authority = text(input.sourceAuthority) || 'CALLER';
  const reference = text(input.sourceReference);
  const global = resolveGlobalSource(input, diagnostics);
  if (Array.isArray(input.analysisSections) && input.analysisSections.length) return {
    seeds: explicitSeeds(input, authority, reference), global,
    migrationFields: { sourceKind: 'EXPLICIT_SECTIONS', requestedProfileId: '',
      legacyDesignBasis: global.legacyDesignBasis, resolutionReason: 'EXPLICIT_ANALYSIS_SECTIONS_PENDING',
      sourceAuthority: authority, sourceReference: reference },
  };
  if (global.supplied) {
    if (!global.valid) return { seeds: [], global, migrationFields: { sourceKind: 'UNRESOLVED',
      requestedProfileId: global.requestedProfileId, legacyDesignBasis: global.legacyDesignBasis,
      resolutionReason: 'PROFILE_SOURCE_INVALID', sourceAuthority: authority, sourceReference: reference } };
    return { seeds: [{ startElementIndex: 0, profileId: global.resolved.profileId,
      sourceAuthority: authority, sourceReference: reference, boundaryAuthority: 'PROFILE_SOURCE_MIGRATION' }], global,
      migrationFields: { sourceKind: global.sourceKind, requestedProfileId: global.requestedProfileId,
        legacyDesignBasis: global.legacyDesignBasis, resolvedProfileId: global.resolved.profileId,
        resolvedMode: global.resolved.resolvedMode,
        resolutionReason: global.sourceKind === 'EXPLICIT_PROFILE'
          ? 'EXPLICIT_PROFILE_ID_RESOLVED' : 'LEGACY_DESIGN_BASIS_MIGRATED',
        sourceAuthority: authority, sourceReference: reference } };
  }
  if (input.greEvidencePresent === true) {
    diagnostics.push(diagnostic('PIPELINE_LEGACY_PROFILE_FALLBACK_BLOCKED',
      'Safe Normal fallback is prohibited when GRE evidence is present.'));
    return { seeds: [], global, migrationFields: { sourceKind: 'UNRESOLVED',
      resolutionReason: 'LEGACY_PROFILE_NOT_SPECIFIED_GRE_EVIDENCE', sourceAuthority: authority,
      sourceReference: reference } };
  }
  const resolved = exactProfile(PIPELINE_ENGINEERING_PROFILE_IDS.NORMAL_METALLIC);
  return { seeds: [{ startElementIndex: 0, profileId: resolved.profileId,
    sourceAuthority: authority, sourceReference: reference, boundaryAuthority: 'SAFE_NORMAL_FALLBACK' }], global,
    migrationFields: { sourceKind: 'SAFE_NORMAL_FALLBACK', resolvedProfileId: resolved.profileId,
      resolvedMode: resolved.resolvedMode, fallbackEligible: true, fallbackApplied: true,
      resolutionReason: 'LEGACY_PROFILE_NOT_SPECIFIED_SAFE_NORMAL', sourceAuthority: authority,
      sourceReference: reference } };
}
function activeFitting(candidate) {
  if (!plain(candidate)) return false;
  const status = text(candidate.status);
  if (['EMITTED', 'READY_NOT_EMITTED'].includes(status)) return true;
  return candidate.geometryFits === true && !['DISABLED', 'INFEASIBLE'].includes(status);
}
function boundaryHitsFitting(index, boundaryNode, bendResolution) {
  if (index <= 0 || boundaryNode == null) return false;
  const incoming = index - 1;
  const emitted = bendResolution?.bendByIncomingElementIndex?.[incoming];
  if (plain(emitted) && text(emitted.status) !== 'DISABLED'
    && text(emitted.cornerNode) === text(boundaryNode)) return true;
  const candidates = Array.isArray(bendResolution?.candidates) ? bendResolution.candidates : [];
  return candidates.some((item) => Number(item?.incomingElementIndex) === incoming
    && text(item?.cornerNode) === text(boundaryNode) && activeFitting(item));
}
function duplicateIndexes(seeds, diagnostics) {
  const counts = Object.create(null);
  seeds.forEach((item) => { const key = String(item.startElementIndex); counts[key] = (counts[key] || 0) + 1; });
  Object.keys(counts).sort(compareText).filter((key) => counts[key] > 1).forEach((key) => diagnostics.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_DUPLICATE_BOUNDARY', 'Analysis-section boundary index is duplicated.',
    { startElementIndex: Number(key), count: counts[key] })));
  return counts;
}
function normalizeSections(seeds, elementCount, rows, bendResolution, global, diagnostics) {
  const counts = duplicateIndexes(seeds, diagnostics);
  if (seeds.length && seeds[0].startElementIndex !== 0) diagnostics.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_FIRST_BOUNDARY_REQUIRED', 'First analysis section must start at element index 0.',
    { firstStartElementIndex: seeds[0].startElementIndex }));
  const accepted = [];
  for (const source of seeds) {
    const start = source.startElementIndex;
    if (!Number.isInteger(start) || start < 0 || start >= elementCount) {
      diagnostics.push(diagnostic('PIPELINE_ANALYSIS_SECTION_START_OUT_OF_RANGE',
        'Analysis-section boundary is outside the element range.', { startElementIndex: start, elementCount }));
      continue;
    }
    if (counts[String(start)] > 1 && accepted.some((item) => item.startElementIndex === start)) continue;
    const resolved = exactProfile(source.profileId);
    if (!resolved) {
      diagnostics.push(diagnostic('PIPELINE_PROFILE_ID_INVALID',
        'Section profile ID is not registered.', { profileId: text(source.profileId), startElementIndex: start }));
      continue;
    }
    if (accepted.at(-1)?.profileId === resolved.profileId) {
      diagnostics.push(diagnostic('PIPELINE_ANALYSIS_SECTION_NO_CHANGE',
        'Adjacent sections cannot use the same profile.', { startElementIndex: start, profileId: resolved.profileId }));
      continue;
    }
    const analysisSectionId = `AS${accepted.length + 1}`;
    if (text(source.analysisSectionId) && text(source.analysisSectionId) !== analysisSectionId) diagnostics.push(diagnostic(
      'PIPELINE_ANALYSIS_SECTION_ID_INVALID', 'Caller section ID contradicts deterministic identity.',
      { suppliedAnalysisSectionId: text(source.analysisSectionId), expectedAnalysisSectionId: analysisSectionId }));
    const boundaryNode = rows[start]?.nodeNumber ?? null;
    if (boundaryHitsFitting(start, boundaryNode, bendResolution)) diagnostics.push(diagnostic(
      'PIPELINE_PROFILE_BOUNDARY_INTERSECTS_FITTING', 'Boundary intersects an incoming-element fitting envelope.',
      { startElementIndex: start, boundaryNode, incomingElementIndex: start - 1 }));
    accepted.push({ analysisSectionId, startElementIndex: start, profileId: resolved.profileId,
      resolvedMode: resolved.resolvedMode, boundaryNode, source });
  }
  if (global.valid && accepted[0] && global.resolved.profileId !== accepted[0].profileId) diagnostics.push(diagnostic(
    'PIPELINE_SECTION_PROFILE_CONFLICT', 'Global profile conflicts with first explicit section.',
    { globalProfileId: global.resolved.profileId, firstSectionProfileId: accepted[0].profileId }));
  return accepted;
}
function sectionContracts(items) {
  return items.map((item) => createPipelineAnalysisSection({
    analysisSectionId: item.analysisSectionId, startElementIndex: item.startElementIndex,
    profileId: item.profileId, boundaryAuthority: text(item.source.boundaryAuthority) || 'EXPLICIT_START_ELEMENT_INDEX',
    boundarySourceReference: text(item.source.boundarySourceReference), sourceAuthority: text(item.source.sourceAuthority),
    sourceReference: text(item.source.sourceReference), status: 'PLANNED',
  }));
}
function elementContracts(sections, elementCount, rows) {
  const result = [];
  for (let elementIndex = 0; elementIndex < elementCount; elementIndex += 1) {
    let owner = null;
    sections.forEach((section) => { if (section.startElementIndex <= elementIndex) owner = section; });
    if (!owner) continue;
    const isStart = owner.startElementIndex === elementIndex;
    result.push(createPipelineElementSectionResolution({
      elementIndex, elementId: `E${elementIndex + 1}`, analysisSectionId: owner.analysisSectionId,
      profileId: owner.profileId, resolvedMode: owner.resolvedMode,
      sectionDisposition: isStart ? 'SECTION_START' : 'INHERITED',
      boundaryNode: isStart ? (rows[elementIndex]?.nodeNumber ?? null) : null,
      sourceAuthority: text(owner.source.sourceAuthority), sourceReference: text(owner.source.sourceReference),
    }));
  }
  return result;
}
function coverageDiagnostic(elements, elementCount) {
  const counts = Object.create(null);
  elements.forEach((item) => { counts[item.elementIndex] = (counts[item.elementIndex] || 0) + 1; });
  const invalid = elements.length !== elementCount
    || elements.some((item) => item.elementIndex < 0 || item.elementIndex >= elementCount || counts[item.elementIndex] !== 1)
    || Array.from({ length: elementCount }, (_, index) => index).some((index) => !counts[index]);
  return invalid ? diagnostic('PIPELINE_ELEMENT_SECTION_COVERAGE_INVALID',
    'Every existing element must have exactly one section owner.', { elementCount, resolutionCount: elements.length }) : null;
}
function finalMigration(fields, plan) {
  if (fields.sourceKind !== 'EXPLICIT_SECTIONS') return migration(fields);
  if (!plan.ready) return migration({ ...fields, resolvedProfileId: '', resolvedMode: '',
    resolutionReason: 'EXPLICIT_ANALYSIS_SECTIONS_BLOCKED' });
  const first = plan.sections[0];
  const resolved = exactProfile(first?.profileId);
  return migration({ ...fields, requestedProfileId: first?.profileId,
    resolvedProfileId: resolved?.profileId, resolvedMode: resolved?.resolvedMode,
    resolutionReason: 'EXPLICIT_ANALYSIS_SECTIONS_RESOLVED' });
}
export function resolvePipelineAnalysisSectionPlan(input = {}) {
  const diagnostics = [];
  let source;
  try { source = cloneJson(input); } catch {
    source = {};
    diagnostics.push(diagnostic('PIPELINE_ELEMENT_SECTION_COVERAGE_INVALID', 'Planner input is not JSON-safe plain data.'));
  }
  const rows = Array.isArray(source.coordinateRows) ? source.coordinateRows : [];
  const elementCount = Math.max(0, rows.length - 1);
  if (!elementCount) diagnostics.push(diagnostic('PIPELINE_ANALYSIS_SECTION_ELEMENT_REQUIRED',
    'At least one piping element is required.', { coordinateRowCount: rows.length }));
  if (source.analysisSections !== undefined && !Array.isArray(source.analysisSections)) diagnostics.push(diagnostic(
    'PIPELINE_ANALYSIS_SECTION_CONTRACT_INVALID', 'analysisSections must be an array when supplied.'));
  const resolved = sourceResolution(source, diagnostics);
  const rawSections = normalizeSections(resolved.seeds, elementCount, rows, source.bendResolution, resolved.global, diagnostics);
  const sections = sectionContracts(rawSections);
  const elementResolutions = elementContracts(rawSections, elementCount, rows);
  const coverage = coverageDiagnostic(elementResolutions, elementCount);
  if (coverage) diagnostics.push(coverage);
  const frozenDiagnostics = orderedDiagnostics(diagnostics);
  const blockerCodes = orderedCodes(frozenDiagnostics);
  const analysisSectionPlan = createPipelineAnalysisSectionPlan({
    sections, elementResolutions, diagnostics: frozenDiagnostics, blockerCodes,
  });
  return deepFreeze({ schema: PIPELINE_ANALYSIS_SECTION_RESOLUTION_SCHEMA,
    migration: finalMigration(resolved.migrationFields, analysisSectionPlan),
    analysisSectionPlan, diagnostics: analysisSectionPlan.diagnostics,
    blockerCodes: analysisSectionPlan.blockerCodes, ready: analysisSectionPlan.ready });
}
export function buildPipelineAnalysisSectionResolutionJson(resolution) {
  return JSON.stringify(resolution, null, 2);
}
const cell = (value) => value == null ? '' : String(value).replace(/[\t\r\n]/g, ' ');
export function buildPipelineAnalysisSectionLedgerText(resolution) {
  const candidate = resolution?.analysisSectionPlan; const plan = candidate?.schema === PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA ? candidate : {};
  const header = ['RecordType', 'Schema', 'ElementIndex', 'ElementId', 'AnalysisSectionId',
    'StartElementIndex', 'ProfileId', 'ResolvedMode', 'Disposition', 'BoundaryNode'];
  const sections = (plan.sections || []).map((section) => ['SECTION', PIPELINE_ANALYSIS_SECTION_SCHEMA,
    '', '', section.analysisSectionId, section.startElementIndex, section.profileId, '', 'SECTION_START',
    (plan.elementResolutions || []).find((item) => item.analysisSectionId === section.analysisSectionId
      && item.sectionDisposition === 'SECTION_START')?.boundaryNode]);
  const elements = (plan.elementResolutions || []).map((item) => ['ELEMENT', PIPELINE_ELEMENT_SECTION_RESOLUTION_SCHEMA, item.elementIndex,
    item.elementId, item.analysisSectionId, '', item.profileId, item.resolvedMode, item.sectionDisposition, item.boundaryNode]);
  return [header, ...sections, ...elements].map((row) => row.map(cell).join('\t')).join('\n');
}
