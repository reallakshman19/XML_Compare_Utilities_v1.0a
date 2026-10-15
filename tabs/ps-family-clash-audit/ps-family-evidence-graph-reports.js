import { evidenceDiagnostic } from './ps-family-evidence-graph-shared.js';
import { projectEvidenceFamily } from './ps-family-evidence-graph-family.js';

export function createEvidenceGraphReports(bundle, families, chain, diagnostics) {
  const output = emptyReports();
  families.forEach((family, index) => appendProjection(
    output,
    projectEvidenceFamily(bundle, family, index, chain),
  ));
  if (!families.length) {
    diagnostics.push(evidenceDiagnostic(
      'ERROR',
      'NO_SUPPORT_FAMILIES_SELECTED',
      'No support families matched the selected source-family filter.',
    ));
  }
  return output;
}

function emptyReports() {
  return {
    supportSummaryRows: [],
    lineMembershipRows: [],
    lineSupportTreeRows: [],
    structureContactRows: [],
    supportChainRows: [],
    supportMemberRows: [],
    supportExceptionRows: [],
    inputEvidenceRows: [],
    connectivityMatrixRows: [],
    structureLineProximityRows: [],
    lineFamilyRows: [],
    relationshipCount: 0,
    symbolicReferenceCount: 0,
    crossLineSupportEdgeCount: 0,
    multiLineFamilyCount: 0,
  };
}

function appendProjection(output, projection) {
  output.supportSummaryRows.push(projection.supportSummaryRow);
  output.lineMembershipRows.push(...(projection.lineMembershipRows || []));
  output.lineSupportTreeRows.push(...(projection.lineSupportTreeRows || []));
  output.structureContactRows.push(...projection.structureContactRows);
  output.supportChainRows.push(...projection.supportChainRows);
  output.supportMemberRows.push(...projection.supportMemberRows);
  output.supportExceptionRows.push(...projection.supportExceptionRows);
  output.inputEvidenceRows.push(...projection.inputEvidenceRows);
  output.connectivityMatrixRows.push(...projection.connectivityMatrixRows);
  output.structureLineProximityRows.push(...projection.structureLineProximityRows);
  output.lineFamilyRows.push(...(projection.lineFamilyRows || []));
  output.relationshipCount += projection.relationshipCount;
  output.symbolicReferenceCount += projection.symbolicReferenceCount;
  output.crossLineSupportEdgeCount += projection.crossLineSupportEdgeCount || 0;
  output.multiLineFamilyCount += projection.lineMembershipRows?.length > 1 ? 1 : 0;
}
