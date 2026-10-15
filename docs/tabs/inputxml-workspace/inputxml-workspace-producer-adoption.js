import { contentFingerprint } from '../../xml-compare/categorized-inputxml-api/index.js';

export const INPUTXML_WORKSPACE_PRODUCER_ADOPTION_SCHEMA = 'inputxml-workspace-producer-adoption/v1';
export const INPUTXML_WORKSPACE_PRODUCER_ID = 'inputxml-workspace';

const clean = (value) => String(value ?? '').trim();
const STATUSES = new Set(['idle', 'running', 'success', 'failed']);
const GENERATED_SOURCE_KINDS = new Set(['5c', 'enriched']);

export function isWorkspaceGeneratedInputXml(sourceKind = '') {
  return GENERATED_SOURCE_KINDS.has(clean(sourceKind));
}

export function workspaceProducerDescriptor(sourceKind = '') {
  const kind = clean(sourceKind);
  return Object.freeze({
    id: INPUTXML_WORKSPACE_PRODUCER_ID,
    repository: 'reallaksh19/XML_Compare_Utilities',
    module: 'tabs/inputxml-workspace/inputxml-workspace-tab.js',
    operation: kind === '5c' ? 'xml-to-inputxml-5c' : 'apply-sideload-enrichment',
    version: INPUTXML_WORKSPACE_PRODUCER_ADOPTION_SCHEMA,
    artifactRole: 'generated-inputxml',
  });
}

export function createWorkspaceProducerAdoptionState(input = {}) {
  const status = STATUSES.has(clean(input.status)) ? clean(input.status) : 'idle';
  return Object.freeze({
    schema: INPUTXML_WORKSPACE_PRODUCER_ADOPTION_SCHEMA,
    status,
    sourceKind: clean(input.sourceKind),
    sourceFilename: clean(input.sourceFilename),
    sourceFingerprint: clean(input.sourceFingerprint),
    result: input.result || null,
    error: input.error || null,
  });
}

export function createWorkspaceProducerSource(input = {}) {
  const text = String(input.text ?? '');
  const sourceKind = clean(input.sourceKind);
  return Object.freeze({
    text,
    sourceKind,
    filename: clean(input.filename) || `inputxml-workspace-${sourceKind || 'generated'}.input.xml`,
    fingerprint: contentFingerprint(text),
  });
}

export function createWorkspaceProducerRequest(sourceInput = {}) {
  const source = createWorkspaceProducerSource(sourceInput);
  return Object.freeze({
    schema: 'InputXmlProducerCategorizeRequest.v1',
    requestId: `inputxml-workspace-${source.sourceKind || 'generated'}-${source.fingerprint.slice(-12)}`,
    producer: workspaceProducerDescriptor(source.sourceKind),
    source: Object.freeze({ filename: source.filename, content: source.text }),
  });
}

function missingSourceState(source = {}) {
  return createWorkspaceProducerAdoptionState({
    status: 'failed',
    sourceKind: source.sourceKind,
    sourceFilename: source.filename,
    sourceFingerprint: source.fingerprint,
    error: Object.freeze({
      code: 'WORKSPACE_GENERATED_INPUTXML_MISSING',
      message: 'Workspace producer did not provide generated InputXML.',
    }),
  });
}

export function startWorkspaceProducerRun(sourceInput = {}) {
  const source = createWorkspaceProducerSource(sourceInput);
  if (!clean(source.text)) return Object.freeze({ source, adoption: missingSourceState(source), request: null });
  if (!isWorkspaceGeneratedInputXml(source.sourceKind)) {
    return Object.freeze({
      source,
      adoption: createWorkspaceProducerAdoptionState({
        status: 'failed', sourceKind: source.sourceKind, sourceFilename: source.filename,
        sourceFingerprint: source.fingerprint,
        error: Object.freeze({ code: 'WORKSPACE_SOURCE_NOT_PRODUCER_GENERATED', message: 'Worker adoption accepts only 5C or sideload-enriched Workspace InputXML.' }),
      }),
      request: null,
    });
  }
  return Object.freeze({
    source,
    adoption: createWorkspaceProducerAdoptionState({
      status: 'running', sourceKind: source.sourceKind, sourceFilename: source.filename,
      sourceFingerprint: source.fingerprint,
    }),
    request: createWorkspaceProducerRequest(source),
  });
}

function failureMessage(result = null, error = null) {
  if (error?.message) return error.message;
  const diagnostic = result?.diagnostics?.find((item) => item.severity === 'error');
  return diagnostic?.message || 'Workspace producer categorization failed.';
}

export function finishWorkspaceProducerRun(adoption = {}, result = null) {
  const text = result?.success ? String(result.artifact?.text || '') : '';
  if (!clean(text)) return failWorkspaceProducerRun(adoption, null, result);
  if (clean(result?.source?.fingerprint) !== clean(adoption.sourceFingerprint)) {
    return failWorkspaceProducerRun(adoption, Object.assign(new Error('Worker receipt source fingerprint does not match the generated InputXML.'), { code: 'WORKSPACE_RECEIPT_SOURCE_MISMATCH' }), result);
  }
  return createWorkspaceProducerAdoptionState({
    status: 'success', sourceKind: adoption.sourceKind, sourceFilename: adoption.sourceFilename,
    sourceFingerprint: adoption.sourceFingerprint, result,
  });
}

export function failWorkspaceProducerRun(adoption = {}, error = null, result = null) {
  return createWorkspaceProducerAdoptionState({
    status: 'failed', sourceKind: adoption.sourceKind, sourceFilename: adoption.sourceFilename,
    sourceFingerprint: adoption.sourceFingerprint, result,
    error: Object.freeze({
      code: clean(error?.code || result?.diagnostics?.find((item) => item.severity === 'error')?.code) || 'WORKSPACE_PRODUCER_CATEGORIZATION_FAILED',
      message: failureMessage(result, error),
    }),
  });
}

export function workspaceProducerOwnsSource(sourceInput = {}, adoption = {}) {
  const source = createWorkspaceProducerSource(sourceInput);
  return isWorkspaceGeneratedInputXml(source.sourceKind)
    && source.fingerprint === clean(adoption.sourceFingerprint)
    && source.sourceKind === clean(adoption.sourceKind);
}

export function workspaceProducerCategorizedText(sourceInput = {}, adoption = {}) {
  if (!workspaceProducerOwnsSource(sourceInput, adoption)) return '';
  return adoption.status === 'success' ? String(adoption.result?.artifact?.text || '') : '';
}

export function workspaceProducerReceipt(sourceInput = {}, adoption = {}) {
  const source = createWorkspaceProducerSource(sourceInput);
  return Object.freeze({
    schema: 'InputXmlWorkspaceProducerReceipt.v1',
    producer: workspaceProducerDescriptor(source.sourceKind || adoption.sourceKind),
    status: adoption.status || 'idle',
    source: Object.freeze({
      kind: source.sourceKind || adoption.sourceKind || null,
      filename: source.filename || adoption.sourceFilename || null,
      fingerprint: adoption.sourceFingerprint || source.fingerprint || null,
      currentFingerprint: source.fingerprint || null,
      current: workspaceProducerOwnsSource(source, adoption),
    }),
    result: adoption.result || null,
    error: adoption.error || null,
  });
}

export function workspaceProducerReceiptJson(sourceInput = {}, adoption = {}) {
  return `${JSON.stringify(workspaceProducerReceipt(sourceInput, adoption), null, 2)}\n`;
}

export async function runWorkspaceProducerAdoption(sourceInput = {}, client = null, requestOptions = {}) {
  const started = startWorkspaceProducerRun(sourceInput);
  if (!started.request) return Object.freeze({ source: started.source, adoption: started.adoption });
  try {
    const result = await client?.producer?.categorizeInputXml?.(started.request, requestOptions);
    return Object.freeze({ source: started.source, adoption: finishWorkspaceProducerRun(started.adoption, result) });
  } catch (error) {
    return Object.freeze({ source: started.source, adoption: failWorkspaceProducerRun(started.adoption, error) });
  }
}

export const _test = Object.freeze({ clean, failureMessage, missingSourceState, GENERATED_SOURCE_KINDS });
