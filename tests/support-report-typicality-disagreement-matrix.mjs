import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import { buildSupportReportBundle } from '../tabs/support-steel-relationship-builder/support-report-engine.js';
import { selectAxisTypicalityMatch } from '../tabs/support-steel-relationship-builder/support-report-axis-typicality.js';
import {
  buildSupportReportTypicalityComparison,
  SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
} from '../tabs/support-steel-relationship-builder/support-report-typicality-projection.js';

export const SUPPORT_REPORT_TYPICALITY_DISAGREEMENT_MATRIX_SCHEMA = 'SupportReportTypicalityDisagreementMatrix.v1';

export function classifyStructuralAxisDisagreement(structural, axis) {
  const structuralCandidate = structural?.result === 'TYPICAL' ? String(structural?.rightFamilyId || '') : '';
  const axisCandidate = axis?.result === 'MATCH' ? String(axis?.rightFamilyId || '') : '';
  const structuralMatch = Boolean(structuralCandidate);
  const axisMatch = Boolean(axisCandidate);
  const structuralReject = structural?.result === 'NO_MATCH';
  const axisReject = axis?.result === 'NO_MATCH';

  if (structuralMatch && axisMatch) {
    return structuralCandidate === axisCandidate
      ? 'A_BOTH_MATCH_SAME_CANDIDATE'
      : 'MATCH_CONFLICT_DIFFERENT_CANDIDATE';
  }
  if (structuralMatch && axisReject) return 'B_STRUCTURAL_MATCH_AXIS_REJECT';
  if (structuralReject && axisMatch) return 'C_STRUCTURAL_REJECT_AXIS_MATCH';
  if (structuralReject && axisReject) return 'D_BOTH_REJECT';
  return `STRUCTURAL_${token(structural?.result || 'UNAVAILABLE')}_AXIS_${token(axis?.result || 'UNAVAILABLE')}`;
}

export function buildStructuralAxisDisagreementMatrix(structuralMatches = [], axisMatches = []) {
  const structuralByFamily = new Map((structuralMatches || []).map((item) => [familyKey(item?.leftFamilyId), item]));
  const axisByFamily = new Map((axisMatches || []).map((item) => [familyKey(item?.leftFamilyId), item]));
  const familyIds = [...new Set([...structuralByFamily.keys(), ...axisByFamily.keys()])].filter(Boolean).sort();
  const entries = familyIds.map((leftFamilyId) => {
    const structural = structuralByFamily.get(leftFamilyId) || null;
    const axis = axisByFamily.get(leftFamilyId) || null;
    const classification = classifyStructuralAxisDisagreement(structural, axis);
    return Object.freeze({
      leftFamilyId,
      classification,
      priorityCalibration: classification === 'B_STRUCTURAL_MATCH_AXIS_REJECT'
        || classification === 'C_STRUCTURAL_REJECT_AXIS_MATCH',
      structural: compactChannel(structural),
      axis: compactChannel(axis),
    });
  });
  return Object.freeze({
    schema: SUPPORT_REPORT_TYPICALITY_DISAGREEMENT_MATRIX_SCHEMA,
    structuralChannel: 'SupportReportTypicalityAudit.v1::structuralMatches',
    axisChannel: 'SupportReportAxisTypicalityAudit.v1::axisTypicalityMatches',
    entries: Object.freeze(entries),
    classificationHistogram: Object.freeze(histogram(entries.map((item) => item.classification))),
    priorityCalibrationCases: Object.freeze(entries.filter((item) => item.priorityCalibration)),
  });
}

export function classifyConservativeTopologyExclusion(left, right) {
  if (!left || !right) return Object.freeze({ excluded: false, reasonCode: 'AXIS_TOPOLOGY_RETAIN_MISSING_FEATURES' });
  if (Number(left.sourceLocationCount || 0) !== Number(right.sourceLocationCount || 0)) return Object.freeze({
    excluded: true,
    reasonCode: 'AXIS_TOPOLOGY_SAFE_EXCLUDE_LOCATION_COUNT',
  });

  if (!traversalTopologyComplete(left) || !traversalTopologyComplete(right)) return Object.freeze({
    excluded: false,
    reasonCode: 'AXIS_TOPOLOGY_RETAIN_TRAVERSAL_INCOMPLETE',
  });
  if (Number(left.sourceTraversalCount || 0) !== Number(right.sourceTraversalCount || 0)) return Object.freeze({
    excluded: true,
    reasonCode: 'AXIS_TOPOLOGY_SAFE_EXCLUDE_TRAVERSAL_COUNT',
  });
  if (!sameArray(left.locationsPerTraversalSpectrum, right.locationsPerTraversalSpectrum)) return Object.freeze({
    excluded: true,
    reasonCode: 'AXIS_TOPOLOGY_SAFE_EXCLUDE_LOCATIONS_PER_TRAVERSAL',
  });

  if (!returnTopologyComplete(left) || !returnTopologyComplete(right)) return Object.freeze({
    excluded: false,
    reasonCode: 'AXIS_TOPOLOGY_RETAIN_RETURN_INCOMPLETE',
  });
  if (!sameArray(left.returnMultiplicitySpectrum, right.returnMultiplicitySpectrum)) return Object.freeze({
    excluded: true,
    reasonCode: 'AXIS_TOPOLOGY_SAFE_EXCLUDE_RETURN_MULTIPLICITY',
  });
  return Object.freeze({ excluded: false, reasonCode: 'AXIS_TOPOLOGY_COMPATIBLE' });
}

export function buildTopologyScreenedAxisSelection(audit = {}) {
  const leftFamilies = audit.leftFamilies || [];
  const rightByFamily = new Map((audit.rightFamilies || []).map((item) => [familyKey(item?.familyId), item]));
  const currentByFamily = new Map((audit.matches || []).map((item) => [familyKey(item?.leftFamilyId), item]));
  const comparisonsByFamily = new Map();
  for (const comparison of audit.familyComparisons || []) {
    const key = familyKey(comparison?.leftFamilyId);
    if (!comparisonsByFamily.has(key)) comparisonsByFamily.set(key, []);
    comparisonsByFamily.get(key).push(comparison);
  }

  const familyDiagnostics = [];
  for (const left of leftFamilies) {
    const leftFamilyId = familyKey(left?.familyId);
    const comparisons = comparisonsByFamily.get(leftFamilyId) || [];
    const retained = [];
    const excluded = [];
    let unassessedCandidateCount = 0;

    for (const comparison of comparisons) {
      const unassessed = comparison?.result === 'REVIEW' || comparison?.result === 'UNAVAILABLE';
      if (unassessed) unassessedCandidateCount += 1;
      const right = rightByFamily.get(familyKey(comparison?.rightFamilyId)) || null;
      const exclusion = unassessed
        ? classifyConservativeTopologyExclusion(left, right)
        : Object.freeze({ excluded: false, reasonCode: 'AXIS_TOPOLOGY_ALREADY_ASSESSED' });
      if (unassessed && exclusion.excluded) {
        excluded.push(Object.freeze({
          rightFamilyId: comparison?.rightFamilyId || '',
          comparisonResult: comparison?.result || 'UNAVAILABLE',
          comparisonReasonCode: comparison?.reasonCode || '',
          rightAuthorityStatus: right?.authorityStatus || 'UNAVAILABLE',
          reasonCode: exclusion.reasonCode,
        }));
      } else {
        retained.push(comparison);
      }
    }

    const current = currentByFamily.get(leftFamilyId) || null;
    const screened = selectAxisTypicalityMatch(left?.familyId || leftFamilyId, retained);
    const currentResult = current?.result || 'UNAVAILABLE';
    const decisivenessUnlocked = ['REVIEW', 'UNAVAILABLE'].includes(currentResult)
      && ['MATCH', 'NO_MATCH'].includes(screened.result);
    familyDiagnostics.push(Object.freeze({
      leftFamilyId,
      leftAuthorityStatus: left?.authorityStatus || 'UNAVAILABLE',
      current: compactChannel(current),
      screened: compactChannel(screened),
      unassessedCandidateCount,
      safelyExcludedCandidateCount: excluded.length,
      retainedUnassessedCandidateCount: retained.filter((item) => item?.result === 'REVIEW' || item?.result === 'UNAVAILABLE').length,
      exclusionReasonHistogram: Object.freeze(histogram(excluded.map((item) => item.reasonCode))),
      excludedCandidates: Object.freeze(excluded),
      decisivenessUnlocked,
    }));
  }

  const unlocked = familyDiagnostics.filter((item) => item.decisivenessUnlocked);
  return Object.freeze({
    familyCount: familyDiagnostics.length,
    unassessedCandidateCount: sum(familyDiagnostics.map((item) => item.unassessedCandidateCount)),
    safelyExcludedCandidateCount: sum(familyDiagnostics.map((item) => item.safelyExcludedCandidateCount)),
    retainedUnassessedCandidateCount: sum(familyDiagnostics.map((item) => item.retainedUnassessedCandidateCount)),
    exclusionReasonHistogram: Object.freeze(mergeHistograms(familyDiagnostics, 'exclusionReasonHistogram')),
    currentSelectedResultHistogram: Object.freeze(histogram(familyDiagnostics.map((item) => item.current.result || 'UNAVAILABLE'))),
    screenedSelectedResultHistogram: Object.freeze(histogram(familyDiagnostics.map((item) => item.screened.result || 'UNAVAILABLE'))),
    decisivenessUnlockedCount: unlocked.length,
    decisivenessUnlockedFamilies: Object.freeze(unlocked),
  });
}

export function summarizeAxisTypicalityAudit(audit = {}) {
  const leftFamilies = audit.leftFamilies || [];
  const rightFamilies = audit.rightFamilies || [];
  const comparisons = audit.familyComparisons || [];
  const matches = audit.matches || [];
  return Object.freeze({
    leftAuthorityStatusHistogram: Object.freeze(histogram(leftFamilies.map((item) => item.authorityStatus || 'UNAVAILABLE'))),
    rightAuthorityStatusHistogram: Object.freeze(histogram(rightFamilies.map((item) => item.authorityStatus || 'UNAVAILABLE'))),
    leftEvidenceGapFlagHistogram: Object.freeze(featureGapHistogram(leftFamilies)),
    rightEvidenceGapFlagHistogram: Object.freeze(featureGapHistogram(rightFamilies)),
    pairResultHistogram: Object.freeze(histogram(comparisons.map((item) => item.result || 'UNAVAILABLE'))),
    pairReasonHistogram: Object.freeze(histogram(comparisons.map((item) => item.reasonCode || 'UNSPECIFIED'))),
    pairAvailabilityHistogram: Object.freeze(histogram(comparisons.map((item) => item.availability?.result || 'UNAVAILABLE'))),
    selectedResultHistogram: Object.freeze(histogram(matches.map((item) => item.result || 'UNAVAILABLE'))),
    selectedReasonHistogram: Object.freeze(histogram(matches.map((item) => item.reasonCode || 'UNSPECIFIED'))),
    selectedCandidateCountHistogram: Object.freeze(histogram(matches.map((item) => String((item.candidateFamilyIds || []).length)))),
    topologyScreen: buildTopologyScreenedAxisSelection(audit),
  });
}

function compactChannel(match) {
  if (!match) return Object.freeze({
    result: 'UNAVAILABLE', reasonCode: '', candidateFamilyId: '', candidateFamilyIds: Object.freeze([]),
    unavailableCandidateFamilyIds: Object.freeze([]), bestCandidateFamilyId: '', failedReasonCodes: Object.freeze([]),
  });
  return Object.freeze({
    result: match.result || 'UNAVAILABLE',
    reasonCode: match.reasonCode || '',
    candidateFamilyId: match.rightFamilyId || '',
    candidateFamilyIds: Object.freeze([...(match.candidateFamilyIds || [])]),
    unavailableCandidateFamilyIds: Object.freeze([...(match.unavailableCandidateFamilyIds || [])]),
    bestCandidateFamilyId: match.bestCandidateFamilyId || '',
    failedReasonCodes: Object.freeze([...(match.failedReasonCodes || [])]),
  });
}

function featureGapHistogram(families) {
  const flags = [];
  for (const family of families || []) {
    if (!Number(family?.trustedTraversalCount || 0)) flags.push('NO_TRUSTED_TRAVERSAL_AXIS');
    if (!Number(family?.normalizedPairCount || 0) && !Number(family?.relativeAxisAngleCount || 0)) {
      flags.push('NO_INTRINSIC_GEOMETRY');
    }
    if (Number(family?.unavailableTraversalCount || 0) > 0) flags.push('UNAVAILABLE_TRAVERSAL');
    if (Number(family?.ambiguousGroupTraversalCount || 0) > 0) flags.push('AMBIGUOUS_GROUP_TRAVERSAL');
    if (Number(family?.missingBorePairOpportunityCount || 0) > 0) flags.push('MISSING_BORE_PAIR_OPPORTUNITY');
    if (family?.authorityStatus === 'COMPLETE') flags.push('COMPLETE_AUTHORITY');
  }
  return histogram(flags);
}

function histogram(values) {
  const counts = new Map();
  for (const value of values || []) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function mergeHistograms(items, key) {
  const counts = new Map();
  for (const item of items || []) {
    for (const [label, count] of Object.entries(item?.[key] || {})) {
      counts.set(label, (counts.get(label) || 0) + Number(count || 0));
    }
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function traversalTopologyComplete(family) {
  return Number(family?.ambiguousGroupTraversalCount || 0) === 0
    && Number(family?.sourceTraversalCount || 0) > 0;
}

function returnTopologyComplete(family) {
  if (!traversalTopologyComplete(family)) return false;
  return sum(family?.returnMultiplicitySpectrum || []) === Number(family?.sourceTraversalCount || 0);
}

function sameArray(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function sum(values) {
  return (values || []).reduce((total, value) => total + Number(value || 0), 0);
}

function familyKey(value) {
  return String(value || '').trim().toUpperCase();
}

function token(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/gu, '_').replace(/^_+|_+$/gu, '') || 'UNAVAILABLE';
}

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

function loadXml(path, root) {
  const evidence = parseSupportReportClashXml(readFileSync(path, 'utf8'));
  return Object.freeze({
    name: relative(root, path),
    evidence,
    report: buildSupportReportBundle({ clashEvidence: evidence }),
  });
}

function summarizePair(left, right) {
  const audit = buildSupportReportTypicalityComparison(left.evidence, right.evidence, {
    leftReportBundle: left.report,
    rightReportBundle: right.report,
    profile: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL,
  });
  return Object.freeze({
    leftXml: left.name,
    rightXml: right.name,
    profileId: audit.profileId,
    matrix: buildStructuralAxisDisagreementMatrix(audit.structuralMatches, audit.axisTypicalityMatches),
    axisDiagnostics: summarizeAxisTypicalityAudit(audit.axisTypicalityAudit),
  });
}

export function runStructuralAxisDisagreementMatrix(leftRoot, rightRoot) {
  const leftFiles = xmlFiles(leftRoot).map((path) => loadXml(path, leftRoot));
  const rightFiles = xmlFiles(rightRoot).map((path) => loadXml(path, rightRoot));
  if (!leftFiles.length || !rightFiles.length) {
    throw new Error(`No XML payloads found: left=${leftFiles.length}, right=${rightFiles.length}`);
  }
  const comparisons = [];
  for (const left of leftFiles) {
    for (const right of rightFiles) comparisons.push(summarizePair(left, right));
  }
  const entries = comparisons.flatMap((comparison) => comparison.matrix.entries.map((entry) => ({
    leftXml: comparison.leftXml,
    rightXml: comparison.rightXml,
    ...entry,
  })));
  const priorityCalibrationCases = entries.filter((item) => item.priorityCalibration);
  const axisDiagnostics = comparisons.map((item) => item.axisDiagnostics);
  const topologyScreens = axisDiagnostics.map((item) => item.topologyScreen);
  return Object.freeze({
    schema: SUPPORT_REPORT_TYPICALITY_DISAGREEMENT_MATRIX_SCHEMA,
    profileId: SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL.profileId,
    leftArchive: basename(leftRoot),
    rightArchive: basename(rightRoot),
    leftXmlCount: leftFiles.length,
    rightXmlCount: rightFiles.length,
    comparisons: Object.freeze(comparisons),
    diagnostics: Object.freeze({
      familyDecisionCount: entries.length,
      classificationHistogram: Object.freeze(histogram(entries.map((item) => item.classification))),
      priorityCalibrationCaseCount: priorityCalibrationCases.length,
      priorityCalibrationCases: Object.freeze(priorityCalibrationCases),
      axis: Object.freeze({
        leftAuthorityStatusHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'leftAuthorityStatusHistogram')),
        rightAuthorityStatusHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'rightAuthorityStatusHistogram')),
        leftEvidenceGapFlagHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'leftEvidenceGapFlagHistogram')),
        rightEvidenceGapFlagHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'rightEvidenceGapFlagHistogram')),
        pairResultHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'pairResultHistogram')),
        pairReasonHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'pairReasonHistogram')),
        pairAvailabilityHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'pairAvailabilityHistogram')),
        selectedResultHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'selectedResultHistogram')),
        selectedReasonHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'selectedReasonHistogram')),
        selectedCandidateCountHistogram: Object.freeze(mergeHistograms(axisDiagnostics, 'selectedCandidateCountHistogram')),
        topologyScreen: Object.freeze({
          unassessedCandidateCount: sum(topologyScreens.map((item) => item?.unassessedCandidateCount)),
          safelyExcludedCandidateCount: sum(topologyScreens.map((item) => item?.safelyExcludedCandidateCount)),
          retainedUnassessedCandidateCount: sum(topologyScreens.map((item) => item?.retainedUnassessedCandidateCount)),
          exclusionReasonHistogram: Object.freeze(mergeHistograms(topologyScreens, 'exclusionReasonHistogram')),
          currentSelectedResultHistogram: Object.freeze(mergeHistograms(topologyScreens, 'currentSelectedResultHistogram')),
          screenedSelectedResultHistogram: Object.freeze(mergeHistograms(topologyScreens, 'screenedSelectedResultHistogram')),
          decisivenessUnlockedCount: sum(topologyScreens.map((item) => item?.decisivenessUnlockedCount)),
          decisivenessUnlockedFamilies: Object.freeze(topologyScreens.flatMap((item) => item?.decisivenessUnlockedFamilies || [])),
        }),
      }),
    }),
  });
}

function main() {
  const [leftRoot, rightRoot, outputPath = '/tmp/typicality-disagreement-matrix.json'] = process.argv.slice(2);
  if (!leftRoot || !rightRoot) {
    throw new Error('Usage: node support-report-typicality-disagreement-matrix.mjs <leftDir> <rightDir> [outputJson]');
  }
  const result = runStructuralAxisDisagreementMatrix(leftRoot, rightRoot);
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`TYPICALITY_DISAGREEMENT_MATRIX=${JSON.stringify({
    schema: result.schema,
    profileId: result.profileId,
    familyDecisionCount: result.diagnostics.familyDecisionCount,
    classificationHistogram: result.diagnostics.classificationHistogram,
    priorityCalibrationCaseCount: result.diagnostics.priorityCalibrationCaseCount,
    priorityCalibrationCases: result.diagnostics.priorityCalibrationCases.slice(0, 50),
    axis: result.diagnostics.axis,
  })}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath && import.meta.url === invokedPath) main();
