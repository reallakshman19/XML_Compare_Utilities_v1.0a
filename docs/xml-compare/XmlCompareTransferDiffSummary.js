export const XML_COMPARE_TRANSFER_DIFF_SUMMARY_SCHEMA = 'xml-compare-transfer-diff-summary/v1';

const clean = (value) => String(value ?? '').trim();
const textOf = (value) => String(value ?? '');

function baseName(name = '') {
  return clean(name).replace(/\.(xml|json|txt)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'xml_compare';
}

function linesOf(text = '') {
  const value = textOf(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return value ? value.split('\n') : [];
}

function changedLineCount(originalLines = [], patchedLines = []) {
  const count = Math.max(originalLines.length, patchedLines.length);
  let changed = 0;
  for (let index = 0; index < count; index += 1) {
    if ((originalLines[index] ?? '') !== (patchedLines[index] ?? '')) changed += 1;
  }
  return changed;
}

export function transferDiffSummaryFileName(targetFileName = '') {
  return `${baseName(targetFileName)}_transfer_diff_summary.json`;
}

export function createTransferDiffSummary({ targetFileName = '', patchedTargetFileName = '', originalTargetText = '', patchedTargetText = '', transferSummary = {}, generatedAt = null } = {}) {
  const original = textOf(originalTargetText);
  const patched = textOf(patchedTargetText);
  const originalLines = linesOf(original);
  const patchedLines = linesOf(patched);
  const available = Boolean(clean(patched));
  const outputStatus = available ? (transferSummary.outputStatus || 'applied') : 'not available';
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_DIFF_SUMMARY_SCHEMA,
    generatedAt: clean(generatedAt || new Date(0).toISOString()),
    status: available ? 'available' : 'not available',
    reason: available ? 'Patched Target XML is available.' : 'Apply staged transfer first.',
    originalTargetFileName: clean(targetFileName || 'Target B'),
    patchedTargetFileName: clean(patchedTargetFileName || transferDiffSummaryFileName(targetFileName).replace(/_transfer_diff_summary\.json$/i, '_patched_target.xml')),
    exportFileName: transferDiffSummaryFileName(targetFileName),
    originalCharCount: original.length,
    patchedCharCount: patched.length,
    charDelta: patched.length - original.length,
    originalLineCount: originalLines.length,
    patchedLineCount: patchedLines.length,
    changedLineCount: available ? changedLineCount(originalLines, patchedLines) : 0,
    patchedTargetAvailable: available,
    outputStatus,
    scope: clean(transferSummary.scope || 'node'),
    selectedBlocks: Object.freeze([...(Array.isArray(transferSummary.selectedBlocks) ? transferSummary.selectedBlocks : [])]),
    updatedCount: Number(transferSummary.updatedCount || 0),
    skippedCount: Number(transferSummary.skippedCount || 0),
    blockedCount: Number(transferSummary.blockedCount || 0),
  });
}

export function serializeTransferDiffSummaryJson(summary = {}) {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

export const _test = Object.freeze({ clean, textOf, baseName, linesOf, changedLineCount });
