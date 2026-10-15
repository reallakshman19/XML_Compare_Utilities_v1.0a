/** Mounts Trace, the 3D Edit Draft, the SVG support-draft editor, and Parity. */
import { createTopologyValidatorController } from './topology-validator-controller.js?v=20260718-headless-autofix-v1';
import { createTopologySvgEditorController } from './topology-svg-editor-controller.js?v=20260718-headless-autofix-v1';
import { createTopologyParityController } from './topology-parity-controller.js?v=20260715-ttv-018-parity';
import { createTopologyEditController } from './topology-edit-controller.js?v=20260718-edit-nav-icons-v3';
import { createTopologySequentialMergeNodesController } from './topology-sequential-merge-nodes-controller.js';
import { createTopologyCheckerController } from './topology-checker-controller.js';
import { topologyCheckerIconMarkup } from './topology-checker-icons.js';
import { createTopologyWorkspaceController, workspaceMarkup } from './topology-svg-edit-routing.js?v=20260909-svg-edit-routing-v1';
import { wireTopologyWorkspace } from './topology-workspace-wiring.js?v=20260718-headless-autofix-v2';
import { createTopologyEditExtensions } from './topology-edit-extensions.js';

const STYLE_ID = 'topology-trace-validator-style';
const STYLE_URL = new URL('./topology-parity-workspace.css?v=20260717-ttv-editor-001', import.meta.url).href;

export function installTopologyTraceValidatorTile(container, context) {
  ensureStylesheet(container.ownerDocument);
  if (container.querySelector('[data-ttv-open]')) return () => {};
  const tile = container.ownerDocument.createElement('section');
  tile.className = 'psmap-card psmap-tile ttv-launcher';
  tile.innerHTML = `<button type="button" data-ttv-open="1"><span class="ttv-launcher-icon">${topologyCheckerIconMarkup('network', 'Topology Trace Validator', '')}</span><span><strong>Topology Trace Validator</strong><small>Trace · edit · check · validate topology</small></span></button>`;
  container.appendChild(tile);
  let workspace = null;
  const open = async () => { workspace = await openTopologyTraceValidator(container.ownerDocument, context); };
  tile.querySelector('[data-ttv-open]').addEventListener('click', open);
  return () => {
    tile.querySelector('[data-ttv-open]')?.removeEventListener('click', open);
    workspace?.destroy();
    tile.remove();
  };
}

export async function openTopologyTraceValidator(documentRef, context) {
  const floatShell = documentRef.createElement('div');
  floatShell.className = 'ttv-float-shell';
  floatShell.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#040914; border:1px solid #1e293b; border-radius:0; box-shadow:0 10px 40px rgba(0,0,0,0.5); display:flex; flex-direction:column; z-index:9999; overflow:hidden; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#e2e8f0;';

  const header = documentRef.createElement('div');
  header.className = 'ttv-float-header ttv-toolbar';
  header.style.cssText = 'padding:6px 12px; user-select:none; border-bottom:1px solid #1e293b; background:#060b17; border-radius:0; display:flex; align-items:center; flex-shrink:0;';

  const body = documentRef.createElement('div');
  body.className = 'ttv-float-body';
  body.style.cssText = 'flex-grow:1; display:flex; flex-direction:column; overflow:hidden; position:relative;';

  floatShell.appendChild(header);
  floatShell.appendChild(body);
  documentRef.body.appendChild(floatShell);


  const mounted = await mountTopologyTraceValidatorWorkspace(body, objectOrNull(context.initialTopologyArtifacts));

  const close = () => { mounted.destroy(); floatShell.remove(); };

  // We need to move the header elements out of the workspace markup and into the actual header
  const workspaceHeader = body.querySelector('.ttv-toolbar');
  if (workspaceHeader) {
    while (workspaceHeader.firstChild) header.appendChild(workspaceHeader.firstChild);
    workspaceHeader.remove();
  }

  // Fullscreen functionality
  const fullscreenBtn = documentRef.createElement('button');
  fullscreenBtn.innerHTML = '⛶';
  fullscreenBtn.title = 'Toggle Fullscreen';
  fullscreenBtn.style.cssText = 'background: #3b82f6; color: white; border: 0; border-radius: 6px; padding: 6px 16px; cursor: pointer; font-weight: 600; margin-left: auto; margin-right: 8px; font-size: 16px; line-height: 1;';

  header.insertBefore(fullscreenBtn, header.querySelector('[data-ttv-close]'));

  let isFullscreen = true;
  fullscreenBtn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      floatShell.style.top = '0';
      floatShell.style.left = '0';
      floatShell.style.width = '100vw';
      floatShell.style.height = '100vh';
      floatShell.style.maxWidth = 'none';
      floatShell.style.maxHeight = 'none';
      floatShell.style.borderRadius = '0';
      header.style.borderRadius = '0';
    } else {
      floatShell.style.top = '5vh';
      floatShell.style.left = '5vw';
      floatShell.style.width = '90vw';
      floatShell.style.height = '90vh';
      floatShell.style.maxWidth = '1800px';
      floatShell.style.maxHeight = '1200px';
      floatShell.style.borderRadius = '8px';
      header.style.borderRadius = '8px 8px 0 0';
    }
  });

  header.querySelector('[data-ttv-close]').addEventListener('click', close);
  return Object.freeze({ ...mounted, destroy: close });
}

export async function mountTopologyTraceValidatorWorkspace(root, initialArtifacts) {
  ensureStylesheet(root.ownerDocument);
  root.innerHTML = workspaceMarkup();
  const shell = root.closest('.ttv-float-shell') || root;
  const traceController = createTopologyValidatorController(collectTraceElements(shell));
  const editorController = createTopologySvgEditorController(traceController, collectEditorElements(shell));
  const parityController = createTopologyParityController(collectParityElements(shell));
  let controller = null, checkerController = null;
  let editExtensions = null;
  const editElements = collectEditElements(shell);
  const baseEditController = createTopologyEditController(editElements, {
    onSelectionChange: (selection) => controller?.synchronizeCanonicalSelection(selection, 'edit'),
    onRender: () => editExtensions?.onRender(),
    onGhostPick: (objectId) => editExtensions?.onGhostPick(objectId),
    reviewEvidence: () => checkerController?.evidence() ?? null,
    modeEvidence: () => workspaceController.modelMode(shell),
  });
  const editController = createTopologySequentialMergeNodesController(baseEditController, {
    documentRef: shell.ownerDocument,
  });
  const workspaceController = createTopologyWorkspaceController(traceController, editController, parityController, editorController);
  checkerController = createTopologyCheckerController(collectCheckerElements(shell), {
    evidence: () => workspaceController.evidence(),
    select: (selection) => workspaceController.synchronizeCanonicalSelection(selection, 'checker'),
    focus: (selection) => workspaceController.focusCanonicalSelection(selection),
    applySuggestions: async (suggestions, approvedOnly) => {
      const scoped = await workspaceController.prepareEditForSuggestions(suggestions, shell);
      if (!scoped.length) return null;
      return editController.applyTopologyFixSuggestions(scoped, approvedOnly);
    },
    applyAutoFixes: async (request) => {
      await workspaceController.prepareEditForAutoFix(request.suggestions, shell);
      await checkerController.refresh();
      const authority = checkerController.evidence();
      const run = await editController.applyTopologyAutoFixes({ ...request,
        report: authority.report, policy: authority.policy, policyHash: authority.policyHash,
        outOfScopeIssueIds: [] });
      editExtensions?.refreshLedger();
      await editController.refreshExportPlan();
      return run;
    },
    modeEvidence: () => workspaceController.modelMode(shell),
    onReviewChange: () => editController.refreshExportPlan(),
  });
  controller = Object.freeze({
    ...workspaceController, checker: checkerController,
    destroy: () => { checkerController.destroy(); workspaceController.destroy(); },
  });
  const cleanups = wireTopologyWorkspace(shell, controller);
  editExtensions = createTopologyEditExtensions(shell, controller);
  if (initialArtifacts) {
    for (const kind of ['source', 'canonical', 'ledger', 'scene', 'parsed', 'report']) {
      if (initialArtifacts[kind]) await controller.loadArtifact(kind, JSON.stringify(initialArtifacts[kind]), `${kind}.fixture.json`);
    }
    if (initialArtifacts.inputXml) await controller.loadArtifact('inputXml', String(initialArtifacts.inputXml), 'topology.fixture.xml');
    controller.validate();
    await checkerController.refresh();
  }
  return Object.freeze({
    controller,
    destroy: () => { cleanups.forEach((cleanup) => cleanup()); editExtensions?.destroy(); controller.destroy(); },
  });
}

function collectCheckerElements(root) {
  const query = requiredQuery(root);
  return {
    workspace: root, panel: query('[data-ttv-checker-panel]'), launcher: query('[data-ttv-checker-open]'),
    badge: query('[data-ttv-checker-badge]'), subtitle: query('[data-ttv-checker-subtitle]'),
    live: query('[data-ttv-checker-live]'), kpis: query('[data-ttv-checker-kpis]'),
    buckets: query('[data-ttv-checker-buckets]'), scroll: query('[data-ttv-checker-scroll]'),
    spacer: query('[data-ttv-checker-spacer]'), rows: query('[data-ttv-checker-rows]'),
    detail: query('[data-ttv-checker-detail]'), settings: query('[data-ttv-checker-settings-panel]'),
    autoFix: query('[data-ttv-checker-auto-fix]'), autoCount: query('[data-ttv-checker-auto-count]'),
    toast: query('[data-ttv-autofix-toast]'), toastTitle: query('[data-ttv-autofix-toast-title]'),
    toastDetail: query('[data-ttv-autofix-toast-detail]'),
  };
}

function collectEditElements(root) {
  const query = requiredQuery(root);
  return {
    root: query('[data-ttv-edit-root]'),
    svgHost: query('[data-ttv-edit-svg-host]'),
    preview3d: query('[data-ttv-edit-3d-host]'),
    inspector: query('[data-ttv-edit-inspector]'),
    timeline: query('[data-ttv-edit-timeline]'),
    validation: query('[data-ttv-edit-validation]'),
    exportPlan: query('[data-ttv-edit-export-plan]'),
    metrics: query('[data-ttv-edit-metrics]'),
    status: query('[data-ttv-edit-status]'),
    live: query('[data-ttv-edit-live]'),
    undo: query('[data-ttv-edit-undo]'),
    redo: query('[data-ttv-edit-redo]'),
    exportBundle: query('[data-ttv-edit-export]'),
  };
}

function collectTraceElements(root) {
  const query = requiredQuery(root);
  return {
    traceRoot: query('[data-ttv-workspace-panel="trace"]'),
    svgHost: query('[data-ttv-svg-host]'),
    bottom: query('[data-ttv-bottom]'),
    inspector: query('[data-ttv-inspector]'),
    status: query('[data-ttv-status]'),
    fileStatus: root,
    branchTree: query('[data-ttv-branch-tree]'),
    typeFilters: query('[data-ttv-type-filters]'),
    metricStrip: query('[data-ttv-metrics]'),
    searchResults: query('[data-ttv-search-results]'),
    componentSymbols: query('[data-ttv-component-symbols]'),
  };
}

function collectEditorElements(root) {
  const query = requiredQuery(root);
  return { root, panel: query('[data-ttv-editor-panel]') };
}

function collectParityElements(root) {
  const query = requiredQuery(root);
  return {
    root: query('[data-ttv-parity-root]'),
    fileStatus: root,
    summary: query('[data-ttv-parity-summary]'),
    svgHost: query('[data-ttv-parity-svg-host]'),
    mismatches: query('[data-ttv-parity-mismatches]'),
    inspector: query('[data-ttv-parity-inspector]'),
    status: query('[data-ttv-parity-status]'),
  };
}

function requiredQuery(root) {
  return (selector) => {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Topology workspace element is missing: ${selector}`);
    return element;
  };
}

function ensureStylesheet(documentRef) {
  let link = documentRef.getElementById(STYLE_ID);
  if (!link) {
    link = documentRef.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    documentRef.head.appendChild(link);
  }
  link.href = STYLE_URL;
}

function objectOrNull(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export const _test = Object.freeze({ collectTraceElements, collectEditElements, collectEditorElements, collectParityElements, collectCheckerElements, requiredQuery, ensureStylesheet, workspaceMarkup });
