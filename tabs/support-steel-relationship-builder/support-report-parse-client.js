export const SUPPORT_REPORT_XML_TEXTAREA_PREVIEW_BYTES = 1024 * 1024;
export const SUPPORT_REPORT_INLINE_PARSE_MAX_BYTES = 2 * 1024 * 1024;

let nextRequestId = 1;

export async function parseSupportReportXmlAsync(source, options = {}, runtime = {}) {
  if (!hasSource(source)) throw new Error('Support Report XML source is empty.');
  if (runtime.signal?.aborted) throw abortError();

  const WorkerCtor = Object.prototype.hasOwnProperty.call(runtime, 'WorkerCtor')
    ? runtime.WorkerCtor
    : globalThis.Worker;
  let worker = null;
  let workerStartupError = null;
  if (typeof WorkerCtor === 'function') {
    try {
      worker = new WorkerCtor(
        runtime.workerUrl || new URL('./support-report-parse-worker.js?v=20260915-support-report-bore-axis-occurrence-1', import.meta.url),
        { type: 'module' },
      );
    } catch (error) {
      workerStartupError = error;
    }
    if (worker) return parseWithWorker(worker, source, options, runtime.signal);
  }

  if (sourceSize(source) > SUPPORT_REPORT_INLINE_PARSE_MAX_BYTES) {
    const suffix = workerStartupError ? ` Background parser startup failed: ${workerStartupError?.message || workerStartupError}` : '';
    throw new Error(`Large Support Report XML requires browser module-worker support; refusing a main-thread parse that can freeze the page.${suffix}`);
  }
  const text = await sourceText(source);
  if (runtime.signal?.aborted) throw abortError();
  const parser = await fallbackParser(runtime);
  return parser(text, options);
}

function parseWithWorker(worker, source, options, signal) {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      worker.removeEventListener?.('message', onMessage);
      worker.removeEventListener?.('error', onError);
      signal?.removeEventListener?.('abort', onAbort);
      worker.terminate?.();
      callback(value);
    };
    const onMessage = (event) => {
      const message = event.data || {};
      if (message.id !== id) return;
      if (message.ok) finish(resolve, message.result);
      else finish(reject, new Error(message.error || 'Support Report XML worker parse failed.'));
    };
    const onError = (event) => finish(reject, new Error(event?.message || 'Support Report XML worker crashed.'));
    const onAbort = () => finish(reject, abortError());

    worker.addEventListener?.('message', onMessage);
    worker.addEventListener?.('error', onError);
    signal?.addEventListener?.('abort', onAbort, { once: true });
    try {
      worker.postMessage({ id, type: 'parse', source, options });
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function fallbackParser(runtime) {
  if (typeof runtime.fallbackParser === 'function') return runtime.fallbackParser;
  const module = await import('./support-report-clash-safety.js?v=20260909-support-report-parser-primitives-8&location=20260915-support-report-bore-axis-occurrence-1&perf=20260913-support-report-large-xml-1');
  return module.parseSupportReportClashXml;
}

function hasSource(source) {
  if (typeof source === 'string') return Boolean(source.trim());
  return Boolean(source && typeof source.text === 'function' && Number(source.size) > 0);
}

function sourceSize(source) {
  if (typeof source === 'string') return source.length * 2;
  return Number(source?.size) || 0;
}

async function sourceText(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source.text === 'function') return source.text();
  throw new TypeError('Support Report XML source must be text or a Blob/File.');
}

function abortError() {
  const error = new Error('Support Report XML parse cancelled.');
  error.name = 'AbortError';
  return error;
}

export const _test = Object.freeze({ hasSource, sourceSize, sourceText });
