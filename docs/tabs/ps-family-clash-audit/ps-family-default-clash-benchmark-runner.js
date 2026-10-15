import { mkdirSync, writeFileSync } from 'node:fs';
import { buildDefaultPsFamilyClashBenchmark } from './ps-family-default-clash-benchmark.js';
import {
  CONTROL_CLASH_CONVERSION_MODE,
  convertPsFamilyClashXmlToCombinedModel,
} from './ps-family-default-clash-converted-model.js';
import { buildPsFamilyOfflineValidationBenchmark } from './ps-family-offline-validation-benchmark.js';
import {
  PS_FAMILY_SAMPLE_STRUCTURE_XML,
  PS_FAMILY_SAMPLE_SUPPORT_XML,
} from './ps-family-clash-audit-samples.js';
import { buildSupportSteelRelationshipBundle } from '../support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js';

const output = 'artifacts/ps-family-default-clash-benchmark';
const base = buildDefaultPsFamilyClashBenchmark();
const controlModel = convertPsFamilyClashXmlToCombinedModel(
  {
    structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
    supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
  },
  { mode: CONTROL_CLASH_CONVERSION_MODE },
);
const controlBundle = buildSupportSteelRelationshipBundle({
  combinedInput: controlModel,
  config: {
    projectionToleranceMm: 25,
    ambiguityDeltaMm: 2,
    memberContactToleranceMm: 2,
    memberCandidateToleranceMm: 25,
    requireAnalyticalGeometryForSpatialResolution: true,
  },
});
const controlReference = buildPsFamilyOfflineValidationBenchmark({
  relationshipBundle: controlBundle,
  structureXmlText: PS_FAMILY_SAMPLE_STRUCTURE_XML,
  supportXmlText: PS_FAMILY_SAMPLE_SUPPORT_XML,
});
const control = controlResult(controlBundle, controlReference, base.source);
const gaps = correctedGaps(base.gaps, control, base.source);
const result = {
  ...base,
  clashImprintedControl: control,
  gaps,
  summary: {
    ...base.summary,
    controlAnalyticalChainRecall: control.analyticalChainMetrics.recall,
    controlAnalyticalTerminalRecall: control.memberTerminalMetrics.recall,
    gapCount: gaps.length,
    highSeverityGapCount: gaps.filter((row) => row.severity === 'HIGH').length,
  },
  convertedModels: {
    ...base.convertedModels,
    clashImprintedControl: controlModel,
  },
};
const required = [
  result.source.structuralClashCount === 2,
  result.source.supportChainClashCount === 3,
  result.strict.standard.structural.precision === 1,
  result.strict.standard.structural.recall === 1,
  result.strict.explicitReferenceChainMetrics.recall === 1,
  result.strict.analyticalChainMetrics.recall === 0,
  result.clashImprintedControl.analyticalChainMetrics.recall === 1,
  result.summary.status === 'MATERIAL_GAPS_FOUND',
];
if (required.some((value) => !value)) throw new Error('Default PS audit benchmark contract failed.');
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/benchmark.json`, `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(`${output}/converted-strict.json`, `${JSON.stringify(result.convertedModels.strict, null, 2)}\n`);
writeFileSync(`${output}/converted-control.json`, `${JSON.stringify(result.convertedModels.clashImprintedControl, null, 2)}\n`);
writeFileSync(`${output}/gap-report.csv`, gapCsv(result.gaps));
console.log(JSON.stringify(result.summary, null, 2));

function controlResult(bundle, reference, source) {
  const chain = bundle.supportMemberChain || {};
  const terminals = (chain.structuralTerminalEdges || []).filter((row) => (
    row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE'
  ));
  const chainReference = new Set(source.supportChainRows.map((row) => pairKey(row.supportA, row.supportB)));
  const chainPredicted = new Set((chain.supportChainEdges || []).map((row) => pairKey(row.supportA, row.supportB)));
  const terminalReference = new Set(source.structuralRows.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId)));
  const terminalPredicted = new Set(terminals.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId)));
  return {
    standard: {
      status: reference.summary.status,
      structural: reference.structural.metrics,
      chain: reference.chain.metrics,
      structuralDisagreements: reference.structural.disagreements,
      chainDisagreements: reference.chain.disagreements,
    },
    analyticalChainMetrics: metrics(chainPredicted, chainReference),
    memberTerminalMetrics: metrics(terminalPredicted, terminalReference),
    steelGroupCount: bundle.summary?.steelGroupCount || 0,
    carrierObjectCount: bundle.summary?.carrierObjectCount || 0,
    analyticalSupportMemberCount: chain.summary?.analyticalMemberCount || 0,
    analyticalSupportChainEdgeCount: chain.summary?.supportChainEdgeCount || 0,
    analyticalStructuralTerminalCount: terminals.length,
    completeCarrierToStructurePathCount: bundle.supportCarrierToStructurePath?.summary?.completePathCount || 0,
    functionConfirmedFamilyCount: bundle.supportRestraintFunction?.summary?.confirmedFamilyCount || 0,
    relationshipRows: bundle.relationships || [],
    analyticalChainRows: chain.supportChainEdges || [],
    analyticalTerminalRows: terminals,
  };
}

function correctedGaps(rows, control, source) {
  const outputRows = rows.filter((row) => row.code !== 'STRUCTURAL_TERMINAL_ENGINE_SELECTS_ONE_NEAREST_MEMBER');
  if (control.memberTerminalMetrics.recall < 1) {
    outputRows.splice(3, 0, {
      code: 'STRUCTURAL_TERMINAL_ENGINE_SELECTS_ONE_NEAREST_MEMBER',
      severity: 'HIGH',
      referenceObservation: 'The XML reference records two member-to-structure contacts for PS-14396 (.9 and .10).',
      gapObservation: `With corrected structural geometry, the control proves ${control.analyticalStructuralTerminalCount} of ${source.structuralTerminalMemberCount} member terminals.`,
      recommendation: 'Evaluate every in-contact support member against the selected structural member instead of retaining only the single nearest terminal.',
    });
  }
  return outputRows;
}

function metrics(predicted, reference) {
  const matchCount = [...predicted].filter((key) => reference.has(key)).length;
  return {
    predictedCount: predicted.size,
    referenceCount: reference.size,
    matchCount,
    falsePositiveCount: [...predicted].filter((key) => !reference.has(key)).length,
    falseNegativeCount: [...reference].filter((key) => !predicted.has(key)).length,
    precision: predicted.size ? round(matchCount / predicted.size) : 0,
    recall: reference.size ? round(matchCount / reference.size) : 0,
  };
}
function memberSteelKey(member, steel) { return `${normalize(member)}::${normalize(steel)}`; }
function pairKey(left, right) { return [normalize(left), normalize(right)].sort().join('::'); }
function normalize(value) { const text = String(value || '').trim().replace(/^\/+/, ''); return text ? `/${text.toUpperCase()}` : ''; }
function round(value) { return Number(value.toFixed(6)); }
function gapCsv(rows) {
  const headers = ['Code', 'Severity', 'ReferenceObservation', 'GapObservation', 'Recommendation'];
  const lines = rows.map((row) => [row.code, row.severity, row.referenceObservation, row.gapObservation, row.recommendation].map(cell).join(','));
  return `${headers.join(',')}\n${lines.join('\n')}\n`;
}
function cell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
