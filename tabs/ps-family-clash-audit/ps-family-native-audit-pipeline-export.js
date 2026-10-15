import {
  exportCarrierAttachmentCsv,
  exportCarrierAttachmentEdgesCsv,
  exportCarrierCatalogCsv,
  exportCarrierResolutionCsv,
  exportSupportCarrierEdgesCsv,
} from './ps-family-carrier-evidence-export.js';
import {
  exportCarrierToStructureCompletePathsCsv,
  exportCarrierToStructureFamiliesCsv,
  exportCarrierToStructurePathExceptionsCsv,
} from './ps-family-carrier-to-structure-path-export.js';
import {
  exportCarrierTopologyComponentsCsv,
  exportCarrierTopologyConnectionsCsv,
  exportCarrierTopologyExceptionsCsv,
  exportCarrierTopologyPathsCsv,
  exportCarrierTopologyPortsCsv,
} from './ps-family-carrier-topology-export.js';
import { createPsFamilyAuditExports } from './ps-family-clash-audit-export.js';
import {
  exportCarrierFramesCsv,
  exportRestraintDirectionEdgesCsv,
  exportRestraintFunctionAssessmentsCsv,
  exportRestraintFunctionExceptionsCsv,
  exportRestraintFunctionFamiliesCsv,
} from './ps-family-restraint-function-export.js';

export function exportPsFamilyNativePipelineJson(pipeline) {
  return `${JSON.stringify(pipeline, null, 2)}\n`;
}

export function exportPsFamilyNativeRelationshipBundleJson(pipeline) {
  return `${JSON.stringify(pipeline?.relationshipBundle || {}, null, 2)}\n`;
}

export function exportPsFamilyNativeAuditJson(pipeline) {
  return `${JSON.stringify(pipeline?.audit || {}, null, 2)}\n`;
}

export function exportPsFamilyNativePipelineSummaryCsv(pipeline) {
  const summary = pipeline?.summary || {};
  const headers = [
    'Status', 'SupportFamilyCount', 'SteelGroupCount', 'ResolvedFamilyCount',
    'AmbiguousFamilyCount', 'UnresolvedFamilyCount', 'CarrierObjectCount',
    'ResolvedPhysicalCarrierCount', 'AnalyticalCarrierGeometryCount',
    'BranchContextOnlyCount', 'AmbiguousCarrierCount', 'UnresolvedCarrierCount',
    'CarrierAttachmentCandidateCount', 'NearbyCarrierAttachmentCandidateCount',
    'UnresolvedCarrierAttachmentCount', 'CarrierTopologyComponentCount',
    'CarrierTopologyConnectionCount', 'CarrierTopologyPathCount',
    'CarrierTopologyRepairCount', 'CarrierTopologyExceptionCount',
    'CompleteCarrierToStructurePathCount', 'CompleteCarrierToStructureFamilyCount',
    'IncompleteCarrierToStructureFamilyCount', 'CarrierToStructurePathExceptionCount',
    'RestraintFunctionAssessmentCount', 'RestraintFunctionConfirmedFamilyCount',
    'RestraintFunctionPartiallyConfirmedFamilyCount', 'RestraintFunctionConflictFamilyCount',
    'RestraintFunctionAmbiguousFamilyCount', 'RestraintFunctionNotProvenFamilyCount',
    'RestraintFunctionExceptionCount', 'SupportChainEdgeCount', 'StructuralTerminalCount',
    'AuditSupportGroupCount', 'AuditExceptionCount', 'XmlRequired', 'XmlConsumed',
  ];
  const row = {
    Status: summary.status,
    SupportFamilyCount: summary.supportFamilyCount,
    SteelGroupCount: summary.steelGroupCount,
    ResolvedFamilyCount: summary.resolvedFamilyCount,
    AmbiguousFamilyCount: summary.ambiguousFamilyCount,
    UnresolvedFamilyCount: summary.unresolvedFamilyCount,
    CarrierObjectCount: summary.carrierObjectCount,
    ResolvedPhysicalCarrierCount: summary.resolvedPhysicalCarrierCount,
    AnalyticalCarrierGeometryCount: summary.analyticalCarrierGeometryCount,
    BranchContextOnlyCount: summary.branchContextOnlyCount,
    AmbiguousCarrierCount: summary.ambiguousCarrierCount,
    UnresolvedCarrierCount: summary.unresolvedCarrierCount,
    CarrierAttachmentCandidateCount: summary.carrierAttachmentCandidateCount,
    NearbyCarrierAttachmentCandidateCount: summary.nearbyCarrierAttachmentCandidateCount,
    UnresolvedCarrierAttachmentCount: summary.unresolvedCarrierAttachmentCount,
    CarrierTopologyComponentCount: summary.carrierTopologyComponentCount,
    CarrierTopologyConnectionCount: summary.carrierTopologyConnectionCount,
    CarrierTopologyPathCount: summary.carrierTopologyPathCount,
    CarrierTopologyRepairCount: summary.carrierTopologyRepairCount,
    CarrierTopologyExceptionCount: summary.carrierTopologyExceptionCount,
    CompleteCarrierToStructurePathCount: summary.completeCarrierToStructurePathCount,
    CompleteCarrierToStructureFamilyCount: summary.completeCarrierToStructureFamilyCount,
    IncompleteCarrierToStructureFamilyCount: summary.incompleteCarrierToStructureFamilyCount,
    CarrierToStructurePathExceptionCount: summary.carrierToStructurePathExceptionCount,
    RestraintFunctionAssessmentCount: summary.restraintFunctionAssessmentCount,
    RestraintFunctionConfirmedFamilyCount: summary.restraintFunctionConfirmedFamilyCount,
    RestraintFunctionPartiallyConfirmedFamilyCount: summary.restraintFunctionPartiallyConfirmedFamilyCount,
    RestraintFunctionConflictFamilyCount: summary.restraintFunctionConflictFamilyCount,
    RestraintFunctionAmbiguousFamilyCount: summary.restraintFunctionAmbiguousFamilyCount,
    RestraintFunctionNotProvenFamilyCount: summary.restraintFunctionNotProvenFamilyCount,
    RestraintFunctionExceptionCount: summary.restraintFunctionExceptionCount,
    SupportChainEdgeCount: summary.supportChainEdgeCount,
    StructuralTerminalCount: summary.structuralTerminalCount,
    AuditSupportGroupCount: summary.auditSupportGroupCount,
    AuditExceptionCount: summary.auditExceptionCount,
    XmlRequired: pipeline?.xmlRequired,
    XmlConsumed: pipeline?.xmlConsumed,
  };
  return `${headers.join(',')}\n${headers.map((key) => csvCell(row[key])).join(',')}\n`;
}

export function createPsFamilyNativePipelineExports(pipeline) {
  const auditExports = pipeline?.audit ? createPsFamilyAuditExports(pipeline.audit) : {};
  return {
    pipelineJson: exportPsFamilyNativePipelineJson(pipeline),
    relationshipBundleJson: exportPsFamilyNativeRelationshipBundleJson(pipeline),
    auditJson: exportPsFamilyNativeAuditJson(pipeline),
    summaryCsv: exportPsFamilyNativePipelineSummaryCsv(pipeline),
    supportSummaryCsv: auditExports.supportSummaryCsv || '',
    supportExceptionsCsv: auditExports.supportExceptionsCsv || '',
    inputEvidenceCsv: auditExports.inputEvidenceCsv || '',
    carrierCatalogCsv: exportCarrierCatalogCsv(pipeline?.audit),
    carrierResolutionCsv: exportCarrierResolutionCsv(pipeline?.audit),
    supportCarrierEdgesCsv: exportSupportCarrierEdgesCsv(pipeline?.audit),
    carrierAttachmentCsv: exportCarrierAttachmentCsv(pipeline?.audit),
    carrierAttachmentEdgesCsv: exportCarrierAttachmentEdgesCsv(pipeline?.audit),
    carrierTopologyComponentsCsv: exportCarrierTopologyComponentsCsv(pipeline?.audit),
    carrierTopologyPortsCsv: exportCarrierTopologyPortsCsv(pipeline?.audit),
    carrierTopologyConnectionsCsv: exportCarrierTopologyConnectionsCsv(pipeline?.audit),
    carrierTopologyPathsCsv: exportCarrierTopologyPathsCsv(pipeline?.audit),
    carrierTopologyExceptionsCsv: exportCarrierTopologyExceptionsCsv(pipeline?.audit),
    carrierToStructureCompletePathsCsv: exportCarrierToStructureCompletePathsCsv(pipeline?.audit),
    carrierToStructurePathExceptionsCsv: exportCarrierToStructurePathExceptionsCsv(pipeline?.audit),
    carrierToStructureFamiliesCsv: exportCarrierToStructureFamiliesCsv(pipeline?.audit),
    carrierFramesCsv: exportCarrierFramesCsv(pipeline?.audit),
    restraintFunctionAssessmentsCsv: exportRestraintFunctionAssessmentsCsv(pipeline?.audit),
    restraintDirectionEdgesCsv: exportRestraintDirectionEdgesCsv(pipeline?.audit),
    restraintFunctionExceptionsCsv: exportRestraintFunctionExceptionsCsv(pipeline?.audit),
    restraintFunctionFamiliesCsv: exportRestraintFunctionFamiliesCsv(pipeline?.audit),
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
