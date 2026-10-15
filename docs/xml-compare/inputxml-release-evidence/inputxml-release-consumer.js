/**
 * Functionality: validate and compare manifest-selected InputXML release evidence.
 * Parameters: exact file maps and an explicit selected-output manifest file name.
 * Outputs: release eligibility plus normalized and semantic/topological differences in separate groups.
 * Fallback: manifest-free inputs remain visible only as LEGACY_UNVERIFIED.
 */
import { readInputXmlReleaseEvidence } from '../../vendor/3d-converters/inputxml-v2/readers/inputxml-release-evidence-reader.js';

function selectedHash(evidence, role) {
  return evidence.manifest?.artifacts?.[role]?.sha256 || null;
}

function difference(label, baseline, candidate) {
  return baseline === candidate ? null : Object.freeze({ label, baseline, candidate });
}

function normalizedComparison(baseline, candidate) {
  return Object.freeze([
    difference('normalization plan', selectedHash(baseline, 'normalizationPlan'), selectedHash(candidate, 'normalizationPlan')),
    difference('canonical InputXML bytes', selectedHash(baseline, 'canonicalInputXml'), selectedHash(candidate, 'canonicalInputXml')),
  ].filter(Boolean));
}

function topologyComparison(baseline, candidate) {
  return Object.freeze([
    difference('canonical topology', selectedHash(baseline, 'canonicalTopology'), selectedHash(candidate, 'canonicalTopology')),
    difference('numbered topology projection', selectedHash(baseline, 'numberedTopologyProjection'), selectedHash(candidate, 'numberedTopologyProjection')),
    difference('topology parity report', selectedHash(baseline, 'topologyParityReport'), selectedHash(candidate, 'topologyParityReport')),
  ].filter(Boolean));
}

export async function validateInputXmlReleaseEvidence(filesByName, manifestFileName) {
  return await readInputXmlReleaseEvidence(filesByName, manifestFileName);
}

export async function compareInputXmlReleaseEvidence(baselineFiles, candidateFiles, manifestFileName) {
  const baseline = await validateInputXmlReleaseEvidence(baselineFiles, manifestFileName);
  const candidate = await validateInputXmlReleaseEvidence(candidateFiles, manifestFileName);
  const releaseValidated = baseline.releaseValidated && candidate.releaseValidated;
  return Object.freeze({
    releaseValidated,
    classification: releaseValidated ? 'RELEASE_VALIDATED_V2_COMPARISON' : 'LEGACY_UNVERIFIED_COMPARISON',
    normalizedDifferences: normalizedComparison(baseline, candidate),
    semanticTopologyDifferences: topologyComparison(baseline, candidate),
  });
}
