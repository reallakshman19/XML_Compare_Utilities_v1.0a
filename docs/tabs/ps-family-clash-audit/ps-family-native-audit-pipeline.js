import { buildSupportSteelRelationshipBundle } from '../support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js';
import { parseSupportSteelJson } from '../support-steel-relationship-builder/support-steel-source-utils.js';
import { buildPsFamilyEvidenceAudit } from './ps-family-evidence-graph-audit.js';

export const PS_FAMILY_NATIVE_AUDIT_PIPELINE_SCHEMA = 'PsFamilyNativeAuditPipeline.v1';
export const PS_FAMILY_NATIVE_AUDIT_MODE = 'STAGED_JSON_PIPELINE';

export function buildPsFamilyNativeAuditPipeline(input = {}) {
  const supportInput = parseNativeSource(
    input.supportInput ?? input.supportInputText,
    'Staged support source',
  );
  const steelInput = parseNativeSource(
    input.steelInput ?? input.steelInputText,
    'Staged steel source',
  );
  const relationshipBundle = buildSupportSteelRelationshipBundle({
    supportInput,
    steelInput,
    config: input.relationshipConfig || input.config?.relationship || {},
  });
  const audit = buildPsFamilyEvidenceAudit({
    relationshipBundle,
    expectedRows: input.expectedRows || [],
    elementDetailRows: input.elementDetailRows || [],
    posFamilies: input.posFamilies || [],
    config: input.auditConfig || input.config?.audit || {},
    diagnostics: input.diagnostics || [],
  });
  const diagnostics = createPipelineDiagnostics(relationshipBundle, audit);
  return {
    schema: PS_FAMILY_NATIVE_AUDIT_PIPELINE_SCHEMA,
    productionMode: PS_FAMILY_NATIVE_AUDIT_MODE,
    xmlRequired: false,
    xmlConsumed: false,
    inputSchemas: {
      support: sourceSchema(supportInput),
      steel: sourceSchema(steelInput),
    },
    outputSchemas: {
      relationshipBundle: relationshipBundle.schema,
      memberChain: relationshipBundle.memberChainEngineSchema || null,
      carrierResolution: relationshipBundle.carrierResolutionSchema || null,
      carrierCatalog: relationshipBundle.carrierCatalogSchema || null,
      carrierGeometry: relationshipBundle.carrierGeometrySchema || null,
      carrierAttachment: relationshipBundle.carrierAttachmentSchema || null,
      carrierTopologyCatalog: relationshipBundle.carrierTopologyCatalogSchema || null,
      carrierTopology: relationshipBundle.carrierTopologySchema || null,
      carrierToStructurePath: relationshipBundle.carrierToStructurePathSchema || null,
      carrierLocalFrame: relationshipBundle.carrierLocalFrameSchema || null,
      restraintFunction: relationshipBundle.restraintFunctionSchema || null,
      audit: audit.schema,
    },
    config: {
      relationship: relationshipBundle.config,
      carrierAttachment: relationshipBundle.supportCarrierAttachment?.config || {},
      carrierTopology: relationshipBundle.supportCarrierTopology?.config || {},
      restraintFunction: relationshipBundle.supportRestraintFunction?.config || {},
      audit: { sourceFamily: audit.summary.sourceFamily || '' },
    },
    summary: createPipelineSummary(relationshipBundle, audit, diagnostics),
    relationshipBundle,
    audit,
    diagnostics,
  };
}

export function createPsFamilyNativePipelineReadiness(input = {}) {
  const diagnostics = [];
  let supportInput = null;
  let steelInput = null;
  try {
    supportInput = parseNativeSource(
      input.supportInput ?? input.supportInputText,
      'Staged support source',
    );
  } catch (error) {
    diagnostics.push(diagnostic('ERROR', 'INVALID_STAGED_SUPPORT_SOURCE', error.message || String(error)));
  }
  try {
    steelInput = parseNativeSource(
      input.steelInput ?? input.steelInputText,
      'Staged steel source',
    );
  } catch (error) {
    diagnostics.push(diagnostic('ERROR', 'INVALID_STAGED_STEEL_SOURCE', error.message || String(error)));
  }
  if (supportInput && sourceRecordCount(supportInput) === 0) {
    diagnostics.push(diagnostic('ERROR', 'EMPTY_STAGED_SUPPORT_SOURCE', 'The staged support source contains no records.'));
  }
  if (steelInput && sourceRecordCount(steelInput) === 0) {
    diagnostics.push(diagnostic('ERROR', 'EMPTY_STAGED_STEEL_SOURCE', 'The staged steel source contains no records.'));
  }
  return Object.freeze({
    schema: 'PsFamilyNativeAuditPipelineReadiness.v1',
    productionMode: PS_FAMILY_NATIVE_AUDIT_MODE,
    xmlRequired: false,
    blocking: diagnostics.some((row) => row.level === 'ERROR'),
    summary: {
      supportRecordCount: supportInput ? sourceRecordCount(supportInput) : 0,
      steelRecordCount: steelInput ? sourceRecordCount(steelInput) : 0,
      errorCount: diagnostics.filter((row) => row.level === 'ERROR').length,
      warningCount: diagnostics.filter((row) => row.level === 'WARN').length,
    },
    diagnostics,
  });
}

function parseNativeSource(value, label) {
  if (value === undefined || value === null || String(value).trim?.() === '') {
    throw new Error(`${label} is empty.`);
  }
  return parseSupportSteelJson(value, label);
}

function createPipelineDiagnostics(bundle, audit) {
  const diagnostics = [];
  if (!bundle.supportFamilies?.length) {
    diagnostics.push(diagnostic('ERROR', 'NO_SUPPORT_FAMILIES_RECONSTRUCTED', 'No support families were reconstructed from the staged support source.'));
  }
  if (!bundle.steelGroups?.length) {
    diagnostics.push(diagnostic('ERROR', 'NO_STEEL_GROUPS_RECONSTRUCTED', 'No structural steel groups were reconstructed from the staged steel source.'));
  }
  if (bundle.unresolvedSupportFamilies?.length) {
    diagnostics.push(diagnostic(
      'WARN',
      'UNRESOLVED_SUPPORT_FAMILIES_REMAIN',
      `${bundle.unresolvedSupportFamilies.length} support family or families remain unresolved.`,
    ));
  }
  if (bundle.summary?.branchContextOnlyCount > 0) {
    diagnostics.push(diagnostic(
      'INFO',
      'BRANCH_CONTEXT_ONLY_CARRIER_RELATIONSHIPS',
      `${bundle.summary.branchContextOnlyCount} support member(s) have branch context without a physical carrier object.`,
    ));
  }
  if (bundle.summary?.ambiguousCarrierCount > 0 || bundle.summary?.unresolvedCarrierCount > 0) {
    diagnostics.push(diagnostic(
      'WARN',
      'CARRIER_OBJECT_RESOLUTION_EXCEPTIONS_REMAIN',
      'Some support members do not have a unique authoritative carrier object.',
    ));
  }
  if (bundle.summary?.unresolvedCarrierAttachmentCount > 0) {
    diagnostics.push(diagnostic(
      'INFO',
      'CARRIER_ATTACHMENT_GEOMETRY_INCOMPLETE',
      `${bundle.summary.unresolvedCarrierAttachmentCount} resolved carrier identity edge(s) lack analytical attachment evidence.`,
    ));
  }
  if (bundle.summary?.nearbyCarrierAttachmentCandidateCount > 0) {
    diagnostics.push(diagnostic(
      'INFO',
      'NEARBY_CARRIER_ATTACHMENT_CLEARANCES',
      `${bundle.summary.nearbyCarrierAttachmentCandidateCount} support-to-carrier pair(s) are near but outside contact tolerance.`,
    ));
  }
  if (bundle.summary?.carrierTopologyExceptionCount > 0) {
    diagnostics.push(diagnostic(
      'WARN',
      'CARRIER_TOPOLOGY_EXCEPTIONS_REMAIN',
      `${bundle.summary.carrierTopologyExceptionCount} carrier topology exception(s) require review.`,
    ));
  }
  if (bundle.summary?.carrierToStructurePathExceptionCount > 0) {
    diagnostics.push(diagnostic(
      'WARN',
      'CARRIER_TO_STRUCTURE_PATH_EXCEPTIONS_REMAIN',
      `${bundle.summary.carrierToStructurePathExceptionCount} carrier-to-structure path exception(s) require review.`,
    ));
  }
  if (bundle.summary?.restraintFunctionExceptionCount > 0) {
    diagnostics.push(diagnostic(
      'WARN',
      'RESTRAINT_FUNCTION_EXCEPTIONS_REMAIN',
      `${bundle.summary.restraintFunctionExceptionCount} restraint-function exception(s) require engineering review.`,
    ));
  }
  if (audit.supportExceptionRows?.some((row) => row.severity === 'ERROR')) {
    diagnostics.push(diagnostic(
      'WARN',
      'AUDIT_ENGINEERING_EXCEPTIONS_REMAIN',
      'The graph-native audit contains engineering exceptions that require review.',
    ));
  }
  return diagnostics;
}

function createPipelineSummary(bundle, audit, diagnostics) {
  return {
    status: diagnostics.some((row) => row.level === 'ERROR')
      ? 'BLOCKED'
      : audit.supportExceptionRows?.some((row) => row.severity === 'ERROR')
        ? 'READY_WITH_ENGINEERING_EXCEPTIONS'
        : 'READY',
    supportFamilyCount: bundle.summary?.supportFamilyCount || 0,
    steelGroupCount: bundle.summary?.steelGroupCount || 0,
    resolvedFamilyCount: bundle.summary?.resolvedFamilyCount || 0,
    ambiguousFamilyCount: bundle.summary?.ambiguousFamilyCount || 0,
    unresolvedFamilyCount: bundle.summary?.unresolvedFamilyCount || 0,
    carrierObjectCount: bundle.summary?.carrierObjectCount || 0,
    analyticalCarrierGeometryCount: bundle.summary?.analyticalCarrierGeometryCount || 0,
    resolvedPhysicalCarrierCount: bundle.summary?.resolvedPhysicalCarrierCount || 0,
    branchContextOnlyCount: bundle.summary?.branchContextOnlyCount || 0,
    ambiguousCarrierCount: bundle.summary?.ambiguousCarrierCount || 0,
    unresolvedCarrierCount: bundle.summary?.unresolvedCarrierCount || 0,
    carrierAttachmentCandidateCount: bundle.summary?.carrierAttachmentCandidateCount || 0,
    nearbyCarrierAttachmentCandidateCount: bundle.summary?.nearbyCarrierAttachmentCandidateCount || 0,
    unresolvedCarrierAttachmentCount: bundle.summary?.unresolvedCarrierAttachmentCount || 0,
    carrierTopologyComponentCount: bundle.summary?.carrierTopologyComponentCount || 0,
    carrierTopologyConnectionCount: bundle.summary?.carrierTopologyConnectionCount || 0,
    carrierTopologyPathCount: bundle.summary?.carrierTopologyPathCount || 0,
    carrierTopologyRepairCount: bundle.summary?.carrierTopologyRepairCount || 0,
    carrierTopologyExceptionCount: bundle.summary?.carrierTopologyExceptionCount || 0,
    completeCarrierToStructurePathCount: bundle.summary?.completeCarrierToStructurePathCount || 0,
    completeCarrierToStructureFamilyCount: bundle.summary?.completeCarrierToStructureFamilyCount || 0,
    incompleteCarrierToStructureFamilyCount: bundle.summary?.incompleteCarrierToStructureFamilyCount || 0,
    carrierToStructurePathExceptionCount: bundle.summary?.carrierToStructurePathExceptionCount || 0,
    restraintFunctionAssessmentCount: bundle.summary?.restraintFunctionAssessmentCount || 0,
    restraintFunctionConfirmedFamilyCount: bundle.summary?.restraintFunctionConfirmedFamilyCount || 0,
    restraintFunctionPartiallyConfirmedFamilyCount: bundle.summary?.restraintFunctionPartiallyConfirmedFamilyCount || 0,
    restraintFunctionConflictFamilyCount: bundle.summary?.restraintFunctionConflictFamilyCount || 0,
    restraintFunctionAmbiguousFamilyCount: bundle.summary?.restraintFunctionAmbiguousFamilyCount || 0,
    restraintFunctionNotProvenFamilyCount: bundle.summary?.restraintFunctionNotProvenFamilyCount || 0,
    restraintFunctionExceptionCount: bundle.summary?.restraintFunctionExceptionCount || 0,
    supportChainEdgeCount: bundle.supportMemberChain?.summary?.supportChainEdgeCount || 0,
    structuralTerminalCount: audit.summary?.structuralTerminalCount || 0,
    auditSupportGroupCount: audit.summary?.supportGroupCount || 0,
    auditExceptionCount: audit.summary?.supportExceptionCount || 0,
  };
}

function sourceSchema(value) {
  if (value?.schema) return value.schema;
  return Array.isArray(value) ? 'StagedJsonArray' : 'StagedJsonObject';
}

function sourceRecordCount(value) {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.objects)) return value.objects.length;
  return value && typeof value === 'object' ? 1 : 0;
}

function diagnostic(level, code, message) {
  return { level, code, message };
}
