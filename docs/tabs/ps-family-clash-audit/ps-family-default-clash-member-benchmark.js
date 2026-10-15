import {
  CONTROL_CLASH_CONVERSION_MODE,
  STRICT_CLASH_CONVERSION_MODE,
  convertPsFamilyClashXmlToCombinedModel,
} from './ps-family-default-clash-converted-model.js';
import { buildPsFamilyOfflineValidationBenchmark } from './ps-family-offline-validation-benchmark.js';
import { parseSupportChangeXml } from './ps-family-psclash-xml-parser.js';
import {
  PS_FAMILY_SAMPLE_STRUCTURE_XML,
  PS_FAMILY_SAMPLE_SUPPORT_XML,
} from './ps-family-clash-audit-samples.js';
import { buildSupportSteelRelationshipBundle } from '../support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js';

export const PS_FAMILY_DEFAULT_CLASH_MEMBER_BENCHMARK_SCHEMA = 'PsFamilyDefaultClashMemberBenchmark.v1';

export function buildDefaultPsFamilyClashMemberBenchmark(input = {}) {
  const structureXmlText = input.structureXmlText ?? PS_FAMILY_SAMPLE_STRUCTURE_XML;
  const supportXmlText = input.supportXmlText ?? PS_FAMILY_SAMPLE_SUPPORT_XML;
  const config = {
    projectionToleranceMm: 25,
    ambiguityDeltaMm: 2,
    memberContactToleranceMm: 2,
    memberCandidateToleranceMm: 25,
    requireAnalyticalGeometryForSpatialResolution: true,
    ...(input.config || {}),
  };
  const strictModel = convertPsFamilyClashXmlToCombinedModel(
    { structureXmlText, supportXmlText },
    { mode: STRICT_CLASH_CONVERSION_MODE },
  );
  const controlModel = convertPsFamilyClashXmlToCombinedModel(
    { structureXmlText, supportXmlText },
    { mode: CONTROL_CLASH_CONVERSION_MODE },
  );
  const source = sourceReference(structureXmlText, supportXmlText);
  const strictBundle = buildSupportSteelRelationshipBundle({ combinedInput: strictModel, config });
  const controlBundle = buildSupportSteelRelationshipBundle({ combinedInput: controlModel, config });
  const strict = engineResult(strictBundle, source, structureXmlText, supportXmlText);
  const control = engineResult(controlBundle, source, structureXmlText, supportXmlText);
  const gaps = gapLedger(strict, control, source);
  return {
    schema: PS_FAMILY_DEFAULT_CLASH_MEMBER_BENCHMARK_SCHEMA,
    validationOnly: true,
    productionDependency: false,
    benchmarkFixture: 'FIRST_PS_AUDIT_ICON_DEFAULT_PS-14396',
    sourceCaution: 'Historical clash XML is a limited comparison reference, not production authority or complete engineering truth.',
    source,
    strict,
    clashImprintedControl: control,
    gaps,
    summary: {
      status: gaps.some((row) => row.severity === 'HIGH') ? 'MATERIAL_GAPS_FOUND' : 'REVIEW_REQUIRED',
      sourceStructuralClashCount: source.structuralRows.length,
      sourceSupportChainClashCount: source.supportChainRows.length,
      strictStructuralFamilyPrecision: strict.familyStructuralMetrics.precision,
      strictStructuralFamilyRecall: strict.familyStructuralMetrics.recall,
      strictExplicitReferenceChainRecall: strict.explicitReferenceChainMetrics.recall,
      strictAnalyticalChainRecall: strict.analyticalChainMetrics.recall,
      strictAnalyticalTerminalRecall: strict.memberTerminalMetrics.recall,
      controlAnalyticalChainRecall: control.analyticalChainMetrics.recall,
      controlAnalyticalTerminalRecall: control.memberTerminalMetrics.recall,
      controlAnalyticalTerminalCount: control.analyticalStructuralTerminalCount,
      strictCompleteCarrierToStructurePathCount: strict.completeCarrierToStructurePathCount,
      strictFunctionConfirmedFamilyCount: strict.functionConfirmedFamilyCount,
      gapCount: gaps.length,
      highSeverityGapCount: gaps.filter((row) => row.severity === 'HIGH').length,
    },
    convertedModels: { strict: strictModel, clashImprintedControl: controlModel },
  };
}

function engineResult(bundle, source, structureXmlText, supportXmlText) {
  const reference = buildPsFamilyOfflineValidationBenchmark({
    relationshipBundle: bundle,
    structureXmlText,
    supportXmlText,
  });
  const chain = bundle.supportMemberChain || {};
  const analyticalChain = new Set((chain.supportChainEdges || []).map((row) => pairKey(row.supportA, row.supportB)));
  const explicitChain = new Set((chain.referenceEdges || []).map((row) => pairKey(row.fromMemberId, row.toMemberId)));
  const referenceChain = new Set(source.supportChainRows.map((row) => pairKey(row.supportA, row.supportB)));
  const analyticalTerminals = (chain.structuralTerminalEdges || []).filter((row) => (
    row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE'
  ));
  const predictedTerminals = new Set(analyticalTerminals.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId)));
  const referenceTerminals = new Set(source.structuralRows.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId)));
  return {
    inputMode: bundle.inputMode,
    familyStructuralMetrics: reference.structural.metrics,
    analyticalChainMetrics: setMetrics(analyticalChain, referenceChain),
    explicitReferenceChainMetrics: setMetrics(explicitChain, referenceChain),
    memberTerminalMetrics: setMetrics(predictedTerminals, referenceTerminals),
    analyticalStructuralTerminalCount: analyticalTerminals.length,
    analyticalStructuralTerminalRows: analyticalTerminals,
    carrierObjectCount: bundle.summary?.carrierObjectCount || 0,
    completeCarrierToStructurePathCount: bundle.supportCarrierToStructurePath?.summary?.completePathCount || 0,
    functionConfirmedFamilyCount: bundle.supportRestraintFunction?.summary?.confirmedFamilyCount || 0,
    functionNotProvenFamilyCount: bundle.supportRestraintFunction?.summary?.notProvenFamilyCount || 0,
    structuralTerminalEvaluationSchema: bundle.structuralTerminalEvaluationSchema,
  };
}

function sourceReference(structureXmlText, supportXmlText) {
  const structuralRows = parseSupportChangeXml(
    structureXmlText, {}, 'StructureGroup vs Supports',
  ).rows.filter((row) => row.edgeType === 'StructuralContact').map((row) => ({
    clashName: row.clashName,
    supportFamilyId: family(row.psRoot || row.support),
    supportMemberId: rooted(row.support),
    steelGroupId: rooted(row.structuralRoot || row.structuralGroup),
    clashPoint: row.point,
  }));
  const supportChainRows = parseSupportChangeXml(
    supportXmlText, {}, 'Clash within Supports',
  ).rows.filter((row) => row.edgeType === 'SupportChain').map((row) => ({
    clashName: row.clashName,
    supportFamilyId: family(row.psRoot || row.supportA),
    supportA: rooted(row.supportA),
    supportB: rooted(row.supportB),
    clashPointAvailable: Boolean(row.point),
  }));
  return {
    supportFamilyIds: unique([...structuralRows, ...supportChainRows].map((row) => row.supportFamilyId)),
    structuralRows,
    supportChainRows,
    uniqueStructuralFamilyPairCount: unique(structuralRows.map((row) => `${row.supportFamilyId}::${normalize(row.steelGroupId)}`)).length,
    structuralTerminalMemberCount: unique(structuralRows.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId))).length,
    uniqueSupportChainPairCount: unique(supportChainRows.map((row) => pairKey(row.supportA, row.supportB))).length,
  };
}

function gapLedger(strict, control, source) {
  const rows = [];
  if (strict.familyStructuralMetrics.recall === 1 && strict.memberTerminalMetrics.recall < 1) rows.push(gap(
    'FAMILY_LEVEL_STRUCTURAL_MATCH_MASKS_MEMBER_TERMINAL_GAP', 'HIGH',
    'The family-to-steel benchmark collapses two PS-14396 member contacts into one family pair.',
    `Strict member-terminal recall is ${strict.memberTerminalMetrics.recall} for ${source.structuralTerminalMemberCount} referenced members.`,
    'Always publish family-level and member-level structural metrics separately.',
  ));
  if (strict.explicitReferenceChainMetrics.recall === 1 && strict.analyticalChainMetrics.recall < 1) rows.push(gap(
    'CHAIN_RELATIONSHIPS_PRESERVED_BUT_NOT_PHYSICALLY_PROVEN', 'HIGH',
    'All XML support-chain pairs survive as explicit references.',
    'The strict conversion has no member solids, axes or clash points for independent analytical contact proof.',
    'Keep explicit reference edges at NOT_PROVEN and use staged model geometry for production.',
  ));
  if (control.analyticalChainMetrics.recall === 1 && strict.analyticalChainMetrics.recall < 1) rows.push(gap(
    'SOURCE_GEOMETRY_GAP_CONFIRMED_BY_CONTROL', 'HIGH',
    'The geometry control reproduces all three chain contacts.',
    'The strict conversion cannot reproduce them without clash-derived geometry.',
    'Treat this as missing source geometry, not a pair-matching defect.',
  ));
  if (control.memberTerminalMetrics.recall < 1) rows.push(gap(
    'STRUCTURAL_TERMINAL_ENGINE_MISSES_IN_CONTACT_MEMBER', 'HIGH',
    'The control contains two independently contacting support members.',
    `Only ${control.analyticalStructuralTerminalCount} analytical terminals were emitted.`,
    'Evaluate every physical member against the selected structural geometry.',
  ));
  if (!strict.carrierObjectCount) rows.push(gap(
    'CLASH_XML_HAS_NO_AUTHORITATIVE_CARRIER_OBJECT', 'HIGH',
    'The XML contains line/branch paths but no physical carrier axis, diameter or topology ports.',
    'Carrier identity, attachment and topology cannot be validated.',
    'Use the original staged JSON/RVM carrier catalog.',
  ));
  if (!strict.completeCarrierToStructurePathCount) rows.push(gap(
    'COMPLETE_PATH_NOT_BENCHMARKABLE_FROM_CLASH_XML_ALONE', 'MEDIUM',
    'The reference covers selected support and structure pairs only.',
    'It cannot validate a complete carrier-to-structure path.',
    'Label pair, terminal, path and function benchmark coverage independently.',
  ));
  if (!strict.functionConfirmedFamilyCount) rows.push(gap(
    'RESTRAINT_FUNCTION_NOT_BENCHMARKABLE_FROM_DEFAULT_XML', 'MEDIUM',
    'The XML contains no authoritative restraint intent or member orientation.',
    'REST/GUIDE/LINE_STOP/HOLD_DOWN/ANCHOR cannot be confirmed.',
    'Use staged support attributes and geometry for function validation.',
  ));
  rows.push(gap(
    'CLASH_IMPRINTED_CONTROL_IS_CIRCULAR', 'MEDIUM',
    'The control geometry is generated from the same clash graph used as reference.',
    'Its agreement demonstrates reproducibility, not independent accuracy.',
    'Never use control scores as a production quality claim.',
  ));
  return rows;
}

function setMetrics(predicted, reference) {
  const matches = [...predicted].filter((key) => reference.has(key));
  return {
    predictedCount: predicted.size,
    referenceCount: reference.size,
    matchCount: matches.length,
    falsePositiveCount: [...predicted].filter((key) => !reference.has(key)).length,
    falseNegativeCount: [...reference].filter((key) => !predicted.has(key)).length,
    precision: predicted.size ? round(matches.length / predicted.size) : 0,
    recall: reference.size ? round(matches.length / reference.size) : 0,
    matchedKeys: matches.sort(),
    predictedOnlyKeys: [...predicted].filter((key) => !reference.has(key)).sort(),
    referenceOnlyKeys: [...reference].filter((key) => !predicted.has(key)).sort(),
  };
}
function gap(code, severity, referenceObservation, gapObservation, recommendation) {
  return { code, severity, referenceObservation, gapObservation, recommendation };
}
function pairKey(left, right) { return [normalize(left), normalize(right)].sort().join('::'); }
function memberSteelKey(memberId, steelGroupId) { return `${normalize(memberId)}::${normalize(steelGroupId)}`; }
function family(value) { return normalize(value).match(/(?:^|\/)(PS-\d+)/u)?.[1] || normalize(value); }
function normalize(value) { return rooted(value).toUpperCase(); }
function rooted(value) { const text = String(value || '').trim(); return text ? `/${text.replace(/^\/+/, '')}` : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function round(value) { return Number(value.toFixed(6)); }
