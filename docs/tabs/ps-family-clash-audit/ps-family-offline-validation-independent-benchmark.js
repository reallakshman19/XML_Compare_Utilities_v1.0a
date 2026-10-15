import { buildPsFamilyNativeAuditPipeline } from './ps-family-native-combined-input.js';
import { buildPsFamilyOfflineValidationBenchmark } from './ps-family-offline-validation-benchmark.js';
import { parseSupportChangeXml } from './ps-family-psclash-xml-parser.js';

export const PS_FAMILY_INDEPENDENT_BENCHMARK_SCHEMA = 'PsFamilyIndependentModelBenchmark.v1';

export function buildPsFamilyIndependentModelBenchmark(input = {}) {
  const combinedInputText = text(input.combinedInputText ?? input.combinedInput);
  if (!combinedInputText.trim()) throw new Error('Load one combined staged model JSON in Native Pipeline before benchmarking.');
  const pipeline = buildPsFamilyNativeAuditPipeline({
    combinedInputText,
    relationshipConfig: input.relationshipConfig || {},
    auditConfig: input.auditConfig || {},
  });
  const reference = buildPsFamilyOfflineValidationBenchmark({
    relationshipBundle: pipeline.relationshipBundle,
    structureXmlText: input.structureXmlText || '',
    supportXmlText: input.supportXmlText || '',
    config: input.validationConfig || {},
  });
  const memberTerminal = terminalBenchmark(
    pipeline.relationshipBundle,
    input.structureXmlText || '',
    input.validationConfig || {},
  );
  const coverage = coverageRows(pipeline, reference, memberTerminal);
  const gaps = gapRows(reference, memberTerminal, coverage);
  return {
    schema: PS_FAMILY_INDEPENDENT_BENCHMARK_SCHEMA,
    validationOnly: true,
    productionDependency: false,
    inputMode: 'COMBINED_STAGED_MODEL_WITH_OPTIONAL_XML_REFERENCE',
    sourceSchema: pipeline.relationshipBundle?.sourceSchema || pipeline.relationshipBundle?.schema,
    referenceCaution: 'Clash XML is an optional historical reference. The combined staged model remains the only production evidence source.',
    pipeline,
    reference,
    memberTerminal,
    coverage,
    gaps,
    summary: {
      status: gaps.some((row) => row.severity === 'HIGH') ? 'MATERIAL_GAPS_FOUND' : 'MEETS_AVAILABLE_REFERENCE',
      referenceComparableLayerCount: coverage.filter((row) => row.coverageStatus === 'REFERENCE_COMPARABLE').length,
      modelOnlyLayerCount: coverage.filter((row) => row.coverageStatus === 'MODEL_ONLY').length,
      noModelEvidenceLayerCount: coverage.filter((row) => row.coverageStatus === 'NO_MODEL_EVIDENCE').length,
      gapCount: gaps.length,
      highSeverityGapCount: gaps.filter((row) => row.severity === 'HIGH').length,
      structuralPrecision: reference.structural.metrics.precision,
      structuralRecall: reference.structural.metrics.recall,
      chainPrecision: reference.chain.metrics.precision,
      chainRecall: reference.chain.metrics.recall,
      memberTerminalPrecision: memberTerminal.metrics.precision,
      memberTerminalRecall: memberTerminal.metrics.recall,
    },
  };
}

function terminalBenchmark(bundle, structureXmlText, config) {
  const xml = parseSupportChangeXml(structureXmlText, config, 'StructureGroup vs Supports');
  const predictedRows = unique((bundle.supportMemberChain?.structuralTerminalEdges || [])
    .filter((row) => row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
      && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE')
    .map((row) => terminal(row.supportMemberId, row.steelGroupId, row.edgeId, 'MODEL')));
  const referenceRows = unique((xml.rows || [])
    .filter((row) => row.edgeType === 'StructuralContact')
    .map((row) => terminal(row.support, row.structuralRoot || row.structuralGroup, row.clashName, 'XML')));
  const predicted = new Set(predictedRows.map((row) => row.key));
  const reference = new Set(referenceRows.map((row) => row.key));
  const matches = predictedRows.filter((row) => reference.has(row.key));
  return {
    metrics: metric(matches.length, predicted.size, reference.size),
    predictedRows,
    referenceRows,
    matches,
    disagreements: [
      ...predictedRows.filter((row) => !reference.has(row.key)).map((row) => ({ classification: 'MODEL_ONLY', ...row })),
      ...referenceRows.filter((row) => !predicted.has(row.key)).map((row) => ({ classification: 'XML_ONLY', ...row })),
    ],
    diagnostics: xml.diagnostics || [],
  };
}

function coverageRows(pipeline, reference, terminalResult) {
  const summary = pipeline.summary || {};
  const restraint = pipeline.relationshipBundle?.supportRestraintFunction?.summary || {};
  return [
    comparable('FAMILY_TO_STEEL', reference.structural.metrics),
    comparable('SUPPORT_MEMBER_CHAIN', reference.chain.metrics),
    comparable('MEMBER_TO_STEEL_TERMINAL', terminalResult.metrics),
    modelOnly('CARRIER_IDENTITY', summary.resolvedPhysicalCarrierCount, 'Clash XML has no authoritative physical carrier object.'),
    modelOnly('CARRIER_ATTACHMENT', summary.carrierAttachmentCandidateCount, 'Clash XML has no carrier-to-support attachment geometry.'),
    modelOnly('CARRIER_TOPOLOGY', summary.carrierTopologyConnectionCount, 'Clash XML has no component ports or route continuity.'),
    modelOnly('COMPLETE_CARRIER_TO_STRUCTURE_PATH', summary.completeCarrierToStructurePathCount, 'Pair clashes cannot validate the complete proof path.'),
    modelOnly('RESTRAINT_FUNCTION', restraint.confirmedFamilyCount, 'Clash XML has no authoritative restraint intent or direction.'),
  ];
}

function gapRows(reference, terminalResult, coverage) {
  const rows = [];
  for (const [code, result] of [
    ['FAMILY_TO_STEEL_REFERENCE_GAP', reference.structural],
    ['SUPPORT_CHAIN_REFERENCE_GAP', reference.chain],
    ['MEMBER_TERMINAL_REFERENCE_GAP', terminalResult],
  ]) {
    if (result.metrics.status === 'BELOW_REFERENCE_THRESHOLDS') rows.push(gap(code, 'HIGH', 'Agreement is below available XML-reference thresholds.'));
    if (result.metrics.status === 'NO_REFERENCE_COVERAGE') rows.push(gap(`${code}_NO_REFERENCE`, 'INFO', 'No historical XML reference coverage is available.'));
  }
  if (reference.structural.metrics.recall === 1 && terminalResult.metrics.xmlReferenceCount > 0 && terminalResult.metrics.recall < 1) {
    rows.push(gap('FAMILY_MATCH_MASKS_MEMBER_TERMINAL_GAP', 'HIGH', 'Family-level recall hides missing physical member terminals.'));
  }
  coverage.filter((row) => row.coverageStatus === 'NO_MODEL_EVIDENCE')
    .forEach((row) => rows.push(gap(`${row.layer}_NOT_PROVEN`, 'MEDIUM', row.claimBoundary)));
  coverage.filter((row) => row.coverageStatus === 'MODEL_ONLY')
    .forEach((row) => rows.push(gap(`${row.layer}_XML_COVERAGE_UNAVAILABLE`, 'INFO', row.claimBoundary)));
  return rows;
}

function comparable(layer, metrics) {
  return {
    layer,
    coverageStatus: metrics.xmlReferenceCount
      ? metrics.graphAcceptedCount ? 'REFERENCE_COMPARABLE' : 'NO_MODEL_EVIDENCE'
      : metrics.graphAcceptedCount ? 'MODEL_ONLY' : 'NO_REFERENCE_OR_MODEL_EVIDENCE',
    modelEvidenceCount: metrics.graphAcceptedCount,
    referenceEvidenceCount: metrics.xmlReferenceCount,
    claimBoundary: 'Comparable only within the historical pair relationships represented by the XML reference.',
  };
}
function modelOnly(layer, count = 0, claimBoundary) {
  return { layer, coverageStatus: count ? 'MODEL_ONLY' : 'NO_MODEL_EVIDENCE', modelEvidenceCount: count || 0, referenceEvidenceCount: 0, claimBoundary };
}
function metric(matches, model, reference) {
  const precision = model ? round(matches / model) : 0;
  const recall = reference ? round(matches / reference) : 0;
  return {
    status: !reference ? 'NO_REFERENCE_COVERAGE' : precision === 1 && recall === 1 ? 'MEETS_REFERENCE_THRESHOLDS' : 'BELOW_REFERENCE_THRESHOLDS',
    matchCount: matches,
    graphAcceptedCount: model,
    xmlReferenceCount: reference,
    falsePositiveReferenceCount: Math.max(0, model - matches),
    falseNegativeReferenceCount: Math.max(0, reference - matches),
    precision,
    recall,
  };
}
function terminal(member, steel, evidenceId, source) {
  const supportMemberId = id(member);
  const steelGroupId = steelId(steel);
  return { key: `${supportMemberId}::${steelGroupId}`, supportMemberId, steelGroupId, evidenceId, source };
}
function unique(rows) { const seen = new Set(); return rows.filter((row) => !seen.has(row.key) && seen.add(row.key)); }
function text(value) { return typeof value === 'string' ? value : value ? JSON.stringify(value) : ''; }
function id(value) { const valueText = String(value || '').trim().replace(/^\/+/, ''); return valueText ? `/${valueText.toUpperCase()}` : ''; }
function steelId(value) { const normalized = id(value); const match = normalized.match(/\/(?:.*\/)?((?:PS|SL)-\d+)/u); return match ? `/${match[1]}` : normalized; }
function round(value) { return Number(value.toFixed(6)); }
function gap(code, severity, message) { return { code, severity, message }; }
