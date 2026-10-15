import { summarizeTransferOutput } from './XmlCompareTransferOutputModel.js';

export const XML_COMPARE_TRANSFER_ARTIFACT_MANIFEST_SCHEMA = 'xml-compare-transfer-artifact-manifest/v1';
const clean = (value) => String(value ?? '').trim();

export function transferArtifactFileNames(summary = {}) {
  const fileNames = summary.fileNames || {};
  const patched = clean(fileNames.patchedTargetXml || 'xml_compare_patched_target.xml');
  const base = patched.replace(/_patched_target\.xml$/i, '') || 'xml_compare';
  return Object.freeze({
    patchedTargetXml: patched,
    transferAuditJson: clean(fileNames.transferAuditJson || `${base}_transfer_audit.json`),
    transferProofJson: clean(fileNames.transferProofJson || `${base}_transfer_proof.json`),
    transferManifestJson: `${base}_transfer_manifest.json`,
  });
}

export function createTransferArtifactManifest({ input = {}, tState = {}, summary = null, auditPayload = null, proofPayload = null, generatedAt = null } = {}) {
  const out = summary || summarizeTransferOutput({ input, tState, lastAction: 'export-bundle' });
  const files = transferArtifactFileNames(out);
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_ARTIFACT_MANIFEST_SCHEMA,
    generatedAt: clean(generatedAt || new Date(0).toISOString()),
    sourceFileName: out.sourceFileName,
    targetFileName: out.targetFileName,
    scope: out.scope,
    selectedBlocks: out.selectedBlocks,
    updatedCount: out.updatedCount,
    skippedCount: out.skippedCount,
    blockedCount: out.blockedCount,
    patchedTargetAvailable: out.hasPatchedTargetText,
    outputStatus: out.outputStatus,
    artifacts: Object.freeze([
      Object.freeze({ kind: 'patched-target-xml', fileName: files.patchedTargetXml, available: out.hasPatchedTargetText }),
      Object.freeze({ kind: 'transfer-audit-json', fileName: files.transferAuditJson, schema: auditPayload?.schema || '', available: Boolean(auditPayload) }),
      Object.freeze({ kind: 'transfer-proof-json', fileName: files.transferProofJson, schema: proofPayload?.schema || '', available: Boolean(proofPayload) }),
      Object.freeze({ kind: 'transfer-manifest-json', fileName: files.transferManifestJson, schema: XML_COMPARE_TRANSFER_ARTIFACT_MANIFEST_SCHEMA, available: true }),
    ]),
    hierarchyConnectorAnchorMutatedByExport: false,
  });
}

export function serializeTransferArtifactManifestJson(manifest = {}) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export const _test = Object.freeze({ clean });
