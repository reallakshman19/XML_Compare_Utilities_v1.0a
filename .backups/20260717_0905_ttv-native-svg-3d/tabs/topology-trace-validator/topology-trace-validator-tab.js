/** Mounts the read-only trace validator and dedicated topology parity area. */
import { createTopologyValidatorController } from './topology-validator-controller.js?v=20260715-ttv-018-parity';
import { createTopologyParityController } from './topology-parity-controller.js?v=20260715-ttv-018-parity';
import { createTopologyWorkspaceController } from './topology-workspace-controller.js?v=20260715-ttv-018-parity';
import { wireTopologyWorkspace } from './topology-workspace-wiring.js?v=20260715-ttv-018-parity';
import { workspaceMarkup } from './topology-workspace-markup.js?v=20260715-ttv-018-parity';

const STYLE_ID = 'topology-trace-validator-style';

export function installTopologyTraceValidatorTile(container, context) {
  ensureStylesheet(container.ownerDocument);
  if (container.querySelector('[data-ttv-open]')) return () => {};
  const tile = container.ownerDocument.createElement('section');
  tile.className = 'psmap-card psmap-tile ttv-launcher';
  tile.innerHTML = '<button type="button" data-ttv-open="1"><span class="ttv-launcher-icon">⌁</span><span><strong>Topology Trace Validator</strong><small>Validate source → canonical → InputXML → SVG parity</small></span></button>';
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
  const overlay = documentRef.createElement('div');
  overlay.className = 'ttv-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Topology Trace Validator');
  documentRef.body.appendChild(overlay);
  const mounted = await mountTopologyTraceValidatorWorkspace(overlay, objectOrNull(context.initialTopologyArtifacts));
  const close = () => { mounted.destroy(); overlay.remove(); };
  overlay.querySelector('[data-ttv-close]').addEventListener('click', close);
  return Object.freeze({ ...mounted, destroy: close });
}

export async function mountTopologyTraceValidatorWorkspace(root, initialArtifacts) {
  ensureStylesheet(root.ownerDocument);
  root.innerHTML = workspaceMarkup();
  const traceController = createTopologyValidatorController(collectTraceElements(root));
  const parityController = createTopologyParityController(collectParityElements(root));
  const controller = createTopologyWorkspaceController(traceController, parityController);
  const cleanups = wireTopologyWorkspace(root, controller);
  if (initialArtifacts) {
    for (const kind of ['source', 'canonical', 'ledger', 'scene', 'parsed', 'report']) {
      if (initialArtifacts[kind]) await controller.loadArtifact(kind, JSON.stringify(initialArtifacts[kind]), `${kind}.fixture.json`);
    }
    if (initialArtifacts.inputXml) await controller.loadArtifact('inputXml', String(initialArtifacts.inputXml), 'topology.fixture.xml');
    controller.validate();
  }
  return Object.freeze({
    controller,
    destroy: () => { cleanups.forEach((cleanup) => cleanup()); controller.destroy(); },
  });
}

function collectTraceElements(root) {
  const query = requiredQuery(root);
  return {
    traceRoot: root,
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
  link.href = './tabs/topology-trace-validator/topology-parity-workspace.css?v=20260715-ttv-018-parity';
}

function objectOrNull(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export const _test = Object.freeze({ collectTraceElements, collectParityElements, requiredQuery, workspaceMarkup });
