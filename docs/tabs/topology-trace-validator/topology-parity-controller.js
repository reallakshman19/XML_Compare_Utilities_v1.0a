/** Coordinates read-only topology parity artifacts, scene rendering, selection, and exports. */
import { readCanonicalTopology, readTopologyTraceLedger } from './topology-artifact-reader.js';
import { readParsedInputXmlTopology, readTopologyParityReport, readTopologySvgScene } from './topology-parity-artifact-reader.js';
import { buildCiiSvgIdentityParity, readInputXmlCiiProjectionLedger } from './topology-cii-identity-parity.js';
import { buildTopologyParityState } from './topology-parity-state.js';
import { buildTopologySceneViewModel } from './topology-scene-view-model.js';
import { renderTopologyParitySvg } from './topology-parity-svg-renderer.js';
import { topologyParityInspectorMarkup, topologyParityMismatchTableMarkup, topologyParitySummaryMarkup } from './topology-parity-panel.js';
import { wireTopologySvgNavigation } from './topology-svg-navigation.js';
import { asArray, cleanText, deepFreeze, objectRecord } from './topology-validator-values.js';

function emptyNavigation() { return Object.freeze({ fit: () => {}, fitElements: () => false, fitObjectKey: () => false, fitBranch: () => false, zoomIn: () => {}, zoomOut: () => {}, destroy: () => {} }); }

function parseArtifact(kind, text) {
  const value = JSON.parse(String(text ?? ''));
  if (kind === 'canonical') return readCanonicalTopology(value);
  if (kind === 'ledger') return readTopologyTraceLedger(value);
  if (kind === 'scene') return readTopologySvgScene(value);
  if (kind === 'parsed') return readParsedInputXmlTopology(value);
  if (kind === 'report') return readTopologyParityReport(value);
  if (kind === 'ciiProjection') return readInputXmlCiiProjectionLedger(value);
  throw new RangeError(`Unsupported topology parity artifact: ${kind}`);
}

function downloadText(documentRef, name, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob), anchor = documentRef.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

function combinedReport(report, ciiParity) {
  if (!report) return null;
  const ciiMismatches = asArray(ciiParity?.mismatches);
  return deepFreeze({
    ...report,
    mismatches: [...asArray(report.mismatches), ...ciiMismatches],
    summary: {
      ...objectRecord(report.summary),
      ciiIdentityMismatchCount: ciiMismatches.length,
      totalParityMismatchCount: Number(objectRecord(report.summary).topologyMismatchCount || 0) + ciiMismatches.length,
    },
  });
}

function effectiveParityState(topologyState, ciiParity) {
  if (topologyState.status === 'PASS' && ciiParity?.status === 'FAIL') return deepFreeze({ ...topologyState, status: 'FAIL', ciiIdentityStatus: 'FAIL' });
  return deepFreeze({ ...topologyState, ciiIdentityStatus: ciiParity?.status || 'NOT_RUN' });
}

export function createTopologyParityController(elements) {
  let artifacts = { canonical: null, ledger: null, scene: null, parsed: null, report: null, ciiProjection: null };
  let fileNames = { canonical: '', ledger: '', scene: '', parsed: '', report: '', ciiProjection: '' };
  let viewState = { projection: 'ISO', branch: '', labels: false, selectedMismatchId: '' };
  let parityState = buildTopologyParityState(artifacts), ciiParity = buildCiiSvgIdentityParity(), viewModel = null, selectedKey = '';
  let navigation = emptyNavigation();

  async function loadArtifact(kind, text, fileName) {
    const artifact = parseArtifact(kind, text);
    artifacts = { ...artifacts, [kind]: artifact }; fileNames = { ...fileNames, [kind]: fileName };
    parityState = buildTopologyParityState(artifacts);
    const status = elements.fileStatus.querySelector(`[data-ttv-parity-file-status="${kind}"]`);
    if (status) status.textContent = fileName;
    render(); return artifact;
  }

  async function loadFile(kind, file) {
    if (!file || typeof file.text !== 'function') throw new TypeError(`A file is required for ${kind}.`);
    return loadArtifact(kind, await file.text(), file.name);
  }

  function validate() { parityState = buildTopologyParityState(artifacts); render(); return effectiveParityState(parityState, ciiParity); }

  function render() {
    parityState = buildTopologyParityState(artifacts);
    ciiParity = buildCiiSvgIdentityParity({ projection: artifacts.ciiProjection, parsed: artifacts.parsed, scene: artifacts.scene });
    const state = effectiveParityState(parityState, ciiParity), report = combinedReport(artifacts.report, ciiParity);
    elements.summary.innerHTML = topologyParitySummaryMarkup(state, report, ciiParity);
    elements.mismatches.innerHTML = topologyParityMismatchTableMarkup(report, viewState.selectedMismatchId);
    elements.status.textContent = parityStatusText(state, report, ciiParity);
    elements.status.setAttribute('data-status', state.status.toLowerCase());
    navigation.destroy(); navigation = emptyNavigation();
    if (!artifacts.scene || !artifacts.parsed || !artifacts.report) {
      elements.svgHost.innerHTML = '<div class="ttv-empty">Load TopologySvgScene.v1, ParsedInputXmlTopology.v1, and TopologyParityReport.v1.</div>';
      elements.inspector.innerHTML = topologyParityInspectorMarkup(null, artifacts); viewModel = null; return;
    }
    viewModel = buildTopologySceneViewModel({ scene: artifacts.scene, parsed: artifacts.parsed, report, ciiParity, state: viewState });
    const svg = renderTopologyParitySvg(elements.svgHost, viewModel);
    if (svg) { svg.setAttribute('tabindex', '0'); navigation = wireTopologySvgNavigation(svg); }
    const selection = selectedKey ? objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey)[selectedKey] : null;
    elements.inspector.innerHTML = topologyParityInspectorMarkup(selection, artifacts);
  }

  function select(objectKey, fit = false) {
    if (!viewModel) return null;
    const selection = objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey)[cleanText(objectKey)] ?? null;
    selectedKey = selection ? cleanText(objectKey) : '';
    elements.inspector.innerHTML = topologyParityInspectorMarkup(selection, artifacts);
    elements.root.querySelectorAll('[data-object-key].is-selected').forEach((element) => element.classList.remove('is-selected'));
    if (selection) {
      const linked = [selection.objectKey, ...asArray(selection.linkedObjectKeys)];
      const nodes = linked.flatMap((key) => [...elements.svgHost.querySelectorAll(`[data-object-key="${CSS.escape(cleanText(key))}"]`)]);
      nodes.forEach((element) => element.classList.add('is-selected')); if (fit) navigation.fitElements(nodes);
    }
    return selection;
  }

  function selectMismatch(mismatchId) {
    viewState = { ...viewState, selectedMismatchId: cleanText(mismatchId) };
    selectedKey = `parity:mismatch:${cleanText(mismatchId)}`; render();
    const selection = select(selectedKey, false);
    if (selection) {
      const keys = asArray(selection.linkedObjectKeys);
      const nodes = keys.flatMap((key) => [...elements.svgHost.querySelectorAll(`[data-object-key="${CSS.escape(cleanText(key))}"]`)]);
      navigation.fitElements(nodes, 60);
    }
    return selection;
  }

  function setProjection(projection) { if (!['ISO', 'XY', 'XZ', 'YZ'].includes(projection)) throw new RangeError(`Unsupported topology parity projection: ${projection}`); viewState = { ...viewState, projection }; render(); }
  function setBranch(branch) { viewState = { ...viewState, branch: cleanText(branch) }; render(); if (viewState.branch) navigation.fitBranch(viewState.branch); }
  function setLabels(labels) { viewState = { ...viewState, labels: labels === true }; render(); }

  function exportArtifact(kind) {
    const map = {
      scene: ['topology-svg-scene.json', artifacts.scene, 'application/json'], parsed: ['parsed-inputxml-topology.json', artifacts.parsed, 'application/json'],
      report: ['topology-parity-report.json', artifacts.report, 'application/json'], ciiProjection: ['inputxml-cii-projection-ledger.json', artifacts.ciiProjection, 'application/json'],
      ciiIdentity: ['cii-svg-identity-parity.json', ciiParity, 'application/json'], mismatches: ['topology-parity-mismatches.csv', mismatchCsv(combinedReport(artifacts.report, ciiParity)), 'text/csv'],
      svg: ['topology.svg', elements.svgHost.querySelector('svg')?.outerHTML ?? '', 'image/svg+xml'],
    };
    const row = map[kind];
    if (!row || row[1] === null || row[1] === '') throw new Error(`Topology parity export is unavailable: ${kind}.`);
    const text = typeof row[1] === 'string' ? row[1] : `${JSON.stringify(row[1], null, 2)}\n`;
    downloadText(elements.root.ownerDocument, row[0], text, row[2]);
  }

  function evidence() { return Object.freeze({ artifacts, fileNames, parityState: effectiveParityState(parityState, ciiParity), ciiParity, viewState, viewModel, selectedKey }); }
  function destroy() { navigation.destroy(); }

  elements.svgHost.addEventListener('click', (event) => { const target = event.target instanceof Element ? event.target.closest('[data-object-key]') : null; if (target) select(target.getAttribute('data-object-key')); });
  elements.mismatches.addEventListener('click', (event) => { const row = event.target instanceof Element ? event.target.closest('[data-parity-mismatch-id]') : null; if (row) selectMismatch(row.getAttribute('data-parity-mismatch-id')); });
  render();
  return Object.freeze({ loadArtifact, loadFile, validate, render, select, selectMismatch, setProjection, setBranch, setLabels,
    fitAll: () => navigation.fit(), fitBranch: () => navigation.fitBranch(viewState.branch), fitIssue: () => selectedKey && navigation.fitObjectKey(selectedKey),
    zoomIn: () => navigation.zoomIn(), zoomOut: () => navigation.zoomOut(), exportArtifact, evidence, destroy });
}

function parityStatusText(state, report, ciiParity) {
  if (state.status === 'NOT_RUN') return `Topology parity NOT_RUN: missing ${asArray(state.missing).join(', ') || 'artifacts'}.`;
  if (state.status === 'STALE') return `Topology parity STALE: ${asArray(state.reasons).length} hash/configuration mismatch(es).`;
  if (state.status === 'RUNNING') return 'Topology parity RUNNING.';
  const count = objectRecord(report?.summary).totalParityMismatchCount ?? objectRecord(report?.summary).topologyMismatchCount ?? '—';
  return `Topology parity ${state.status}: total mismatch count ${count}; CII identity ${ciiParity?.status || 'NOT_RUN'}.`;
}

function mismatchCsv(report) {
  const headers = ['Severity', 'Category', 'Canonical ID', 'InputXML ID', 'SVG ID', 'CII ID', 'Expected', 'Actual', 'Source Path', 'Status'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = asArray(report?.mismatches).map((row) => [row.severity, row.category, row.canonicalIdentity, row.inputXmlIdentity, row.svgIdentity, row.ciiIdentity, JSON.stringify(row.expected), JSON.stringify(row.actual), asArray(row.sourcePaths).join('|'), row.status || 'OPEN']);
  return `${[headers, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`;
}

export const _test = Object.freeze({ emptyNavigation, parseArtifact, combinedReport, effectiveParityState, parityStatusText, mismatchCsv });
