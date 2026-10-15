import { contentFingerprint } from '../../xml-compare/categorized-inputxml-api/index.js';
import { createCategorizedInputXmlWorkerClient } from '../../xml-compare/categorized-inputxml-worker/index.js';
import { detectSchema, XML_SCHEMA_KINDS } from '../adapters/inputxml-adapter.js';

export const WORKBENCH_IMPORTED_INPUTXML_REVIEW_SCHEMA = 'WorkbenchImportedInputXmlReview.v1';
export const WORKBENCH_IMPORTED_INPUTXML_REVIEW_RECEIPT_SCHEMA = 'WorkbenchImportedInputXmlReviewReceipt.v1';

const SIDES = new Set(['source', 'target']);
const STATUSES = new Set(['IDLE', 'NOT_APPLICABLE', 'RUNNING', 'PASS', 'FAILED']);
const clean = (value) => String(value ?? '').trim();

function sideValue(value) {
  const side = clean(value).toLowerCase();
  if (!SIDES.has(side)) throw new Error(`Unsupported Workbench3D review side: ${value}.`);
  return side;
}

function excludedDiagnostic(schema) {
  if (schema === XML_SCHEMA_KINDS.NODESET_XML) {
    return Object.freeze({
      code: 'WORKBENCH_NODESET_REVIEW_EXCLUDED',
      message: 'Comparison-only NodeSet XML is not CAESAR InputXML and is never submitted for categorized review.',
    });
  }
  if (schema === XML_SCHEMA_KINDS.CATEGORIZED_XML) {
    return Object.freeze({
      code: 'WORKBENCH_ALREADY_CATEGORIZED',
      message: 'The imported document is already CategorizedInputXML; no derived companion is generated.',
    });
  }
  if (schema === XML_SCHEMA_KINDS.PSI_XML) {
    return Object.freeze({
      code: 'WORKBENCH_PSI_REVIEW_EXCLUDED',
      message: 'PSI pipe-stress text is outside the imported CAESAR InputXML review route.',
    });
  }
  return Object.freeze({
    code: 'WORKBENCH_INPUTXML_REVIEW_NOT_APPLICABLE',
    message: 'The imported document is not recognized as CAESAR InputXML.',
  });
}

export function isGenuineCaesarInputXml(value = '') {
  const raw = String(value ?? '');
  const root = raw.match(/<CAESARII\b([^>]*)>/i);
  return Boolean(root
    && /\bXML_TYPE\s*=\s*["']Input["']/i.test(root[1])
    && /<PIPINGMODEL\b/i.test(raw));
}

export function createImportedInputXmlReviewState(input = {}) {
  const status = STATUSES.has(clean(input.status).toUpperCase())
    ? clean(input.status).toUpperCase()
    : 'IDLE';
  return Object.freeze({
    schema: WORKBENCH_IMPORTED_INPUTXML_REVIEW_SCHEMA,
    side: input.side ? sideValue(input.side) : null,
    status,
    sourceSchema: clean(input.sourceSchema) || null,
    sourceFilename: clean(input.sourceFilename) || null,
    sourceFingerprint: clean(input.sourceFingerprint) || null,
    requestId: clean(input.requestId) || null,
    result: input.result || null,
    diagnostic: input.diagnostic || null,
  });
}

export function createImportedInputXmlReviewCollection(input = {}) {
  return Object.freeze({
    source: createImportedInputXmlReviewState({ side: 'source', ...(input.source || {}) }),
    target: createImportedInputXmlReviewState({ side: 'target', ...(input.target || {}) }),
  });
}

export function importedInputXmlReviewDescriptor(side) {
  const normalizedSide = sideValue(side);
  return Object.freeze({
    id: 'workbench3d-imported-inputxml-review',
    repository: 'reallaksh19/XML_Compare_Utilities',
    module: 'workbench3d/ui/workbench3d-tab.js',
    operation: `review-imported-${normalizedSide}-inputxml`,
    version: WORKBENCH_IMPORTED_INPUTXML_REVIEW_SCHEMA,
    artifactRole: 'imported-inputxml-categorized-review',
  });
}

export function createImportedInputXmlReviewSource(input = {}) {
  const side = sideValue(input.side);
  const text = String(input.text ?? '');
  return Object.freeze({
    side,
    text,
    filename: clean(input.filename) || `${side}-imported.input.xml`,
    fingerprint: contentFingerprint(text),
    sourceSchema: detectSchema(text),
    genuineCaesarInputXml: isGenuineCaesarInputXml(text),
  });
}

export function createImportedInputXmlReviewRequest(sourceInput = {}) {
  const source = createImportedInputXmlReviewSource(sourceInput);
  const requestId = `workbench3d-${source.side}-${source.fingerprint.slice(-16)}`;
  return Object.freeze({
    schema: 'InputXmlProducerCategorizeRequest.v1',
    requestId,
    producer: importedInputXmlReviewDescriptor(source.side),
    source: Object.freeze({ filename: source.filename, content: source.text }),
  });
}

export function startImportedInputXmlReview(sourceInput = {}) {
  const source = createImportedInputXmlReviewSource(sourceInput);
  if (!clean(source.text)) {
    return Object.freeze({
      source,
      request: null,
      review: createImportedInputXmlReviewState({ side: source.side, status: 'IDLE' }),
    });
  }
  if (source.sourceSchema === XML_SCHEMA_KINDS.INPUT_XML && !source.genuineCaesarInputXml) {
    return Object.freeze({
      source,
      request: null,
      review: createImportedInputXmlReviewState({
        side: source.side,
        status: 'NOT_APPLICABLE',
        sourceSchema: source.sourceSchema,
        sourceFilename: source.filename,
        sourceFingerprint: source.fingerprint,
        diagnostic: Object.freeze({
code: 'WORKBENCH_CAESAR_INPUTXML_ROOT_REQUIRED',
message: 'PIPINGELEMENT markers alone are insufficient; categorized review requires a CAESARII root with XML_TYPE="Input" and PIPINGMODEL.',
        }),
      }),
    });
  }
  if (source.sourceSchema !== XML_SCHEMA_KINDS.INPUT_XML) {
    return Object.freeze({
      source,
      request: null,
      review: createImportedInputXmlReviewState({
        side: source.side,
        status: 'NOT_APPLICABLE',
        sourceSchema: source.sourceSchema,
        sourceFilename: source.filename,
        sourceFingerprint: source.fingerprint,
        diagnostic: excludedDiagnostic(source.sourceSchema),
      }),
    });
  }
  const request = createImportedInputXmlReviewRequest(source);
  return Object.freeze({
    source,
    request,
    review: createImportedInputXmlReviewState({
      side: source.side,
      status: 'RUNNING',
      sourceSchema: source.sourceSchema,
      sourceFilename: source.filename,
      sourceFingerprint: source.fingerprint,
      requestId: request.requestId,
    }),
  });
}

function resultFailure(review, code, message, result = null) {
  return createImportedInputXmlReviewState({
    ...review,
    status: 'FAILED',
    result,
    diagnostic: Object.freeze({ code, message }),
  });
}

export function failImportedInputXmlReview(review = {}, error = null, result = null) {
  const diagnostic = result?.diagnostics?.find((item) => item?.severity === 'error');
  return resultFailure(
    review,
    clean(error?.code || diagnostic?.code) || 'WORKBENCH_IMPORTED_INPUTXML_REVIEW_FAILED',
    clean(error?.message || diagnostic?.message) || 'Imported InputXML categorized review failed.',
    result,
  );
}

export function finishImportedInputXmlReview(review = {}, result = null) {
  const artifactText = result?.success ? String(result.artifact?.text || '') : '';
  if (!clean(artifactText)) return failImportedInputXmlReview(review, null, result);
  if (clean(result.requestId) !== clean(review.requestId)) {
    return resultFailure(review, 'WORKBENCH_REVIEW_REQUEST_MISMATCH', 'Categorized review result does not match the current request.', result);
  }
  const expectedSource = clean(review.sourceFingerprint);
  if (clean(result.source?.fingerprint) !== expectedSource || clean(result.artifact?.sourceFingerprint) !== expectedSource) {
    return resultFailure(review, 'WORKBENCH_REVIEW_SOURCE_MISMATCH', 'Categorized review result is not bound to the current imported InputXML.', result);
  }
  if (clean(result.artifact?.fingerprint) !== contentFingerprint(artifactText)) {
    return resultFailure(review, 'WORKBENCH_REVIEW_ARTIFACT_MISMATCH', 'Categorized review artifact fingerprint is invalid.', result);
  }
  if (result.categorizedValidation?.success !== true) {
    return resultFailure(review, 'WORKBENCH_REVIEW_VALIDATION_FAILED', 'Categorized review artifact did not pass validation.', result);
  }
  return createImportedInputXmlReviewState({
    ...review,
    status: 'PASS',
    result,
    diagnostic: null,
  });
}

export function importedInputXmlReviewIsCurrent(sourceInput = {}, review = {}) {
  const source = createImportedInputXmlReviewSource(sourceInput);
  return source.sourceSchema === XML_SCHEMA_KINDS.INPUT_XML
    && source.genuineCaesarInputXml
    && review.status === 'PASS'
    && review.side === source.side
    && review.sourceFingerprint === source.fingerprint
    && review.requestId === review.result?.requestId;
}

export function importedInputXmlReviewText(sourceInput = {}, review = {}) {
  return importedInputXmlReviewIsCurrent(sourceInput, review)
    ? String(review.result?.artifact?.text || '')
    : '';
}

export function importedInputXmlReviewReceipt(sourceInput = {}, review = {}) {
  const source = createImportedInputXmlReviewSource(sourceInput);
  return Object.freeze({
    schema: WORKBENCH_IMPORTED_INPUTXML_REVIEW_RECEIPT_SCHEMA,
    side: source.side,
    status: review.status || 'IDLE',
    producer: importedInputXmlReviewDescriptor(source.side),
    source: Object.freeze({
      filename: source.filename,
      schema: source.sourceSchema,
      genuineCaesarInputXml: source.genuineCaesarInputXml,
      fingerprint: review.sourceFingerprint || source.fingerprint,
      currentFingerprint: source.fingerprint,
      current: importedInputXmlReviewIsCurrent(source, review),
    }),
    requestId: review.requestId || null,
    result: review.result || null,
    diagnostic: review.diagnostic || null,
  });
}

export function importedInputXmlReviewReceiptJson(sourceInput = {}, review = {}) {
  return `${JSON.stringify(importedInputXmlReviewReceipt(sourceInput, review), null, 2)}\n`;
}

function ensureRuntime(container) {
  if (!container.__workbench3dImportedInputXmlReviewRuntime
      || container.__workbench3dImportedInputXmlReviewRuntime.closed) {
    container.__workbench3dImportedInputXmlReviewRuntime = {
      client: null,
      closed: false,
      sides: {
        source: { generation: 0, controller: null, timer: null },
        target: { generation: 0, controller: null, timer: null },
      },
    };
  }
  return container.__workbench3dImportedInputXmlReviewRuntime;
}

function ensureClient(container) {
  const runtime = ensureRuntime(container);
  if (runtime.closed) throw Object.assign(new Error('Workbench3D imported review client is closed.'), { code: 'CLIENT_CLOSED' });
  if (!runtime.client) runtime.client = createCategorizedInputXmlWorkerClient({ clientId: 'workbench3d-imported-inputxml-review' });
  return runtime.client;
}

export function cancelImportedInputXmlReview(container, side, reason = 'source-changed') {
  const runtime = ensureRuntime(container);
  const slot = runtime.sides[sideValue(side)];
  slot.generation += 1;
  clearTimeout(slot.timer);
  slot.timer = null;
  slot.controller?.abort(reason);
  slot.controller = null;
}

export async function runImportedInputXmlReview({ container, state, side, text, filename, onChange = null, timeoutMs = 60000 } = {}) {
  const normalizedSide = sideValue(side);
  const runtime = ensureRuntime(container);
  const slot = runtime.sides[normalizedSide];
  cancelImportedInputXmlReview(container, normalizedSide, 'review-superseded');
  const generation = slot.generation;
  const started = startImportedInputXmlReview({ side: normalizedSide, text, filename });
  state.importedInputXmlReview = Object.freeze({
    ...createImportedInputXmlReviewCollection(state.importedInputXmlReview),
    [normalizedSide]: started.review,
  });
  onChange?.(started.review);
  if (!started.request) return started.review;

  const controller = new AbortController();
  slot.controller = controller;
  try {
    const result = await ensureClient(container).producer.categorizeInputXml(started.request, {
      signal: controller.signal,
      timeoutMs,
    });
    if (runtime.closed || slot.generation !== generation) return state.importedInputXmlReview[normalizedSide];
    const review = finishImportedInputXmlReview(started.review, result);
    state.importedInputXmlReview = Object.freeze({ ...state.importedInputXmlReview, [normalizedSide]: review });
    onChange?.(review);
    return review;
  } catch (error) {
    if (runtime.closed || slot.generation !== generation) return state.importedInputXmlReview[normalizedSide];
    const review = failImportedInputXmlReview(started.review, error);
    state.importedInputXmlReview = Object.freeze({ ...state.importedInputXmlReview, [normalizedSide]: review });
    onChange?.(review);
    return review;
  } finally {
    if (slot.controller === controller) slot.controller = null;
  }
}

export function scheduleImportedInputXmlReview({ container, state, side, text, filename, onChange = null, delayMs = 450 } = {}) {
  const normalizedSide = sideValue(side);
  const runtime = ensureRuntime(container);
  cancelImportedInputXmlReview(container, normalizedSide, 'review-rescheduled');
  const slot = runtime.sides[normalizedSide];
  const generation = slot.generation;
  const started = startImportedInputXmlReview({ side: normalizedSide, text, filename });
  state.importedInputXmlReview = Object.freeze({
    ...createImportedInputXmlReviewCollection(state.importedInputXmlReview),
    [normalizedSide]: started.review,
  });
  onChange?.(started.review);
  if (!started.request) return Promise.resolve(started.review);
  return new Promise((resolve) => {
    slot.timer = setTimeout(() => {
      slot.timer = null;
      if (runtime.closed || slot.generation !== generation) return resolve(state.importedInputXmlReview[normalizedSide]);
      resolve(runImportedInputXmlReview({ container, state, side: normalizedSide, text, filename, onChange }));
    }, Math.max(0, Number(delayMs) || 0));
  });
}

export function closeImportedInputXmlReviewRuntime(container) {
  const runtime = container?.__workbench3dImportedInputXmlReviewRuntime;
  if (!runtime || runtime.closed) return;
  runtime.closed = true;
  for (const side of SIDES) {
    const slot = runtime.sides[side];
    slot.generation += 1;
    clearTimeout(slot.timer);
    slot.timer = null;
    slot.controller?.abort('workbench3d-unmount');
    slot.controller = null;
  }
  runtime.client?.close?.();
  runtime.client = null;
}

export const _test = Object.freeze({ clean, sideValue, excludedDiagnostic, ensureRuntime });
