import { contentFingerprint } from './categorized-inputxml-api/index.js';
import {
  applyLinewiseSideload,
  currentElement,
  ensureCategorized,
  ensureInputXml,
  exportBaseName,
} from './XmlCompareLinewiseWorkflowActions.js';

export const XML_COMPARE_LINEWISE_PRODUCER_ADOPTION_SCHEMA = 'xml-compare-linewise-producer-adoption/v2-adapter-state';
export const XML_COMPARE_LINEWISE_PRODUCER_ID = 'xml-compare-linewise-sideload';

const clean = (value) => String(value ?? '').trim();
const STATUSES = new Set(['idle', 'running', 'success', 'failed']);

export function linewiseProducerDescriptor() {
  return Object.freeze({
    id: XML_COMPARE_LINEWISE_PRODUCER_ID,
    repository: 'reallaksh19/XML_Compare_Utilities',
    module: 'xml-compare/XmlCompareLinewiseWorkflowActions.js',
    operation: 'applyLinewiseSideload',
    version: XML_COMPARE_LINEWISE_PRODUCER_ADOPTION_SCHEMA,
    artifactRole: 'enriched-inputxml',
  });
}

export function createLinewiseProducerAdoptionState(input = {}) {
  const status = STATUSES.has(clean(input.status)) ? clean(input.status) : 'idle';
  return Object.freeze({
    schema: XML_COMPARE_LINEWISE_PRODUCER_ADOPTION_SCHEMA,
    status,
    sourceFingerprint: clean(input.sourceFingerprint),
    result: input.result || null,
    error: input.error || null,
  });
}

export function createLinewiseProducerRequest(linewiseState = {}) {
  const content = String(linewiseState.lastEnriched || linewiseState.text || '');
  return Object.freeze({
    schema: 'InputXmlProducerCategorizeRequest.v1',
    requestId: `xml-compare-linewise-${Date.now()}`,
    producer: linewiseProducerDescriptor(),
    source: Object.freeze({
      filename: clean(linewiseState.fileName) || 'xml_compare_sideload_enriched.input.xml',
      content,
    }),
  });
}

function missingOutputState(linewiseState = {}) {
  return createLinewiseProducerAdoptionState({
    status: 'failed',
    error: Object.freeze({
      code: 'ENRICHED_INPUTXML_MISSING',
      message: linewiseState.lastCanvasStatus || 'Sideload did not produce enriched InputXML.',
    }),
  });
}

export function startLinewiseProducerRun(linewiseState = {}) {
  const enriched = applyLinewiseSideload(linewiseState);
  const content = String(enriched.lastEnriched || '');
  if (!clean(content)) return Object.freeze({ linewiseState: enriched, adoption: missingOutputState(enriched), request: null });
  const adoption = createLinewiseProducerAdoptionState({
    status: 'running',
    sourceFingerprint: contentFingerprint(content),
  });
  return Object.freeze({ linewiseState: enriched, adoption, request: createLinewiseProducerRequest(enriched) });
}

function failureMessage(result = null, error = null) {
  if (error?.message) return error.message;
  const diagnostic = result?.diagnostics?.find((item) => item.severity === 'error');
  return diagnostic?.message || 'Worker categorization failed.';
}

export function finishLinewiseProducerRun(adoption = {}, result = null) {
  const text = result?.success ? String(result.artifact?.text || '') : '';
  if (!text) return failLinewiseProducerRun(adoption, null, result);
  return createLinewiseProducerAdoptionState({
    status: 'success',
    sourceFingerprint: adoption.sourceFingerprint,
    result,
  });
}

export function failLinewiseProducerRun(adoption = {}, error = null, result = null) {
  return createLinewiseProducerAdoptionState({
    status: 'failed',
    sourceFingerprint: adoption.sourceFingerprint,
    result,
    error: Object.freeze({
      code: clean(error?.code || result?.diagnostics?.find((item) => item.severity === 'error')?.code) || 'PRODUCER_CATEGORIZATION_FAILED',
      message: failureMessage(result, error),
    }),
  });
}

export async function runLinewiseSideloadProducerAdoption(linewiseState = {}, client = null) {
  const started = startLinewiseProducerRun(linewiseState);
  if (!started.request) return Object.freeze({ linewiseState: started.linewiseState, adoption: started.adoption });
  try {
    const result = await client?.producer?.categorizeInputXml?.(started.request);
    return Object.freeze({ linewiseState: started.linewiseState, adoption: finishLinewiseProducerRun(started.adoption, result) });
  } catch (error) {
    return Object.freeze({ linewiseState: started.linewiseState, adoption: failLinewiseProducerRun(started.adoption, error) });
  }
}

export function linewiseProducerOwnsOutput(linewiseState = {}, adoption = {}) {
  if (!clean(linewiseState.lastEnriched) || !['running', 'success', 'failed'].includes(adoption.status)) return false;
  return contentFingerprint(linewiseState.lastEnriched) === adoption.sourceFingerprint;
}

export function linewiseCategorizedText(linewiseState = {}, adoption = {}) {
  if (linewiseState.model?.format === 'CategorizedInputXML') return linewiseState.text || '';
  if (clean(linewiseState.lastEnriched)) {
    if (!linewiseProducerOwnsOutput(linewiseState, adoption)) return '';
    return adoption.status === 'success' ? String(adoption.result?.artifact?.text || '') : '';
  }
  return ensureCategorized(linewiseState);
}

export function linewisePreviewText(linewiseState = {}, adoption = {}) {
  if (linewiseState.previewMode === 'input') return ensureInputXml(linewiseState);
  if (linewiseState.previewMode === 'element') return currentElement(linewiseState)?.originalElement || '';
  return linewiseCategorizedText(linewiseState, adoption);
}

export function linewiseCategorizedCanvasPayload(linewiseState = {}, adoption = {}, side = 'a') {
  const text = linewiseCategorizedText(linewiseState, adoption);
  const fileName = `${exportBaseName(linewiseState)}_categorized_enriched.xml`;
  const target = side === 'b' ? 'Target B' : 'Source A';
  return Object.freeze({
    side: side === 'b' ? 'b' : 'a',
    fileName,
    text,
    ready: Boolean(text),
    status: text ? `Loaded ${fileName} to ${target} canvas.` : `Categorized output is unavailable; ${target} canvas was not changed.`,
  });
}

export function linewiseProducerReceipt(linewiseState = {}, adoption = {}) {
  return Object.freeze({
    schema: 'XmlCompareLinewiseProducerReceipt.v1',
    producer: linewiseProducerDescriptor(),
    status: adoption.status || 'idle',
    sourceFingerprint: adoption.sourceFingerprint || null,
    result: adoption.result || null,
    error: adoption.error || null,
    sideloadReport: linewiseState.lastSideloadReport || null,
  });
}

export function linewiseProducerReceiptJson(linewiseState = {}, adoption = {}) {
  return `${JSON.stringify(linewiseProducerReceipt(linewiseState, adoption), null, 2)}\n`;
}

export const _test = Object.freeze({ clean, failureMessage, missingOutputState });
