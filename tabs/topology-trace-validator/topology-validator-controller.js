/**
 * Coordinates artifact loading, validation, immutable SVG view-model creation,
 * rendering, filtering, navigation, and selection for the Trace workspace.
 * Every projection, including 3D/ISO, uses the native SVG renderer.
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
import { artifactHash, escapeHtml, escapeAttribute, shortText, emptyNavigation, downloadEnrichedInputXml } from './topology-controller-helpers.js?v=20260715-ttv-015-native-caesar';

/** @param {Record<string, Element>} elements @returns {Readonly<Record<string, unknown>>} */
export function createTopologyValidatorController(elements) {
  let artifacts = { source: null, canonical: null, ledger: null, inputXml: null };
  let hashes = { source: '', canonical: '', ledger: '', inputXml: '' };
  // fileNames feed the Edit Draft producer options (source name) via evidence().
  let fileNames = { source: '', canonical: '', ledger: '', inputXml: '' };
  let viewState = {
    mode: 'spatial', projection: 'XY', branch: '', types: [], disposition: '',
    searchName: '', searchRef: '', searchPath: '', labels: false,
    showComponentSymbols: false, isolateSupports: false,
    visibility: { source: true, canonical: true, referenceConnections: false, pointFeatures: true, junctions: true, boundaries: true },
  };
  let validation = null;
  let viewModel = null;
  let selectedKey = '';
  let activeBottomTab = 'summary';
  let destroySvgInteractions = () => {};
  let svgNavigation = emptyNavigation();
  let viewModelAdapter = (value) => value;
  let renderObserver = () => {};
  let selectionObserver = () => {};

  async function loadArtifact(kind, text, fileName) {
    try {
      if (kind === 'source') {
        artifacts = { source: readManagedTopologySource(JSON.parse(text)), canonical: null, ledger: null, inputXml: null };
        hashes = { source: '', canonical: '', ledger: '', inputXml: '' };
        fileNames = { source: fileName, canonical: '', ledger: '', inputXml: '' };
        resetCompanionView();
      } else if (kind === 'canonical') artifacts = { ...artifacts, canonical: readCanonicalTopology(JSON.parse(text)) };
      else if (kind === 'ledger') artifacts = { ...artifacts, ledger: readTopologyTraceLedger(JSON.parse(text)) };
      else if (kind === 'inputXml') artifacts = { ...artifacts, inputXml: readTopologyInputXml(text) };
      else throw new RangeError(`Unknown topology artifact kind: ${kind}`);
      if (artifacts.source && artifacts.ledger) {
        const originalSource = objectRecord(artifacts.source).raw;
        artifacts = { ...artifacts, source: bindProducerSourceIdentity(readManagedTopologySource(originalSource), artifacts.ledger) };
      }
      hashes = { ...hashes, [kind]: artifactHash(kind, artifacts[kind]) };
      fileNames = { ...fileNames, [kind]: fileName };
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

  async function loadFile(kind, file) {
    if (!file) throw new TypeError(`A file is required for ${kind}.`);
    await loadArtifact(kind, await file.text(), file.name);
  }

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

  function render() {
    if (!validation) return;
    assertNoMutation();
    const baseViewModel = buildTopologySvgViewModel({ ...artifacts, validation, state: viewState });
    viewModel = viewModelAdapter(baseViewModel) ?? baseViewModel;
    destroySvgInteractions();
    svgNavigation.destroy();
    const svg = renderTopologySvg(elements.svgHost, viewModel);
    renderTopologyBottomPanel(elements.bottom, viewModel, activeBottomTab);
    svgNavigation = wireTopologySvgNavigation(svg);
    destroySvgInteractions = wireTopologySvgInteractions(svg, elements.traceRoot, objectRecord(viewModel.selectionLookup).byObjectKey, selectGroup);
    elements.searchResults.innerHTML = buildTopologySearchResultsMarkup(viewModel);
    const lookup = objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey);
    elements.inspector.innerHTML = buildTopologyInspectorMarkup(viewModel, selectedKey ? lookup[selectedKey] : null);
    if (selectedKey) applyTopologyTraceSelection(elements.traceRoot, lookup, selectedKey);
    updateMetricStrip();
    updateSearchStatus();
    renderObserver({ svg, viewModel, baseViewModel, selectedKey });
  }

  function selectGroup(selection, objectKey) {
    selectedKey = selection ? cleanText(objectKey) : '';
    elements.inspector.innerHTML = buildTopologyInspectorMarkup(viewModel, selection);
    selectionObserver(selection, selectedKey);
  }

  function select(objectKey) {
    if (!viewModel) return null;
    selectedKey = cleanText(objectKey);
    const selection = applyTopologyTraceSelection(
      elements.traceRoot,
      objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey),
      selectedKey,
    );
    elements.inspector.innerHTML = buildTopologyInspectorMarkup(viewModel, selection);
    selectionObserver(selection, selectedKey);
    return selection;
  }

  /** Fit the SVG viewport to an object (cross-surface focus from Edit/Parity). */
  function zoomToObject(objectKey) {
    if (viewModel && typeof svgNavigation.fitObjectKey === 'function') svgNavigation.fitObjectKey(objectKey, true);
  }

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

  function setMode(mode) {
    if (!['spatial', 'trace', 'junctions', 'issues'].includes(mode)) throw new RangeError(`Unsupported topology SVG mode: ${mode}`);
    viewState = { ...viewState, mode };
    render();
  }

  function setProjection(projection) {
    if (!['XY', 'XZ', 'YZ', '3D', 'ISO'].includes(projection)) throw new RangeError(`Unsupported projection: ${projection}`);
    viewState = { ...viewState, projection };
    render();
  }

  function setFilters(patch) {
    viewState = { ...viewState, ...patch };
    render();
  }

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

  function fitView() { svgNavigation.fit(); }
  function zoomView(direction) {
    if (direction === 'in') svgNavigation.zoomIn();
    else if (direction === 'out') svgNavigation.zoomOut();
    else throw new RangeError(`Unknown topology zoom direction: ${direction}`);
  }

  function setVisibility(key, visible) {
    if (!Object.hasOwn(viewState.visibility, key)) throw new RangeError(`Unknown topology visibility key: ${key}`);
    viewState = { ...viewState, visibility: { ...viewState.visibility, [key]: visible } };
    render();
  }

  function setBottomTab(tabId) {
    activeBottomTab = tabId;
    render();
  }

  function setViewModelAdapter(adapter) { viewModelAdapter = typeof adapter === 'function' ? adapter : (value) => value; }
  function setRenderObserver(observer) { renderObserver = typeof observer === 'function' ? observer : () => {}; }
  function setSelectionObserver(observer) { selectionObserver = typeof observer === 'function' ? observer : () => {}; }

  function assertNoMutation() {
    for (const kind of ['source', 'canonical', 'ledger', 'inputXml']) {
      if (!artifacts[kind]) continue;
      const current = artifactHash(kind, artifacts[kind]);
      if (current !== hashes[kind]) throw new Error(`Immutable ${kind} artifact changed after load (${hashes[kind]} -> ${current}).`);
    }
  }

  function updateSourceControls() {
    const source = objectRecord(artifacts.source);
    const branches = asArray(source.branches).map(objectRecord);
    elements.branchTree.innerHTML = `<button type="button" data-ttv-branch="" class="is-active">All branches<span>${branches.length}</span></button>${branches.map((branch) => `<button type="button" data-ttv-branch="${escapeAttribute(branch.name)}">${escapeHtml(shortText(branch.name, 35))}<span>${asArray(branch.components).length}</span></button>`).join('')}`;
    const counts = objectRecord(objectRecord(source.metrics).componentCategoryCounts);
    const types = Object.keys(counts);
    elements.typeFilters.innerHTML = types.map((type) => `<label><input type="checkbox" data-ttv-type="${escapeAttribute(type)}" checked>${escapeHtml(type)} <span>${counts[type]}</span></label>`).join('');
    viewState = { ...viewState, branch: '', types, showComponentSymbols: false, isolateSupports: false };
    elements.componentSymbols.checked = false;
    const isolateToggle = elements.traceRoot.querySelector('[data-ttv-isolate="supports"]');
    if (isolateToggle) isolateToggle.checked = false;
  }

  function syncBranchControls(branch, showComponentSymbols) {
    elements.branchTree.querySelectorAll('[data-ttv-branch]').forEach((button) => {
      button.classList.toggle('is-active', cleanText(button.getAttribute('data-ttv-branch')) === branch);
    });
    elements.componentSymbols.checked = showComponentSymbols;
  }

  function updateMetricStrip() {
    const metrics = objectRecord(validation?.metrics ?? objectRecord(artifacts.source).metrics);
    elements.metricStrip.innerHTML = [
      ['Branches', metrics.branchCount], ['Source', metrics.sourceComponentCount], ['Route', metrics.routeComponentCount],
      ['Supports', metrics.deferredSupportCount], ['Nodes', metrics.canonicalNodeCount], ['Edges', metrics.canonicalEdgeCount],
      ['Issues', metrics.issueCount], ['InputXML', validation?.inputXmlStatus ?? 'NOT_EVALUATED'],
    ].map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value ?? '—')}</span>`).join('');
  }

  function updateSearchStatus() {
    const summary = objectRecord(viewModel?.filterSummary);
    if (summary.searchActive !== true) return;
    setStatus(`Search: ${summary.sourceMatchCount} matches listed; SVG scope ${summary.displayScope} remains unchanged with ${summary.displayedSourceCount} displayed source objects.`, summary.sourceMatchCount ? 'ready' : 'error');
  }

  function setStatus(message, kind) {
    elements.status.textContent = message;
    elements.status.setAttribute('data-status', kind);
  }

  function evidence() { return Object.freeze({ artifacts, hashes, fileNames, validation, viewModel, viewState, activeBottomTab }); }
  function destroy() {
    destroySvgInteractions();
    svgNavigation.destroy();
    setViewModelAdapter(null); setRenderObserver(null); setSelectionObserver(null);
  }

  updateMetricStrip();
  return Object.freeze({
    loadArtifact, loadFile, validate, render, select, focusSearchResult, zoomToObject, setMode, setProjection,
    setFilters, setSearch, setVisibility, setBottomTab, fitView, zoomView, assertNoMutation,
    setViewModelAdapter, setRenderObserver, setSelectionObserver,
    evidence, downloadEnrichedInputXml: () => downloadEnrichedInputXml(artifacts), destroy,
  });
}
