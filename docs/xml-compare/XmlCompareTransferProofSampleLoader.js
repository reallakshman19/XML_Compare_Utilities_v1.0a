export const XML_COMPARE_TRANSFER_PROOF_SAMPLE_LOADER_SCHEMA = 'xml-compare-transfer-proof-sample-loader/v1';
export const TRANSFER_PROOF_SAMPLE_SOURCE_PATH = './samples/xml-compare/transfer-proof/source-categorized.xml';
export const TRANSFER_PROOF_SAMPLE_TARGET_PATH = './samples/xml-compare/transfer-proof/target-categorized.xml';

const clean = (value) => String(value ?? '').trim();

function sampleFile(name = '', text = '') {
  return Object.freeze({ name, size: String(text || '').length, type: 'application/xml' });
}

export function createTransferProofSampleLoadState({ sourceText = '', targetText = '', previousRevision = 0 } = {}) {
  return Object.freeze({
    fileA: sampleFile('source-categorized.xml', sourceText),
    fileB: sampleFile('target-categorized.xml', targetText),
    textA: String(sourceText || ''),
    textB: String(targetText || ''),
    workspaceRevision: Number(previousRevision || 0) + 1,
    report: null,
    status: Object.freeze({ kind: 'ok', message: 'Transfer proof sample loaded. Approve connector, then stage/apply manually.' }),
  });
}

export async function loadTransferProofSampleTexts({ fetchText = null } = {}) {
  const loader = fetchText || defaultFetchText;
  const [sourceText, targetText] = await Promise.all([loader(TRANSFER_PROOF_SAMPLE_SOURCE_PATH), loader(TRANSFER_PROOF_SAMPLE_TARGET_PATH)]);
  return Object.freeze({ sourceText, targetText });
}

async function defaultFetchText(path = '') {
  if (typeof fetch !== 'function') throw new Error('Browser fetch is not available for sample loading.');
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${clean(path)} (${response.status}).`);
  return response.text();
}

export const _test = Object.freeze({ clean, sampleFile, defaultFetchText });
