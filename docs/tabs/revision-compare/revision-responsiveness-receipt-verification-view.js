/** Visible local verification state for imported responsiveness observation receipts. */

function appendText(documentRef, parent, tag, text) {
  const element = documentRef.createElement(tag);
  element.textContent = String(text ?? '');
  parent.appendChild(element);
  return element;
}

function fact(documentRef, list, label, value, status = '') {
  const row = documentRef.createElement('div');
  appendText(documentRef, row, 'dt', label);
  const output = appendText(documentRef, row, 'dd', value);
  if (status) output.setAttribute('data-status', status.toLowerCase());
  list.appendChild(row);
}

function messageFor(model) {
  if (model.status === 'IMPORTING') return 'Checking the receipt schema, canonical content SHA-256 and deterministic receipt ID.';
  if (model.status === 'FAILED') return model.error || 'The responsiveness receipt could not be verified.';
  if (model.status === 'VERIFIED_CURRENT') return 'Receipt structure and integrity are verified; its audit lineage and run ID match the active WebGL run.';
  if (model.status === 'VERIFIED_HISTORICAL') return 'Receipt structure and integrity are verified for the current audit lineage, but it records a different WebGL run.';
  if (model.status === 'VERIFIED_OTHER_AUTHORITY') return 'Receipt structure and integrity are verified, but its audit or source lineage differs from the current workspace.';
  return 'Select a responsiveness observation receipt to verify its strict structure and integrity, then compare its authority with this workspace.';
}

function verificationInput(documentRef) {
  const label = documentRef.createElement('label');
  label.className = 'revc-file-action';
  appendText(documentRef, label, 'span', 'Verify receipt');
  const input = documentRef.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.setAttribute('data-revc-responsiveness-receipt-import', '');
  label.appendChild(input);
  return label;
}

export function renderRevisionResponsivenessReceiptVerificationSection(root, model) {
  const host = root?.querySelector?.('.revc-review-side') ?? root?.querySelector?.('.revc-body');
  if (!host) return null;
  const documentRef = root.ownerDocument;
  const section = documentRef.createElement('section');
  section.className = 'revc-review-session';
  section.setAttribute('data-revc-responsiveness-receipt-verification', model.status.toLowerCase());
  const header = documentRef.createElement('header'); const title = documentRef.createElement('div');
  appendText(documentRef, title, 'span', 'RUNTIME RECEIPT IMPORT');
  appendText(documentRef, title, 'h2', 'Verify responsiveness receipt');
  const status = appendText(documentRef, header, 'strong', model.status);
  status.setAttribute('data-status', model.status.toLowerCase());
  header.appendChild(title); header.appendChild(status); section.appendChild(header);
  const message = appendText(documentRef, section, 'p', messageFor(model));
  message.setAttribute('data-revc-responsiveness-receipt-message', '');
  const facts = documentRef.createElement('dl'); facts.className = 'revc-session-facts';
  fact(documentRef, facts, 'Schema structure', model.structureStatus, model.structureStatus);
  fact(documentRef, facts, 'Content SHA-256', model.contentSha256Status, model.contentSha256Status);
  fact(documentRef, facts, 'Receipt ID', model.receiptIdStatus, model.receiptIdStatus);
  fact(documentRef, facts, 'Current audit', model.authorityStatus, model.authorityStatus);
  fact(documentRef, facts, 'Active run', model.runStatus, model.runStatus);
  fact(documentRef, facts, 'Authenticity', model.authenticityStatus, model.authenticityStatus);
  if (model.contentSha256) fact(documentRef, facts, 'Canonical SHA-256', model.contentSha256);
  if (model.receiptId) fact(documentRef, facts, 'Receipt identity', model.receiptId);
  section.appendChild(facts);
  const controls = documentRef.createElement('div'); controls.className = 'revc-session-actions';
  controls.appendChild(verificationInput(documentRef)); section.appendChild(controls);
  host.appendChild(section);
  return section;
}
