import { parsePsFamilyEvidenceBundle } from './ps-family-evidence-graph-audit.js';
import { parseSupportChangeXml } from './ps-family-psclash-xml-parser.js';
import {
  chainPair,
  groupValidationRows,
  normalizeValidationFamily,
  normalizeValidationSteel,
  splitChainPair,
  splitStructuralPair,
  structuralPair,
  uniqueValidationRows,
} from './ps-family-validation-normalize.js';

export const PS_FAMILY_OFFLINE_VALIDATION_SCHEMA = 'PsFamilyOfflineValidationBenchmark.v1';

const DEFAULT_THRESHOLDS = Object.freeze({
  structuralPrecision: 0.98,
  structuralRecall: 0.95,
  chainPrecision: 0.97,
  chainRecall: 0.95,
});

export function buildPsFamilyOfflineValidationBenchmark(input = {}) {
  const bundle = parsePsFamilyEvidenceBundle(
    input.relationshipBundle ?? input.relationshipBundleText,
  );
  const config = resolveValidationConfig(input.config);
  const structure = parseSupportChangeXml(
    input.structureXmlText,
    config,
    'StructureGroup vs Supports',
  );
  const support = parseSupportChangeXml(
    input.supportXmlText,
    config,
    'Clash within Supports',
  );
  const structural = compareStructuralRelationships(bundle, structure.rows, config);
  const chain = compareSupportChains(bundle, support.rows, config);
  const diagnostics = [
    ...structure.diagnostics,
    ...support.diagnostics,
    ...validationDiagnostics(structural, chain),
  ];
  return {
    schema: PS_FAMILY_OFFLINE_VALIDATION_SCHEMA,
    validationOnly: true,
    productionDependency: false,
    sourceSchema: bundle.schema,
    referenceSources: ['StructureGroup vs Supports XML', 'Clash within Supports XML'],
    referenceCaution: 'Historical clash XML is a comparison reference, not unquestioned engineering truth.',
    thresholds: config.thresholds,
    summary: {
      status: overallStatus(structural.metrics.status, chain.metrics.status),
      structuralStatus: structural.metrics.status,
      chainStatus: chain.metrics.status,
      structuralMatchCount: structural.metrics.matchCount,
      chainMatchCount: chain.metrics.matchCount,
      disagreementCount: structural.disagreements.length + chain.disagreements.length,
      reviewRequiredCount: structural.reviewRows.length + chain.reviewRows.length,
    },
    structural,
    chain,
    diagnostics,
  };
}

function compareStructuralRelationships(bundle, xmlRows, config) {
  const graphRows = uniqueValidationRows((bundle.relationships || [])
    .filter((row) => row.steelGroupId && String(row.relationshipStatus || '').startsWith('RESOLVED_'))
    .map((row) => ({
      key: structuralPair(row.supportFamilyId, row.steelGroupId),
      supportFamilyId: normalizeValidationFamily(row.supportFamilyId),
      steelGroupId: normalizeValidationSteel(row.steelGroupId),
      evidenceId: row.evidenceId || row.relationshipId,
      relationshipStatus: row.relationshipStatus,
      confidence: row.confidence,
    })));
  const xmlReferenceRows = uniqueValidationRows((xmlRows || [])
    .filter((row) => row.edgeType === 'StructuralContact')
    .map((row) => ({
      key: structuralPair(row.psRoot || row.support, row.structuralRoot || row.structuralGroup),
      supportFamilyId: normalizeValidationFamily(row.psRoot || row.support),
      steelGroupId: normalizeValidationSteel(row.structuralRoot || row.structuralGroup),
      referenceId: row.clashName,
    })));
  const graphKeys = new Set(graphRows.map((row) => row.key));
  const xmlKeys = new Set(xmlReferenceRows.map((row) => row.key));
  const matches = graphRows
    .filter((row) => xmlKeys.has(row.key))
    .map((row) => ({ classification: 'MATCH', ...row }));
  const disagreements = structuralDisagreements(bundle, graphRows, xmlReferenceRows, graphKeys, xmlKeys);
  const metrics = buildMetrics(
    matches.length,
    graphRows.length,
    xmlReferenceRows.length,
    config.thresholds.structuralPrecision,
    config.thresholds.structuralRecall,
  );
  return {
    metrics,
    graphAcceptedRows: graphRows,
    xmlReferenceRows,
    matches,
    disagreements,
    reviewRows: disagreements.filter((row) => row.classification !== 'MATCH'),
  };
}

function structuralDisagreements(bundle, graphRows, xmlRows, graphKeys, xmlKeys) {
  const rows = [];
  const graphByFamily = groupValidationRows(graphRows, (row) => row.supportFamilyId);
  const xmlByFamily = groupValidationRows(xmlRows, (row) => row.supportFamilyId);
  const ambiguousByFamily = groupValidationRows(
    (bundle.relationships || []).filter((row) => row.relationshipStatus === 'AMBIGUOUS'),
    (row) => normalizeValidationFamily(row.supportFamilyId),
  );
  const unresolvedByFamily = new Map((bundle.relationships || [])
    .filter((row) => row.relationshipStatus === 'UNRESOLVED')
    .map((row) => [normalizeValidationFamily(row.supportFamilyId), row]));
  const families = new Set([...graphByFamily.keys(), ...xmlByFamily.keys(), ...ambiguousByFamily.keys()]);
  families.forEach((family) => {
    const graph = (graphByFamily.get(family) || []).filter((row) => !xmlKeys.has(row.key));
    let xml = (xmlByFamily.get(family) || []).filter((row) => !graphKeys.has(row.key));
    const ambiguous = ambiguousByFamily.get(family) || [];
    if (ambiguous.length) {
      rows.push({
        classification: 'AMBIGUOUS',
        supportFamilyId: family,
        graphSteelGroupIds: [...new Set(ambiguous.map((row) => normalizeValidationSteel(row.steelGroupId)))],
        xmlSteelGroupIds: xml.map((row) => row.steelGroupId),
        evidenceIds: ambiguous.map((row) => row.evidenceId || row.relationshipId),
      });
    }
    const unresolved = unresolvedByFamily.get(family);
    if (unresolved?.nearestSteelGroupId) {
      const nearest = normalizeValidationSteel(unresolved.nearestSteelGroupId);
      const outOfTolerance = xml.filter((row) => row.steelGroupId === nearest);
      if (outOfTolerance.length && !unresolved.withinProjectionTolerance) {
        rows.push({
          classification: 'OUT_OF_TOLERANCE',
          supportFamilyId: family,
          graphSteelGroupIds: [nearest],
          xmlSteelGroupIds: [nearest],
          distanceMm: unresolved.distanceMm,
          toleranceMm: unresolved.projectionToleranceMm,
          evidenceIds: [unresolved.evidenceId || unresolved.relationshipId],
          referenceIds: outOfTolerance.map((row) => row.referenceId),
        });
        xml = xml.filter((row) => row.steelGroupId !== nearest);
      }
    }
    if (graph.length && xml.length) {
      rows.push({
        classification: 'DIFFERENT_STEEL',
        supportFamilyId: family,
        graphSteelGroupIds: graph.map((row) => row.steelGroupId),
        xmlSteelGroupIds: xml.map((row) => row.steelGroupId),
        evidenceIds: graph.map((row) => row.evidenceId),
        referenceIds: xml.map((row) => row.referenceId),
      });
      return;
    }
    graph.forEach((row) => rows.push({ classification: 'ENGINE_ONLY', ...splitStructuralPair(row.key), evidenceIds: [row.evidenceId] }));
    xml.forEach((row) => rows.push({ classification: 'XML_ONLY', ...splitStructuralPair(row.key), referenceIds: [row.referenceId] }));
  });
  return rows;
}

function compareSupportChains(bundle, xmlRows, config) {
  const graphRows = uniqueValidationRows((bundle.supportMemberChain?.supportChainEdges || [])
    .map((row) => ({
      key: chainPair(row.supportA, row.supportB),
      supportFamilyId: normalizeValidationFamily(row.supportFamilyId || row.supportA),
      supportA: row.supportA,
      supportB: row.supportB,
      evidenceId: row.evidenceId || row.edgeId,
      contactEvidenceStatus: row.contactEvidenceStatus,
    })));
  const xmlReferenceRows = uniqueValidationRows((xmlRows || [])
    .filter((row) => row.edgeType === 'SupportChain')
    .map((row) => ({
      key: chainPair(row.supportA, row.supportB),
      supportFamilyId: normalizeValidationFamily(row.psRoot || row.supportA),
      supportA: row.supportA,
      supportB: row.supportB,
      referenceId: row.clashName,
    })));
  const graphKeys = new Set(graphRows.map((row) => row.key));
  const xmlKeys = new Set(xmlReferenceRows.map((row) => row.key));
  const matches = graphRows.filter((row) => xmlKeys.has(row.key)).map((row) => ({ classification: 'MATCH', ...row }));
  const disagreements = chainDisagreements(graphRows, xmlReferenceRows, graphKeys, xmlKeys);
  const metrics = buildMetrics(
    matches.length,
    graphRows.length,
    xmlReferenceRows.length,
    config.thresholds.chainPrecision,
    config.thresholds.chainRecall,
  );
  return {
    metrics,
    graphAcceptedRows: graphRows,
    xmlReferenceRows,
    matches,
    disagreements,
    reviewRows: disagreements,
  };
}

function chainDisagreements(graphRows, xmlRows, graphKeys, xmlKeys) {
  const rows = [];
  const graphLeft = graphRows.filter((row) => !xmlKeys.has(row.key));
  const xmlLeft = xmlRows.filter((row) => !graphKeys.has(row.key));
  const graphByFamily = groupValidationRows(graphLeft, (row) => row.supportFamilyId);
  const xmlByFamily = groupValidationRows(xmlLeft, (row) => row.supportFamilyId);
  const families = new Set([...graphByFamily.keys(), ...xmlByFamily.keys()]);
  families.forEach((family) => {
    const graph = graphByFamily.get(family) || [];
    const xml = xmlByFamily.get(family) || [];
    if (graph.length && xml.length) {
      rows.push({
        classification: 'DIFFERENT_MEMBER',
        supportFamilyId: family,
        graphPairs: graph.map((row) => splitChainPair(row.key)),
        xmlPairs: xml.map((row) => splitChainPair(row.key)),
        evidenceIds: graph.map((row) => row.evidenceId),
        referenceIds: xml.map((row) => row.referenceId),
      });
      return;
    }
    graph.forEach((row) => rows.push({ classification: 'ENGINE_ONLY', supportFamilyId: family, ...splitChainPair(row.key), evidenceIds: [row.evidenceId] }));
    xml.forEach((row) => rows.push({ classification: 'XML_ONLY', supportFamilyId: family, ...splitChainPair(row.key), referenceIds: [row.referenceId] }));
  });
  return rows;
}

function buildMetrics(matchCount, graphCount, xmlCount, precisionThreshold, recallThreshold) {
  const precision = ratio(matchCount, graphCount);
  const recall = ratio(matchCount, xmlCount);
  const status = graphCount === 0 || xmlCount === 0
    ? 'NO_REFERENCE_COVERAGE'
    : precision >= precisionThreshold && recall >= recallThreshold
      ? 'MEETS_REFERENCE_THRESHOLDS'
      : 'BELOW_REFERENCE_THRESHOLDS';
  return {
    status,
    matchCount,
    graphAcceptedCount: graphCount,
    xmlReferenceCount: xmlCount,
    falsePositiveReferenceCount: Math.max(0, graphCount - matchCount),
    falseNegativeReferenceCount: Math.max(0, xmlCount - matchCount),
    precision,
    recall,
    precisionThreshold,
    recallThreshold,
  };
}

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(6)) : 0;
}

function resolveValidationConfig(config = {}) {
  const threshold = (key) => {
    const value = Number(config[key] ?? config.thresholds?.[key]);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_THRESHOLDS[key];
  };
  return {
    ...config,
    thresholds: {
      structuralPrecision: threshold('structuralPrecision'),
      structuralRecall: threshold('structuralRecall'),
      chainPrecision: threshold('chainPrecision'),
      chainRecall: threshold('chainRecall'),
    },
  };
}

function validationDiagnostics(structural, chain) {
  const rows = [];
  if (!structural.metrics.xmlReferenceCount) rows.push({ level: 'WARN', code: 'NO_STRUCTURAL_XML_REFERENCE', message: 'No structural-contact XML reference edges were available.' });
  if (!chain.metrics.xmlReferenceCount) rows.push({ level: 'WARN', code: 'NO_CHAIN_XML_REFERENCE', message: 'No support-chain XML reference edges were available.' });
  if (structural.metrics.status === 'BELOW_REFERENCE_THRESHOLDS') rows.push({ level: 'WARN', code: 'STRUCTURAL_REFERENCE_THRESHOLD_NOT_MET', message: 'Structural relationship agreement is below the configured reference thresholds.' });
  if (chain.metrics.status === 'BELOW_REFERENCE_THRESHOLDS') rows.push({ level: 'WARN', code: 'CHAIN_REFERENCE_THRESHOLD_NOT_MET', message: 'Support-chain agreement is below the configured reference thresholds.' });
  return rows;
}

function overallStatus(structuralStatus, chainStatus) {
  if (structuralStatus === 'MEETS_REFERENCE_THRESHOLDS' && chainStatus === 'MEETS_REFERENCE_THRESHOLDS') return 'MEETS_REFERENCE_THRESHOLDS';
  if (structuralStatus === 'NO_REFERENCE_COVERAGE' || chainStatus === 'NO_REFERENCE_COVERAGE') return 'INCOMPLETE_REFERENCE_COVERAGE';
  return 'BELOW_REFERENCE_THRESHOLDS';
}
