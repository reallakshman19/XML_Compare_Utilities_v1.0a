/** Workspace-owned receipt integrity and detached-signature verification lifecycle. */
import {
  REVISION_RESPONSIVENESS_RECEIPT_MAX_BYTES,
  completeRevisionResponsivenessReceiptVerification,
  createRevisionResponsivenessReceiptVerificationState,
  failRevisionResponsivenessReceiptVerification,
  revisionResponsivenessReceiptVerificationModel,
  startRevisionResponsivenessReceiptVerification,
  verifyRevisionResponsivenessObservationReceiptJson,
} from './revision-responsiveness-observation-receipt-import.js';
import {
  REVISION_RESPONSIVENESS_SIGNATURE_MAX_BYTES,
  completeRevisionResponsivenessSignatureImport,
  createRevisionResponsivenessSignatureState,
  failRevisionResponsivenessSignatureImport,
  revisionResponsivenessSignatureModel,
  startRevisionResponsivenessSignatureImport,
  verifyRevisionResponsivenessSignatureReceiptJson,
} from './revision-responsiveness-receipt-signature.js';
import { renderRevisionResponsivenessReceiptVerificationSection } from './revision-responsiveness-receipt-verification-view.js';
import { renderRevisionResponsivenessSignatureSection } from './revision-responsiveness-receipt-signature-view.js';

async function importReceiptFile(context, file) {
  const generation = context.receiptState().generation + 1;
  context.setReceiptState(startRevisionResponsivenessReceiptVerification(context.receiptState(), generation, file?.name));
  context.setSignatureState(createRevisionResponsivenessSignatureState()); context.render();
  try {
    if (!file) throw new TypeError('Select a responsiveness observation receipt.');
    if (file.size > REVISION_RESPONSIVENESS_RECEIPT_MAX_BYTES) throw new RangeError('Responsiveness receipt is limited to 256 KiB.');
    const verification = await verifyRevisionResponsivenessObservationReceiptJson(await file.text(), context.cryptoRef);
    if (context.destroyed()) return;
    const current = context.receiptState(); const next = completeRevisionResponsivenessReceiptVerification(current, generation, verification);
    if (next === current) return; context.setReceiptState(next); context.render();
    context.showToast?.('Responsiveness receipt structure and ID verified.', 'success');
  } catch (error) {
    if (context.destroyed()) return;
    const current = context.receiptState(); const next = failRevisionResponsivenessReceiptVerification(current, generation, error);
    if (next === current) return; context.setReceiptState(next); context.render(); context.reportFailure(error);
  }
}

async function importSignatureFile(context, file) {
  const generation = context.nextSignatureGeneration();
  context.setSignatureState(startRevisionResponsivenessSignatureImport(context.signatureState(), generation, file?.name)); context.render();
  try {
    const target = context.retainedReceipt();
    if (!target) throw new TypeError('Verify a responsiveness observation receipt before importing its detached signature.');
    if (!file) throw new TypeError('Select a responsiveness signature receipt.');
    if (file.size > REVISION_RESPONSIVENESS_SIGNATURE_MAX_BYTES) throw new RangeError('Responsiveness signature receipt is limited to 256 KiB.');
    const receipt = await verifyRevisionResponsivenessSignatureReceiptJson(await file.text(), target, context.cryptoRef);
    if (context.destroyed()) return;
    const current = context.signatureState(); const next = completeRevisionResponsivenessSignatureImport(current, generation, receipt);
    if (next === current) return; context.setSignatureState(next); context.render();
    context.showToast?.('Responsiveness receipt signature verified.', 'success');
  } catch (error) {
    if (context.destroyed()) return;
    const current = context.signatureState(); const next = failRevisionResponsivenessSignatureImport(current, generation, error);
    if (next === current) return; context.setSignatureState(next); context.render(); context.reportFailure(error);
  }
}

export function createRevisionResponsivenessReceiptVerificationWorkspace(options) {
  let state = createRevisionResponsivenessReceiptVerificationState();
  let signatureState = createRevisionResponsivenessSignatureState(); let signatureGeneration = 0; let destroyed = false;
  const retainedReceipt = () => state.verification?.receipt ?? null;
  const model = () => revisionResponsivenessReceiptVerificationModel(state, options.readCurrentInput());
  const signatureModel = () => revisionResponsivenessSignatureModel(signatureState, retainedReceipt(), model());
  const context = {
    cryptoRef: options.cryptoRef, destroyed: () => destroyed, receiptState: () => state, signatureState: () => signatureState,
    retainedReceipt, render: options.renderWorkspace, reportFailure: options.reportFailure, showToast: options.showToast,
    nextSignatureGeneration: () => { signatureGeneration += 1; return signatureGeneration; },
    setReceiptState: (value) => { state = value; }, setSignatureState: (value) => { signatureState = value; },
  };
  function attachment() {
    const current = model(); const receipt = retainedReceipt();
    return current.status === 'VERIFIED_CURRENT' && receipt ? Object.freeze({ status: current.status, runId: receipt.observation.runId, receipt }) : null;
  }
  function matchesAttachment(value) {
    const current = attachment();
    return Boolean(current && value && current.runId === value.runId
      && current.receipt.receiptId === value.receipt?.receiptId
      && current.receipt.contentSha256 === value.receipt?.contentSha256);
  }
  return Object.freeze({
    attachment, matchesAttachment, model, signatureModel,
    importFile: (file, subtype = 'receipt') => (subtype === 'signature' ? importSignatureFile(context, file) : importReceiptFile(context, file)),
    render() {
      renderRevisionResponsivenessReceiptVerificationSection(options.root, model());
      renderRevisionResponsivenessSignatureSection(options.root, signatureModel());
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true; state = createRevisionResponsivenessReceiptVerificationState();
      signatureState = createRevisionResponsivenessSignatureState(); return true;
    },
  });
}
