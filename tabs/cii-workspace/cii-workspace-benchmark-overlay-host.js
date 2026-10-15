import {
  buildCiiSourceTargetBenchmarkOverlay,
  deriveCiiNodeNameBenchmarkDeltaFromCii,
} from './cii-workspace-benchmark-overlay.js';
import { ciiSourceTargetBenchmarkOverlayMarkup } from './cii-workspace-benchmark-overlay-ui.js';

const HOST_TAG = 'cii-benchmark-overlay-host';
const contexts = new Map();
const benchmarkByTargetSha = new Map();
let sequence = 0;

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
function nextToken() { sequence += 1; return `cii-benchmark-${sequence}`; }
function targetKey(targetDocument) { return String(targetDocument?.contentSha256 || targetDocument?.fileName || 'target'); }
function annotationLabel(annotation) {
  if (!annotation || annotation.status === 'NOT_COVERED_BY_PARTIAL_BENCHMARK') return '—';
  if (annotation.benchmarkAction) return `${annotation.status} · ${annotation.benchmarkAction} @ ${annotation.benchmarkTargetNodeId}`;
  return 'ADDITIONAL QUALIFIED · not in partial benchmark';
}
function applyAnnotations(host, overlay) {
  const byKey = new Map((overlay?.censusAnnotations || []).map((row) => [String(row.rowKey || ''), row]));
  const scope = host?.parentElement || host;
  scope?.querySelectorAll?.('[data-ciiw-benchmark-cell]')?.forEach((cell) => {
    const annotation = byKey.get(String(cell.dataset.ciiwBenchmarkCell || ''));
    cell.textContent = annotationLabel(annotation);
  });
}
function hostShell(context, benchmark = null) {
  const loaded = benchmark
    ? `<p><b>Loaded partial expected benchmark:</b> ${h(benchmark.expected?.fileName || 'expected CII')} · ${h(benchmark.summary?.expectedCount || 0)} derived positive delta(s).</p>`
    : '<p>No partial expected benchmark is loaded. The Source↔Target census remains valid without one.</p>';
  return `<section class="ciiw-base-set" data-ciiw-benchmark-loader="1"><header><div><h3>Optional known-positive benchmark</h3><p>Load a partial expected TARGET CII to derive T → expected NodeName positives dynamically. This never grants correspondence identity authority.</p></div><span class="ciiw-corroboration">OPTIONAL</span></header>${loaded}<label><b>Partial expected TARGET CII</b><input type="file" accept=".cii,text/plain" data-ciiw-benchmark-file></label><small>Absence from this partial benchmark is not a veto on additional qualified correspondence or mutation.</small><div data-ciiw-benchmark-runtime></div></section>`;
}

export function ciiBenchmarkOverlayHostMarkup(audit, targetDocument) {
  if (!audit?.rows || !targetDocument) return '';
  const token = nextToken();
  contexts.set(token, { audit, targetDocument });
  return `<${HOST_TAG} data-ciiw-benchmark-token="${h(token)}"></${HOST_TAG}>`;
}

export function cachedCiiBenchmarkForTarget(targetDocument) {
  return benchmarkByTargetSha.get(targetKey(targetDocument)) || null;
}

if (typeof globalThis.HTMLElement !== 'undefined' && globalThis.customElements && !globalThis.customElements.get(HOST_TAG)) {
  class CiiBenchmarkOverlayHost extends globalThis.HTMLElement {
    context() { return contexts.get(String(this.dataset.ciiwBenchmarkToken || '')) || null; }
    render(benchmark = null) {
      const context = this.context(); if (!context) return;
      this.innerHTML = hostShell(context, benchmark);
      if (benchmark) {
        const overlay = buildCiiSourceTargetBenchmarkOverlay(context.audit, benchmark);
        const runtime = this.querySelector('[data-ciiw-benchmark-runtime]');
        if (runtime) runtime.innerHTML = ciiSourceTargetBenchmarkOverlayMarkup(context.audit, benchmark);
        applyAnnotations(this, overlay);
      }
      this.bindInput();
    }
    bindInput() {
      this.querySelector('[data-ciiw-benchmark-file]')?.addEventListener('change', (event) => { void this.loadFile(event); });
    }
    async loadFile(event) {
      const context = this.context(); const file = event.target?.files?.[0];
      if (!context || !file) return;
      const runtime = this.querySelector('[data-ciiw-benchmark-runtime]');
      try {
        if (runtime) runtime.textContent = 'Deriving TARGET → partial expected benchmark…';
        const bytes = new Uint8Array(await file.arrayBuffer());
        const benchmark = await deriveCiiNodeNameBenchmarkDeltaFromCii(null, bytes, {
          beforeDocument: context.targetDocument,
          expectedFileName: file.name,
          cryptoRef: globalThis.crypto,
        });
        benchmarkByTargetSha.set(targetKey(context.targetDocument), benchmark);
        this.render(benchmark);
      } catch (error) {
        if (runtime) runtime.textContent = `Benchmark audit blocked: ${error?.message || String(error)}`;
      }
    }
    connectedCallback() {
      const context = this.context(); if (!context) return;
      this.render(benchmarkByTargetSha.get(targetKey(context.targetDocument)) || null);
    }
    disconnectedCallback() {
      contexts.delete(String(this.dataset.ciiwBenchmarkToken || ''));
    }
  }
  globalThis.customElements.define(HOST_TAG, CiiBenchmarkOverlayHost);
}

export const _test = Object.freeze({ HOST_TAG, targetKey, annotationLabel, hostShell });
