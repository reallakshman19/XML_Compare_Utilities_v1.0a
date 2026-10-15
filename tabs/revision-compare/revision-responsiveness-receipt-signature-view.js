/** Visible detached-signature verification for one retained responsiveness receipt. */
import { REVISION_RESPONSIVENESS_SIGNATURE_STATEMENT } from './revision-responsiveness-receipt-signature.js';

function appendText(documentRef, parent, tag, text, selector = null) {
  const node = documentRef.createElement(tag); node.textContent = String(text ?? '');
  if (selector) node.setAttribute(selector, ''); parent.appendChild(node); return node;
}
function fact(documentRef, list, label, value, selector = null) {
  appendText(documentRef, list, 'dt', label); appendText(documentRef, list, 'dd', value, selector);
}
function messageFor(model) {
  if (!model.available) return 'Verify a full-digest responsiveness receipt v2 before importing its detached signature receipt.';
  if (model.status === 'IMPORTING') return 'Checking the signature receipt, public key profile, canonical subject and detached RSA-PSS signature.';
  if (model.status === 'FAILED') return model.error || 'The detached signature receipt could not be verified.';
  if (model.status === 'VERIFIED') return 'The detached signature is valid for the retained responsiveness receipt and supplied public key.';
  return 'Import a detached signature receipt for the retained responsiveness receipt.';
}
function signatureInput(documentRef, disabled) {
  const label = documentRef.createElement('label'); label.className = 'revc-file-action';
  appendText(documentRef, label, 'span', 'Verify external signature');
  const input = documentRef.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.disabled = disabled;
  input.setAttribute('data-revc-responsiveness-signature-import', ''); label.appendChild(input); return label;
}

export function renderRevisionResponsivenessSignatureSection(root, model) {
  const host = root?.querySelector?.('.revc-review-side') ?? root?.querySelector?.('.revc-body');
  if (!host) return null;
  const documentRef = root.ownerDocument; const section = documentRef.createElement('section');
  section.className = 'revc-review-session'; section.setAttribute('data-revc-responsiveness-signature-status', model.status.toLowerCase());
  const header = documentRef.createElement('header'); const title = documentRef.createElement('div');
  appendText(documentRef, title, 'span', 'RUNTIME RECEIPT SIGNATURE'); appendText(documentRef, title, 'h2', 'Verify external signature');
  const status = appendText(documentRef, header, 'strong', model.status); status.setAttribute('data-status', model.status.toLowerCase());
  header.appendChild(title); header.appendChild(status); section.appendChild(header);
  appendText(documentRef, section, 'p', messageFor(model), 'data-revc-responsiveness-signature-message');
  const facts = documentRef.createElement('dl'); facts.className = 'revc-session-facts';
  fact(documentRef, facts, 'Cryptographic result', model.cryptographicStatus, 'data-revc-responsiveness-signature-result');
  fact(documentRef, facts, 'Receipt relationship', model.receiptRelationship, 'data-revc-responsiveness-signature-relationship');
  fact(documentRef, facts, 'Identity status', model.identityStatus); fact(documentRef, facts, 'Trust status', model.trustStatus);
  if (model.signatureReceiptId) fact(documentRef, facts, 'Signature receipt ID', model.signatureReceiptId);
  if (model.publicKeySha256) fact(documentRef, facts, 'Public-key SHA-256', model.publicKeySha256, 'data-revc-responsiveness-signature-key-sha');
  if (model.signerClaim) fact(documentRef, facts, 'External signer claim', model.signerClaim);
  if (model.organizationClaim) fact(documentRef, facts, 'Organization claim', model.organizationClaim);
  if (model.signedAt) fact(documentRef, facts, 'Signed at', model.signedAt);
  fact(documentRef, facts, 'Algorithm', model.algorithm); section.appendChild(facts);
  const controls = documentRef.createElement('div'); controls.className = 'revc-session-actions';
  controls.appendChild(signatureInput(documentRef, !model.available)); section.appendChild(controls);
  if (model.status === 'VERIFIED') appendText(documentRef, section, 'p', REVISION_RESPONSIVENESS_SIGNATURE_STATEMENT, 'data-revc-responsiveness-signature-boundary');
  host.appendChild(section); return section;
}
