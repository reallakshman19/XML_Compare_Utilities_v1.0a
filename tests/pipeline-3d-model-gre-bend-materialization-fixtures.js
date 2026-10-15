import { resolvePipelineGreBendGeometryPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-bend-geometry-plan.js';

const baseRows = Object.freeze([
  Object.freeze({ nodeNumber: 100, x: 0, y: 0, z: 0 }),
  Object.freeze({ nodeNumber: 110, x: 1000, y: 0, z: 0 }),
  Object.freeze({ nodeNumber: 120, x: 1000, y: 1000, z: 0 }),
  Object.freeze({ nodeNumber: 130, x: 2000, y: 1000, z: 0 }),
]);
const candidate = (rows, id, incoming, radius = 300, tangent = 300) => ({
  id, incomingElementIndex: incoming, outgoingElementIndex: incoming + 1,
  previousNode: rows[incoming].nodeNumber, cornerNode: rows[incoming + 1].nodeNumber,
  nextNode: rows[incoming + 2].nodeNumber, turnAngleDeg: 90, radiusMm: radius,
  tangentMm: tangent, incomingLengthMm: 1000, outgoingLengthMm: 1000,
});
const owner = (candidateId) => ({ candidateId, analysisSectionId: 'AS1', profileId: 'gre',
  status: 'ROUTED', diagnostics: [], blockerCodes: [], ready: true });
const vendorPlan = (breakLengthMm) => ({ schema: 'PipelineGreVendorSeriesPlan.v1', ready: true,
  blockerCodes: [], sectionResolutions: [{ analysisSectionId: 'AS1', profileId: 'gre', ready: true,
    status: 'RESOLVED', vendorId: 'VENDOR-A', seriesId: 'SERIES-A', qualificationEvidenceId: 'QUAL-A',
    requirementReference: 'REQ-A', bendRadiusMm: 300, bendBreakLengthBasis: 'EXPLICIT_LENGTH',
    bendBreakLengthMm: breakLengthMm, bendLocalThicknessMm: 12,
    sourceAuthority: 'PROJECT_GRE_SPEC', sourceReference: 'GRE-SPEC-A' }] });
const application = (value) => [{ analysisSectionId: 'AS1', vendorId: 'VENDOR-A', seriesId: 'SERIES-A',
  qualificationEvidenceId: 'QUAL-A', bendBreakLengthApplication: value,
  sourceAuthority: 'PROJECT_GRE_SPEC', sourceReference: `GRE-APP:${value}` }];

export function createPipelineGreMaterializationFixture({ twoBends = false,
  breakLengthMm = twoBends ? 500 : 400, applicationValue = 'EACH_LEG_FROM_CORNER', reverse = false } = {}) {
  const rows = baseRows.map((row) => ({ ...row }));
  const candidates = [candidate(rows, 'bend:110', 0)];
  if (twoBends) candidates.push(candidate(rows, 'bend:120', 1));
  if (reverse) candidates.reverse();
  const bendResolution = { schema: 'PipelineBendResolution.v3', candidates,
    geometryRows: rows.map((row) => ({ ...row })) };
  const candidateOwnership = candidates.map((item) => owner(item.id));
  const sectionProfileRoutingPlan = { schema: 'PipelineSectionProfileRoutingPlan.v1', ready: true,
    diagnostics: [], blockerCodes: [], analysisSections: [{ analysisSectionId: 'AS1', startElementIndex: 0,
      profileId: 'gre', status: 'ROUTED', diagnostics: [], blockerCodes: [], ready: true }],
    candidateOwnership };
  const greBendGeometryPlan = resolvePipelineGreBendGeometryPlan({ bendResolution,
    sectionProfileRoutingPlan, greVendorSeriesPlan: vendorPlan(breakLengthMm),
    bendBreakApplications: application(applicationValue) });
  const originalNodeNumbers = rows.map((row) => row.nodeNumber).sort((a, b) => a - b);
  const nodeAllocationPolicy = { schema: 'PipelineGreBendNodeAllocationPolicy.v1',
    policyId: 'GRE-INSERTED-NODE-TEST-V1', nodeStep: 10, allocationStart: 1000,
    reservedNodeNumbers: [900, 910], originalNodeNumbers,
    allocationOrder: ['GRE_INCOMING_BREAK', 'GRE_INCOMING_TANGENCY',
      'GRE_OUTGOING_TANGENCY', 'GRE_OUTGOING_BREAK'],
    sourceAuthority: 'PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY', sourceReference: 'TEST:GRE-NODE-POLICY' };
  return { rows, bendResolution, sectionProfileRoutingPlan, greBendGeometryPlan, nodeAllocationPolicy,
    input: { greBendGeometryPlan, bendResolution, sectionProfileRoutingPlan, nodeAllocationPolicy } };
}
