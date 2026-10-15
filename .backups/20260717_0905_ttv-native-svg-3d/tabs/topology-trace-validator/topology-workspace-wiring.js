/** Browser event wiring for the combined trace and topology parity workspace. */
import { loadTopologySourceFile } from './topology-companion-loader.js';
import { cleanText } from './topology-validator-values.js';
import { renderStagedJsonEnrichmentPanel } from './stagedjson-enrichment/stagedjson-enrichment-ui.js?v=20260715-ttv-005-css-fix';

export function wireTopologyWorkspace(root, controller) {
  const cleanups = [];
  const listen = (target, type, handler) => {
    if (!target) return;
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };
  root.querySelectorAll('input[type="file"][data-ttv-file]').forEach((input) => listen(input, 'change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (input.dataset.ttvFile === 'source') {
        const windowRef = root.ownerDocument.defaultView;
        if (!windowRef?.fetch) throw new Error('Browser fetch is unavailable for automatic companion loading.');
        try {
          await loadTopologySourceFile(controller, file, root.ownerDocument.location.href, windowRef.fetch.bind(windowRef));
        } catch (error) {
          if (error.name === 'TopologyCompanionLoadError') setStatus(root, `${file.name} loaded. Build topology or load companion artifacts manually.`, 'ready');
          else throw error;
        }
      } else await controller.loadFile(input.dataset.ttvFile, file);
    } catch (error) { showWorkspaceError(root, error); }
  }));
  root.querySelectorAll('input[type="file"][data-ttv-parity-file]').forEach((input) => listen(input, 'change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try { await controller.parity.loadFile(input.dataset.ttvParityFile, file); }
    catch (error) { showWorkspaceError(root, error); }
  }));
  listen(root.querySelector('[data-ttv-validate]'), 'click', () => {
    try { controller.validate(); } catch (error) { showWorkspaceError(root, error); }
  });
  wireEnrichment(root, controller, listen);
  listen(root.querySelector('[data-ttv-download-inputxml]'), 'click', () => {
    try { controller.downloadEnrichedInputXml(); } catch (error) { showWorkspaceError(root, error); }
  });
  listen(root.querySelector('[data-ttv-build-topology]'), 'click', (event) => buildTopology(root, controller, event));
  listen(root.querySelector('[data-ttv-fit]'), 'click', () => controller.fitView());
  root.querySelectorAll('[data-ttv-zoom]').forEach((button) => listen(button, 'click', () => controller.zoomView(button.dataset.ttvZoom)));
  root.querySelectorAll('[data-ttv-mode]').forEach((button) => listen(button, 'click', () => {
    setActiveButtons(root, 'data-ttv-mode', button);
    controller.setMode(button.dataset.ttvMode);
  }));
  root.querySelectorAll('[data-ttv-projection]').forEach((button) => listen(button, 'click', () => {
    setActiveButtons(root, 'data-ttv-projection', button);
    controller.setProjection(button.dataset.ttvProjection);
  }));
  listen(root.querySelector('[data-ttv-labels]'), 'change', (event) => controller.setFilters({ labels: event.target.checked }));
  listen(root.querySelector('[data-ttv-component-symbols]'), 'change', (event) => controller.setFilters({ showComponentSymbols: event.target.checked }));
  listen(root.querySelector('[data-ttv-branch-tree]'), 'click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-ttv-branch]') : null;
    if (!button) return;
    setActiveButtons(root, 'data-ttv-branch', button);
    const branch = button.dataset.ttvBranch, showComponentSymbols = Boolean(branch);
    root.querySelector('[data-ttv-component-symbols]').checked = showComponentSymbols;
    controller.setFilters({ branch, showComponentSymbols });
    controller.parity.setBranch(branch);
  });
  listen(root.querySelector('[data-ttv-type-filters]'), 'change', () => controller.setFilters({
    types: [...root.querySelectorAll('[data-ttv-type]:checked')].map((input) => input.dataset.ttvType),
  }));
  listen(root.querySelector('[data-ttv-disposition]'), 'change', (event) => controller.setFilters({ disposition: event.target.value }));
  for (const key of ['searchName', 'searchRef', 'searchPath']) listen(root.querySelector(`[data-ttv-${toKebab(key)}]`), 'input', (event) => controller.setSearch(key, event.target.value));
  listen(root.querySelector('[data-ttv-search-results]'), 'click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-object-key]') : null;
    if (button) controller.focusSearchResult(cleanText(button.getAttribute('data-object-key')));
  });
  root.querySelectorAll('[data-ttv-visibility]').forEach((input) => listen(input, 'change', () => controller.setVisibility(input.dataset.ttvVisibility, input.checked)));
  listen(root.querySelector('[data-ttv-bottom]'), 'click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-ttv-bottom-tab]') : null;
    if (button) controller.setBottomTab(button.dataset.ttvBottomTab);
    const focus = event.target instanceof Element ? event.target.closest('.ttv-focus-button') : null;
    const row = event.target instanceof Element ? event.target.closest('[data-object-key]') : null;
    if (focus && row) controller.focusSearchResult(cleanText(row.getAttribute('data-object-key')));
    else if (row) controller.select(cleanText(row.getAttribute('data-object-key')));
  });
  wireParityControls(root, controller, listen);
  return cleanups;
}

function wireParityControls(root, controller, listen) {
  root.querySelectorAll('[data-ttv-parity-projection]').forEach((button) => listen(button, 'click', () => {
    setActiveButtons(root, 'data-ttv-parity-projection', button);
    controller.parity.setProjection(button.dataset.ttvParityProjection);
  }));
  root.querySelectorAll('[data-ttv-parity-zoom]').forEach((button) => listen(button, 'click', () => {
    if (button.dataset.ttvParityZoom === 'in') controller.parity.zoomIn();
    else controller.parity.zoomOut();
  }));
  root.querySelectorAll('[data-ttv-parity-fit]').forEach((button) => listen(button, 'click', () => {
    const action = button.dataset.ttvParityFit;
    if (action === 'all') controller.parity.fitAll();
    else if (action === 'branch') controller.parity.fitBranch();
    else if (action === 'issue') controller.parity.fitIssue();
  }));
  listen(root.querySelector('[data-ttv-parity-labels]'), 'change', (event) => controller.parity.setLabels(event.target.checked));
  root.querySelectorAll('[data-ttv-parity-export]').forEach((button) => listen(button, 'click', () => {
    try { controller.parity.exportArtifact(button.dataset.ttvParityExport); }
    catch (error) { showWorkspaceError(root, error); }
  }));
}

function wireEnrichment(root, controller, listen) {
  listen(root.querySelector('[data-ttv-enrich]'), 'click', () => {
    const overlay = root.ownerDocument.createElement('div');
    overlay.className = 'ttv-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const container = root.ownerDocument.createElement('div');
    container.className = 'ttv-modal-content';
    Object.assign(container.style, { width: '90vw', height: '90vh', background: 'var(--psmap-surface)', display: 'flex', flexDirection: 'column' });
    const header = root.ownerDocument.createElement('div');
    Object.assign(header.style, { padding: '10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--psmap-border)' });
    const title = root.ownerDocument.createElement('h2'); title.textContent = 'Master File Enrichment Workbench'; title.style.margin = '0';
    const closeBtn = root.ownerDocument.createElement('button'); closeBtn.textContent = '✕ Close';
    const body = root.ownerDocument.createElement('div'); Object.assign(body.style, { flex: '1', overflow: 'hidden', position: 'relative' });
    header.append(title, closeBtn); container.append(header, body); overlay.appendChild(container); root.ownerDocument.body.appendChild(overlay);
    const dispose = renderStagedJsonEnrichmentPanel(body, { onApplyToWorkspace: async (json) => {
      try { dispose?.(); overlay.remove(); await controller.loadArtifact('source', JSON.stringify(json), 'enriched_source.json'); }
      catch (error) { showWorkspaceError(root, error); }
    } });
    closeBtn.addEventListener('click', () => { dispose?.(); overlay.remove(); });
  });
}

async function buildTopology(root, controller, event) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLButtonElement)) return;
  const originalText = button.textContent;
  try {
    button.textContent = '⚙️ Building...'; button.disabled = true;
    const evidence = controller.evidence(), source = evidence.trace.artifacts.source;
    if (!source) throw new Error('A Source JSON must be loaded before building topology.');
    const rawObj = source.raw, sourceText = JSON.stringify(Array.isArray(rawObj) ? rawObj : (rawObj.hierarchy || rawObj.branches || rawObj.objects || []));
    const { buildComponentTopologyArtifacts, topologyArtifactOutputs } = await import('../../../3D_Converters/tabs/model-converters/converters/component-topology/topology-artifact-exporter.js');
    setStatus(root, 'Building topology artifacts and exact parity report...', 'ready');
    const stem = root.querySelector('[data-ttv-file-status="source"]').textContent.replace(/\.json$/i, '') || 'generated';
    const built = await buildComponentTopologyArtifacts(sourceText, { sourceName: stem, jobName: 'Trace Validator Build', toleranceMm: 0.1, supportProjectionToleranceMm: 50, enrichmentConfig: {} });
    const outputs = topologyArtifactOutputs(built, { stem });
    const outputKind = (name) => name.includes('.canonical-topology.json') ? 'canonical'
      : name.includes('.topology-trace-ledger.json') ? 'ledger'
        : name.includes('.topology.input.xml') ? 'inputXml'
          : name.includes('.topology-svg-scene.json') ? 'scene'
            : name.includes('.parsed-inputxml-topology.json') ? 'parsed'
              : name.includes('.topology-parity-report.json') ? 'report' : '';
    await controller.loadArtifact('source', sourceText, `${stem}.json`);
    for (const output of outputs) {
      const kind = outputKind(output.name);
      if (kind) await controller.loadArtifact(kind, output.text, output.name);
    }
    controller.validate();
  } catch (error) {
    showWorkspaceError(root, error);
    root.ownerDocument.defaultView?.alert(`Build Failed: ${error?.message || String(error)}`);
  } finally { button.textContent = originalText; button.disabled = false; }
}

function setActiveButtons(root, attribute, active) {
  root.querySelectorAll(`[${attribute}]`).forEach((button) => button.classList.toggle('is-active', button === active));
}

function setStatus(root, message, status) {
  const target = root.querySelector('[data-ttv-status]');
  target.textContent = message;
  target.setAttribute('data-status', status);
}

function showWorkspaceError(root, error) {
  setStatus(root, error?.message || String(error), 'error');
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export const _test = Object.freeze({ wireParityControls, buildTopology, setActiveButtons, setStatus, showWorkspaceError, toKebab });
