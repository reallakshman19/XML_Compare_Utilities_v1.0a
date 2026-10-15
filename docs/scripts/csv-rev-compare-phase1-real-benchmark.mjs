import fs from 'node:fs';
import { runPsNoChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase1-benchmark.js';

const [earlierPath, laterPath, outputPath] = process.argv.slice(2);
if (!earlierPath || !laterPath) {
  console.error('usage: node scripts/csv-rev-compare-phase1-real-benchmark.mjs R2.csv R3.csv [output.json]');
  process.exit(2);
}

const earlier = fs.readFileSync(earlierPath, 'utf8');
const later = fs.readFileSync(laterPath, 'utf8');
const result = runPsNoChangeBenchmark(earlier, later);
const summary = {
  schema: result.schema,
  bucket: result.bucket,
  compareStage: result.compareStage,
  compareOk: result.compareOk,
  metrics: result.metrics,
  coordinateFrame: coordinateFrameSummary(result.compareResult?.lineage?.coordinateFrame),
  expectedItems: result.expected,
  detectedItems: result.detected.map((item) => ({
    ...item,
    lineageEvidence: detectedLineageEvidence(item, result.compareResult),
  })),
  mismatchDiagnostics: mismatchDiagnostics(result),
};

const json = JSON.stringify(summary, null, 2);
console.log(json);
if (outputPath) fs.writeFileSync(outputPath, `${json}\n`, 'utf8');
if (result.compareStage === 'CONVERSION_BLOCKED') process.exit(3);
if (!result.compareOk) process.exit(4);
if (result.metrics.falsePositives || result.metrics.falseNegatives) process.exit(5);

function detectedLineageEvidence(item, compare) {
  if (!compare?.sourceModel || !compare?.targetModel) return null;
  const target = compare.targetModel.locations.find((location) => location.supportLocationIdentity === item.key) || null;
  if (!target) return null;
  const edge = (compare.lineage?.edges || []).find((row) => row.targetNodeIds.includes(target.nodeId)) || null;
  if (!edge) return { target: locationSummary(target), edge: null, candidate: null };
  const candidate = selectedCandidate(edge, compare.lineage?.candidates || [], target.nodeId);
  return {
    target: locationSummary(target),
    source: edge.sourceNodeIds.length === 1 ? locationSummary(compare.sourceModel.locationByNodeId.get(edge.sourceNodeIds[0])) : null,
    edge: {
      edgeId: edge.edgeId,
      cardinality: edge.cardinality,
      outcome: edge.outcome,
      matchingMethod: edge.matchingMethod,
      reasonCodes: edge.reasonCodes,
      persistentReferences: edge.persistentReferences,
      candidateScore: edge.candidateScore ?? candidate?.score ?? null,
      scorePolicyId: edge.scorePolicyId || candidate?.scorePolicyId || '',
      scorePolicyVersion: edge.scorePolicyVersion || candidate?.scorePolicyVersion || '',
      coordinateEvidence: edge.coordinateEvidence || [],
    },
    candidate: candidateSummary(candidate),
  };
}

function selectedCandidate(edge, candidates, targetNodeId) {
  const candidateIds = new Set(edge?.candidateIds || []);
  const byId = candidates.find((candidate) => candidateIds.has(candidate.candidateId));
  if (byId) return byId;
  if (edge?.sourceNodeIds?.length !== 1) return null;
  return candidates.find((candidate) => candidate.sourceNodeId === edge.sourceNodeIds[0] && candidate.targetNodeId === targetNodeId) || null;
}

function candidateSummary(candidate) {
  if (!candidate) return null;
  return {
    candidateId: candidate.candidateId,
    outcome: candidate.outcome,
    score: candidate.score,
    eligible: candidate.eligible,
    hardRejected: candidate.hardRejected,
    strongEvidence: candidate.strongEvidence,
    approximateEligible: candidate.approximateEligible,
    approximateSignalCount: candidate.approximateSignalCount,
    matchingMethod: candidate.matchingMethod,
    reasonCodes: candidate.reasonCodes,
    persistentReferences: candidate.persistentReferences,
    scorePolicyId: candidate.scorePolicyId,
    scorePolicyVersion: candidate.scorePolicyVersion,
    weightBreakdown: candidate.weightBreakdown,
    boreEvidence: candidate.evidence?.bore || null,
    coordinateEvidence: candidate.evidence?.coordinate || null,
  };
}

function mismatchDiagnostics(result) {
  const compare = result.compareResult;
  if (!compare?.sourceModel || !compare?.targetModel) return null;
  const falseNegativeKeys = new Set(result.metrics.falseNegativeKeys || []);
  const falsePositiveKeys = new Set(result.metrics.falsePositiveKeys || []);
  return {
    falseNegatives: result.expected.filter((item) => falseNegativeKeys.has(item.key)).map((item) => diagnoseTarget(item, compare)),
    falsePositives: result.detected.filter((item) => falsePositiveKeys.has(item.key)).map((item) => diagnoseTarget(item, compare)),
    unresolvedAmbiguities: (compare.lineage?.ambiguous || []).length,
  };
}

function diagnoseTarget(item, compare) {
  const target = compare.targetModel.locations.find((location) => location.supportLocationIdentity === item.key) || null;
  if (!target) return { item, target: null, candidates: [], sourceAlternatives: [], edges: [] };
  const rawCandidates = (compare.lineage?.candidates || [])
    .filter((candidate) => candidate.targetNodeId === target.nodeId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const candidates = rawCandidates.map((candidate) => ({
    ...candidateSummary(candidate),
    source: locationSummary(compare.sourceModel.locationByNodeId.get(candidate.sourceNodeId)),
  }));
  const sourceAlternatives = rawCandidates.map((candidate) => ({
    source: locationSummary(compare.sourceModel.locationByNodeId.get(candidate.sourceNodeId)),
    targets: (compare.lineage?.candidates || [])
      .filter((row) => row.sourceNodeId === candidate.sourceNodeId)
      .sort((a, b) => b.score - a.score || a.targetNodeId.localeCompare(b.targetNodeId))
      .slice(0, 8)
      .map((row) => ({
        ...candidateSummary(row),
        target: locationSummary(compare.targetModel.locationByNodeId.get(row.targetNodeId)),
      })),
  }));
  const edges = (compare.lineage?.edges || [])
    .filter((edge) => edge.targetNodeIds.includes(target.nodeId))
    .map((edge) => ({
      edgeId: edge.edgeId,
      cardinality: edge.cardinality,
      outcome: edge.outcome,
      matchingMethod: edge.matchingMethod,
      reasonCodes: edge.reasonCodes,
      persistentReferences: edge.persistentReferences,
      coordinateEvidence: edge.coordinateEvidence || [],
      sources: edge.sourceNodeIds.map((nodeId) => locationSummary(compare.sourceModel.locationByNodeId.get(nodeId))),
    }));
  return { item, target: locationSummary(target), candidates, sourceAlternatives, edges };
}

function coordinateFrameSummary(frame) {
  if (!frame) return null;
  return {
    schema: frame.schema,
    policyId: frame.policyId,
    status: frame.status,
    anchorCount: frame.anchorCount,
    anchorBasis: frame.anchorBasis || '',
    scoreMinimumAnchors: frame.scoreMinimumAnchors ?? null,
    scoreFrameUsable: frame.scoreFrameUsable ?? false,
    axes: frame.axes,
  };
}

function locationSummary(location) {
  if (!location) return null;
  return {
    nodeId: location.nodeId,
    rowId: location.sourceRowId,
    identity: location.supportLocationIdentity,
    family: location.family,
    prevName: location.legacyIdentity,
    size: location.size,
    pipe: location.pipe.raw,
    pipeCore: location.pipe.normalizedCore,
    references: location.persistentReferences,
    components: location.components.map((component) => ({ memberId: component.memberId, supportType: component.supportType, reference: component.reference })),
    loadState: location.loads?.state || '',
    loadSlots: (location.loads?.slots || []).filter((slot) => String(slot.raw ?? '').trim()).map((slot) => ({ header: slot.sourceHeader, ordinal: slot.ordinal, raw: slot.raw })),
    totalSupportPoints: location.sourceFields?.totalSupportPoints || '',
    primarySupportDescription: location.sourceFields?.primarySupportDescription || '',
    position: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, location.position?.[axis]?.raw || ''])),
  };
}
