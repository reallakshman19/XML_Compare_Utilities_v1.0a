import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  importLinewiseText,
  ensureInputXml,
} from '../xml-compare/XmlCompareLinewiseWorkflowActions.js';
import {
  createLinewiseProducerAdoptionState,
  linewiseCategorizedCanvasPayload,
  linewiseCategorizedText,
  linewisePreviewText,
  linewiseProducerReceiptJson,
  runLinewiseSideloadProducerAdoption,
  startLinewiseProducerRun,
} from '../xml-compare/XmlCompareLinewiseProducerAdoption.js';
import { updateLinewiseWorkflowState } from '../xml-compare/XmlCompareLinewiseWorkflowState.js';
import { applyXmlCompareSideload } from '../xml-compare/XmlCompareSideloadEnricher.js';
import {
  createCategorizedInputXmlWorkerClient,
  installCategorizedInputXmlWorkerRuntime,
} from '../xml-compare/categorized-inputxml-worker/index.js';
import { renderLinewiseWorkflowPopupHtml } from '../xml-compare/XmlCompareLinewiseWorkflowView.js';

function createEndpoint() {
  const listeners = new Map();
  return {
    peer: null,
    terminated: false,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    postMessage(message) {
      if (this.terminated) throw new Error('Endpoint terminated.');
      const data = structuredClone(message);
      queueMicrotask(() => this.peer?.emit('message', { data }));
    },
    emit(type, event) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    terminate() { this.terminated = true; listeners.clear(); },
  };
}

function createWorkerPair() {
  const client = createEndpoint(), worker = createEndpoint();
  client.peer = worker;
  worker.peer = client;
  return { client, worker };
}

const inputXml = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="L-OLD" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="219.1" WALL_THICK="8.18">
  <BEND RADIUS="300" />
</PIPINGELEMENT>
<RESTRAINT NODE="10" TYPE="14" STIFFNESS="1" GAP="0" MU="0" CNODE="0" />
</PIPINGMODEL>
</CAESARII>`;
const sideload = Object.freeze({
  lineIdText: 'FROM_NODE\tTO_NODE\tLINE_ID\n10\t20\tL-NEW',
  nodeNameText: 'FROM_NODE\tTO_NODE\tFROM_NAME\tTO_NAME\n10\t20\tN10\tN20',
  restraintTagText: '',
  coordinateText: '',
});
const imported = importLinewiseText({ fileName: 'linewise.input.xml', text: inputXml });
const linewise = updateLinewiseWorkflowState(imported, { sideload });
const idle = createLinewiseProducerAdoptionState();

const direct = applyXmlCompareSideload(inputXml, sideload);
const started = startLinewiseProducerRun(linewise);
assert.equal(started.linewiseState.lastEnriched, direct.xmlText, 'worker adoption preserves sideload output bytes');
assert.equal(started.adoption.status, 'running');
assert.equal(started.request.producer.id, 'xml-compare-linewise-sideload');
assert.equal(started.request.source.content, direct.xmlText);
assert.equal(linewiseCategorizedText(started.linewiseState, started.adoption), '', 'running worker owns categorized output without UI fallback');
assert.equal(ensureInputXml(started.linewiseState), direct.xmlText, 'enriched InputXML remains available while worker runs');

const pair = createWorkerPair();
const runtime = installCategorizedInputXmlWorkerRuntime({ scope: pair.worker });
const client = createCategorizedInputXmlWorkerClient({ worker: pair.client, clientId: 'xml-compare-linewise-test' });
const completed = await runLinewiseSideloadProducerAdoption(linewise, client);
assert.equal(completed.adoption.status, 'success');
assert.equal(completed.adoption.result.success, true);
assert.equal(completed.adoption.result.producer.id, 'xml-compare-linewise-sideload');
assert.equal(completed.adoption.result.source.fingerprint, completed.adoption.result.artifact.sourceFingerprint);
assert.ok(completed.adoption.result.artifact.text.includes('schema="categorized-inputxml/v3"'));
assert.ok(completed.adoption.result.artifact.text.includes('<LINE_ID>L-NEW</LINE_ID>'));
assert.equal(linewiseCategorizedText(completed.linewiseState, completed.adoption), completed.adoption.result.artifact.text);
const categorizedPreview = updateLinewiseWorkflowState(completed.linewiseState, { previewMode: 'categorized' });
assert.equal(linewisePreviewText(categorizedPreview, completed.adoption), completed.adoption.result.artifact.text);
assert.equal(ensureInputXml(completed.linewiseState), direct.xmlText);
assert.equal(linewiseCategorizedCanvasPayload(completed.linewiseState, completed.adoption, 'a').ready, true);
assert.ok(linewiseProducerReceiptJson(completed.linewiseState, completed.adoption).includes('XmlCompareLinewiseProducerReceipt.v1'));
const successHtml = renderLinewiseWorkflowPopupHtml({ ...completed.linewiseState, producerAdoption: completed.adoption, open: true, tab: 'sideload' });
assert.ok(successHtml.includes('Worker categorization passed'));
assert.ok(successHtml.includes('Download producer receipt JSON'));

const rejectedClient = Object.freeze({
  producer: Object.freeze({
    categorizeInputXml: async () => Object.freeze({
      success: false,
      diagnostics: Object.freeze([{ severity: 'error', code: 'TEST_REJECTED', message: 'Rejected by producer service.' }]),
      diagnosticCounts: Object.freeze({ total: 1, error: 1, warning: 0, information: 0 }),
      artifact: null,
    }),
  }),
});
const rejected = await runLinewiseSideloadProducerAdoption(linewise, rejectedClient);
assert.equal(rejected.adoption.status, 'failed');
assert.equal(rejected.adoption.error.code, 'TEST_REJECTED');
assert.equal(rejected.linewiseState.lastEnriched, direct.xmlText);
assert.equal(ensureInputXml(rejected.linewiseState), direct.xmlText);
assert.equal(linewiseCategorizedText(rejected.linewiseState, rejected.adoption), '');
assert.equal(linewiseCategorizedCanvasPayload(rejected.linewiseState, rejected.adoption, 'b').ready, false);
assert.ok(renderLinewiseWorkflowPopupHtml({ ...rejected.linewiseState, producerAdoption: rejected.adoption, open: true, tab: 'preview' }).includes('Worker categorization failed'));

const throwingClient = Object.freeze({
  producer: Object.freeze({
    categorizeInputXml: async () => { throw Object.assign(new Error('Worker transport unavailable.'), { code: 'WORKER_UNAVAILABLE' }); },
  }),
});
const failed = await runLinewiseSideloadProducerAdoption(linewise, throwingClient);
assert.equal(failed.adoption.status, 'failed');
assert.equal(failed.adoption.error.code, 'WORKER_UNAVAILABLE');
assert.equal(failed.linewiseState.lastEnriched, direct.xmlText);
assert.equal(linewiseCategorizedText(failed.linewiseState, failed.adoption), '');

const staleLinewise = updateLinewiseWorkflowState(completed.linewiseState, { lastEnriched: `${completed.linewiseState.lastEnriched}\n<!-- changed -->` });
assert.notEqual(linewiseCategorizedText(staleLinewise, completed.adoption), completed.adoption.result.artifact.text, 'stale receipt cannot own changed sideload output');

const ordinary = importLinewiseText({ fileName: 'ordinary.input.xml', text: inputXml });
assert.ok(linewiseCategorizedText(ordinary, idle).includes('categorized-inputxml/v3'), 'ordinary imports retain direct compatibility');

const actionsSource = fs.readFileSync(new URL('../xml-compare/XmlCompareLinewiseWorkflowActions.js', import.meta.url), 'utf8');
const stateSource = fs.readFileSync(new URL('../xml-compare/XmlCompareLinewiseWorkflowState.js', import.meta.url), 'utf8');
const tabSource = fs.readFileSync(new URL('../tabs/xml-compare-tab.js', import.meta.url), 'utf8');
assert.equal(actionsSource.includes('producerCategorizationStatus'), false, 'protected line-wise actions remain producer-agnostic');
assert.equal(stateSource.includes('producerCategorizationStatus'), false, 'protected line-wise state remains producer-agnostic');
assert.ok(tabSource.includes('createCategorizedInputXmlWorkerClient'), 'XML Compare tab imports the worker client');
assert.ok(tabSource.includes('linewiseProducerAdoption'), 'XML Compare tab owns producer adoption state');
assert.ok(tabSource.includes('linewiseProducerAbort'), 'XML Compare tab owns request cancellation');
assert.ok(tabSource.includes('.close?.()'), 'XML Compare tab closes the worker client during cleanup');

client.close();
runtime.dispose();
assert.equal(pair.client.terminated, true);
assert.equal(runtime.isDisposed(), true);

console.log('XML Compare line-wise producer adoption tests passed');
