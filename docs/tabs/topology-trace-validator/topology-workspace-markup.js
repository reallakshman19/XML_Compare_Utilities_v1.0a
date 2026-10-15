/** Static markup: Trace (with SVG support-draft editor), the 3D Edit Draft tab, and Parity. */

import { FINAL_DISPOSITIONS, escapeMarkup } from './topology-validator-values.js';
import { topologyCheckerIconMarkup } from './topology-checker-icons.js';
import { topologyCheckerPanelMarkup } from './topology-checker-panel.js';
import { EDIT_OPERATION_CAPABILITIES, EDIT_SHELL_CAPABILITIES, EDIT_TOOL_CAPABILITIES, topologyEditCapabilityButtonsMarkup } from './topology-edit-capability-registry.js';

/** @param {string} kind @param {string} label @param {string} accept @param {Record<string, unknown>} options @returns {string} */
function fileControl(kind, label, accept, options = {}) {
  const parity = options.scope === 'parity';
  const scope = parity ? 'data-ttv-parity-file' : 'data-ttv-file';
  const status = parity ? 'data-ttv-parity-file-status' : 'data-ttv-file-status';
  const title = options.title ? ` title="${escapeMarkup(options.title)}"` : '';
  return `<label class="ttv-file-button ${options.disabled ? 'is-disabled' : ''}"${title}>${label}<input type="file" ${scope}="${kind}" accept="${accept}" ${options.disabled ? 'disabled' : ''} hidden><small ${status}="${kind}" hidden>Not loaded</small></label>`;
}
function visibilityCheck(key, label, checked) { return `<label><input type="checkbox" data-ttv-visibility="${key}"${checked ? ' checked' : ''}>${label}</label>`; }
function canvasNavigationMarkup() {
  return `<div class="ttv-canvas-navigation" data-ttv-canvas-navigation aria-label="Trace canvas orientation controls"><button type="button" data-ttv-canvas-fit>Fit</button><button type="button" class="is-active" data-ttv-canvas-projection="XY">XY</button><button type="button" data-ttv-canvas-projection="XZ">XZ</button><button type="button" data-ttv-canvas-projection="ISO">ISO</button></div><svg class="ttv-axis-compass" data-ttv-axis-compass data-projection="XY" viewBox="0 0 100 82" role="img" aria-label="XY axis compass"><circle cx="50" cy="50" r="4"/><g data-ttv-axis="x"><line x1="50" y1="50" x2="84" y2="50"/><text x="88" y="54">X</text></g><g data-ttv-axis="y"><line x1="50" y1="50" x2="50" y2="16"/><text x="46" y="12">Y</text></g><g data-ttv-axis="z" hidden><line x1="50" y1="50" x2="50" y2="12"/><text x="46" y="9">Z</text></g></svg>`;
}

function editorPanelMarkup() {
  return `<section class="ttv-editor-panel" data-ttv-editor-panel hidden aria-label="SVG support draft editor"><header><strong>Support Draft</strong><span data-ttv-editor-dirty>Clean</span></header><p data-ttv-editor-selection>Select a support symbol</p><div class="ttv-editor-coordinates">${['x', 'y', 'z'].map((axis) => `<label>${axis.toUpperCase()}<input type="number" step="0.001" data-ttv-editor-coordinate="${axis}" disabled></label>`).join('')}</div><div class="ttv-editor-actions"><button type="button" data-ttv-editor-set disabled>Set XYZ</button><button type="button" data-ttv-editor-undo disabled>Undo</button><button type="button" data-ttv-editor-redo disabled>Redo</button><button type="button" data-ttv-editor-revert disabled>Revert Draft</button><button type="button" data-ttv-editor-export disabled>Export Patch</button></div><p class="ttv-editor-status" data-ttv-editor-status data-status="ready">Draft changes never mutate loaded evidence.</p></section>`;
}

/** Main-header downloads remain accessible in large-model Trace-only rendering mode. */
function traceExportActionsMarkup() {
  return `<div class="ttv-button-group ttv-main-exports" aria-label="Topology export downloads"><button type="button" data-ttv-edit-export disabled title="Always allowed after exact bytes are prepared; issues and ID-wise operations are logged">Export Bundle + Log</button><button type="button" data-ttv-edit-export-staged title="Export inputxml-managed-stage/v1 with applied mutations and provenance">Export Staged JSON</button></div>`;
}

/** Infrequent artifact overrides are disclosed without occupying the primary header. */
function manualArtifactControlsMarkup() {
  return `<details class="ttv-manual-overrides"><summary aria-label="Show legacy artifact loaders" title="Legacy artifact loaders">&gt;</summary><div class="ttv-manual-overrides-menu">${fileControl('canonical', 'Load Canonical Topology', '.json')}${fileControl('ledger', 'Load Trace Ledger', '.json')}${fileControl('inputXml', 'Load Topology InputXML', '.xml,.XML')}<button type="button" data-ttv-validate>Validate</button></div></details>`;
}

/** Non-modal completion feedback forwards to the same audited header export actions. */
function autoFixToastMarkup() {
  return `<aside class="ttv-autofix-toast" data-ttv-autofix-toast hidden role="status" aria-live="polite"><div class="ttv-autofix-toast-copy"><strong data-ttv-autofix-toast-title>Auto fixed 0</strong><span data-ttv-autofix-toast-detail>0 ID-wise changes recorded in Edit Draft.</span></div><div class="ttv-autofix-toast-actions"><button type="button" data-ttv-autofix-toast-export="bundle">Export Bundle + Log</button><button type="button" data-ttv-autofix-toast-export="staged">Export Staged JSON</button><button type="button" class="ttv-autofix-toast-close" data-ttv-autofix-toast-close aria-label="Dismiss Auto fix summary">×</button></div></aside>`;
}

function replaceRequiredMarkup(markup, fragment, replacement, label) {
  if (!markup.includes(fragment)) throw new Error(`Topology workspace markup is missing ${label}.`);
  return markup.replace(fragment, replacement);
}

function promotedTraceMarkup() {
  const launcherEnd = '<b data-ttv-checker-badge hidden>0</b></button>';
  const legacyControls = `<div class="ttv-manual-overrides">${fileControl('canonical', 'Load Canonical Topology', '.json')}${fileControl('ledger', 'Load Trace Ledger', '.json')}${fileControl('inputXml', 'Load Topology InputXML', '.xml,.XML')}<button type="button" data-ttv-validate>Validate</button></div>`;
  const withExports = replaceRequiredMarkup(traceMarkup(), launcherEnd, `${launcherEnd}${traceExportActionsMarkup()}`, 'checker launcher');
  return replaceRequiredMarkup(withExports, legacyControls, manualArtifactControlsMarkup(), 'legacy artifact controls');
}

function editWithoutExportActionsMarkup() {
  const bundle = '        <button type="button" data-ttv-edit-export disabled title="Always allowed after exact bytes are prepared; issues and operations are logged">Export Bundle + Log</button>\n';
  const staged = '        <button type="button" data-ttv-edit-export-staged title="Export inputxml-managed-stage/v1 with applied mutations + provenance">Export Staged JSON</button>\n';
  const withoutBundle = replaceRequiredMarkup(editMarkup(), bundle, '', 'Edit Draft Bundle + Log action');
  return replaceRequiredMarkup(withoutBundle, staged, '', 'Edit Draft staged JSON action');
}

/** @returns {string} */
function traceMarkup() {
  const dispositionOptions = FINAL_DISPOSITIONS.map((value) => `<option value="${value}">${value}</option>`).join('');
  return `<section class="ttv-trace-area is-active" data-ttv-workspace-panel="trace"><header class="ttv-toolbar"><div class="ttv-title"><strong>Topology Trace Validator</strong><span>Immutable review + isolated SVG draft</span></div><button type="button" class="ttv-checker-launcher" data-ttv-checker-open aria-expanded="false" title="Open dedicated Topology Checker">${topologyCheckerIconMarkup('scan-search', 'Topology Checker', '')}<span>Topology Checker</span><b data-ttv-checker-badge hidden>0</b></button>${fileControl('source', 'Load Json', '.json')}<button type="button" data-ttv-enrich>📚 Master File Enrichment</button><button type="button" data-ttv-download-inputxml title="Download current InputXML; committed Edit Draft and Auto-fix changes take precedence">⬇ Download InputXML</button><div class="ttv-button-group"><button type="button" data-ttv-zoom="in">Zoom +</button><button type="button" data-ttv-zoom="out">Zoom −</button><button type="button" data-ttv-fit>Fit</button></div><div class="ttv-button-group"><button type="button" class="is-active" data-ttv-projection="XY">XY</button><button type="button" data-ttv-projection="XZ">XZ</button><button type="button" data-ttv-projection="YZ">YZ</button><button type="button" data-ttv-projection="3D">3D</button></div><div class="ttv-button-group"><button type="button" class="is-active" data-ttv-mode="spatial">Spatial Overlay</button><button type="button" data-ttv-mode="trace">Source ↔ Canonical</button><button type="button" data-ttv-mode="junctions">Junctions / Boundaries</button><button type="button" data-ttv-mode="issues">Issues Only</button></div><div class="ttv-button-group ttv-editor-mode-group" aria-label="Trace authoring mode"><button type="button" class="is-active" data-ttv-editor-mode="review">Review</button><button type="button" data-ttv-editor-mode="edit">Edit Draft</button><span data-ttv-editor-dirty>Clean</span></div><label class="ttv-toggle"><input type="checkbox" data-ttv-isolate="supports">Isolate Supports</label><label class="ttv-toggle"><input type="checkbox" data-ttv-component-symbols data-ttv-symbol-overlays>Symbol Overlays</label><label class="ttv-toggle"><input type="checkbox" data-ttv-labels>Labels</label><div class="ttv-manual-overrides">${fileControl('canonical', 'Load Canonical Topology', '.json')}${fileControl('ledger', 'Load Trace Ledger', '.json')}${fileControl('inputXml', 'Load Topology InputXML', '.xml,.XML')}<button type="button" data-ttv-validate>Validate</button></div><button type="button" class="ttv-close" data-ttv-close>Close</button></header><div class="ttv-file-status" data-ttv-file-status-root hidden></div><div class="ttv-metrics" data-ttv-metrics></div><div class="ttv-main"><aside class="ttv-left"><h2>Branches</h2><div class="ttv-branch-tree" data-ttv-branch-tree><p>Select one source JSON; companion artifacts load automatically.</p></div><h2>Component types</h2><div class="ttv-type-filters" data-ttv-type-filters></div><label>Disposition<select data-ttv-disposition><option value="">All dispositions</option>${dispositionOptions}</select></label><label>Search NAME<input type="search" data-ttv-search-name></label><label>Search REF<input type="search" data-ttv-search-ref></label><label>Search source path<input type="search" data-ttv-search-path></label><div class="ttv-search-results" data-ttv-search-results></div><fieldset><legend>Visibility</legend>${visibilityCheck('source', 'Source geometry', true)}${visibilityCheck('canonical', 'Canonical geometry', true)}${visibilityCheck('referenceConnections', 'Reference connection spans', false)}${visibilityCheck('pointFeatures', 'Point features', true)}${visibilityCheck('boundaries', 'Boundaries', true)}${visibilityCheck('junctions', 'Junctions', true)}</fieldset></aside><main class="ttv-center">${canvasNavigationMarkup()}<div class="ttv-svg-host" data-ttv-svg-host><div class="ttv-empty">Select a managed source JSON to auto-load its companion artifacts.</div></div>${editorPanelMarkup()}<div class="ttv-navigation-hint">Native SVG · Drag to pan · Wheel to zoom · Edit Draft uses X/Y/Z handles · Escape cancels drag</div></main><aside class="ttv-inspector" data-ttv-inspector><div class="ttv-inspector-empty">Select an object after validation.</div></aside></div><footer class="ttv-bottom" data-ttv-bottom></footer><div class="ttv-status" data-ttv-status data-status="idle">Select source JSON. Canonical topology, trace ledger, and InputXML will load automatically when hosted.</div></section>`;
}

/** @returns {string} */
function editMarkup() {
  const toolButtons = topologyEditCapabilityButtonsMarkup(EDIT_TOOL_CAPABILITIES, 'tool.select');
  const operationButtons = topologyEditCapabilityButtonsMarkup(EDIT_OPERATION_CAPABILITIES, '');
  const shellButtons = topologyEditCapabilityButtonsMarkup(EDIT_SHELL_CAPABILITIES, '');
  return `<section class="ttv-edit-area" data-ttv-workspace-panel="edit" data-ttv-edit-root hidden>
    <header class="ttv-edit-toolbar">
      <div class="ttv-title"><strong>Edit Draft</strong><span data-ttv-edit-scope-status>Reversible canonical topology surgery · source remains immutable</span></div>
      <div class="ttv-button-group">
        ${toolButtons}${operationButtons}
      </div>
      <div class="ttv-button-group">
        ${shellButtons}
      </div>
      <div class="ttv-button-group">
        <label class="ttv-toggle" title="Select Vertical Axis">Up Axis: <select data-ttv-vertical-axis><option value="Y">Y</option><option value="Z" selected>Z</option></select></label>
        <label class="ttv-support-scale" title="Scale support symbols without changing topology">Support scale <input type="range" min="0.25" max="6" step="0.25" value="2.5" data-ttv-support-scale><output data-ttv-support-scale-output>2.50×</output></label>
        <label class="ttv-toggle" title="Show autofix proposals as translucent ghosts"><input type="checkbox" data-ttv-edit-ghosts>Ghost fixes</label>
        <button type="button" data-ttv-edit-apply-approved title="Apply every auto-approved proposal (one transaction)">Apply approved</button>
      </div>
      <div class="ttv-visibility-ribbon" aria-label="Selection filters">
        ${EDIT_FILTERS.map((kind) => {
          const icons = { node:'⬡', edge:'📏', support:'△', bend:'⌒', issue:'⚠️' };
          return `<button type="button" class="ttv-vis-btn is-active" data-ttv-edit-selection-filter="${kind}" title="Filter ${kind}">${icons[kind]}</button>`;
        }).join('')}
      </div>
      <div class="ttv-button-group ttv-edit-exports">
        <label class="ttv-file-button" title="Load a managed-stage / staged JSON directly (branch scope popup for large files)">Load Staged JSON<input type="file" data-ttv-edit-load-staged accept=".json" hidden></label>
        <button type="button" data-ttv-edit-load-branches title="Load or change the JSON zones and branches rendered in large-model Draft Edit">Load JSON branches</button>
        <label class="ttv-toggle" title="Models above this canonical element count use scoped Draft Edit">Large model &gt; <input type="number" min="1" step="1" value="200" data-ttv-large-model-threshold style="width:64px"></label>
        <button type="button" data-ttv-edit-save>Save Draft</button>
        <label class="ttv-file-button">Load Draft<input type="file" data-ttv-edit-load accept=".json" hidden></label>
        <button type="button" data-ttv-edit-export disabled title="Always allowed after exact bytes are prepared; issues and operations are logged">Export Bundle + Log</button>
        <button type="button" data-ttv-edit-export-staged title="Export inputxml-managed-stage/v1 with applied mutations + provenance">Export Staged JSON</button>
      </div>
    </header>
    <div class="ttv-edit-metrics" data-ttv-edit-metrics></div>
    <div class="ttv-edit-ghost-summary" data-ttv-edit-ghost-summary></div>
    <div class="ttv-edit-main">
      <main class="ttv-edit-canvas-stack">
        <div class="ttv-edit-svg-host" data-ttv-edit-svg-host><div class="ttv-empty">Open Edit Draft after loading topology.</div></div><svg class="ttv-axis-compass" data-ttv-edit-axis-compass viewBox="-50 -50 100 100" width="80" height="80" style="position:absolute;bottom:10px;left:10px;pointer-events:none;z-index:20;"><defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs><line x1="0" y1="0" x2="35" y2="0" stroke="#ef4444" stroke-width="2" marker-end="url(#arrow)" style="color:#ef4444" /><text x="40" y="5" font-size="12" fill="#ef4444">X</text><line x1="0" y1="0" x2="0" y2="-35" stroke="#22c55e" stroke-width="2" marker-end="url(#arrow)" style="color:#22c55e" /><text x="-5" y="-40" font-size="12" fill="#22c55e">Y</text></svg>
        <div class="ttv-edit-3d-host" data-ttv-edit-3d-host hidden></div>
        <div class="ttv-navigation-hint" id="ttv-edit-keyboard-help">CAD navigation: left select/edit · middle orbit · Shift+middle pan · wheel zoom · F fit selection · Shift+F fit all · H home · Backspace previous view · P pivot · Escape cancel</div>
      </main>
      <aside class="ttv-edit-inspector" data-ttv-edit-inspector><div class="ttv-inspector-empty">Select a draft object.</div></aside>
    </div>
    <details class="ttv-edit-bottom-details" open>
      <summary class="ttv-edit-bottom-summary">Data, Export, Logs & Findings</summary>
      <footer class="ttv-edit-bottom">
        <section data-ttv-edit-timeline></section>
        <section data-ttv-edit-validation></section>
        <section class="ttv-edit-updates" data-ttv-edit-updates></section>
        <section class="ttv-edit-export-plan" data-ttv-edit-export-plan><div class="ttv-export-pending">Export state will appear after Edit Draft initializes.</div></section>
      </footer>
    </details>
    <div class="ttv-status" data-ttv-edit-status data-status="idle">Edit Draft is not initialized.</div>
    <div class="ttv-sr-only" aria-live="polite" data-ttv-edit-live></div>
  </section>`;
}

const EDIT_FILTERS = Object.freeze(['node', 'edge', 'support', 'bend', 'issue']);

/** @returns {string} */
function parityMarkup() {
  return `<section class="ttv-parity-area" data-ttv-workspace-panel="parity" data-ttv-parity-root hidden>
    <header class="ttv-parity-toolbar">
      <div class="ttv-title"><strong>Topology Parity</strong><span>Canonical ↔ InputXML ↔ SVG ↔ actual CII records</span></div>
      <div class="ttv-button-group">
        ${fileControl('scene', '🖼️', '.json', { scope: 'parity', title: 'Load SVG Scene' })}
        ${fileControl('parsed', '🌳', '.json', { scope: 'parity', title: 'Load Parsed InputXML Topology' })}
        ${fileControl('report', '📊', '.json', { scope: 'parity', title: 'Load Parity Report' })}
        ${fileControl('ciiProjection', '📋', '.json', { scope: 'parity', title: 'Load CII Projection Ledger' })}
      </div>
      <div class="ttv-button-group">
        <button type="button" data-ttv-parity-zoom="in">🔍+</button><button type="button" data-ttv-parity-zoom="out">🔍−</button>
        <button type="button" data-ttv-parity-fit="all" title="Fit All">🏠</button><button type="button" data-ttv-parity-fit="branch" title="Fit Branch">🌿</button><button type="button" data-ttv-parity-fit="issue" title="Fit Issue">⚠️</button>
      </div>
      <div class="ttv-button-group">
        <button type="button" class="is-active" data-ttv-parity-projection="ISO">ISO</button><button type="button" data-ttv-parity-projection="XY">XY</button><button type="button" data-ttv-parity-projection="XZ">XZ</button><button type="button" data-ttv-parity-projection="YZ">YZ</button>
      </div>
      <label class="ttv-toggle"><input type="checkbox" data-ttv-parity-labels>Labels</label>
      <div class="ttv-parity-exports">
        <button type="button" data-ttv-parity-export="scene">Scene</button><button type="button" data-ttv-parity-export="parsed">Parsed</button><button type="button" data-ttv-parity-export="report">Report</button><button type="button" data-ttv-parity-export="ciiProjection">CII Ledger</button><button type="button" data-ttv-parity-export="ciiIdentity">CII Identity</button><button type="button" data-ttv-parity-export="mismatches">Mismatch CSV</button><button type="button" data-ttv-parity-export="svg" title="Topology SVG">SVG</button>
      </div>
    </header>
    <div class="ttv-parity-summary" data-ttv-parity-summary></div>
    <div class="ttv-parity-main"><main class="ttv-parity-center"><div class="ttv-parity-svg-host" data-ttv-parity-svg-host><div class="ttv-empty">Load parity artifacts or build topology.</div></div><div class="ttv-navigation-hint">Scene-only topology · CII is linked evidence, never geometry · Drag to pan · Cursor-centred wheel zoom</div></main><div class="ttv-parity-gutter" data-ttv-gutter="1"></div><aside class="ttv-parity-inspector-host" data-ttv-parity-inspector><div class="ttv-inspector-empty">Select a parity mismatch or SVG entity.</div></aside></div>
    <div class="ttv-parity-mismatches" data-ttv-parity-mismatches></div>
    <div class="ttv-status" data-ttv-parity-status data-status="not_run">Topology parity NOT_RUN.</div>
  </section>`;
}

/** @returns {string} */
export function workspaceMarkup() {
  return `<section class="ttv-workspace"><nav class="ttv-workspace-tabs" role="tablist" aria-label="Topology workspace"><button type="button" role="tab" aria-selected="true" class="is-active" data-ttv-workspace-tab="trace">Trace</button><button type="button" role="tab" aria-selected="false" data-ttv-workspace-tab="edit">Edit Draft</button><button type="button" role="tab" aria-selected="false" data-ttv-workspace-tab="parity">Parity</button>    <div class="ttv-button-group" style="margin-left:auto; margin-right:8px; align-self:center; transform:scale(0.85);">
      <button type="button" data-ttv-font-zoom="in" title="Increase font size (F+)">F+</button>
      <button type="button" data-ttv-font-zoom="out" title="Decrease font size (F-)">F−</button>
    </div></nav>${promotedTraceMarkup()}${editWithoutExportActionsMarkup()}${parityMarkup()}${topologyCheckerPanelMarkup()}${autoFixToastMarkup()}</section>`;
}

export const _test = Object.freeze({ fileControl, visibilityCheck, canvasNavigationMarkup, editorPanelMarkup, traceExportActionsMarkup, manualArtifactControlsMarkup, autoFixToastMarkup, replaceRequiredMarkup, promotedTraceMarkup, editWithoutExportActionsMarkup, traceMarkup, editMarkup, parityMarkup });
