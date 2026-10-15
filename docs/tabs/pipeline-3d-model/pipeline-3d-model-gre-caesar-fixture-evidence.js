import {
  PIPELINE_GRE_CAESAR_FIXTURE_CASES,
  PIPELINE_GRE_CAESAR_FIXTURE_EVIDENCE_SCHEMA,
  clonePipelineGreCaesarQualificationValue as clone,
  createPipelineGreCaesarDiagnostic as diagnostic,
  createPipelineGreCaesarFixtureEvidenceRecord,
  safePipelineGreCaesarQualificationInput as safe,
} from './pipeline-3d-model-gre-caesar-qualification-contracts.js';

export { PIPELINE_GRE_CAESAR_FIXTURE_EVIDENCE_SCHEMA };
export const PIPELINE_GRE_CAESAR_AUDITED_VERSIONS = Object.freeze(['14.00', '15.00']);
export const PIPELINE_GRE_CAESAR_CURVATURE_ROLES = Object.freeze([
  'USER_MIDPOINT', 'CAESAR_DERIVED_NEAR_POINT', 'CAESAR_FAR_POINT', 'OTHER_AUTHENTICATED',
]);

const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const sha256 = (value) => /^[a-f0-9]{64}$/.test(text(value));
const commitSha = (value) => /^[a-f0-9]{40}$/.test(text(value));
const lexicalMatches = (lexical, numeric) => text(lexical) && Number(text(lexical)) === numeric;

function requiredArtifact(value, blocker, fixtureId, errors) {
  if (!sha256(value)) errors.push(diagnostic(blocker, { fixtureId }));
}

function evidenceIdentity(value, source) {
  return plain(value) && text(value.evidenceId) && text(value.sourceReference)
    && text(value.caesarVersion) === text(source.caesarVersion)
    && text(value.caesarBuild) === text(source.caesarBuild)
    && sha256(value.operatorLogSha256) && value.operatorLogSha256 === source.operatorLogSha256;
}

function importEvidenceValid(source, errors) {
  const evidence = source.importEvidence, fixtureId = text(source.fixtureId);
  const result = evidence?.result;
  const arrays = Array.isArray(evidence?.warnings) && Array.isArray(evidence?.errors);
  const base = evidence?.status === 'PROVEN' && evidenceIdentity(evidence, source)
    && sha256(evidence?.importedJobSha256) && evidence.importedJobSha256 === source.importedJobSha256
    && ['ACCEPTED', 'REJECTED'].includes(result) && arrays;
  if (!base || (result === 'REJECTED' && source.fixtureCaseId !== 'F6')) {
    errors.push(diagnostic('PIPELINE_GRE_CAESAR_IMPORT_NOT_PROVEN', { fixtureId })); return false;
  }
  const clean = result === 'ACCEPTED' && evidence.cleanImport === true
    && evidence.warnings.length === 0 && evidence.errors.length === 0;
  const rejected = result === 'REJECTED' && evidence.cleanImport === false
    && evidence.errors.length > 0;
  if (!clean && !rejected) errors.push(diagnostic('PIPELINE_GRE_CAESAR_IMPORT_WARNING_UNRESOLVED', { fixtureId }));
  return clean || rejected;
}

const comparisonFields = Object.freeze([
  'ownershipPreserved', 'connectivityPreserved', 'nodeRolesPreserved', 'radiusPreserved',
  'fittingThicknessPreserved', 'typePreserved', 'numMiterPreserved',
  'curvatureNodesPreserved', 'numEltPreserved', 'numBendPreserved',
  'unitsPreserved', 'codeContextPreserved', 'laminatePreserved',
]);

function roundTripEvidenceValid(source, errors) {
  const evidence = source.roundTripEvidence, fixtureId = text(source.fixtureId);
  if (source.importEvidence?.result === 'REJECTED') {
    const valid = evidence?.status === 'NOT_APPLICABLE' && text(evidence.sourceReference);
    if (!valid) errors.push(diagnostic('PIPELINE_GRE_CAESAR_ROUND_TRIP_NOT_PROVEN', { fixtureId }));
    return valid;
  }
  const comparison = evidence?.comparison;
  const complete = plain(comparison) && comparisonFields.every((field) => comparison[field] === true)
    && sha256(comparison.identityMapSha256);
  const valid = evidence?.status === 'PROVEN' && evidenceIdentity(evidence, source)
    && evidence.semanticEquivalent === true && sha256(evidence.reexportSha256)
    && evidence.reexportSha256 === source.reexportSha256;
  if (!valid) errors.push(diagnostic('PIPELINE_GRE_CAESAR_ROUND_TRIP_NOT_PROVEN', { fixtureId }));
  if (!complete) errors.push(diagnostic('PIPELINE_GRE_CAESAR_ROUND_TRIP_COMPARISON_INCOMPLETE', { fixtureId }));
  return valid && complete;
}

function bendRecordValid(record) {
  if (!plain(record) || !text(record.bendRecordId) || !text(record.ownerElementId)
    || !positiveInteger(record.ownerFromNode) || !positiveInteger(record.ownerToNode)
    || !(Number(record.radius) > 0) || typeof record.typeAttributePresent !== 'boolean'
    || typeof record.numMiterAttributePresent !== 'boolean') return false;
  if (record.typeAttributePresent && (!Number.isFinite(record.typeValue)
    || !lexicalMatches(record.typeLexicalValue, record.typeValue))) return false;
  if (record.numMiterAttributePresent && (!Number.isFinite(record.numMiterValue)
    || !lexicalMatches(record.numMiterLexicalValue, record.numMiterValue))) return false;
  const nodes = Array.isArray(record.curvatureNodes) ? record.curvatureNodes : [];
  return nodes.every((item) => plain(item) && Number.isFinite(item.angle)
    && positiveInteger(item.node) && PIPELINE_GRE_CAESAR_CURVATURE_ROLES.includes(item.role));
}

function continuityRecordValid(record) {
  if (!plain(record) || !text(record.continuityRecordId) || !text(record.enteringElementId)
    || !text(record.leavingElementId) || record.bendOwnerElementId !== record.enteringElementId
    || !positiveInteger(record.enteringFromNode) || !positiveInteger(record.enteringToNode)
    || !positiveInteger(record.leavingFromNode) || !positiveInteger(record.leavingToNode)
    || !positiveInteger(record.incomingTangencyNode) || !positiveInteger(record.outgoingTangencyNode)
    || !positiveInteger(record.inactiveCornerNode) || record.inactiveCornerSerialized !== false
    || typeof record.sharedLogicalNode !== 'boolean' || !text(record.observedTopologyMode)) return false;
  if (record.observedTopologyMode === 'TANGENCY_SEPARATED_BRIDGE') return !record.sharedLogicalNode
    && record.enteringToNode === record.incomingTangencyNode
    && record.leavingFromNode === record.outgoingTangencyNode
    && record.enteringToNode !== record.leavingFromNode;
  if (['CONSECUTIVE_SHARED_LOGICAL_NODE', 'CAESAR_FAR_POINT_SHARED_NODE']
    .includes(record.observedTopologyMode)) return record.sharedLogicalNode
    && record.enteringToNode === record.leavingFromNode;
  return false;
}

function missingAuthority(source) {
  const errors = [], fixtureId = text(source.fixtureId);
  if (!text(source.fixtureId) || !text(source.fixturePath) || !sha256(source.fixtureSha256)
    || !PIPELINE_GRE_CAESAR_FIXTURE_CASES.includes(text(source.fixtureCaseId))) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED', { fixtureId }));
  if (!PIPELINE_GRE_CAESAR_AUDITED_VERSIONS.includes(text(source.caesarVersion))
    || text(source.xmlVersion) !== text(source.caesarVersion)) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_VERSION_UNRESOLVED', { fixtureId }));
  if (!text(source.caesarBuild)) errors.push(diagnostic('PIPELINE_GRE_CAESAR_BUILD_UNRESOLVED', { fixtureId }));
  if (!text(source.pipingCodeId)) errors.push(diagnostic('PIPELINE_GRE_CAESAR_CODE_ID_UNRESOLVED', { fixtureId }));
  if (!text(source.pipingCodeEdition)) errors.push(diagnostic('PIPELINE_GRE_CAESAR_CODE_EDITION_UNRESOLVED', { fixtureId }));
  if (!text(source.laminateClassification)) errors.push(diagnostic('PIPELINE_GRE_CAESAR_LAMINATE_UNRESOLVED', { fixtureId }));
  if (!text(source.unitFileId) || !sha256(source.unitFileSha256)) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_UNIT_FILE_UNRESOLVED', { fixtureId }));
  requiredArtifact(source.nativeJobSha256, 'PIPELINE_GRE_CAESAR_NATIVE_JOB_UNAUTHENTICATED', fixtureId, errors);
  requiredArtifact(source.importedJobSha256, 'PIPELINE_GRE_CAESAR_NATIVE_JOB_UNAUTHENTICATED', fixtureId, errors);
  requiredArtifact(source.operatorLogSha256, 'PIPELINE_GRE_CAESAR_OPERATOR_LOG_UNAUTHENTICATED', fixtureId, errors);
  if (!commitSha(source.sourceCommitSha)) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_SOURCE_COMMIT_UNRESOLVED', { fixtureId }));
  return errors;
}

export function createPipelineGreCaesarFixtureEvidence(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.diagnostics,
    ...missingAuthority(source)];
  const bends = Array.isArray(source.bendRecords) ? source.bendRecords : [];
  const continuity = Array.isArray(source.continuityRecords) ? source.continuityRecords : [];
  if (!positiveInteger(source.elementCount) || !nonnegativeInteger(source.bendCount)
    || bends.length !== source.bendCount || !bends.every(bendRecordValid)
    || continuity.length !== source.bendCount || !continuity.every(continuityRecordValid)) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED', { fixtureId: text(source.fixtureId),
      reason: 'FIXTURE_RECORD_COVERAGE' }));
  importEvidenceValid(source, errors); roundTripEvidenceValid(source, errors);
  return createPipelineGreCaesarFixtureEvidenceRecord({
    fixtureId: text(source.fixtureId), fixtureCaseId: text(source.fixtureCaseId),
    fixturePath: text(source.fixturePath), fixtureSha256: text(source.fixtureSha256),
    fixtureGitBlobSha1: text(source.fixtureGitBlobSha1), sourceCommitSha: text(source.sourceCommitSha),
    sourceClassification: text(source.sourceClassification), caesarVersion: text(source.caesarVersion),
    caesarBuild: text(source.caesarBuild), xmlVersion: text(source.xmlVersion),
    unitFileId: text(source.unitFileId), unitFileSha256: text(source.unitFileSha256),
    nativeJobSha256: text(source.nativeJobSha256), importedJobSha256: text(source.importedJobSha256),
    reexportSha256: text(source.reexportSha256), operatorLogSha256: text(source.operatorLogSha256),
    pipingCodeId: text(source.pipingCodeId), pipingCodeName: text(source.pipingCodeName),
    pipingCodeEdition: text(source.pipingCodeEdition), laminateClassification: text(source.laminateClassification),
    elementCount: nonnegativeInteger(source.elementCount) ? source.elementCount : 0,
    bendCount: nonnegativeInteger(source.bendCount) ? source.bendCount : 0,
    bendRecords: clone(bends), continuityRecords: clone(continuity),
    importEvidence: clone(source.importEvidence || {}), roundTripEvidence: clone(source.roundTripEvidence || {}),
    authorityLevel: text(source.authorityLevel), sourceReferences: clone(source.sourceReferences || []),
  }, errors);
}

export function createRepositoryGreInputXmlFixtureEvidence() {
  return createPipelineGreCaesarFixtureEvidence({ fixtureId: 'repo-gre-inputxml-v14', fixtureCaseId: '',
    fixturePath: 'docs/GREInputxml.xml', fixtureSha256: '', fixtureGitBlobSha1: 'e7dc8ff9b1082d489609980bb495ced048a81679',
    sourceCommitSha: '', sourceClassification: 'CAESAR_EXPORTED_REPOSITORY_FIXTURE', caesarVersion: '14.00',
    caesarBuild: '', xmlVersion: '14.00', unitFileId: '', unitFileSha256: '', nativeJobSha256: '',
    importedJobSha256: '', reexportSha256: '', operatorLogSha256: '', pipingCodeId: '36',
    pipingCodeName: '', pipingCodeEdition: '', laminateClassification: '', elementCount: 100, bendCount: 12,
    bendRecords: [{ bendRecordId: 'repo-gre-inputxml-v14:representative:1450-1500', ownerElementId: '1450-1500',
      ownerFromNode: 1450, ownerToNode: 1500, radius: 1206, typeAttributePresent: true, typeValue: 3,
      typeLexicalValue: '3', numMiterAttributePresent: true, numMiterValue: -1.0101,
      numMiterLexicalValue: '-1.0101', fittingThicknessAttributePresent: true,
      fittingThicknessValue: -1.0101, curvatureNodes: [
        { angle: -2.0202, node: 1499, role: 'OTHER_AUTHENTICATED' },
        { angle: 0, node: 1498, role: 'OTHER_AUTHENTICATED' }], recordCoverage: 'REPRESENTATIVE_ONLY' }],
    continuityRecords: [{ continuityRecordId: 'repo-gre-inputxml-v14:continuity:1500',
      enteringElementId: '1450-1500', leavingElementId: '1500-1550', bendOwnerElementId: '1450-1500',
      enteringFromNode: 1450, enteringToNode: 1500, leavingFromNode: 1500, leavingToNode: 1550,
      incomingTangencyNode: 1450, outgoingTangencyNode: 1550, inactiveCornerNode: 1490,
      inactiveCornerSerialized: false, sharedLogicalNode: true,
      observedTopologyMode: 'CONSECUTIVE_SHARED_LOGICAL_NODE' }],
    importEvidence: { status: 'MISSING' }, roundTripEvidence: { status: 'MISSING' },
    authorityLevel: 'REPOSITORY_EXPORT_OBSERVATION', sourceReferences: ['docs/GREInputxml.xml'],
  });
}

export function buildPipelineGreCaesarFixtureInventoryJson(fixtures) {
  const ordered = [...fixtures].sort((a, b) => a.fixtureId < b.fixtureId ? -1 : a.fixtureId > b.fixtureId ? 1 : 0);
  return JSON.stringify({ schema: 'PipelineGreCaesarFixtureInventory.v2', fixtures: ordered }, null, 2);
}
