import { createTransferProof, snippet } from './XmlCompareTransferProofModel.js';
import { gateAllowsAction } from './XmlCompareTransferWorkflowGateModel.js';

export const XML_COMPARE_TRANSFER_RESULT_REVIEW_PANEL_SCHEMA = 'xml-compare-transfer-result-review-panel/v2';

const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const clean = (value) => String(value ?? '').trim();
const shortHash = (value = '') => clean(value).replace(/^fnv1a32:/, '') || '-';
function metric(label, value) { return `<span><b>${esc(label)}</b><br>${esc(value)}</span>`; }
function sourceTarget(row = {}) { const source = [row.sourceLine, row.sourceElement, row.sourceNode].map(clean).filter(Boolean).join(' / '), target = [row.targetLine, row.targetElement, row.targetNode].map(clean).filter(Boolean).join(' / '); return `${source || '-'} → ${target || '-'}`; }
function rowHtml(row = {}) { return `<article class="xml-compare-transfer-review-row"><header><b>${esc(row.blockName || '-')}</b><span>${esc(row.status || '-')}</span></header><small>${esc(row.scope || 'node')} · ${esc(sourceTarget(row))}</small><div class="xml-compare-transfer-review-snippets"><pre>${esc(snippet(row.beforeXml || ''))}</pre><pre>${esc(snippet(row.afterXml || ''))}</pre></div></article>`; }
function rowsHtml(proof = {}) { const rows = proof.changedBlocks || []; if (!rows.length) return '<small>No changed block rows available yet. Apply or export a staged transfer to populate review data.</small>'; return `<div class="xml-compare-transfer-review-list">${rows.map(rowHtml).join('')}</div>`; }
function reviewButton(action, label, gate = null) { const disabled = gate && !gateAllowsAction(gate, action) ? 'disabled' : ''; return `<button type="button" data-xml-compare-action="${esc(action)}" ${disabled}>${esc(label)}</button>`; }
function actions(gate = null) { return `<div class="xml-compare-transfer-apply-actions">${reviewButton('download-transfer-proof-json', 'Download Transfer Proof JSON', gate)}${reviewButton('copy-patched-target-preview', 'Copy Patched Target Preview', gate)}</div>`; }
export function renderXmlCompareTransferResultReviewPanelHtml({ transferState = null, gate = null } = {}) { const proof = createTransferProof({ transferAudit: transferState?.transferAudit, postTransferValidation: transferState?.postTransferValidation, transferLastResult: transferState?.transferLastResult }); return `<section class="xml-compare-automap-panel" data-xml-compare-transfer-result-review><header><b>Transfer result review</b><span>${esc(proof.schema)}</span></header><div class="xml-compare-validation-summary">${metric('Updated', proof.updatedCount)}${metric('Skipped', proof.skippedCount)}${metric('Blocked', proof.blockedCount)}${metric('Result hash', shortHash(proof.resultHash))}</div>${actions(gate)}${rowsHtml(proof)}</section>`; }
export const _test = Object.freeze({ esc, clean, shortHash, metric, sourceTarget, rowHtml, rowsHtml, reviewButton, actions });
