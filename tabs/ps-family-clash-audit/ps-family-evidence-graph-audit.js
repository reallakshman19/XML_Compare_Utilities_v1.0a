import { PS_FAMILY_CLASH_AUDIT_SCHEMA } from './ps-family-clash-audit-contract.js';
import {
  carrierEvidenceSummary,
  createCarrierEvidenceProjection,
} from './ps-family-carrier-evidence-projection.js';
import {
  PS_FAMILY_EVIDENCE_MODE,
  PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
  detectedEvidenceSourceFamily,
  evidenceBundleDiagnostics,
  evidenceDiagnostic,
  filterEvidenceFamilies,
  normalizeEvidenceDiagnostics,
  resolveEvidenceConfig,
} from './ps-family-evidence-graph-shared.js';
import {
  createEvidenceCoverageReports,
  createEvidenceSourceVsPosRows,
} from './ps-family-evidence-graph-coverage.js';
import { createEvidenceGraphReports } from './ps-family-evidence-graph-reports.js';

export const PS_FAMILY_EVIDENCE_AUDIT_SCHEMA = 'ps-family-evidence-audit/v1';
export { PS_FAMILY_EVIDENCE_MODE, PS_FAMILY_EVIDENCE_SOURCE_SCHEMA };

export function parsePsFamilyEvidenceBundle(value, label = 'Relationship bundle') {
  if (value && typeof value === 'object') return validateBundle(value, label);
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is empty.`);
  try {
    return validateBundle(JSON.parse(text), label);
  } catch (error) {
    if (error?.code === 'PSFA_INVALID_BUNDLE') throw error;
    throw new Error(`${label} is not valid JSON: ${error.message || error}`);
  }
}

export function createPsFamilyEvidenceReadiness(input = {}) {
  const diagnostics = [];
  let bundle = null;
  try {
    bundle = parsePsFamilyEvidenceBundle(
      input.relationshipBundle ?? input.relationshipBundleText,
    );
  } catch (error) {
    diagnostics.push(evidenceDiagnostic(
      'ERROR',
      'INVALID_RELATIONSHIP_BUNDLE',
      error.message || String(error),
    ));
  }
  if (bundle) diagnostics.push(...evidenceBundleDiagnostics(bundle));
  const expectedRows = input.expectedRows || [];
  const detailRows = input.elementDetailRows || [];
  const summary = bundle
    ? readinessSummary(bundle, expectedRows, detailRows, diagnostics, input.config)
    : emptyReadinessSummary(diagnostics);
  return Object.freeze({
    summary,
    diagnostics,
    blocking: diagnostics.some((item) => item.level === 'ERROR'),
  });
}

export function buildPsFamilyEvidenceAudit(input = {}) {
  const bundle = parsePsFamilyEvidenceBundle(
    input.relationshipBundle ?? input.relationshipBundleText,
  );
  const config = resolveEvidenceConfig(input.config);
  const diagnostics = [
    ...evidenceBundleDiagnostics(bundle),
    ...normalizeEvidenceDiagnostics(input.diagnostics),
    ...normalizeEvidenceDiagnostics(bundle.diagnostics),
  ];
  const expectedRows = input.expectedRows || [];
  const detailRows = input.elementDetailRows || [];
  const posFamilies = input.posFamilies || [];
  const families = filterEvidenceFamilies(
    bundle.supportFamilies || [],
    config.sourceFamily,
  );
  const reports = createEvidenceGraphReports(
    bundle,
    families,
    bundle.supportMemberChain || {},
    diagnostics,
  );
  const coverage = createEvidenceCoverageReports(
    families,
    expectedRows,
    detailRows,
    config,
  );
  const summary = buildSummary(
    bundle,
    families,
    expectedRows,
    posFamilies,
    reports,
    coverage,
    config,
  );
  const carrierEvidence = createCarrierEvidenceProjection(bundle);
  return {
    schema: PS_FAMILY_EVIDENCE_AUDIT_SCHEMA,
    legacyReportContractSchema: PS_FAMILY_CLASH_AUDIT_SCHEMA,
    evidenceMode: PS_FAMILY_EVIDENCE_MODE,
    sourceSchema: bundle.schema,
    ...carrierEvidence.schemas,
    summary,
    coverageRows: coverage.coverageRows,
    clashRows: [],
    graphEvidenceRows: reports.inputEvidenceRows,
    psClashRows: [],
    psClashReportRows: reports.supportMemberRows,
    missingRows: coverage.missingRows,
    outOfFamilyRows: [],
    duplicateRows: coverage.duplicateRows,
    unexpectedInFamilyRows: coverage.unexpectedInFamilyRows,
    lineFamilyRows: reports.lineFamilyRows,
    posFamilyRows: posFamilies,
    sourceVsPosFamilyRows: createEvidenceSourceVsPosRows(
      families,
      coverage.coverageRows,
      posFamilies,
    ),
    ...carrierEvidence.rows,
    diagnostics,
    ...reports,
  };
}

function validateBundle(bundle, label) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw invalidBundle(`${label} must be an object.`);
  }
  if (bundle.schema !== PS_FAMILY_EVIDENCE_SOURCE_SCHEMA) {
    throw invalidBundle(
      `${label} schema must be ${PS_FAMILY_EVIDENCE_SOURCE_SCHEMA}; received ${bundle.schema || 'none'}.`,
    );
  }
  if (!Array.isArray(bundle.supportFamilies)) {
    throw invalidBundle(`${label} is missing supportFamilies.`);
  }
  if (!Array.isArray(bundle.relationships)) {
    throw invalidBundle(`${label} is missing relationships.`);
  }
  return bundle;
}

function invalidBundle(message) {
  const error = new Error(message);
  error.code = 'PSFA_INVALID_BUNDLE';
  return error;
}

function readinessSummary(bundle, expectedRows, detailRows, diagnostics, config = {}) {
  const resolvedConfig = resolveEvidenceConfig(config);
  const families = filterEvidenceFamilies(
    bundle.supportFamilies || [],
    resolvedConfig.sourceFamily,
  );
  const chain = bundle.supportMemberChain || {};
  const physicalTerminals = (chain.structuralTerminalEdges || []).filter(
    (edge) => edge.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE',
  );
  return {
    evidenceMode: PS_FAMILY_EVIDENCE_MODE,
    sourceFamily: detectedEvidenceSourceFamily(families, resolvedConfig),
    structureContactCount: physicalTerminals.length,
    supportChainCount: (chain.supportChainEdges || []).length,
    ...carrierEvidenceSummary(bundle),
    xmlClashCount: 0,
    psClashCount: 0,
    expectedCount: expectedRows.length,
    detailCount: detailRows.length,
    positionParsedCount: detailRows.filter((row) => row.position).length,
    positionMissingCount: detailRows.filter((row) => !row.position).length,
    posFamilyCount: 0,
    relationshipCount: bundle.relationships.length,
    supportFamilyCount: families.length,
    ...diagnosticCounts(diagnostics),
  };
}

function emptyReadinessSummary(diagnostics) {
  return {
    evidenceMode: PS_FAMILY_EVIDENCE_MODE,
    sourceFamily: '',
    structureContactCount: 0,
    supportChainCount: 0,
    ...carrierEvidenceSummary(),
    xmlClashCount: 0,
    psClashCount: 0,
    expectedCount: 0,
    detailCount: 0,
    positionParsedCount: 0,
    positionMissingCount: 0,
    posFamilyCount: 0,
    relationshipCount: 0,
    supportFamilyCount: 0,
    ...diagnosticCounts(diagnostics),
  };
}

function buildSummary(
  bundle,
  families,
  expectedRows,
  posFamilies,
  reports,
  coverage,
  config,
) {
  const foundCount = coverage.coverageRows.filter((row) => row.found).length;
  return {
    sourceFamily: detectedEvidenceSourceFamily(families, config),
    evidenceMode: PS_FAMILY_EVIDENCE_MODE,
    sourceSchema: bundle.schema,
    expectedCount: expectedRows.length,
    clashCount: 0,
    psClashCount: 0,
    graphEvidenceCount: reports.inputEvidenceRows.length,
    relationshipCount: reports.relationshipCount,
    supportChainEdgeCount: reports.supportChainRows.length,
    structuralTerminalCount: reports.structureContactRows.length,
    ...carrierEvidenceSummary(bundle),
    symbolicReferenceCount: reports.symbolicReferenceCount,
    supportGroupCount: reports.supportSummaryRows.length,
    supportExceptionCount: reports.supportExceptionRows.length,
    foundExactCount: foundCount,
    missingCount: coverage.missingRows.length,
    outOfFamilyCount: 0,
    duplicateMemberCount: coverage.duplicateRows.length,
    unexpectedInFamilyCount: coverage.unexpectedInFamilyRows.length,
    posFamilyCount: posFamilies.length,
    psClashReportCount: reports.supportMemberRows.length,
    structureLineProximityCount: reports.structureLineProximityRows.length,
    coveragePct: expectedRows.length
      ? Number(((foundCount / expectedRows.length) * 100).toFixed(2))
      : 0,
  };
}

function diagnosticCounts(diagnostics) {
  return {
    errorCount: diagnostics.filter((item) => item.level === 'ERROR').length,
    warnCount: diagnostics.filter((item) => item.level === 'WARN').length,
    infoCount: diagnostics.filter((item) => item.level === 'INFO').length,
  };
}
