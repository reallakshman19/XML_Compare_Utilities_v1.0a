import { createEngineeringPropertyAggregate, freezeJsonValue } from '../../core/engineering-scene/index.js';
import { aggregateEngineeringSvgProperties } from '../../core/engineering-svg/engineering-svg-property-runtime.js';
import { buildEngineeringSvgInspectorModel } from '../../core/engineering-svg/engineering-svg-inspector-model.js';
import { createEngineeringSvgPropertyInspectorView } from '../../core/engineering-svg/engineering-svg-property-inspector-view.js';
import {
  createRevisionComparePropertyEvidence,
  rawRevisionDifferenceEvidence,
  revisionComparePropertyAuditKey,
} from './revision-compare-property-evidence.js';

export const REVISION_COMPARE_PROPERTY_INSPECTOR_SCHEMA = 'RevisionComparePropertyInspector.v1';

function element(documentRef, tag, attributes = {}) {
  const node = documentRef.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
  return node;
}

function clearChildren(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}

function displayRawValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return String(value);
  if (typeof value === 'function') return `[function ${value.name || 'anonymous'}]`;
  try { return JSON.stringify(value); } catch { return Object.prototype.toString.call(value); }
}

function pathText(item) {
  const revA = item.revAEvidencePath ?? 'Unavailable';
  const revB = item.revBEvidencePath ?? 'Unavailable';
  return `Rev A: ${revA} · Rev B: ${revB}`;
}

function fallbackTable(documentRef, items, failure = false) {
  if (!items.length) return null;
  const section = element(documentRef, 'section', { 'data-revc-property-fallback': failure ? 'failure' : 'unsupported' });
  const message = element(documentRef, 'p');
  message.textContent = failure
    ? 'Shared property presentation failed. Raw audit evidence remains available.'
    : 'Unsupported property evidence retained from the audit.';
  const table = element(documentRef, 'table', { class: 'revc-property-table' });
  const head = element(documentRef, 'thead');
  const headRow = element(documentRef, 'tr');
  ['Property', 'Rev A', 'Rev B', 'Reason', 'Evidence paths'].forEach((label) => {
    const cell = element(documentRef, 'th'); cell.textContent = label; headRow.appendChild(cell);
  });
  head.appendChild(headRow); table.appendChild(head);
  const body = element(documentRef, 'tbody');
  items.forEach((item) => {
    const row = element(documentRef, 'tr', { 'data-revc-property-fallback-key': item.propertyKey ?? '' });
    [item.propertyKey, displayRawValue(item.revAValue), displayRawValue(item.revBValue), item.reason, pathText(item)]
      .forEach((value, index) => {
        const cell = element(documentRef, index === 0 ? 'th' : 'td'); cell.textContent = value ?? 'Unavailable'; row.appendChild(cell);
      });
    body.appendChild(row);
  });
  table.appendChild(body); section.append(message, table);
  return section;
}

function createScaffold(host, differenceId) {
  const documentRef = host.ownerDocument;
  clearChildren(host);
  const context = element(documentRef, 'p', { class: 'revc-property-direction' });
  context.textContent = 'Previous = Rev A · Current = Rev B';
  const status = element(documentRef, 'p', { 'data-revc-property-status': 'loading' });
  status.textContent = 'Loading persisted property evidence…';
  const shared = element(documentRef, 'div', {
    class: 'revc-property-shared',
    'data-revc-shared-property-view': differenceId,
  });
  const fallback = element(documentRef, 'div', { 'data-revc-property-fallback-host': differenceId });
  host.append(context, status, shared, fallback);
  return { context, status, shared, fallback };
}

function hideSharedChrome(host) {
  [
    '[data-engineering-svg-inspector-heading]',
    '[data-engineering-svg-inspector-summary]',
    '[data-engineering-svg-inspector-actions]',
  ].forEach((selector) => {
    const node = host.querySelector(selector);
    if (node) { node.hidden = true; node.setAttribute('aria-hidden', 'true'); }
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function failureEvidence(adapter, audit, differenceId) {
  try {
    return adapter?.rawAuditEvidence(differenceId)
      ?? rawRevisionDifferenceEvidence(audit, differenceId);
  } catch {
    try { return rawRevisionDifferenceEvidence(audit, differenceId); } catch { return Object.freeze([]); }
  }
}

function fieldForKey(propertySets, differenceId, key) {
  return propertySets.flatMap((set) => (
    set.ownerIds.includes(differenceId) ? set.fields : []
  )).find((field) => field.key === key) ?? null;
}

function preserveExplicitCurrentSources(propertyViews, propertySets, differenceId) {
  return freezeJsonValue(propertyViews.map((view) => {
    const field = fieldForKey(propertySets, differenceId, view.field.key);
    if (field?.source !== null || view.sourceAggregate.state !== 'not-applicable') return view;
    return {
      ...view,
      sourceAggregate: createEngineeringPropertyAggregate({
        key: view.field.key,
        state: 'uniform',
        value: null,
        selectedCount: view.aggregate.selectedCount,
      }),
      sourceEvidenceCount: view.aggregate.selectedCount,
    };
  }));
}

export function createRevisionComparePropertyInspector(options = {}) {
  const evidenceFactory = options.evidenceFactory ?? createRevisionComparePropertyEvidence;
  let generation = 0;
  let currentHost = null;
  let currentView = null;
  let currentEvidence = null;
  let currentAuditId = null;
  let currentAuditKey = null;
  let currentDifferenceId = null;
  let failure = null;
  let disposed = false;
  let requests = 0;
  let staleResultsIgnored = 0;

  function destroyView() {
    currentView?.destroy();
    currentView = null;
  }

  function adapterFor(audit) {
    const nextKey = revisionComparePropertyAuditKey(audit);
    if (!currentEvidence || currentAuditKey !== nextKey) {
      currentEvidence = null;
      currentAuditKey = nextKey;
      currentAuditId = audit.auditId;
      currentEvidence = evidenceFactory(audit);
    }
    return currentEvidence;
  }

  function clear() {
    generation += 1;
    destroyView();
    clearChildren(currentHost);
    currentHost = null;
    currentDifferenceId = null;
    failure = null;
  }

  async function render(host, audit, differenceId) {
    if (disposed) throw new TypeError('Revision Compare property inspector is disposed.');
    if (!host?.ownerDocument?.createElement) throw new TypeError('Revision Compare property host is required.');
    const id = String(differenceId ?? '').trim();
    if (!id) { clear(); return false; }
    generation += 1;
    const requestGeneration = generation;
    requests += 1;
    destroyView();
    currentHost = host;
    currentDifferenceId = id;
    failure = null;
    const scaffold = createScaffold(host, id);
    let adapter = null;
    try {
      adapter = adapterFor(audit);
      const sets = await adapter.provider.getPropertySets([id], adapter.revision);
      if (requestGeneration !== generation || host !== currentHost) {
        staleResultsIgnored += 1;
        return false;
      }
      const aggregated = aggregateEngineeringSvgProperties([id], sets);
      const propertyViews = preserveExplicitCurrentSources(aggregated, sets, id);
      const model = buildEngineeringSvgInspectorModel({ selectedIds: [id], propertyViews, draft: {} });
      scaffold.status.remove();
      if (model.rows.length) {
        currentView = createEngineeringSvgPropertyInspectorView({
          host: scaffold.shared,
          idPrefix: `revc-${id}`,
        });
        currentView.render(model);
        hideSharedChrome(scaffold.shared);
      } else {
        const empty = element(host.ownerDocument, 'p', { class: 'revc-empty', 'data-revc-property-empty': id });
        empty.textContent = 'No supported scalar property changes.';
        scaffold.shared.appendChild(empty);
      }
      const unsupported = adapter.fallback(id);
      const fallback = fallbackTable(host.ownerDocument, unsupported, false);
      if (fallback) scaffold.fallback.appendChild(fallback);
      return true;
    } catch (error) {
      if (requestGeneration !== generation || host !== currentHost) {
        staleResultsIgnored += 1;
        return false;
      }
      destroyView();
      clearChildren(scaffold.shared);
      failure = errorMessage(error);
      scaffold.status.setAttribute('data-revc-property-status', 'failed');
      scaffold.status.textContent = `Property evidence unavailable: ${failure}`;
      const fallback = fallbackTable(host.ownerDocument, failureEvidence(adapter, audit, id), true);
      if (fallback) scaffold.fallback.appendChild(fallback);
      return false;
    }
  }

  function evidence() {
    return Object.freeze({
      schema: REVISION_COMPARE_PROPERTY_INSPECTOR_SCHEMA,
      generation,
      auditId: currentAuditId,
      auditKey: currentAuditKey,
      differenceId: currentDifferenceId,
      requests,
      staleResultsIgnored,
      mountedViews: currentView ? 1 : 0,
      actionListeners: currentView ? 2 : 0,
      failure,
      disposed,
      adapter: currentEvidence?.evidence?.() ?? null,
    });
  }

  function dispose() {
    if (disposed) return false;
    clear();
    currentEvidence = null;
    currentAuditId = null;
    currentAuditKey = null;
    disposed = true;
    return true;
  }

  return Object.freeze({ render, clear, evidence, dispose });
}

export const _test = Object.freeze({ displayRawValue, fallbackTable, preserveExplicitCurrentSources });
