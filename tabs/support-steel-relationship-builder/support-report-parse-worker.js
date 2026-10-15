import { parseSupportReportClashXml } from './support-report-clash-safety.js?v=20260909-support-report-parser-primitives-8&location=20260915-support-report-bore-axis-occurrence-1&perf=20260913-support-report-large-xml-1';

async function sourceText(source) {
  if (typeof source === 'string') return source;
  if (source && typeof source.text === 'function') return source.text();
  throw new TypeError('Support Report XML worker requires text or a Blob/File source.');
}

async function handle(message) {
  const { id, type } = message || {};
  if (type !== 'parse') throw new Error(`Unknown Support Report XML worker request: ${type || '(empty)'}`);
  const text = await sourceText(message.source);
  return {
    id,
    ok: true,
    result: parseSupportReportClashXml(text, message.options || {}),
  };
}

self.addEventListener('message', (event) => {
  const message = event.data || {};
  void handle(message)
    .then((result) => self.postMessage(result))
    .catch((error) => self.postMessage({
      id: message.id,
      ok: false,
      error: String(error?.message || error),
    }));
});

export const _test = Object.freeze({ sourceText, handle });
