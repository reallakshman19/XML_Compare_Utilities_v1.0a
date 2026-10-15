/** Browser event wiring for the combined trace and topology parity workspace. */
import { loadTopologySourceFile } from './topology-companion-loader.js';
import { cleanText, objectRecord } from './topology-validator-values.js';
import { wireLeftPanelResize, wireBottomPanelResize } from './topology-panel-resize.js';
import { loadTopologyProducerCore } from './topology-producer-loader.js';
import { loadStagedJsonScoped } from './topology-staged-load-flow.js';
import { wireTopologyEnrichment } from './topology-enrichment-wiring.js';
import { wireTopologyEditCommandRouter } from './topology-edit-command-router.js';
import { wireTopologyLargeModelControls } from './topology-large-model-controls.js';

// Trace SVG axis-compass geometry per projection (PR #363 native-SVG editor).
const COMPASS_GEOMETRY = Object.freeze({
  XY: { x: [50, 50, 84, 50], y: [50, 50, 50, 16], z: null },
  XZ: { x: [50, 50, 84, 50], y: null, z: [50, 50, 50, 14] },
  YZ: { x: null, y: [50, 50, 84, 50], z: [50, 50, 50, 14] },
  ISO: { x: [50, 50, 82, 68], y: [50, 50, 18, 68], z: [50, 50, 50, 12] },
});
export function wireTopologyWorkspace(root, controller) {
  const cleanups = [];
  cleanups.push(wireLeftPanelResize(root));
  cleanups.push(wireBottomPanelResize(root));
  const listen = (target, type, handler) => {
    if (!target) return;
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };
  wireWorkspaceTabs(root, controller, listen);
  wireEditControls(root, controller, listen);
  root.querySelectorAll('input[type="file"][data-ttv-file]').forEach((input) => listen(input, 'change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (input.dataset.ttvFile === 'source') {
        await controller.loadArtifact('source', await file.text(), file.name);
        await buildTopology(root, controller, null);
      } else await controller.loadFile(input.dataset.ttvFile, file);
      await refreshCheckerIfReady(controller);
    } catch (error) { showWorkspaceError(root, error); }
  }));
  root.querySelectorAll('input[type="file"][data-ttv-parity-file]').forEach((input) => listen(input, 'change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try { await controller.parity.loadFile(input.dataset.ttvParityFile, file); }
    catch (error) { showWorkspaceError(root, error); }
  }));
  listen(root.querySelector('[data-ttv-validate]'), 'click', async () => {
    try { controller.validate(); await refreshCheckerIfReady(controller); } catch (error) { showWorkspaceError(root, error); }
  });
  wireTopologyEnrichment(root, controller, listen, showWorkspaceError);
  listen(root.querySelector('[data-ttv-download-inputxml]'), 'click', () => {
    try { controller.downloadCurrentInputXml(root.ownerDocument); } catch (error) { showWorkspaceError(root, error); }
  });
  listen(root.querySelector('[data-ttv-export-selection]'), 'click', () => {
    try { controller.downloadEnrichedInputXml(true); } catch (error) { showWorkspaceError(root, error); }
  });
  listen(root.querySelector('[data-ttv-build-topology]'), 'click', (event) => buildTopology(root, controller, event));
  listen(root.querySelector('[data-ttv-fit]'), 'click', () => controller.fitView());
  listen(root.querySelector('[data-ttv-canvas-fit]'), 'click', () => controller.fitView());
  root.querySelectorAll('[data-ttv-zoom]').forEach((button) => listen(button, 'click', () => controller.zoomView(button.dataset.ttvZoom)));
  root.querySelectorAll('[data-ttv-font-zoom]').forEach((button) => listen(button, 'click', () => {
    const isOut = button.dataset.ttvFontZoom === 'out';
    const current = parseFloat(root.style.getPropertyValue('--ttv-font-scale')) || 1;
    const next = Math.max(0.6, Math.min(1.8, current + (isOut ? -0.1 : 0.1)));
    root.style.setProperty('--ttv-font-scale', next.toFixed(1));
  }));
  root.querySelectorAll('[data-ttv-mode]').forEach((button) => listen(button, 'click', () => {
    setActiveButtons(root, 'data-ttv-mode', button);
    controller.setMode(button.dataset.ttvMode);
  }));
  root.querySelectorAll('[data-ttv-projection]').forEach((button) => listen(button, 'click', () => applyTraceProjection(root, controller, button.dataset.ttvProjection)));
  root.querySelectorAll('[data-ttv-canvas-projection]').forEach((button) => listen(button, 'click', () => applyTraceProjection(root, controller, button.dataset.ttvCanvasProjection)));
  root.querySelectorAll('[data-ttv-vertical-axis]').forEach((select) => listen(select, 'change', (event) => {
    const verticalAxis = event.target.value;
    root.querySelectorAll('[data-ttv-vertical-axis]').forEach((el) => { el.value = verticalAxis; });
    controller.setFilters({ verticalAxis });
    if (controller.edit && typeof controller.edit.render === 'function') {
      controller.edit.render();
    }
  }));
  listen(root.querySelector('[data-ttv-labels]'), 'change', (event) => controller.setFilters({ labels: event.target.checked }));
  listen(root.querySelector('[data-ttv-component-symbols]'), 'change', (event) => controller.setFilters({ showComponentSymbols: event.target.checked }));
  listen(root.querySelector('[data-ttv-isolate="supports"]'), 'change', (event) => {
    const checked = event.target.checked;
    const overlays = root.querySelector('[data-ttv-component-symbols]');
    if (checked && overlays) overlays.checked = true;
    controller.setFilters({ isolateSupports: checked, ...(checked ? { showComponentSymbols: true } : {}) });
  });
  listen(root.querySelector('[data-ttv-branch-tree]'), 'click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-ttv-branch]') : null;
    if (!button) return;
    setActiveButtons(root, 'data-ttv-branch', button);
    const branch = button.dataset.ttvBranch, showComponentSymbols = Boolean(branch);
    const overlays = root.querySelector('[data-ttv-component-symbols]');
    if (overlays) overlays.checked = showComponentSymbols;
    controller.setFilters({ branch, showComponentSymbols });
    controller.parity?.setBranch?.(branch);
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
  listen(root.querySelector('[data-ttv-svg-host]'), 'click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-object-key]') : null;
    if (target) controller.synchronizeSurfaceSelection(cleanText(target.getAttribute('data-object-key')), 'trace');
  });
  root.querySelectorAll('[data-ttv-visibility]').forEach((input) => listen(input, 'change', () => controller.setVisibility(input.dataset.ttvVisibility, input.checked)));
  listen(root.querySelector('[data-ttv-bottom]'), 'click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const collapseBtn = target ? target.closest('[data-ttv-bottom-collapse]') : null;
    if (collapseBtn) {
      const bottom = root.querySelector('.ttv-bottom');
      const content = root.querySelector('.ttv-bottom-content');
      if (content && bottom) {
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'block' : 'none';
        bottom.style.height = isCollapsed ? '250px' : 'auto';
        collapseBtn.innerHTML = isCollapsed ? '▾' : '▴';
      }
      return;
    }
    const button = target ? target.closest('[data-ttv-bottom-tab]') : null;
    if (button) controller.setBottomTab(button.dataset.ttvBottomTab);
    const row = target ? target.closest('[data-object-key]') : null;
    if (row) {
      const key = cleanText(row.getAttribute('data-object-key'));
      controller.select(key);
      controller.zoomToObject(key);
    }
  });
  wireParityControls(root, controller, listen);
  listen(root.querySelector('[data-ttv-parity-svg-host]'), 'click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-object-key]') : null;
    if (target) controller.synchronizeSurfaceSelection(cleanText(target.getAttribute('data-object-key')), 'parity');
  });
  syncTopologyProjectionUi(root, 'XY');
  return cleanups;
}

function applyTraceProjection(root, controller, projection) {
  syncTopologyProjectionUi(root, projection);
  controller.setProjection(projection);
}

export function syncTopologyProjectionUi(root, projection) {
  const normalized = projection === '3D' ? 'ISO' : projection;
  const toolbarProjection = normalized === 'ISO' ? '3D' : normalized;
  root.querySelectorAll('[data-ttv-projection]').forEach((button) => button.classList.toggle('is-active', button.dataset.ttvProjection === toolbarProjection));
  root.querySelectorAll('[data-ttv-canvas-projection]').forEach((button) => button.classList.toggle('is-active', button.dataset.ttvCanvasProjection === normalized));
  const compass = root.querySelector('[data-ttv-axis-compass]');
  if (!compass) return;
  compass.dataset.projection = projection;
  compass.setAttribute('aria-label', `${normalized} axis compass`);
  const geometry = COMPASS_GEOMETRY[normalized] || COMPASS_GEOMETRY.ISO;
  for (const axis of ['x', 'y', 'z']) updateCompassAxis(compass, axis, geometry[axis]);
}

function updateCompassAxis(compass, axis, coordinates) {
  const group = compass.querySelector(`[data-ttv-axis="${axis}"]`);
  if (!group) return;
  group.toggleAttribute('hidden', !coordinates);
  if (!coordinates) return;
  const [x1, y1, x2, y2] = coordinates;
  const line = group.querySelector('line'), text = group.querySelector('text');
  for (const [name, value] of Object.entries({ x1, y1, x2, y2 })) line?.setAttribute(name, String(value));
  text?.setAttribute('x', String(x2 + (axis === 'y' && x2 < 50 ? -7 : 4)));
  text?.setAttribute('y', String(y2 + (y2 < 20 ? -3 : 5)));
}

function wireWorkspaceTabs(root, controller, listen) {
  root.querySelectorAll('[data-ttv-workspace-tab]').forEach((button) => listen(button, 'click', async () => {
    try { await controller.activateTab(button.dataset.ttvWorkspaceTab, root); }
    catch (error) { showWorkspaceError(root, error); showEditError(root, error); }
  }));
}
function wireEditControls(root, controller, listen) {
  const run = async (operation) => {
    try { await controller.edit.runOperation(operation); }
    catch (error) { showEditError(root, error); }
  };
  wireTopologyEditCommandRouter(root, controller.edit, listen, (error) => showEditError(root, error));
  root.querySelectorAll('[data-ttv-edit-projection]').forEach((button) => listen(button, 'click', () => {
    const projection = button.dataset.ttvEditProjection;
    controller.edit.setProjection(projection);
    const compass = root.querySelector('[data-ttv-edit-root] [data-ttv-axis-compass]');
    if (compass) {
      const hAxis = projection.charAt(0);
      const vAxis = projection.charAt(1);
      compass.innerHTML = `
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
        <line x1="0" y1="0" x2="35" y2="0" stroke="#ef4444" stroke-width="2" marker-end="url(#arrow)" style="color:#ef4444" />
        <text x="40" y="5" font-size="12" fill="#ef4444">${hAxis}</text>
        <line x1="0" y1="0" x2="0" y2="-35" stroke="#22c55e" stroke-width="2" marker-end="url(#arrow)" style="color:#22c55e" />
        <text x="-5" y="-40" font-size="12" fill="#22c55e">${vAxis}</text>
      `;
    }
  }));
  const camBtn = root.querySelector('[data-ttv-edit-camera]');
  if (camBtn) listen(camBtn, 'click', () => controller.edit.toggleCameraType());
  const pivotBtn = root.querySelector('[data-ttv-edit-pivot]');
  if (pivotBtn) listen(pivotBtn, 'click', () => controller.edit.setPivotToSelection());
  root.querySelectorAll('[data-ttv-edit-selection-filter]').forEach((button) => listen(button, 'click', () => {
    button.classList.toggle('is-active');
    controller.edit.setSelectionFilter(button.dataset.ttvEditSelectionFilter, button.classList.contains('is-active'));
  }));
  listen(root.querySelector('[data-ttv-support-scale]'), 'input', (event) => {
    const value = Number(event.target.value);
    const output = root.querySelector('[data-ttv-support-scale-output]');
    if (output) output.textContent = `${value.toFixed(2)}×`;
    try { controller.edit.setSupportScale(value); } catch (error) { showEditError(root, error); }
  });
  listen(root.querySelector('[data-ttv-edit-3d]'), 'change', (event) => {
    const is3D = event.target.checked;
    controller.edit.set3dVisible(is3D);
  });
  listen(root.querySelector('[data-ttv-edit-load-staged]'), 'change', async (event) => {
    const input = event.target, file = input.files?.[0];
    if (!file) return;
    try { await loadStagedJsonScoped(root, controller, file, { buildFullTopology: () => buildTopology(root, controller, null) }); }
    catch (error) { showEditError(root, error); } finally { input.value = ''; }
  });
  wireTopologyLargeModelControls(root, controller, listen, (error) => showEditError(root, error));
  listen(root.querySelector('[data-ttv-edit-save]'), 'click', () => { try { controller.edit.saveDraft(); } catch (error) { showEditError(root, error); } });
  listen(root.querySelector('[data-ttv-edit-load]'), 'change', async (event) => {
    try { if (event.target.files?.[0]) await controller.edit.loadDraftFile(event.target.files[0]); }
    catch (error) { showEditError(root, error); }
  });
  listen(root.querySelector('[data-ttv-edit-export]'), 'click', async () => {
    try { await controller.edit.exportBundle(); } catch (error) { showEditError(root, error); }
  });
  listen(root.querySelector('[data-ttv-edit-inspector]'), 'change', (event) => {
    const context = event.target instanceof Element ? event.target.closest('[data-ttv-edit-context]') : null;
    if (context) controller.edit.setContextEdge(context.value);
  });
  listen(root.querySelector('[data-ttv-edit-inspector]'), 'click', (event) => {
    const action = event.target instanceof Element ? event.target.closest('[data-ttv-edit-inspector-action]') : null;
    if (action) run(action.dataset.ttvEditInspectorAction);
  });
}
function wireParityControls(root, controller, listen) {
  root.querySelectorAll('[data-ttv-parity-projection]').forEach((btn) => listen(btn, 'click', () => { setActiveButtons(root, 'data-ttv-parity-projection', btn); controller.parity.setProjection(btn.dataset.ttvParityProjection); }));
  root.querySelectorAll('[data-ttv-parity-zoom]').forEach((btn) => listen(btn, 'click', () => { if (btn.dataset.ttvParityZoom === 'in') controller.parity.zoomIn(); else controller.parity.zoomOut(); }));
  root.querySelectorAll('[data-ttv-parity-fit]').forEach((btn) => listen(btn, 'click', () => { const act = btn.dataset.ttvParityFit; if (act === 'all') controller.parity.fitAll(); else if (act === 'branch') controller.parity.fitBranch(); else if (act === 'issue') controller.parity.fitIssue(); }));
  listen(root.querySelector('[data-ttv-parity-labels]'), 'change', (ev) => controller.parity.setLabels(ev.target.checked));
  root.querySelectorAll('[data-ttv-parity-export]').forEach((btn) => listen(btn, 'click', () => { try { controller.parity.exportArtifact(btn.dataset.ttvParityExport); } catch (e) { showWorkspaceError(root, e); } }));
}

async function buildTopology(root, controller, event) {
  const button = event?.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  const originalText = button?.textContent;
  try {
    if (button) { button.textContent = '⚙️ Building...'; button.disabled = true; }
    const evidence = controller.evidence(), source = evidence.trace.artifacts.source;
    if (!source) throw new Error('A Source JSON must be loaded before building topology.');
    const rawObj = source.raw, sourceText = JSON.stringify(Array.isArray(rawObj) ? rawObj : (rawObj.hierarchy || rawObj.branches || rawObj.objects || []));
    const { buildComponentTopologyArtifacts, topologyArtifactOutputs } = await loadTopologyProducerCore();
    setStatus(root, 'Building topology artifacts and exact parity report...', 'ready');
    const stem = cleanText(root.querySelector('[data-ttv-file-status="source"]')?.textContent).replace(/\.json$/i, '')
      || cleanText(objectRecord(evidence.trace.fileNames).source).replace(/\.json$/i, '') || 'generated';
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
    await refreshCheckerIfReady(controller);
  } catch (error) {
    showWorkspaceError(root, error);
  } finally {
    if (button) { button.textContent = originalText; button.disabled = false; }
  }
}
function setActiveButtons(root, attr, act) { root.querySelectorAll(`[${attr}]`).forEach((b) => b.classList.toggle('is-active', b === act)); }
function setStatus(root, msg, status) { const t = root.querySelector('[data-ttv-status]'); if (t) { t.textContent = msg; t.setAttribute('data-status', status); } }
function showWorkspaceError(root, error) { setStatus(root, error?.message || String(error), 'error'); }
function showEditError(root, error) { const t = root.querySelector('[data-ttv-edit-status]'); if (t) { t.textContent = error?.message || String(error); t.setAttribute('data-status', 'error'); } const l = root.querySelector('[data-ttv-edit-live]'); if (l) l.textContent = error?.message || String(error); }
async function refreshCheckerIfReady(controller) {
  const canonical = objectRecord(objectRecord(objectRecord(controller.evidence()).trace).artifacts).canonical;
  if (objectRecord(canonical).schema === 'CanonicalTopology.v1') await controller.checker?.refresh();
}
function toKebab(value) { return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`); }
export const _test = Object.freeze({ wireWorkspaceTabs, wireEditControls, wireParityControls, buildTopology, setActiveButtons, setStatus, showWorkspaceError, showEditError, refreshCheckerIfReady, toKebab });
