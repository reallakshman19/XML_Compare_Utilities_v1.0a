import {
  CONTROL_CLASH_CONVERSION_MODE,
  STRICT_CLASH_CONVERSION_MODE,
  convertPsFamilyClashXmlToCombinedModel,
} from './ps-family-default-clash-json-converter.js';
import { buildPsFamilyOfflineValidationBenchmark } from './ps-family-offline-validation-benchmark.js';
import { parseSupportChangeXml } from './ps-family-psclash-xml-parser.js';
import {
  PS_FAMILY_SAMPLE_STRUCTURE_XML,
  PS_FAMILY_SAMPLE_SUPPORT_XML,
} from './ps-family-clash-audit-samples.js';
import { buildSupportSteelRelationshipBundle } from '../support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js';

export const PS_FAMILY_DEFAULT_CLASH_BENCHMARK_SCHEMA = 'PsFamilyDefaultClashBenchmark.v1';

export function buildDefaultPsFamilyClashBenchmark(input = {}) {
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
  const strictBundle = buildSupportSteelRelationshipBundle({ combinedInput: strictModel, config });
  const controlBundle = buildSupportSteelRelationshipBundle({ combinedInput: controlModel, config });
  const strictReference = buildPsFamilyOfflineValidationBenchmark({
    relationshipBundle: strictBundle,
    structureXmlText,
    supportXmlText,
    config: input.referenceConfig || {},
  });
  const controlReference = buildPsFamilyOfflineValidationBenchmark({
    relationshipBundle: controlBundle,
    structureXmlText,
    supportXmlText,
    config: input.referenceConfig || {},
  });
  const source = sourceReference(structureXmlText, supportXmlText);
  const strict = engineResult(strictBundle, strictReference, source);
  const control = engineResult(controlBundle, controlReference, source);
  const gaps = identifyGaps(strict, control, source);
  return {
    schema: PS_FAMILY_DEFAULT_CLASH_BENCHMARK_SCHEMA,
    validationOnly: true,
    productionDependency: false,
    benchmarkFixture: 'FIRST_PS_AUDIT_ICON_DEFAULT_PS-14396',
    sourceCaution: 'The clash XML is a historical comparison reference. It records selected pair relationships, not complete model geometry or unquestioned engineering truth.',
    source,
    strict,
    clashImprintedControl: control,
    gaps,
    summary: {
      status: gaps.some((row) => row.severity === 'HIGH') ? 'MATERIAL_GAPS_FOUND' : 'REVIEW_REQUIRED',
      sourceStructuralClashCount: source.structuralClashCount,
      sourceSupportChainClashCount: source.supportChainClashCount,
      strictStructuralFamilyPrecision: strict.standard.structural.precision,
      strictStructuralFamilyRecall: strict.standard.structural.recall,
      strictAnalyticalChainPrecision: strict.standard.chain.precision,
      strictAnalyticalChainRecall: strict.standard.chain.recall,
      strictAnalyticalTerminalRecall: strict.memberTerminalMetrics.recall,
      strictExplicitReferenceChainRecall: strict.explicitReferenceChainMetrics.recall,
      controlAnalyticalChainRecall: control.standard.chain.recall,
      controlAnalyticalTerminalRecall: control.memberTerminalMetrics.recall,
      strictCompleteCarrierToStructurePathCount: strict.completeCarrierToStructurePathCount,
      strictFunctionConfirmedFamilyCount: strict.functionConfirmedFamilyCount,
      gapCount: gaps.length,
      highSeverityGapCount: gaps.filter((row) => row.severity === 'HIGH').length,
    },
    convertedModels: {
      strict: strictModel,
      clashImprintedControl: controlModel,
    },
  };
}

function sourceReference(structureXmlText, supportXmlText) {
  const structureRows = parseSupportChangeXml(
    structureXmlText, {}, 'StructureGroup vs Supports',
  ).rows.filter((row) => row.edgeType === 'StructuralContact');
  const chainRows = parseSupportChangeXml(
    supportXmlText, {}, 'Clash within Supports',
  ).rows.filter((row) => row.edgeType === 'SupportChain');
  return {
    supportFamilyIds: unique([
      ...structureRows.map((row) => normalizeFamily(row.psRoot || row.support)),
      ...chainRows.map((row) => normalizeFamily(row.psRoot || row.supportA)),
    ]),
    structuralClashCount: structureRows.length,
    uniqueStructuralFamilyPairCount: unique(structureRows.map(structuralFamilyKey)).length,
    structuralTerminalMemberCount: unique(structureRows.map(structuralMemberKey)).length,
    supportChainClashCount: chainRows.length,
    uniqueSupportChainPairCount: unique(chainRows.map(chainKey)).length,
    structuralRows: structureRows.map((row) => ({
      clashName: row.clashName,
      supportMemberId: rooted(row.support),
      supportFamilyId: normalizeFamily(row.psRoot || row.support),
      steelGroupId: rooted(row.structuralRoot || row.structuralGroup),
      clashPoint: row.point,
      distance: row.distance,
    })),
    supportChainRows: chainRows.map((row) => ({
      clashName: row.clashName,
      supportFamilyId: normalizeFamily(row.psRoot || row.supportA),
      supportA: rooted(row.supportA),
      supportB: rooted(row.supportB),
      distance: row.distance,
      clashPointAvailable: Boolean(row.point),
    })),
  };
}

function engineResult(bundle, standardReference, source) {
  const chain = bundle.supportMemberChain || {};
  const analyticalTerminals = (chain.structuralTerminalEdges || []).filter((row) => (
    row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE'
    && row.contactEvidenceStatus === 'ANALYTICAL_CONTACT_CANDIDATE'
  ));
  const referenceChainKeys = new Set(source.supportChainRows.map((row) => pairKey(row.supportA, row.supportB)));
  const analyticalChainKeys = new Set((chain.supportChainEdges || []).map((row) => pairKey(row.supportA, row.supportB)));
  const explicitReferenceKeys = new Set((chain.referenceEdges || []).map((row) => pairKey(row.fromMemberId, row.toMemberId)));
  const terminalReferenceKeys = new Set(source.structuralRows.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId)));
  const analyticalTerminalKeys = new Set(analyticalTerminals.map((row) => memberSteelKey(row.supportMemberId, row.steelGroupId)));
  const structurePath = bundle.supportCarrierToStructurePath || {};
  const restraint = bundle.supportRestraintFunction || {};
  return {
    inputMode: bundle.inputMode,
    bundleSchema: bundle.schema,
    standard: {
      status: standardReference.summary.status,
      structural: standardReference.structural.metrics,
      chain: standardReference.chain.metrics,
      structuralDisagreements: standardReference.structural.disagreements,
      chainDisagreements: standardReference.chain.disagreements,
    },
    analyticalChainMetrics: setMetrics(analyticalChainKeys, referenceChainKeys),
    explicitReferenceChainMetrics: setMetrics(explicitReferenceKeys, referenceChainKeys),
    memberTerminalMetrics: setMetrics(analyticalTerminalKeys, terminalReferenceKeys),
    supportFamilyCount: bundle.summary?.supportFamilyCount || 0,
    steelGroupCount: bundle.summary?.steelGroupCount || 0,
    carrierObjectCount: bundle.summary?.carrierObjectCount || 0,
    analyticalSupportMemberCount: chain.summary?.analyticalMemberCount || 0,
    analyticalSupportChainEdgeCount: chain.summary?.supportChainEdgeCount || 0,
    explicitSupportReferenceEdgeCount: chain.summary?.referenceEdgeCount || 0,
    analyticalStructuralTerminalCount: analyticalTerminals.length,
    completeCarrierToStructurePathCount: structurePath.summary?.completePathCount || 0,
    carrierToStructureExceptionCodes: unique((structurePath.pathExceptions || []).map((row) => row.exceptionCode)),
    functionConfirmedFamilyCount: restraint.summary?.confirmedFamilyCount || 0,
    functionNotProvenFamilyCount: restraint.summary?.notProvenFamilyCount || 0,
    functionExceptionCodes: unique((restraint.functionExceptions || []).map((row) => row.exceptionCode)),
    relationshipRows: (bundle.relationships || []).map((row) => ({
      supportFamilyId: row.supportFamilyId,
      steelGroupId: row.steelGroupId,
      relationshipStatus: row.relationshipStatus,
      relationshipBasis: row.relationshipBasis,
      analyticalGeometryAvailable: row.analyticalGeometryAvailable,
      contactEvidenceStatus: row.contactEvidenceStatus,
    })),
    analyticalChainRows: chain.supportChainEdges || [],
    explicitReferenceRows: chain.referenceEdges || [],
    analyticalTerminalRows: analyticalTerminals,
  };
}

function identifyGaps(strict, control, source) {
  const gaps = [];
  if (strict.standard.structural.recall === 1 && strict.memberTerminalMetrics.recall < 1) {
    gaps.push(gap(
      'FAMILY_LEVEL_STRUCTURAL_MATCH_MASKS_MEMBER_TERMINAL_GAP', 'HIGH',
      'The standard benchmark reports a perfect family-to-steel match after collapsing two XML contacts into one PS-family/steel pair.',
      `Member-level analytical terminal recall is ${strict.memberTerminalMetrics.recall}; ${source.structuralTerminalMemberCount} XML support members contact structure.`,
      'Add member-level structural-terminal precision/recall to the official benchmark and report family-level and member-level results separately.',
    ));
  }
  if (strict.explicitReferenceChainMetrics.recall === 1 && strict.analyticalChainMetrics.recall < 1) {
    gaps.push(gap(
      'CHAIN_RELATIONSHIPS_PRESERVED_BUT_NOT_PHYSICALLY_PROVEN', 'HIGH',
      'All three XML support-chain links survive conversion as explicit references.',
      'The analytical chain remains unproven because the default support-clash XML contains no clash points, member axes or bounds.',
      'Keep reference edges as NOT_PROVEN and obtain staged member geometry; do not promote XML adjacency to physical contact.',
    ));
  }
  if (control.analyticalChainMetrics.recall === 1 && strict.analyticalChainMetrics.recall < 1) {
    gaps.push(gap(
      'SOURCE_GEOMETRY_GAP_CONFIRMED_BY_CONTROL', 'HIGH',
      'The clash-imprinted control reproduces the complete support chain.',
      'The strict conversion cannot reproduce it without inventing geometry, proving that missing source geometry—not pair matching—is the dominant chain gap.',
      'Use the original combined staged JSON/RVM geometry as production input; retain the imprinted model for validation tests only.',
    ));
  }
  if (control.memberTerminalMetrics.recall < 1) {
    gaps.push(gap(
      'STRUCTURAL_TERMINAL_ENGINE_SELECTS_ONE_NEAREST_MEMBER', 'HIGH',
      'The XML reference records two member-to-structure contacts for PS-14396 (.9 and .10).',
      `Even the clash-imprinted control proves only ${control.analyticalStructuralTerminalCount} analytical terminal(s).`,
      'Evaluate all in-contact support members against the selected structural member instead of retaining only the single nearest terminal.',
    ));
  }
  if (!strict.carrierObjectCount) {
    gaps.push(gap(
      'CLASH_XML_HAS_NO_AUTHORITATIVE_CARRIER_OBJECT', 'HIGH',
      'The XML path identifies the line and branch but contains no physical pipe component, carrier axis, diameter or topology ports.',
      'Carrier identity, attachment, connected carrier topology and complete carrier-to-structure paths remain unavailable.',
      'Benchmark carrier/path stages only with the original staged model JSON or an independently generated carrier catalog.',
    ));
  }
  if (!strict.completeCarrierToStructurePathCount) {
    gaps.push(gap(
      'COMPLETE_PATH_NOT_BENCHMARKABLE_FROM_CLASH_XML_ALONE', 'MEDIUM',
      'The clash baseline covers support-chain and structure-contact pairs only.',
      'It cannot validate carrier topology, carrier attachment or the full carrier → support → structure proof path.',
      'Define separate benchmark coverage labels so pair-level XML agreement is never presented as complete-path validation.',
    ));
  }
  if (!strict.functionConfirmedFamilyCount) {
    gaps.push(gap(
      'RESTRAINT_FUNCTION_NOT_BENCHMARKABLE_FROM_DEFAULT_XML', 'MEDIUM',
      'The default clash XML has no authoritative REST/GUIDE/LINE_STOP/HOLD_DOWN/ANCHOR intent or member orientation.',
      'Restraint-function confirmation remains unavailable even when pair relationships match.',
      'Use staged support attributes and geometry for function benchmarking; XML can only serve as a limited contact reference.',
    ));
  }
  gaps.push(gap(
    'CLASH_IMPRINTED_CONTROL_IS_CIRCULAR', 'MEDIUM',
    'The control geometry is constructed from the same clash graph used as the reference.',
    'Its high chain agreement proves engine reproducibility, not independent engineering accuracy.',
    'Never use the control precision/recall as a production quality claim.',
  ));
  return gaps;
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
function structuralFamilyKey(row) { return `${normalizeFamily(row.psRoot || row.support)}::${normalizeSteel(row.structuralRoot || row.structuralGroup)}`; }
function structuralMemberKey(row) { return memberSteelKey(rooted(row.support), rooted(row.structuralRoot || row.structuralGroup)); }
function chainKey(row) { return pairKey(rooted(row.supportA), rooted(row.supportB)); }
function memberSteelKey(member, steel) { return `${normalizeId(member)}::${normalizeId(steel)}`; }
function pairKey(left, right) { return [normalizeId(left), normalizeId(right)].sort().join('::'); }
function normalizeFamily(value) { const match = normalizeId(value).match(/(?:^|\/)(PS-\d+)/u); return match ? match[1] : normalizeId(value); }
function normalizeSteel(value) { const match = normalizeId(value).match(/(?:^|\/)((?:PS|SL)-\d+)/u); return match ? match[1] : normalizeId(value); }
function normalizeId(value) { return rooted(value).toUpperCase(); }
function rooted(value) { const text = String(value || '').trim(); return text ? `/${text.replace(/^\/+/, '')}` : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function round(value) { return Number(value.toFixed(6)); }
