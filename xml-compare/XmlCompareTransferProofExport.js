import { createTransferProof } from './XmlCompareTransferProofModel.js';
import { summarizeTransferOutput } from './XmlCompareTransferOutputModel.js';

export const XML_COMPARE_TRANSFER_PROOF_EXPORT_SCHEMA = 'xml-compare-transfer-proof/v1';
const clean = (value) => String(value ?? '').trim();

export function createTransferProofExport({ input = {}, tState = {}, generatedAt = null, exportedFileName = '' } = {}) {
  const summary = summarizeTransferOutput({ input, tState, lastAction: 'export-proof' });
  const proof = createTransferProof({ transferAudit: tState.transferAudit, postTransferValidation: tState.postTransferValidation, transferLastResult: tState.transferLastResult, generatedAt });
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_PROOF_EXPORT_SCHEMA,
    generatedAt: clean(generatedAt || proof.generatedAt),
    sourceFileName: summary.sourceFileName,
    targetFileName: summary.targetFileName,
    scope: summary.scope,
    selectedBlocks: summary.selectedBlocks,
    updatedCount: proof.updatedCount,
    skippedCount: proof.skippedCount,
    blockedCount: proof.blockedCount,
    blockedReasons: summary.blockedReasons,
    exportedFileName: clean(exportedFileName || summary.fileNames.transferProofJson),
    patchedTargetAvailable: summary.hasPatchedTargetText,
    exportSucceeded: Boolean(tState.transferStage || tState.transferAudit || tState.transferLastResult),
    hierarchyConnectorAnchorMutatedByExport: false,
    proof,
  });
}

export function serializeTransferProofExportJson(payload = {}) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const _test = Object.freeze({ clean });
