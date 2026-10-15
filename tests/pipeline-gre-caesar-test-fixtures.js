import { createPipelineGreCaesarFixtureEvidence } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-fixture-evidence.js';
import { createPipelineGreCaesarBendFieldMapping } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-field-mapping.js';
import { createPipelineGreCaesarBendTopologyMapping } from '../tabs/pipeline-3d-model/pipeline-3d-model-gre-caesar-bend-topology-mapping.js';

const HASH_A = 'a'.repeat(64), HASH_B = 'b'.repeat(64), HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64), HASH_E = 'e'.repeat(64), HASH_F = 'f'.repeat(64);
const SOURCE_SHA = '1'.repeat(40);

function topologyForCase(caseId, overrides) {
  const mode = overrides.mode || (caseId === 'F6' ? 'TANGENCY_SEPARATED_BRIDGE'
    : 'CONSECUTIVE_SHARED_LOGICAL_NODE');
  const shared = mode !== 'TANGENCY_SEPARATED_BRIDGE';
  return { mode, shared, enteringToNode: 110, leavingFromNode: shared ? 110 : 120,
    incomingTangencyNode: 110, outgoingTangencyNode: shared ? 130 : 120 };
}

function comparison(overrides = {}) {
  return { ownershipPreserved: true, connectivityPreserved: true, nodeRolesPreserved: true,
    radiusPreserved: true, fittingThicknessPreserved: true, typePreserved: true,
    numMiterPreserved: true, curvatureNodesPreserved: true, numEltPreserved: true,
    numBendPreserved: true, unitsPreserved: true, codeContextPreserved: true,
    laminatePreserved: true, identityMapSha256: HASH_F, ...overrides };
}

export function qualifiedFixture(overrides = {}) {
  const caseId = overrides.caseId || 'F1', topology = topologyForCase(caseId, overrides);
  const rejected = overrides.importResult === 'REJECTED';
  const curvatureNodes = overrides.curvatureNodes || [];
  return createPipelineGreCaesarFixtureEvidence({
    fixtureId: overrides.fixtureId || `fixture:${caseId}`, fixtureCaseId: caseId,
    fixturePath: overrides.fixturePath || `fixtures/${caseId}.xml`, fixtureSha256: overrides.fixtureSha256 || HASH_A,
    sourceCommitSha: SOURCE_SHA, sourceClassification: 'CAESAR_OPERATOR_ROUND_TRIP',
    caesarVersion: overrides.caesarVersion || '14.00', caesarBuild: overrides.caesarBuild || '14.00.00.1234',
    xmlVersion: overrides.caesarVersion || '14.00', unitFileId: 'unit:metric', unitFileSha256: HASH_B,
    nativeJobSha256: HASH_C, importedJobSha256: HASH_D, reexportSha256: rejected ? '' : HASH_E,
    operatorLogSha256: HASH_F, pipingCodeId: overrides.pipingCodeId || '36',
    pipingCodeName: overrides.pipingCodeName || 'ISO 14692',
    pipingCodeEdition: overrides.pipingCodeEdition || (caseId === 'F2' ? '2017' : '2005'),
    laminateClassification: overrides.laminateClassification || 'CSM_AND_MULTI_FILAMENT',
    elementCount: 2, bendCount: 1, bendRecords: [{ bendRecordId: `bend:${caseId}`,
      ownerElementId: `entering:${caseId}`, ownerFromNode: 100, ownerToNode: 110, radius: 300,
      typeAttributePresent: overrides.typeAttributePresent ?? true, typeValue: overrides.typeValue ?? 3,
      typeLexicalValue: overrides.typeLexicalValue ?? '3',
      numMiterAttributePresent: overrides.numMiterAttributePresent ?? false,
      numMiterValue: overrides.numMiterValue ?? null,
      numMiterLexicalValue: overrides.numMiterLexicalValue ?? '',
      fittingThicknessAttributePresent: true, fittingThicknessValue: caseId === 'F5' ? 14 : 12,
      curvatureNodes }],
    continuityRecords: [{ continuityRecordId: `continuity:${caseId}`,
      enteringElementId: `entering:${caseId}`, leavingElementId: `leaving:${caseId}`,
      bendOwnerElementId: `entering:${caseId}`, enteringFromNode: 100,
      enteringToNode: topology.enteringToNode, leavingFromNode: topology.leavingFromNode,
      leavingToNode: 130, incomingTangencyNode: topology.incomingTangencyNode,
      outgoingTangencyNode: topology.outgoingTangencyNode, inactiveCornerNode: 115,
      inactiveCornerSerialized: false, sharedLogicalNode: topology.shared,
      observedTopologyMode: topology.mode }],
    importEvidence: { status: 'PROVEN', evidenceId: `import:${caseId}`, caesarVersion: '14.00',
      caesarBuild: '14.00.00.1234', result: rejected ? 'REJECTED' : 'ACCEPTED',
      cleanImport: !rejected, warnings: [], errors: rejected ? ['TOPOLOGY_REJECTED'] : [],
      importedJobSha256: HASH_D, operatorLogSha256: HASH_F, sourceReference: `operator-log:${caseId}` },
    roundTripEvidence: rejected ? { status: 'NOT_APPLICABLE', sourceReference: `operator-log:${caseId}` }
      : { status: 'PROVEN', evidenceId: `roundtrip:${caseId}`, caesarVersion: '14.00',
        caesarBuild: '14.00.00.1234', semanticEquivalent: overrides.semanticEquivalent ?? true,
        reexportSha256: HASH_E, operatorLogSha256: HASH_F, sourceReference: `operator-log:${caseId}`,
        comparison: comparison(overrides.comparison) },
    authorityLevel: 'CAESAR_IMPORT_AND_ROUND_TRIP', sourceReferences: [`operator-log:${caseId}`],
    ...overrides.fixtureOverrides,
  });
}

export function qualifiedFieldMapping(fixture, overrides = {}) {
  const hasMiter = fixture.bendRecords[0].numMiterAttributePresent;
  const roles = fixture.bendRecords[0].curvatureNodes.map((node) => node.role);
  return createPipelineGreCaesarBendFieldMapping({ mappingId: overrides.mappingId || `mapping:${fixture.fixtureCaseId}`,
    caesarVersion: fixture.caesarVersion, caesarBuild: fixture.caesarBuild,
    unitFileId: fixture.unitFileId, unitFileSha256: fixture.unitFileSha256,
    pipingCodeId: fixture.pipingCodeId, pipingCodeName: fixture.pipingCodeName,
    pipingCodeEdition: fixture.pipingCodeEdition, laminateClassification: fixture.laminateClassification,
    bendTypeDisposition: overrides.bendTypeDisposition || 'EMIT_NUMERIC',
    bendTypeValue: overrides.bendTypeValue ?? 3, bendTypeLexicalValue: overrides.bendTypeLexicalValue ?? '3',
    bendTypeMeaning: 'AUTHENTICATED_FIXTURE_VALUE',
    numMiterDisposition: overrides.numMiterDisposition || (hasMiter ? 'PRESERVE_QUALIFIED_SENTINEL' : 'OMIT_ATTRIBUTE'),
    numMiterValue: overrides.numMiterValue ?? (hasMiter ? fixture.bendRecords[0].numMiterValue : null),
    numMiterLexicalValue: overrides.numMiterLexicalValue ?? (hasMiter
      ? fixture.bendRecords[0].numMiterLexicalValue : ''), numMiterMeaning: 'AUTHENTICATED_FIXTURE_VALUE',
    curvatureNodeDisposition: overrides.curvatureNodeDisposition || (roles.length
      ? 'EXACT_CURVATURE_ROLES_REQUIRED' : 'NO_CURVATURE_NODES_REQUIRED'),
    curvatureNodeRoles: overrides.curvatureNodeRoles || roles,
    overallTurnAngleDisposition: 'OVERALL_ANGLE_EVIDENCE_ONLY',
    fittingThicknessDisposition: 'EMIT_AUTHENTICATED_VALUE', radiusDisposition: 'EMIT_AUTHENTICATED_VALUE',
    sourceAuthority: 'CAESAR_IMPORT_AND_ROUND_TRIP', sourceReferences: [`operator-log:${fixture.fixtureCaseId}`],
    fixtureIds: [fixture.fixtureId], fixtures: [fixture] });
}

const roleProfiles = {
  TANGENCY_SEPARATED_BRIDGE: { enteringElementFromRole: 'UPSTREAM_ROUTE_NODE',
    enteringElementToRole: 'INCOMING_TANGENCY', leavingElementFromRole: 'OUTGOING_TANGENCY',
    leavingElementToRole: 'DOWNSTREAM_ROUTE_NODE', nearPointRole: 'INCOMING_TANGENCY',
    farPointRole: 'OUTGOING_TANGENCY', sharedLogicalNodeRole: 'NONE',
    inactiveCornerDisposition: 'NOT_SERIALIZED', incomingTangencyDisposition: 'ENTERING_ELEMENT_TO',
    outgoingTangencyDisposition: 'LEAVING_ELEMENT_FROM', continuityRequirement: 'BEND_BRIDGES_DISTINCT_TANGENCIES' },
  CONSECUTIVE_SHARED_LOGICAL_NODE: { enteringElementFromRole: 'UPSTREAM_ROUTE_NODE',
    enteringElementToRole: 'CAESAR_LOGICAL_BEND_NODE', leavingElementFromRole: 'CAESAR_LOGICAL_BEND_NODE',
    leavingElementToRole: 'DOWNSTREAM_ROUTE_NODE', nearPointRole: 'CAESAR_DERIVED_NEAR_POINT',
    farPointRole: 'CAESAR_LOGICAL_BEND_NODE', sharedLogicalNodeRole: 'ENTERING_TO_AND_LEAVING_FROM',
    inactiveCornerDisposition: 'NOT_SERIALIZED', incomingTangencyDisposition: 'CAESAR_DERIVED_NEAR_POINT',
    outgoingTangencyDisposition: 'CAESAR_FAR_POINT', continuityRequirement: 'ENTERING_TO_EQUALS_LEAVING_FROM' },
};

export function qualifiedTopologyMapping(fixture, overrides = {}) {
  const mode = overrides.mode || fixture.continuityRecords[0].observedTopologyMode;
  return createPipelineGreCaesarBendTopologyMapping({
    topologyMappingId: overrides.topologyMappingId || `topology:${fixture.fixtureCaseId}`,
    caesarTopologyMode: mode, ...roleProfiles[mode], ...overrides.roles,
    sourceAuthority: 'CAESAR_IMPORT_AND_ROUND_TRIP', sourceReferences: [`operator-log:${fixture.fixtureCaseId}`],
    fixtureIds: [fixture.fixtureId], fixtures: [fixture] });
}
