/** Composes Trace, the 3D Edit Draft, the SVG support-draft editor, and Parity. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import { buildBranchScopeTree, readStagedBranches } from '../../workbench3d/core/staged-json-core.js';
import { openBranchScopePopup } from './topology-branch-scope-popup.js';
import {
  branchSelectionIdsForIndexes, createHeadlessTopologyEditScope, createTopologyEditScope, scopeContainsBranchIndexes,
  suggestionBranchIndexes, topologyModelMode,
} from './topology-edit-scope-model.js';

const TRACE_KINDS = new Set(['source', 'canonical', 'ledger', 'inputXml']);
const PARITY_KINDS = new Set(['canonical', 'ledger', 'scene', 'parsed', 'report', 'ciiProjection']);
const WORKSPACE_TABS = new Set(['trace', 'edit', 'parity']);

/** @param {string} key @returns {Record<string,string>|null} */
function canonicalSelectionFromKey(key) {
  const value = cleanText(key);
  let match = value.match(/^canonical:(node|edge):(.+)$/);
  if (match) return { kind: match[1], id: match[2] };
  match = value.match(/^scene:(node|edge|support):(.+)$/);
  if (match) return { kind: match[1], id: match[2] };
  return null;
}

/** @param {Record<string, unknown>|null} selection @param {string} requestedKey @returns {ReadonlyArray<Record<string,string>>} */
function selectionRows(selection, requestedKey) {
  const record = objectRecord(selection), object = objectRecord(record.object);
  const keys = [requestedKey, ...asArray(record.keys), ...asArray(record.linkedObjectKeys), cleanText(record.objectKey), cleanText(object.objectKey)];
  const rows = keys.map(canonicalSelectionFromKey).filter(Boolean);
  if (!rows.length) {
    const nodeId = cleanText(object.canonicalNodeId), edgeId = cleanText(object.canonicalEdgeId), supportId = cleanText(object.canonicalSupportId);
    if (nodeId) rows.push({ kind: 'node', id: nodeId });
    if (edgeId) rows.push({ kind: 'edge', id: edgeId });
    if (supportId) rows.push({ kind: 'support', id: supportId });
  }
  const seen = new Set();
  return Object.freeze(rows.filter((row) => {
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }));
}

/** @param {Record<string, unknown>} traceController @param {Record<string, unknown>} editController 3D Edit Draft @param {Record<string, unknown>} parityController @param {Record<string, unknown>} editorController SVG support-draft editor @returns {Readonly<Record<string, unknown>>} */
export function createTopologyWorkspaceController(traceController, editController, parityController, editorController) {
  let activeTab = 'trace', editScope = null;

  function configuredThreshold(root) {
    return Number(root.querySelector('[data-ttv-large-model-threshold]')?.value ?? 200);
  }

  function currentModelMode(root) {
    const canonical = objectRecord(objectRecord(traceController.evidence().artifacts).canonical);
    return topologyModelMode(canonical, configuredThreshold(root));
  }

  function renderScopeStatus(root, mode) {
    const target = root.querySelector('[data-ttv-edit-scope-status]');
    if (!target) return;
    target.textContent = mode.requiresScope
      ? editScope
        ? `${mode.elementCount.toLocaleString()} elements · ${editScope.stats?.matched ?? 0} loaded branch(es) · full export`
        : `${mode.elementCount.toLocaleString()} elements · branches not loaded · full export retained`
      : `${mode.elementCount.toLocaleString()} elements · full Draft Edit`;
  }

  function renderBranchLoadRequired(root) {
    const status = root.querySelector('[data-ttv-edit-status]');
    if (!status) return;
    status.textContent = 'Large-model Draft Edit is ready. Select Load JSON branches only when interactive branch geometry is required; Auto fix runs model-wide without this view scope.';
    status.setAttribute('data-status', 'ready');
  }

  async function requestEditScope(root, requiredIndexes) {
    const evidence = traceController.evidence(), source = objectRecord(objectRecord(evidence.artifacts).source);
    const branches = readStagedBranches(source.raw).branches;
    if (!branches.length) throw new Error('Large-model Draft Edit requires managed source branches.');
    const initialSelectedIds = branchSelectionIdsForIndexes(source.raw, requiredIndexes);
    const result = await openBranchScopePopup(root.ownerDocument, buildBranchScopeTree(branches), {
      title: `Select Draft Edit zone / branch · ${branches.length} branches · full Trace and export retained`, initialSelectedIds,
    });
    if (result.cancelled) return false;
    if (!result.wildcard && !result.selectedIds.length) {
      root.ownerDocument.defaultView?.alert('Select at least one zone or branch for large-model Draft Edit.');
      return requestEditScope(root, requiredIndexes);
    }
    const next = createTopologyEditScope(source.raw, result);
    if (!scopeContainsBranchIndexes(next, requiredIndexes)) {
      root.ownerDocument.defaultView?.alert('The selected scope does not contain every object required by the proposed automatic fix.');
      return requestEditScope(root, requiredIndexes);
    }
    editScope = next; editController.setEditScope(editScope); return true;
  }

  async function ensureEditScope(root, force, requiredIndexes) {
    const mode = currentModelMode(root);
    if (!mode.requiresScope) { editScope = null; editController.setEditScope(null); renderScopeStatus(root, mode); return true; }
    const required = asArray(requiredIndexes).map(Number);
    if (force || !editScope || !scopeContainsBranchIndexes(editScope, required)) {
      if (!await requestEditScope(root, required)) return false;
    }
    renderScopeStatus(root, mode); return true;
  }

  async function loadArtifact(kind, text, fileName) {
    const results = {};
    if (TRACE_KINDS.has(kind)) {
      if (kind === 'source') { editScope = null; editController.setEditScope(null); }
      editorController.reset();
      results.trace = await traceController.loadArtifact(kind, text, fileName);
    }
    if (PARITY_KINDS.has(kind)) results.parity = await parityController.loadArtifact(kind, text, fileName);
    if (!TRACE_KINDS.has(kind) && !PARITY_KINDS.has(kind)) throw new RangeError(`Unknown topology workspace artifact: ${kind}`);
    return Object.freeze(results);
  }

  async function loadFile(kind, file) {
    if (!file || typeof file.text !== 'function') throw new TypeError(`A file is required for ${kind}.`);
    return loadArtifact(kind, await file.text(), file.name);
  }

  function validate() {
    const trace = traceController.validate();
    const parity = parityController.validate();
    return Object.freeze({ trace, parity, edit: editController.evidence() });
  }

  /** @param {ReadonlyArray<Record<string,string>>} selection @param {string} source @returns {void} */
  function synchronizeCanonicalSelection(selection, source) {
    const rows = asArray(selection).map(objectRecord).filter((row) => cleanText(row.id));
    if (source !== 'edit') editController.setExternalSelection(rows);
    const active = rows.at(-1);
    if (!active) return;
    const kind = cleanText(active.kind), rawId = cleanText(active.id), id = kind === 'bend' ? rawId.replace(/^bend:/, '') : rawId;
    if (source !== 'trace' && ['node', 'edge'].includes(kind)) traceController.select(`canonical:${kind}:${id}`);
    if (source !== 'parity' && ['node', 'edge', 'support'].includes(kind)) parityController.select(`scene:${kind}:${id}`);
  }

  /** @param {ReadonlyArray<Record<string,string>>} selection @returns {void} */
  function focusCanonicalSelection(selection) {
    const active = asArray(selection).map(objectRecord).filter((row) => cleanText(row.id)).at(-1);
    if (!active) return;
    const kind = cleanText(active.kind), id = cleanText(active.id).replace(/^bend:/, '');
    if (activeTab === 'trace' && ['node', 'edge'].includes(kind)) traceController.zoomToObject(`canonical:${kind}:${id}`);
    else if (activeTab === 'parity' && ['node', 'edge', 'support'].includes(kind)) parityController.select(`scene:${kind}:${id}`, true);
    else if (activeTab === 'edit') editController.focusSelection();
  }

  /** @param {string} objectKey @param {string} surface @returns {ReadonlyArray<Record<string,string>>} */
  function synchronizeSurfaceSelection(objectKey, surface) {
    const selection = surface === 'trace' ? traceController.select(objectKey) : parityController.select(objectKey);
    const rows = selectionRows(selection, objectKey);
    synchronizeCanonicalSelection(rows, surface);
    return rows;
  }

  /** @param {string} tab @param {ParentNode} root @returns {Promise<void>} */
  async function activateTab(tab, root) {
    const next = cleanText(tab);
    if (!WORKSPACE_TABS.has(next)) throw new RangeError(`Unknown topology workspace tab ${next}.`);
    activeTab = next;
    root.querySelectorAll('[data-ttv-workspace-tab]').forEach((button) => {
      const active = button.getAttribute('data-ttv-workspace-tab') === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    root.querySelectorAll('[data-ttv-workspace-panel]').forEach((panel) => {
      const active = panel.getAttribute('data-ttv-workspace-panel') === next;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    if (next === 'edit') {
      const mode = currentModelMode(root); renderScopeStatus(root, mode);
      if (mode.requiresScope && !editScope) renderBranchLoadRequired(root);
      else await editController.initialize(traceController.evidence());
    }
    else if (next === 'parity') parityController.render();
    else traceController.render();
    const currentSelection = asArray(editController.evidence().selection);
    if (currentSelection.length) synchronizeCanonicalSelection(currentSelection, 'edit');
    return true;
  }

  async function loadEditBranches(root) {
    const mode = currentModelMode(root);
    const loaded = mode.requiresScope ? await ensureEditScope(root, true, []) : true;
    if (!loaded) return false;
    renderScopeStatus(root, mode); await editController.initialize(traceController.evidence()); editController.render();
    return true;
  }

  async function prepareEditForSuggestions(suggestions, root) {
    const canonical = objectRecord(objectRecord(traceController.evidence().artifacts).canonical);
    const requested = asArray(suggestions), mode = currentModelMode(root);
    if (mode.requiresScope && !editScope) throw new Error('Load JSON branches in Edit Draft before applying an interactive selected fix on a large model.');
    const scoped = mode.requiresScope ? requested.filter((suggestion) => {
      const indexes = suggestionBranchIndexes(canonical, [suggestion]);
      return !indexes.length || scopeContainsBranchIndexes(editScope, indexes);
    }) : requested;
    await editController.initialize(traceController.evidence()); return Object.freeze(scoped);
  }

  /** Model-wide Auto fix owns a full command draft; large geometry stays on an empty render scope until loaded manually. */
  async function prepareEditForAutoFix(suggestions, root) {
    const requested = Object.freeze(asArray(suggestions));
    const mode = currentModelMode(root);
    editController.setEditScope(mode.requiresScope && !editScope ? createHeadlessTopologyEditScope() : editScope);
    await editController.initialize(traceController.evidence());
    return requested;
  }

  /** Download the current committed draft InputXML, or the immutable loaded artifact before a draft exists. */
  function downloadCurrentInputXml(documentRef) {
    const edited = objectRecord(objectRecord(editController.evidence()).editedArtifacts);
    const xml = typeof edited.topologyInputXml === 'string' ? edited.topologyInputXml : '';
    if (!xml) return traceController.downloadEnrichedInputXml();
    const sourceName = cleanText(objectRecord(traceController.evidence().fileNames).source);
    const fileName = `${outputStem(sourceName)}.topology.input.xml`;
    downloadText(documentRef, fileName, xml, 'application/xml;charset=utf-8');
    return Object.freeze({ source: 'EDIT_DRAFT', fileName });
  }

  function evidence() {
    return Object.freeze({
      trace: traceController.evidence(),
      edit: editController.evidence(),
      editor: editorController.evidence(),
      parity: parityController.evidence(),
      activeTab, modelMode: null, editScope,
    });
  }

  function destroy() {
    editorController.destroy();
    traceController.destroy();
    editController.destroy();
    parityController.destroy();
  }

  return Object.freeze({
    loadArtifact,
    loadFile,
    validate,
    evidence,
    destroy,
    activateTab,
    loadEditBranches,
    prepareEditForSuggestions,
    prepareEditForAutoFix,
    downloadCurrentInputXml,
    modelMode: currentModelMode,
    synchronizeCanonicalSelection,
    focusCanonicalSelection,
    synchronizeSurfaceSelection,
    render: traceController.render,
    select: traceController.select,
    focusSearchResult: traceController.focusSearchResult,
    zoomToObject: traceController.zoomToObject,
    setMode: traceController.setMode,
    setProjection: traceController.setProjection,
    setFilters: traceController.setFilters,
    setSearch: traceController.setSearch,
    setVisibility: traceController.setVisibility,
    setBottomTab: traceController.setBottomTab,
    fitView: traceController.fitView,
    zoomView: traceController.zoomView,
    assertNoMutation: traceController.assertNoMutation,
    downloadEnrichedInputXml: traceController.downloadEnrichedInputXml,
    edit: editController,
    editor: editorController,
    parity: parityController,
  });
}

export const _test = Object.freeze({ TRACE_KINDS, PARITY_KINDS, WORKSPACE_TABS, canonicalSelectionFromKey, selectionRows });
