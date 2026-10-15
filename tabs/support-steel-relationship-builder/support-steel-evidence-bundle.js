import { buildSupportCarrierAttachmentBundle } from './support-carrier-attachment-engine.js';
import { buildSupportCarrierResolutionBundle } from './support-carrier-resolution.js';
import { buildSupportCarrierToStructurePathBundle } from './support-carrier-to-structure-path.js';
import { collectSupportCarrierTopologyCatalog } from './support-carrier-topology-catalog.js';
import { buildSupportCarrierTopologyBundle } from './support-carrier-topology-engine.js';
import { buildSupportSteelRelationshipBundle as buildCoreRelationshipBundle } from './support-steel-relationship-engine.js';

export function buildSupportSteelRelationshipBundle(input = {}) {
  const combinedInput = input.combinedInput ?? input.stagedInput ?? null;
  const supportInput = input.supportInput ?? combinedInput;
  const steelInput = input.steelInput ?? combinedInput;
  const normalizedInput = { ...input, supportInput, steelInput };
  const coreBundle = buildCoreRelationshipBundle(normalizedInput);
  const carrierResolution = buildSupportCarrierResolutionBundle({
    supportInput,
    supportFamilies: coreBundle.supportFamilies,
  });
  const carrierAttachment = buildSupportCarrierAttachmentBundle({
    supportFamilies: carrierResolution.supportFamilies,
    carrierObjects: carrierResolution.carrierObjects,
    supportCarrierEdges: carrierResolution.supportCarrierEdges,
    config: input.config || {},
  });
  const carrierTopologyCatalog = collectSupportCarrierTopologyCatalog(supportInput);
  const carrierTopology = buildSupportCarrierTopologyBundle({
    catalog: carrierTopologyCatalog,
    config: input.config || {},
  });
  const carrierToStructurePath = buildSupportCarrierToStructurePathBundle({
    supportFamilies: carrierResolution.supportFamilies,
    carrierResolution,
    carrierAttachment,
    carrierTopology,
    supportMemberChain: coreBundle.supportMemberChain,
  });
  return {
    ...coreBundle,
    inputMode: combinedInput ? 'COMBINED_STAGED_MODEL' : 'LEGACY_SEPARATE_SOURCES',
    carrierResolutionSchema: carrierResolution.schema,
    carrierCatalogSchema: carrierResolution.catalogSchema,
    carrierAttachmentSchema: carrierAttachment.schema,
    carrierGeometrySchema: 'SupportCarrierAnalyticalGeometry.v1',
    carrierTopologyCatalogSchema: carrierTopologyCatalog.schema,
    carrierTopologySchema: carrierTopology.schema,
    carrierToStructurePathSchema: carrierToStructurePath.schema,
    bundlePurpose: 'RELATIONSHIP_MEMBER_CONNECTIVITY_CARRIER_CONTEXT_ATTACHMENT_TOPOLOGY_AND_STRUCTURE_PATH_AUDIT',
    authoritativeCarrierObjectResolutionAvailable: carrierResolution.summary.carrierObjectCount > 0,
    analyticalCarrierAttachmentEvidenceAvailable: carrierAttachment.summary.analyticalCarrierContactCandidateCount > 0,
    carrierTopologyEvidenceAvailable: carrierTopology.summary.connectionCount > 0,
    completeCarrierToStructurePathAvailable: carrierToStructurePath.summary.completePathCount > 0,
    supportFamilies: carrierResolution.supportFamilies,
    supportCarrierResolution: {
      ...carrierResolution,
      supportFamilies: undefined,
    },
    supportCarrierAttachment: carrierAttachment,
    supportCarrierTopology: carrierTopology,
    supportCarrierToStructurePath: carrierToStructurePath,
    summary: {
      ...coreBundle.summary,
      carrierObjectCount: carrierResolution.summary.carrierObjectCount,
      analyticalCarrierGeometryCount: carrierAttachment.summary.analyticalCarrierGeometryCount,
      resolvedPhysicalCarrierCount: carrierResolution.summary.resolvedPhysicalCarrierCount,
      branchContextOnlyCount: carrierResolution.summary.branchContextOnlyCount,
      ambiguousCarrierCount: carrierResolution.summary.ambiguousCarrierCount,
      unresolvedCarrierCount: carrierResolution.summary.unresolvedCarrierCount,
      carrierAttachmentCandidateCount: carrierAttachment.summary.analyticalCarrierContactCandidateCount,
      nearbyCarrierAttachmentCandidateCount: carrierAttachment.summary.nearbyCarrierAttachmentCandidateCount,
      unresolvedCarrierAttachmentCount: carrierAttachment.summary.unresolvedCarrierAttachmentCount,
      carrierTopologyComponentCount: carrierTopology.summary.componentCount,
      carrierTopologyConnectionCount: carrierTopology.summary.connectionCount,
      carrierTopologyPathCount: carrierTopology.summary.pathCount,
      carrierTopologyRepairCount: carrierTopology.summary.smallGapRepairCount,
      carrierTopologyExceptionCount: carrierTopology.summary.reviewExceptionCount,
      completeCarrierToStructurePathCount: carrierToStructurePath.summary.completePathCount,
      completeCarrierToStructureFamilyCount: carrierToStructurePath.summary.completeFamilyCount,
      incompleteCarrierToStructureFamilyCount: carrierToStructurePath.summary.incompleteFamilyCount,
      carrierToStructurePathExceptionCount: carrierToStructurePath.summary.exceptionCount,
    },
    diagnostics: [
      ...(coreBundle.diagnostics || []),
      ...(carrierResolution.diagnostics || []),
      ...(carrierAttachment.diagnostics || []),
      ...topologyDiagnostics(carrierTopology.topologyExceptions),
      ...(carrierToStructurePath.diagnostics || []),
    ],
  };
}

function topologyDiagnostics(rows = []) {
  return rows.map((row) => ({
    severity: row.severity || 'WARN',
    code: row.exceptionCode,
    componentId: row.componentId,
    message: row.message || 'Carrier topology continuity requires engineering review.',
  }));
}
