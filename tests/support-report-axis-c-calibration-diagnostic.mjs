import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import {
  buildSupportReportTypicalityComparison,
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

export const SUPPORT_REPORT_AXIS_C_CALIBRATION_SCHEMA = 'SupportReportAxisCCalibrationLedger.v1';

const TARGETS = Object.freeze([
  Object.freeze({ leftFamilyId: 'PS-10235', rightFamilyId: 'PS-12076' }),
  Object.freeze({ leftFamilyId: 'PS-10258', rightFamilyId: 'PS-12005' }),
  Object.freeze({ leftFamilyId: 'PS-10903', rightFamilyId: 'PS-12076' }),
]);

function xmlFiles(root) {
  const out = [];
  function walk(path) {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.xml$/iu.test(name)) out.push(full);
    }
  }
  walk(root);
  return out.sort();
}

function loadSingleXml(root) {
  const files = xmlFiles(root);
  if (files.length !== 1) throw new Error(`Expected exactly one XML in ${root}; found ${files.length}`);
  const path = files[0];
  const evidence = parseSupportReportClashXml(readFileSync(path, 'utf8'));
  return Object.freeze({
    name: relative(root, path),
    evidence,
    report: buildSupportReportBundle({ clashEvidence: evidence }),
  });
}

function compactFamilyFeatures(features) {
  if (!features) return null;
  return Object.freeze({
    familyId: features.familyId,
    authorityStatus: features.authorityStatus,
    sourceLocationCount: features.sourceLocationCount,
    sourceTraversalCount: features.sourceTraversalCount,
    trustedTraversalCount: features.trustedTraversalCount,
    unavailableTraversalCount: features.unavailableTraversalCount,
    ambiguousGroupTraversalCount: features.ambiguousGroupTraversalCount,
    missingBorePairOpportunityCount: features.missingBorePairOpportunityCount,
    locationsPerTraversalSpectrum: features.locationsPerTraversalSpectrum,
    returnMultiplicitySpectrum: features.returnMultiplicitySpectrum,
    dnNormalizedPairSpectrum: features.dnNormalizedPairSpectrum,
    relativeAxisAngleSpectrumDeg: features.relativeAxisAngleSpectrumDeg,
    normalizedPairCount: features.normalizedPairCount,
    relativeAxisAngleCount: features.relativeAxisAngleCount,
    traversalAxisEvidence: features.traversalAxisEvidence,
  });
}

function compactDecision(decision) {
  if (!decision) return null;
  return Object.freeze({
    result: decision.result || '',
    reasonCode: decision.reasonCode || '',
    rightFamilyId: decision.rightFamilyId || '',
    candidateFamilyIds: Object.freeze([...(decision.candidateFamilyIds || [])]),
    bestCandidateFamilyId: decision.bestCandidateFamilyId || '',
    failedReasonCodes: Object.freeze([...(decision.failedReasonCodes || [])]),
  });
}

function histogram(values) {
  const counts = new Map();
  for (const value of values || []) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function matchEvidenceStrength(axisComparison, leftFeatures, rightFeatures) {
  const angleSignal = (axisComparison?.signals || []).find((item) =>
    item.reasonCode === 'AXIS_RELATIVE_ANGLE_WITHIN_TOLERANCE');
  if (angleSignal && angleSignal.result !== 'UNAVAILABLE') return 'RELATIVE_ANGLE_INFORMED';

  const bases = [
    ...(leftFeatures?.traversalAxisEvidence || []),
    ...(rightFeatures?.traversalAxisEvidence || []),
  ].map((item) => item.axisBasis).filter(Boolean);
  if (bases.length && bases.every((item) => item === 'TWO_POINT_AXIS')) return 'SINGLE_TRAVERSAL_TWO_POINT_ONLY';
  if (bases.some((item) => item === 'PCA_BRANCH_AXIS')) return 'SINGLE_TRAVERSAL_PCA_BACKED';
  return 'OTHER_AXIS_EVIDENCE';
}

function structuralRelation(structuralDecision, rightFamilyId) {
  if (structuralDecision?.result === 'TYPICAL' && structuralDecision?.rightFamilyId === rightFamilyId) {
    return 'STRUCTURAL_MATCH_SAME_CANDIDATE';
  }
  if (structuralDecision?.result === 'NO_MATCH') return 'STRUCTURAL_NO_MATCH';
  if (structuralDecision?.result === 'TYPICAL') return 'STRUCTURAL_MATCH_DIFFERENT_CANDIDATE';
  return `STRUCTURAL_${String(structuralDecision?.result || 'UNAVAILABLE')}`;
}

export function buildAxisCCalibrationLedger(left, right) {
  const audit = buildSupportReportTypicalityComparison(left.evidence, right.evidence, {
    leftReportBundle: left.report,
    rightReportBundle: right.report,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });

  const leftFeaturesByFamily = new Map(audit.axisTypicalityAudit.leftFamilies.map((item) => [item.familyId, item]));
  const rightFeaturesByFamily = new Map(audit.axisTypicalityAudit.rightFamilies.map((item) => [item.familyId, item]));
  const structuralDecisionByFamily = new Map(audit.structuralMatches.map((item) => [item.leftFamilyId, item]));
  const structuralComparisonByPair = new Map(audit.familyComparisons.map((item) => [
    `${item.leftFamilyId}::${item.rightFamilyId}`, item,
  ]));

  const cases = TARGETS.map((target) => {
    const leftFeatures = leftFeaturesByFamily.get(target.leftFamilyId) || null;
    const rightFeatures = rightFeaturesByFamily.get(target.rightFamilyId) || null;
    const axisComparison = audit.axisTypicalityAudit.familyComparisons.find((item) =>
      item.leftFamilyId === target.leftFamilyId && item.rightFamilyId === target.rightFamilyId) || null;
    const structuralComparison = structuralComparisonByPair.get(`${target.leftFamilyId}::${target.rightFamilyId}`) || null;
    const structuralDecision = structuralDecisionByFamily.get(target.leftFamilyId) || null;
    const axisDecision = audit.axisTypicalityMatches.find((item) => item.leftFamilyId === target.leftFamilyId) || null;

    if (!leftFeatures || !rightFeatures || !axisComparison || !structuralComparison || !structuralDecision || !axisDecision) {
      throw new Error(`Missing governed calibration evidence for ${target.leftFamilyId} -> ${target.rightFamilyId}`);
    }

    return Object.freeze({
      ...target,
      leftAxisFeatures: compactFamilyFeatures(leftFeatures),
      rightAxisFeatures: compactFamilyFeatures(rightFeatures),
      axisPairComparison: axisComparison,
      structuralPairComparison: structuralComparison,
      structuralFamilyDecision: compactDecision(structuralDecision),
      currentAxisFamilyDecision: compactDecision(axisDecision),
      evidenceStrength: matchEvidenceStrength(axisComparison, leftFeatures, rightFeatures),
    });
  });

  const availableAxisMatches = audit.axisTypicalityAudit.familyComparisons
    .filter((item) => item.result === 'MATCH')
    .map((axisComparison) => {
      const leftFeatures = leftFeaturesByFamily.get(axisComparison.leftFamilyId) || null;
      const rightFeatures = rightFeaturesByFamily.get(axisComparison.rightFamilyId) || null;
      const structuralDecision = structuralDecisionByFamily.get(axisComparison.leftFamilyId) || null;
      const structuralComparison = structuralComparisonByPair.get(
        `${axisComparison.leftFamilyId}::${axisComparison.rightFamilyId}`) || null;
      const evidenceStrength = matchEvidenceStrength(axisComparison, leftFeatures, rightFeatures);
      return Object.freeze({
        leftFamilyId: axisComparison.leftFamilyId,
        rightFamilyId: axisComparison.rightFamilyId,
        evidenceStrength,
        structuralRelation: structuralRelation(structuralDecision, axisComparison.rightFamilyId),
        leftAxisFeatures: compactFamilyFeatures(leftFeatures),
        rightAxisFeatures: compactFamilyFeatures(rightFeatures),
        axisPairComparison: axisComparison,
        structuralPairComparison: structuralComparison,
        structuralFamilyDecision: compactDecision(structuralDecision),
      });
    });

  return Object.freeze({
    schema: SUPPORT_REPORT_AXIS_C_CALIBRATION_SCHEMA,
    profileId: audit.profileId,
    leftXml: left.name,
    rightXml: right.name,
    cases: Object.freeze(cases),
    matchSufficiency: Object.freeze({
      availableAxisMatchCount: availableAxisMatches.length,
      evidenceStrengthHistogram: Object.freeze(histogram(availableAxisMatches.map((item) => item.evidenceStrength))),
      structuralRelationHistogram: Object.freeze(histogram(availableAxisMatches.map((item) => item.structuralRelation))),
      pairs: Object.freeze(availableAxisMatches),
    }),
  });
}

function main() {
  const [leftRoot, rightRoot, outputPath = '/tmp/support-report-axis-c-calibration.json'] = process.argv.slice(2);
  if (!leftRoot || !rightRoot) {
    throw new Error('Usage: node support-report-axis-c-calibration-diagnostic.mjs <leftDir> <rightDir> [outputJson]');
  }
  const result = buildAxisCCalibrationLedger(loadSingleXml(leftRoot), loadSingleXml(rightRoot));
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`AXIS_C_CALIBRATION=${JSON.stringify({
    schema: result.schema,
    profileId: result.profileId,
    cases: result.cases.map((item) => ({
      leftFamilyId: item.leftFamilyId,
      rightFamilyId: item.rightFamilyId,
      structuralResult: item.structuralFamilyDecision?.result || '',
      axisPairResult: item.axisPairComparison?.result || '',
      axisPairReasonCode: item.axisPairComparison?.reasonCode || '',
      evidenceStrength: item.evidenceStrength,
      signals: item.axisPairComparison?.signals || [],
    })),
    matchSufficiency: {
      availableAxisMatchCount: result.matchSufficiency.availableAxisMatchCount,
      evidenceStrengthHistogram: result.matchSufficiency.evidenceStrengthHistogram,
      structuralRelationHistogram: result.matchSufficiency.structuralRelationHistogram,
    },
  })}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath && import.meta.url === invokedPath) main();
