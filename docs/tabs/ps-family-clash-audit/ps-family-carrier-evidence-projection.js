export function createCarrierEvidenceProjection(bundle = {}) {
  const carrier = bundle.supportCarrierResolution || {};
  const attachment = bundle.supportCarrierAttachment || {};
  const topology = bundle.supportCarrierTopology || {};
  const structurePath = bundle.supportCarrierToStructurePath || {};
  const restraint = bundle.supportRestraintFunction || {};
  return {
    schemas: {
      carrierResolutionSchema: bundle.carrierResolutionSchema || carrier.schema || null,
      carrierCatalogSchema: bundle.carrierCatalogSchema || carrier.catalogSchema || null,
      carrierAttachmentSchema: bundle.carrierAttachmentSchema || attachment.schema || null,
      carrierGeometrySchema: bundle.carrierGeometrySchema || null,
      carrierTopologyCatalogSchema: bundle.carrierTopologyCatalogSchema || topology.catalogSchema || null,
      carrierTopologySchema: bundle.carrierTopologySchema || topology.schema || null,
      carrierToStructurePathSchema: bundle.carrierToStructurePathSchema || structurePath.schema || null,
      carrierLocalFrameSchema: bundle.carrierLocalFrameSchema || restraint.carrierFrameSchema || null,
      restraintFunctionSchema: bundle.restraintFunctionSchema || restraint.schema || null,
    },
    rows: {
      carrierObjectRows: carrier.carrierObjects || [],
      branchContextRows: carrier.branchContexts || [],
      carrierResolutionRows: carrier.resolutions || [],
      supportCarrierEdgeRows: carrier.supportCarrierEdges || [],
      branchContextEdgeRows: carrier.branchContextEdges || [],
      carrierAttachmentEvaluationRows: attachment.evaluations || [],
      carrierAttachmentRows: attachment.supportCarrierAttachmentEdges || [],
      nearbyCarrierAttachmentRows: attachment.nearbyCarrierAttachmentCandidates || [],
      unresolvedCarrierAttachmentRows: attachment.unresolvedCarrierAttachments || [],
      carrierTopologyComponentRows: topology.components || [],
      carrierTopologyPortRows: topology.ports || [],
      carrierTopologyConnectionRows: topology.connectionEdges || [],
      carrierTopologyPathRows: topology.topologyPaths || [],
      carrierTopologyExceptionRows: topology.topologyExceptions || [],
      carrierToStructureCompletePathRows: structurePath.completePaths || [],
      carrierToStructurePathExceptionRows: structurePath.pathExceptions || [],
      carrierToStructureFamilyRows: structurePath.familyResults || [],
      carrierFrameRows: restraint.carrierFrames || [],
      restraintIntentRows: restraint.intendedFunctions || [],
      evidencedRestraintRows: restraint.evidencedRestraints || [],
      restraintFunctionAssessmentRows: restraint.functionAssessments || [],
      restraintDirectionEdgeRows: restraint.restraintEdges || [],
      restraintFunctionExceptionRows: restraint.functionExceptions || [],
      restraintFunctionFamilyRows: restraint.familyResults || [],
    },
    summary: carrierEvidenceSummary(bundle),
  };
}

export function carrierEvidenceSummary(bundle = {}) {
  const carrier = bundle.supportCarrierResolution || {};
  const attachment = bundle.supportCarrierAttachment || {};
  const topology = bundle.supportCarrierTopology || {};
  const structurePath = bundle.supportCarrierToStructurePath || {};
  const restraint = bundle.supportRestraintFunction || {};
  return {
    carrierObjectCount: (carrier.carrierObjects || []).length,
    resolvedCarrierEdgeCount: (carrier.supportCarrierEdges || []).length,
    branchContextEdgeCount: (carrier.branchContextEdges || []).length,
    carrierAttachmentCandidateCount: (attachment.supportCarrierAttachmentEdges || []).length,
    nearbyCarrierAttachmentCount: (attachment.nearbyCarrierAttachmentCandidates || []).length,
    unresolvedCarrierAttachmentCount: (attachment.unresolvedCarrierAttachments || []).length,
    analyticalCarrierGeometryCount: attachment.summary?.analyticalCarrierGeometryCount || 0,
    ambiguousCarrierCount: carrier.summary?.ambiguousCarrierCount || 0,
    unresolvedCarrierCount: carrier.summary?.unresolvedCarrierCount || 0,
    carrierTopologyComponentCount: (topology.components || []).length,
    carrierTopologyConnectionCount: (topology.connectionEdges || []).length,
    carrierTopologyPathCount: (topology.topologyPaths || []).length,
    carrierTopologyExceptionCount: (topology.topologyExceptions || []).length,
    carrierTopologyRepairCount: topology.summary?.smallGapRepairCount || 0,
    carrierTopologyAmbiguousCount: topology.summary?.ambiguousConnectionCount || 0,
    carrierTopologyDisconnectedCount: topology.summary?.disconnectedComponentCount || 0,
    completeCarrierToStructurePathCount: (structurePath.completePaths || []).length,
    completeCarrierToStructureFamilyCount: structurePath.summary?.completeFamilyCount || 0,
    incompleteCarrierToStructureFamilyCount: structurePath.summary?.incompleteFamilyCount || 0,
    carrierToStructurePathExceptionCount: (structurePath.pathExceptions || []).length,
    carrierAttachmentPathExceptionCount: structurePath.summary?.attachmentNotProvenCount || 0,
    carrierTopologyPathExceptionCount: structurePath.summary?.topologyPathExceptionCount || 0,
    supportChainPathExceptionCount: structurePath.summary?.supportChainIncompleteCount || 0,
    structuralTerminalPathExceptionCount: structurePath.summary?.structuralTerminalMissingCount || 0,
    carrierFrameCount: (restraint.carrierFrames || []).length,
    restraintFunctionAssessmentCount: (restraint.functionAssessments || []).length,
    restraintDirectionEdgeCount: (restraint.restraintEdges || []).length,
    restraintFunctionExceptionCount: (restraint.functionExceptions || []).length,
    restraintFunctionConfirmedFamilyCount: restraint.summary?.confirmedFamilyCount || 0,
    restraintFunctionPartiallyConfirmedFamilyCount: restraint.summary?.partiallyConfirmedFamilyCount || 0,
    restraintFunctionConflictFamilyCount: restraint.summary?.conflictFamilyCount || 0,
    restraintFunctionAmbiguousFamilyCount: restraint.summary?.ambiguousFamilyCount || 0,
    restraintFunctionNotProvenFamilyCount: restraint.summary?.notProvenFamilyCount || 0,
  };
}
