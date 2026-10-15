/**
 * Functionality: coordinates browser file loading, independent validation,
 * immutable view-model creation, rendering, filtering, and selection. Search
 * result focus is explicit and never changes SVG scope until the user clicks a
 * result. Inputs are explicit DOM hosts. Output is a disposable controller API. Fallback:
 * validation stops with an actionable error until all three required JSON
 * artifacts are loaded; optional InputXML remains NOT_EVALUATED.
 */

import { readCanonicalTopology, readTopologyInputXml, readTopologyTraceLedger } from './topology-artifact-reader.js';
import { validateTopologyArtifacts } from './topology-independent-validator.js';
import { renderTopologyBottomPanel, buildTopologyInspectorMarkup } from './topology-ledger-table.js';
import { readManagedTopologySource } from './topology-source-reader.js';
import { bindProducerSourceIdentity } from './topology-source-identity.js';
import { applyTopologyTraceSelection, wireTopologySvgInteractions } from './topology-svg-interactions.js';
import { wireTopologySvgNavigation } from './topology-svg-navigation.js';
import { buildTopologySvgViewModel, updateTopologySearchViewModel } from './topology-svg-view-model.js';
import { renderTopologySearchStatus, renderTopologySvg } from './topology-svg-renderer.js';
import { buildTopologySearchResultsMarkup } from './topology-search-panel.js';
import { GEOMETRY_TOLERANCE_MM, asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { render3dViewer, select3dObject, dispose3dViewer } from './topology-3d-viewer-bridge.js?v=20260715-ttv-014-bend-fix';
import { artifactHash, escapeHtml, escapeAttribute, shortText, emptyNavigation, downloadEnrichedInputXml } from './topology-controller-helpers.js?v=20260715-ttv-015-native-caesar';

/** @param {Record<string, Element>} elements @returns {Readonly<Record<string, unknown>>} */
export function createTopologyValidatorController(elements) {
  let artifacts = { source: null, canonical: null, ledger: null, inputXml: null };
  let hashes = { source: '', canonical: '', ledger: '', inputXml: '' };
  let viewState = {
    mode: 'spatial', projection: 'XY', branch: '', types: [], disposition: '',
    searchName: '', searchRef: '', searchPath: '', labels: false, showComponentSymbols: false,
    visibility: { source: true, canonical: true, referenceConnections: false, pointFeatures: true, junctions: true, boundaries: true },
  };
  let validation = null, viewModel = null, selectedKey = '', activeBottomTab = 'summary';
  let destroySvgInteractions = () => {};
  let svgNavigation = emptyNavigation();

  /** @param {string} kind @param {string} text @param {string} fileName @returns {Promise<void>} */
  async function loadArtifact(kind, text, fileName) {
    try {
      if (kind === 'source') {
        artifacts = { source: readManagedTopologySource(JSON.parse(text)), canonical: null, ledger: null, inputXml: null };
        hashes = { source: '', canonical: '', ledger: '', inputXml: '' };
        resetCompanionView();
      }
      else if (kind === 'canonical') artifacts = { ...artifacts, canonical: readCanonicalTopology(JSON.parse(text)) };
      else if (kind === 'ledger') artifacts = { ...artifacts, ledger: readTopologyTraceLedger(JSON.parse(text)) };
      else if (kind === 'inputXml') artifacts = { ...artifacts, inputXml: readTopologyInputXml(text) };
      else throw new RangeError(`Unknown topology artifact kind: ${kind}`);
      if (artifacts.source && artifacts.ledger) {
        const originalSource = objectRecord(artifacts.source).raw;
        artifacts = {
          ...artifacts,
          source: bindProducerSourceIdentity(readManagedTopologySource(originalSource), artifacts.ledger),
        };
      }
      hashes = { ...hashes, [kind]: artifactHash(kind, artifacts[kind]) };
      validation = null;
      elements.fileStatus.querySelector(`[data-ttv-file-status="${kind}"]`).textContent = fileName;
      if (kind === 'source') updateSourceControls();
      setStatus(`${fileName} loaded. Select Validate after required artifacts are ready.`, 'ready');
      updateMetricStrip();
    } catch (error) {
      setStatus(`${fileName}: ${error?.message || String(error)}`, 'error');
      throw error;
    }
  }

  /** @returns {void} */
  function resetCompanionView() {
    for (const kind of ['canonical', 'ledger', 'inputXml']) {
      elements.fileStatus.querySelector(`[data-ttv-file-status="${kind}"]`).textContent = 'Not loaded';
    }
    destroySvgInteractions();
    svgNavigation.destroy();
    destroySvgInteractions = () => {};
    svgNavigation = emptyNavigation();
    elements.svgHost.innerHTML = '<div class="ttv-empty">Loading companion topology artifacts…</div>';
    elements.bottom.innerHTML = '';
    elements.inspector.innerHTML = '<div class="ttv-inspector-empty">Select an object after validation.</div>';
    validation = null;
    viewModel = null;
    selectedKey = '';
  }

  /** @param {string} kind @param {File} file @returns {Promise<void>} */
  async function loadFile(kind, file) {
    if (!file) throw new TypeError(`A file is required for ${kind}.`);
    await loadArtifact(kind, await file.text(), file.name);
  }

  /** @returns {Readonly<Record<string, unknown>>} */
  function validate() {
    if (!artifacts.source || !artifacts.canonical || !artifacts.ledger) {
      const missing = ['source', 'canonical', 'ledger'].filter((kind) => !artifacts[kind]);
      throw new Error(`Required artifacts not loaded: ${missing.join(', ')}.`);
    }
    assertNoMutation();
    validation = validateTopologyArtifacts(artifacts, GEOMETRY_TOLERANCE_MM);
    render();
    setStatus(`Validation complete: ${validation.metrics.issueCount} findings, ${validation.metrics.blockingIssueCount} blocking.`, validation.metrics.blockingIssueCount ? 'error' : 'pass');
    return validation;
  }

  /** @returns {void} */
  function render() {
    if (!validation) return;
    assertNoMutation();
    viewModel = buildTopologySvgViewModel({ ...artifacts, validation, state: viewState });
    if (viewState.projection !== '3D') {
      dispose3dViewer();
      destroySvgInteractions();
      svgNavigation.destroy();
      const svg = renderTopologySvg(elements.svgHost, viewModel);
      renderTopologyBottomPanel(elements.bottom, viewModel, activeBottomTab);
      svgNavigation = wireTopologySvgNavigation(svg);
      destroySvgInteractions = wireTopologySvgInteractions(svg, elements.traceRoot, objectRecord(viewModel.selectionLookup).byObjectKey, selectGroup);
    } else {
      destroySvgInteractions();
      svgNavigation.destroy();
      destroySvgInteractions = () => {};
      svgNavigation = emptyNavigation();
      renderTopologyBottomPanel(elements.bottom, viewModel, activeBottomTab);
      render3dViewer(elements, viewModel, selectedKey, select);
    }
    elements.searchResults.innerHTML = buildTopologySearchResultsMarkup(viewModel);
    elements.inspector.innerHTML = buildTopologyInspectorMarkup(viewModel, selectedKey ? objectRecord(objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey)[selectedKey]) : null);
    if (selectedKey && viewState.projection !== '3D') applyTopologyTraceSelection(elements.traceRoot, objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey), selectedKey);
    updateMetricStrip();
    updateSearchStatus();
  }

  /** @param {Record<string, unknown>|null} selection @returns {void} */
  function selectGroup(selection, objectKey) {
    selectedKey = selection ? cleanText(objectKey) : '';
    elements.inspector.innerHTML = buildTopologyInspectorMarkup(viewModel, selection);
  }

  /** @param {string} objectKey @returns {Record<string, unknown>|null} */
  function select(objectKey) {
    if (!viewModel) return null;
    selectedKey = objectKey;
    const selection = viewState.projection !== '3D'
      ? applyTopologyTraceSelection(elements.traceRoot, objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey), objectKey)
      : (objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey)[objectKey] ?? null);
    elements.inspector.innerHTML = buildTopologyInspectorMarkup(viewModel, selection);
    if (viewState.projection === '3D') {
      select3dObject(objectKey);
    }
    return selection;
  }

  /** @param {string} objectKey @returns {Record<string, unknown>|null} */
  function focusSearchResult(objectKey) {
    if (!viewModel) return null;
    const result = asArray(viewModel.searchResults).map(objectRecord).find((row) => cleanText(row.objectKey) === cleanText(objectKey));
    if (!result) throw new RangeError(`Search result is not available: ${objectKey}`);
    const branch = cleanText(result.branch);
    viewState = { ...viewState, branch, showComponentSymbols: true };
    selectedKey = cleanText(objectKey);
    syncBranchControls(branch, true);
    render();
    return select(selectedKey);
  }

  /** @param {string} mode @returns {void} */
  function setMode(mode) {
    if (!['spatial', 'trace', 'junctions', 'issues'].includes(mode)) throw new RangeError(`Unsupported topology SVG mode: ${mode}`);
    viewState = { ...viewState, mode };
    render();
  }

  /** @param {string} projection @returns {void} */
  function setProjection(projection) {
    if (!['XY', 'XZ', 'YZ', '3D'].includes(projection)) throw new RangeError(`Unsupported projection: ${projection}`);
    viewState = { ...viewState, projection };
    render();
  }

  /** @param {Record<string, unknown>} patch @returns {void} */
  function setFilters(patch) {
    viewState = { ...viewState, ...patch };
    render();
  }

  /** @param {string} key @param {string} value @returns {void} */
  function setSearch(key, value) {
    if (!['searchName', 'searchRef', 'searchPath'].includes(key)) throw new RangeError(`Unknown topology search key: ${key}`);
    viewState = { ...viewState, [key]: value };
    if (!viewModel) return;
    assertNoMutation();
    viewModel = updateTopologySearchViewModel(viewModel, viewState);
    elements.searchResults.innerHTML = buildTopologySearchResultsMarkup(viewModel);
    const svg = elements.svgHost.querySelector('svg');
    if (svg) renderTopologySearchStatus(svg, viewModel);
    updateSearchStatus();
  }

  /** @returns {void} */
  function fitView() {
    svgNavigation.fit();
  }

  /** @param {string} direction @returns {void} */
  function zoomView(direction) {
    if (direction === 'in') svgNavigation.zoomIn();
    else if (direction === 'out') svgNavigation.zoomOut();
    else throw new RangeError(`Unknown topology zoom direction: ${direction}`);
  }

  /** @param {string} key @param {boolean} visible @returns {void} */
  function setVisibility(key, visible) {
    if (!Object.hasOwn(viewState.visibility, key)) throw new RangeError(`Unknown topology visibility key: ${key}`);
    viewState = { ...viewState, visibility: { ...viewState.visibility, [key]: visible } };
    render();
  }

  /** @param {string} tabId @returns {void} */
  function setBottomTab(tabId) {
    activeBottomTab = tabId;
    render();
  }

  /** @returns {void} */
  function assertNoMutation() {
    for (const kind of ['source', 'canonical', 'ledger', 'inputXml']) {
      if (!artifacts[kind]) continue;
      const current = artifactHash(kind, artifacts[kind]);
      if (current !== hashes[kind]) throw new Error(`Immutable ${kind} artifact changed after load (${hashes[kind]} -> ${current}).`);
    }
  }

  /** @returns {void} */
  function updateSourceControls() {
    const source = objectRecord(artifacts.source), branches = asArray(source.branches).map(objectRecord);
    elements.branchTree.innerHTML = `<button type="button" data-ttv-branch="" class="is-active">All branches<span>${branches.length}</span></button>${branches.map((branch) => `<button type="button" data-ttv-branch="${escapeAttribute(branch.name)}">${escapeHtml(shortText(branch.name, 35))}<span>${asArray(branch.components).length}</span></button>`).join('')}`;
    const counts = objectRecord(objectRecord(source.metrics).componentCategoryCounts), types = Object.keys(counts);
    elements.typeFilters.innerHTML = types.map((type) => `<label><input type="checkbox" data-ttv-type="${escapeAttribute(type)}" checked>${escapeHtml(type)} <span>${counts[type]}</span></label>`).join('');
    viewState = { ...viewState, branch: '', types, showComponentSymbols: false };
    elements.componentSymbols.checked = false;
  }

  /** @param {string} branch @param {boolean} showComponentSymbols @returns {void} */
  function syncBranchControls(branch, showComponentSymbols) {
    elements.branchTree.querySelectorAll('[data-ttv-branch]').forEach((button) => {
      button.classList.toggle('is-active', cleanText(button.getAttribute('data-ttv-branch')) === branch);
    });
    elements.componentSymbols.checked = showComponentSymbols;
  }

  /** @returns {void} */
  function updateMetricStrip() {
    const metrics = objectRecord(validation?.metrics ?? objectRecord(artifacts.source).metrics);
    elements.metricStrip.innerHTML = [
      ['Branches', metrics.branchCount], ['Source', metrics.sourceComponentCount], ['Route', metrics.routeComponentCount],
      ['Supports', metrics.deferredSupportCount], ['Nodes', metrics.canonicalNodeCount], ['Edges', metrics.canonicalEdgeCount],
      ['Issues', metrics.issueCount], ['InputXML', validation?.inputXmlStatus ?? 'NOT_EVALUATED'],
    ].map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value ?? '—')}</span>`).join('');
  }

  /** @returns {void} */
  function updateSearchStatus() {
    const summary = objectRecord(viewModel?.filterSummary);
    if (summary.searchActive !== true) return;
    setStatus(`Search: ${summary.sourceMatchCount} matches listed; SVG scope ${summary.displayScope} remains unchanged with ${summary.displayedSourceCount} displayed source objects.`, summary.sourceMatchCount ? 'ready' : 'error');
  }

  /** @param {string} message @param {string} kind @returns {void} */
  function setStatus(message, kind) {
    elements.status.textContent = message;
    elements.status.setAttribute('data-status', kind);
  }

  /** @returns {Readonly<Record<string, unknown>>} */
  function evidence() {
    return Object.freeze({ artifacts, hashes, validation, viewModel, viewState, activeBottomTab });
  }

  /** @returns {void} */
  function destroy() {
    dispose3dViewer();
    destroySvgInteractions();
    svgNavigation.destroy();
  }

  updateMetricStrip();
  return Object.freeze({
    loadArtifact, loadFile, validate, render, select, focusSearchResult, setMode, setProjection,
    setFilters, setSearch, setVisibility, setBottomTab, fitView, zoomView, assertNoMutation,
    evidence, downloadEnrichedInputXml: () => downloadEnrichedInputXml(artifacts), destroy
  });
}
