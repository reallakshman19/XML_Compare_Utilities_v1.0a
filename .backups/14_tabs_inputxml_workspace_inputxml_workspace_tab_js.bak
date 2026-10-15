import { buildCleanXml, buildCleanXmlFromTables, parseAvevaXmlToTables, positiveRouteNodes } from './inputxml-workspace-cleanxml.js';
import { dtxrRowsFromJsonTraceSnapshot, dtxrRowsToTableText, parseDtxrTable } from './inputxml-workspace-dtxr.js';
import {
  buildAccdbSideloadTables, RESTRAINT_COLUMNS, NODAL_COORD_COLUMNS, USER_COORD_COLUMNS, BASIC_ELEMENT_COLUMNS,
  SAMPLE_BASIC_TEXT, SAMPLE_RESTRAINTS_TEXT, SAMPLE_NODAL_TEXT, SAMPLE_USER_NODAL_TEXT,
} from './inputxml-workspace-sideload.js';
import { parseLooseTable, rowsToTabText } from './inputxml-workspace-table.js';
import { BRANCH_COLUMNS, COMPONENT_COLUMNS, SUPPORT_COLUMNS, COORDINATE_COLUMNS, buildTablesFromManualRows } from './inputxml-workspace-manual-tables.js';
import { readAccdbNamedTables } from '../../parser/accdb-mdb.js';
import { RuntimeEvents } from '../../contracts/runtime-events.js';
import { applyXmlCompareSideload } from '../../xml-compare/XmlCompareSideloadEnricher.js';
import { convertCategorizedInputXml, categorizedFileName } from '../../xml-compare/CategorizedInputXmlConverter.js';
import { renderXmlCiiTopology5BPanel } from '../model-converters/xml-cii-topology-5b-panel.js';
import { renderXmlCiiTopology5CPanel } from '../model-converters/xml-cii-topology-5c-panel.js';
import { renderXmlCiiInputXmlCompare5DPanel } from '../model-converters/xml-cii-inputxml-compare-5d-panel.js';
import { bindXmlCiiJsonTracePanel, renderXmlCiiJsonTracePanel } from '../model-converters/json-trace/json-trace-panel.js';
import { bindXmlCiiSupportMapperPhase, xmlCiiRenderSupportMapperPhase } from '../model-converters/converters/xmltocii2019_helper/support-types-panel.js';
import { detectXmlWorkspaceSchema, isXmlMaskEnabled, setXmlMaskEnabled, maskedFileName, XML_OR_TXT_ACCEPT, XML_WORKSPACE_KINDS } from './inputxml-workspace-xml-detect.js';

/**
 * InputXML Workspace UI tile/modal.
 * Inputs: pasted/uploaded XML, staged JSON, DTXR tables, ACCDB-helper tables, and InputXML files.
 * Outputs: CleanXML, enriched InputXML, 5C InputXML, categorized XML, 5D topology comparison.
 * Fallback: all tabs accept paste input when helper/browse sources are unavailable.
 */

const ACTIVATE = 'click';
const MODAL_STYLE_ID = 'inputxml-workspace-style';
const POPUP_TITLE_ID = 'inputxml-workspace-title';
const TABS = Object.freeze([
  ['clean', '1 Clean XML / Table to CleanXML'],
  ['enrich', '2 InputXML Enrichment'],
  ['xml-to-inputxml', '3 XML to InputXML'],
  ['categorized', '4 Create Categorized XML'],
  ['compare5d', '5 InputXML Compare Topo-wise'],
  ['misc', '6 Misc'],
]);
const CLEAN_SUBTABS = Object.freeze([
  ['branches', 'Branches'],
  ['components', 'Components/Nodes'],
  ['supports', 'Supports/Restraints'],
  ['coordinates', 'Coordinates'],
  ['cleanxml', 'CleanXML'],
  ['dtxr', 'DTXR'],
]);
const MISC_SUBTABS = Object.freeze([
  ['config', 'Config'],
  ['topo', 'Topo'],
  ['support', 'Support config'],
]);

const h = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const text = (value) => String(value ?? '').trim();

function ensureModalStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(MODAL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = MODAL_STYLE_ID;
  style.textContent = `
.inputxml-workspace-launcher{height:160px;width:220px;border:1px solid rgba(125,211,252,.32);border-radius:16px;background:#111827;color:#e5eefb;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.25);display:grid!important;grid-template-columns:1fr;place-items:center;text-align:center;padding:16px;margin-top:18px;gap:5px;box-sizing:border-box}
.inputxml-workspace-launcher b{font-size:15px;color:#e0f2fe}.inputxml-workspace-launcher span{color:#9fb3ca;font-size:12px;line-height:1.35}
.inputxml-workspace-launcher-icon{display:block;font-size:40px;line-height:1;margin:0 0 6px}
.ixw-backdrop{position:fixed;inset:0;z-index:94;display:grid;place-items:center;padding:20px;background:rgba(2,6,23,.78);box-sizing:border-box}
.ixw-dialog{--ixw-gap-sm:6px;--ixw-gap-md:10px;--ixw-gap-lg:16px;width:min(1500px,calc(100vw - 34px));height:min(920px,calc(100vh - 34px));display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(125,211,252,.36)!important;border-radius:14px!important;background:#0f172a!important;color:#dbeafe;box-shadow:0 24px 80px rgba(0,0,0,.56)}
.ixw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.18);background:#111827}
.ixw-head b{font-size:16px;color:#f8fafc}.ixw-head span{display:block;color:#9fb3ca;font-size:12px;margin-top:3px}
.ixw-close,.ixw-btn{background:#1f2937;color:#e5eefb;border:1px solid rgba(148,163,184,.34);border-radius:8px;padding:7px 10px;cursor:pointer;font-size:12px}
.ixw-btn.primary{background:#1d4ed8;border-color:#2563eb;color:#fff}.ixw-btn:disabled{opacity:.46;cursor:not-allowed}
.ixw-tabs,.ixw-subtabs{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.14);background:#0b1220}
.ixw-tab,.ixw-subtab{background:#111827;color:#a9bfd8;border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:7px 10px;cursor:pointer;font-size:12px}.ixw-tab.active,.ixw-subtab.active{background:#1e3a5f;color:#e0f2fe;border-color:#38bdf8}
.ixw-body{min-height:0;overflow:auto;padding:12px}.ixw-grid{display:grid;grid-template-columns:minmax(320px,420px) minmax(0,1fr);gap:12px;align-items:start}.ixw-grid.three{grid-template-columns:1fr 1fr 1fr}
.ixw-panel{border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#111827;padding:10px;margin-bottom:10px}
.ixw-panel>.ixw-title:first-child{margin-top:0}.ixw-panel.compact{padding:8px}
.ixw-title{font-size:12px;font-weight:700;color:#dbeafe;margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em}.ixw-note{font-size:12px;color:#9fb3ca;line-height:1.4;margin:4px 0 8px}
.ixw-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
.ixw-toolbar.actions{border-top:1px solid rgba(148,163,184,.14);padding-top:8px;margin-top:8px}
.ixw-textarea{width:100%;min-height:170px;box-sizing:border-box;background:#020617;color:#e5eefb;border:1px solid rgba(148,163,184,.32);border-radius:8px;padding:8px;font:11px ui-monospace,Consolas,monospace}
.ixw-textarea.small{min-height:92px}.ixw-textarea.tall{min-height:430px}.ixw-output{white-space:pre;overflow:auto;max-height:360px;background:#020617;color:#dbeafe;border:1px solid rgba(148,163,184,.24);border-radius:8px;padding:8px;font:11px ui-monospace,Consolas,monospace}
.ixw-status{font-size:12px;color:#bbf7d0}.ixw-error{font-size:12px;color:#fecaca}.ixw-table{width:100%;border-collapse:collapse;font-size:12px;min-width:760px}.ixw-table th,.ixw-table td{border-bottom:1px solid rgba(148,163,184,.16);padding:6px 8px;text-align:left}.ixw-table th{color:#bfdbfe;background:#0b1220;position:sticky;top:0}.ixw-table tbody tr:nth-child(even){background:rgba(148,163,184,.05)}
@media(max-width:900px){.ixw-grid,.ixw-grid.three{grid-template-columns:1fr}.ixw-dialog{height:calc(100vh - 24px);width:calc(100vw - 24px)}}
.ixw-dialog .xml-cii-native-toolbar,.ixw-dialog .model-converters-toolbar,.ixw-dialog .json-trace-source-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(148,163,184,.12);margin-bottom:8px}
.ixw-dialog .json-trace-scope-controls,.ixw-dialog .json-trace-join-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 0;margin:4px 0}
.ixw-dialog .json-trace-check,.ixw-dialog .json-trace-inline-field{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#c7d5e6}
.ixw-dialog .json-trace-join-title{font-size:11px;font-weight:700;color:#9fb3ca;text-transform:uppercase;letter-spacing:.03em;margin-right:4px}
.ixw-dialog .json-trace-join-note,.ixw-dialog .json-trace-muted{font-size:11px;color:#8ea0b8;margin:2px 0 8px}
.ixw-dialog .json-trace-source-drawer,.ixw-dialog details.xml-cii-native-card,.ixw-dialog .json-trace-tree-card,.ixw-dialog .json-trace-table-wrap{border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:8px 10px;margin-bottom:10px;background:#111827}
.ixw-dialog .json-trace-source-drawer>summary,.ixw-dialog details.xml-cii-native-card>summary,.ixw-dialog .json-trace-tree-group>summary,.ixw-dialog .json-trace-tree-bucket>summary,.ixw-dialog .json-trace-tree-bore>summary,.ixw-dialog .json-trace-tree-branch>summary{cursor:pointer;font-weight:600;color:#dbeafe}
.ixw-dialog .json-trace-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:1px solid rgba(148,163,184,.18);padding-bottom:4px;margin:10px 0 8px}
.ixw-dialog .json-trace-section-title,.ixw-dialog .json-trace-page-title,.ixw-dialog .json-trace-card-title{font-size:12px;font-weight:700;color:#dbeafe;text-transform:uppercase;letter-spacing:.04em}
.ixw-dialog .json-trace-section-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ixw-dialog .json-trace-ghost-btn,.ixw-dialog .json-trace-source-button{background:#1f2937;color:#e5eefb;border:1px solid rgba(148,163,184,.34);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px}
.ixw-dialog .xml-cii-native-table,.ixw-dialog .json-trace-table{width:100%;border-collapse:collapse;font-size:12px}
.ixw-dialog .xml-cii-native-table th,.ixw-dialog .xml-cii-native-table td,.ixw-dialog .json-trace-table th,.ixw-dialog .json-trace-table td{border-bottom:1px solid rgba(148,163,184,.16);padding:6px 8px;text-align:left}
.ixw-dialog .xml-cii-native-table th,.ixw-dialog .json-trace-table th{color:#bfdbfe;background:#0b1220;position:sticky;top:0}
.ixw-dialog .xml-cii-native-table-wrap,.ixw-dialog .json-trace-table-wrap{overflow:auto;max-height:340px}
.ixw-dialog .model-converters-download-btn,.ixw-dialog .model-converters-run-btn,.ixw-dialog .xml-cii-native-card button{background:#1f2937;color:#e5eefb;border:1px solid rgba(148,163,184,.34);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px}
`;
  doc.head?.appendChild(style);
}

function renderLauncher() {
  return `<button type="button" class="psmap-card psmap-tile inputxml-workspace-launcher" data-ixw-open="1" title="Open InputXML Workspace">
<span class="inputxml-workspace-launcher-icon" aria-hidden="true">🗂️</span>
<b>InputXML Workspace</b>
<span>CleanXML, enrichment, XML→InputXML, categorized XML, and topo compare</span>
</button>`;
}

function defaultState() {
  return {
    activeTab: 'clean',
    cleanSubtab: 'cleanxml',
    miscSubtab: 'config',
    sourceXmlText: '',
    sourceName: 'pasted.xml',
    cleanXmlText: '',
    cleanTables: null,
    dtxrTableText: '',
    dtxrRows: [],
    jsonTraceDtxrRows: [],
    manualTables: { branchesText: '', componentsText: '', supportsText: '', coordinatesText: '' },
    manualRows: { branches: [], components: [], supports: [], coordinates: [] },
    supportConfigJson: '{}',
    enrichment: {},
    categorizedDirection: 'input-to-categorized',
    categorizedInputText: '',
    categorizedOutputText: '',
    status: '',
    error: '',
  };
}

function tablePreview(rows = [], columns = [], emptyText = 'No rows.') {
  if (!rows.length) return `<div class="ixw-note">${h(emptyText)}</div>`;
  const visible = rows.slice(0, 300);
  return `<div style="overflow:auto;max-height:300px;"><table class="ixw-table"><thead><tr>${columns.map((column) => `<th>${h(column.label || column.key)}</th>`).join('')}</tr></thead><tbody>${visible.map((row) => `<tr>${columns.map((column) => `<td>${h(row?.[column.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function cleanSummary(state) {
  const tables = state.cleanTables;
  if (!tables) return 'No CleanXML result yet.';
  const routeNodeCount = (tables.branches || []).reduce((sum, branch) => sum + positiveRouteNodes(branch.nodes).length, 0);
  const droppedCount = tables.nodes.length - routeNodeCount;
  const droppedNote = droppedCount > 0 ? ` ${droppedCount} node(s) dropped (GASK type, or blank NodeNumber with no position).` : '';
  return `${tables.branches.length} branch(es), ${tables.nodes.length} node row(s) parsed, ${routeNodeCount} node(s) written to CleanXML route, ${tables.dtxr.length} DTXR annotated node(s), ${tables.supports.length} restraint row(s).${droppedNote}`;
}

function renderCleanXmlSubtab(state) {
  const nodeCols = [
    { key: 'branchName', label: 'Branch' },
    { key: 'nodeNumberRaw', label: 'Node' },
    { key: 'nodeName', label: 'Node Name' },
    { key: 'componentType', label: 'Resolved Role' },
    { key: 'sourceComponentType', label: 'Source Type' },
    { key: 'componentRefNo', label: 'Ref' },
    { key: 'resolverBasis', label: 'Basis' },
  ];
  return `<div class="ixw-grid">
    <section class="ixw-panel">
      <div class="ixw-title">Source XML</div>
      <div class="ixw-toolbar">
        <input type="file" accept="${XML_OR_TXT_ACCEPT}" data-ixw-file="sourceXml">
        <button class="ixw-btn primary" data-ixw-action="build-cleanxml">Build CleanXML</button>
        <button class="ixw-btn" data-ixw-action="use-cleanxml-5c" ${state.cleanXmlText ? '' : 'disabled'}>Use in Tab 3</button>
        <button class="ixw-btn" data-ixw-action="use-cleanxml-enrichment" ${state.cleanXmlText ? '' : 'disabled'}>Use in Tab 2 Enrichment</button>
      </div>
      <textarea class="ixw-textarea tall" spellcheck="false" data-ixw-field="sourceXmlText" placeholder="Paste Aveva XML or node-based XML here.">${h(state.sourceXmlText)}</textarea>
      <div class="${state.error ? 'ixw-error' : 'ixw-status'}">${h(state.error || state.status)}</div>
    </section>
    <section class="ixw-panel">
      <div class="ixw-title">CleanXML Result</div>
      <div class="ixw-note">${h(cleanSummary(state))}</div>
      <div class="ixw-toolbar">
        <button class="ixw-btn" data-ixw-action="download-cleanxml" ${state.cleanXmlText ? '' : 'disabled'}>Download CleanXML</button>
        <button class="ixw-btn" data-ixw-action="copy-cleanxml" ${state.cleanXmlText ? '' : 'disabled'}>Copy CleanXML</button>
      </div>
      <textarea class="ixw-textarea tall" readonly spellcheck="false">${h(state.cleanXmlText)}</textarea>
      <div class="ixw-title" style="margin-top:10px;">Resolved Node Table</div>
      ${tablePreview(state.cleanTables?.nodes || [], nodeCols)}
    </section>
  </div>`;
}

function renderDtxrSubtab(state) {
  const dtxrCols = [
    { key: 'psNo', label: 'PS No.(Item Name)' },
    { key: 'branch', label: 'Branch(Pipe)' },
    { key: 'bore', label: 'Bore' },
    { key: 'pos', label: 'POS' },
    { key: 'dtxr', label: 'DTXR' },
    { key: 'cmpSupGap', label: 'CMPSUPGAP' },
    { key: 'source', label: 'Source' },
  ];
  return `<div class="ixw-grid">
    <section class="ixw-panel">
      <div class="ixw-title">DTXR Table Paste</div>
      <div class="ixw-note">Accepted columns: PS No.(Item Name), Branch(Pipe), Bore, POS, DTXR, CMPSUPGAP.</div>
      <div class="ixw-toolbar">
        <button class="ixw-btn primary" data-ixw-action="parse-dtxr-table">Parse DTXR Table</button>
        <button class="ixw-btn" data-ixw-action="use-json-trace-dtxr">Use JSON Trace DTXR</button>
      </div>
      <textarea class="ixw-textarea" spellcheck="false" data-ixw-field="dtxrTableText" placeholder="PS No.(Item Name)	Branch(Pipe)	Bore	POS	DTXR	CMPSUPGAP">${h(state.dtxrTableText)}</textarea>
      <div class="ixw-title" style="margin-top:10px;">Parsed DTXR Rows</div>
      ${tablePreview([...state.dtxrRows, ...state.jsonTraceDtxrRows], dtxrCols, 'No DTXR rows parsed yet.')}
    </section>
    <section class="ixw-panel">
      <div class="ixw-title">Json Trace</div>
      <div class="ixw-note">Browse staged JSON and mark it as the JSON Trace staged source. CleanXML can consume parsed DTXR rows from this state.</div>
      <div data-ixw-json-trace-host>${renderXmlCiiJsonTracePanel(jsonTraceServices(state))}</div>
    </section>
  </div>`;
}

const MANUAL_TABLE_SPECS = {
  branches: {
    title: 'Branches (paste table)',
    note: 'Columns: BranchName, Pressure1-9, Temperature1-9, HydroPressure, MaterialNumber, MaterialName, InsulationDensity, FluidDensity, PipingClass, Rating.',
    textKey: 'branchesText',
    rowsKey: 'branches',
    parseAction: 'parse-manual-branches',
    columns: BRANCH_COLUMNS,
    previewCols: [
      { key: 'branchName', label: 'Branch' },
      { key: 'pressure1', label: 'P1' },
      { key: 'temperature1', label: 'T1' },
      { key: 'materialName', label: 'Material' },
      { key: 'pipingClass', label: 'Class' },
    ],
  },
  components: {
    title: 'Components / Nodes (paste table)',
    note: 'Columns: BranchName, NodeNumberRaw, NodeName, Endpoint, ComponentType, ComponentTypeOverride, ConnectionType, ComponentRefNo, PositionX/Y/Z, Od, WallThickness, CorrosionAllowance, InsulationThickness, BendRadius, Sif, Rigid, Weight, BoreMm, PipingClass, Rating, MaterialName, MaterialCode. Leave Endpoint blank and set ComponentTypeOverride to force Tee/Olet/Reducer classification when Endpoint data is unavailable.',
    textKey: 'componentsText',
    rowsKey: 'components',
    parseAction: 'parse-manual-components',
    columns: COMPONENT_COLUMNS,
    previewCols: [
      { key: 'branchName', label: 'Branch' },
      { key: 'nodeNumberRaw', label: 'Node' },
      { key: 'nodeName', label: 'Node Name' },
      { key: 'componentType', label: 'Component Type' },
      { key: 'componentTypeOverride', label: 'Override' },
      { key: 'endpoint', label: 'Endpoint' },
    ],
  },
  supports: {
    title: 'Supports / Restraints (paste table)',
    note: 'Columns: BranchName, NodeNumber, NodeName, Type, Stiffness, Gap, Friction, Xcosine, Ycosine, Zcosine, Tag.',
    textKey: 'supportsText',
    rowsKey: 'supports',
    parseAction: 'parse-manual-supports',
    columns: SUPPORT_COLUMNS,
    previewCols: [
      { key: 'branchName', label: 'Branch' },
      { key: 'nodeNumber', label: 'Node' },
      { key: 'type', label: 'Type' },
      { key: 'stiffness', label: 'Stiffness' },
      { key: 'gap', label: 'Gap' },
      { key: 'tag', label: 'Tag' },
    ],
  },
  coordinates: {
    title: 'Coordinates (paste table)',
    note: 'Columns: BranchName, NodeNumber, NodeName, X, Y, Z.',
    textKey: 'coordinatesText',
    rowsKey: 'coordinates',
    parseAction: 'parse-manual-coordinates',
    columns: COORDINATE_COLUMNS,
    previewCols: [
      { key: 'branchName', label: 'Branch' },
      { key: 'nodeNumber', label: 'Node' },
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
      { key: 'z', label: 'Z' },
    ],
  },
};

function renderManualTableSubtab(state, specKey) {
  const spec = MANUAL_TABLE_SPECS[specKey];
  const rows = state.manualRows[spec.rowsKey] || [];
  return `<div class="ixw-grid">
    <section class="ixw-panel">
      <div class="ixw-title">${h(spec.title)}</div>
      <div class="ixw-note">${h(spec.note)}</div>
      <div class="ixw-toolbar">
        <button class="ixw-btn primary" data-ixw-action="${h(spec.parseAction)}">Parse Table</button>
        <button class="ixw-btn" data-ixw-action="build-cleanxml-from-tables">Build CleanXML from Tables</button>
      </div>
      <textarea class="ixw-textarea tall" spellcheck="false" data-ixw-field="${h(spec.textKey)}" placeholder="Paste a tab/comma/pipe-delimited table with a header row.">${h(state.manualTables[spec.textKey])}</textarea>
      <div class="${state.error ? 'ixw-error' : 'ixw-status'}">${h(state.error || state.status)}</div>
    </section>
    <section class="ixw-panel">
      <div class="ixw-title">Parsed Rows</div>
      ${tablePreview(rows, spec.previewCols, 'No rows parsed yet.')}
    </section>
  </div>`;
}

function renderManualBranchesSubtab(state) { return renderManualTableSubtab(state, 'branches'); }
function renderManualComponentsSubtab(state) { return renderManualTableSubtab(state, 'components'); }
function renderManualSupportsSubtab(state) { return renderManualTableSubtab(state, 'supports'); }
function renderManualCoordinatesSubtab(state) { return renderManualTableSubtab(state, 'coordinates'); }

function renderCleanTab(state) {
  const body = state.cleanSubtab === 'dtxr' ? renderDtxrSubtab(state)
    : state.cleanSubtab === 'branches' ? renderManualBranchesSubtab(state)
    : state.cleanSubtab === 'components' ? renderManualComponentsSubtab(state)
    : state.cleanSubtab === 'supports' ? renderManualSupportsSubtab(state)
    : state.cleanSubtab === 'coordinates' ? renderManualCoordinatesSubtab(state)
    : renderCleanXmlSubtab(state);
  return `<div class="ixw-subtabs">${CLEAN_SUBTABS.map(([id, label]) => `<button type="button" class="ixw-subtab ${state.cleanSubtab === id ? 'active' : ''}" data-ixw-clean-subtab="${h(id)}">${h(label)}</button>`).join('')}</div>${body}`;
}

function renderEnrichmentTab(state) {
  const output = state.enrichment || {};
  return `<div class="ixw-grid three">
    <section class="ixw-panel">
      <div class="ixw-title">InputXML</div>
      <div class="ixw-toolbar">
        <input type="file" accept="${XML_OR_TXT_ACCEPT}" data-ixw-file="enrichInputXml">
      </div>
      <textarea class="ixw-textarea" data-ixw-field="enrichInputXml" spellcheck="false" placeholder="Paste InputXML to enrich">${h(output.inputXmlText || '')}</textarea>
    </section>
    <section class="ixw-panel">
      <div class="ixw-title">ACCDB Helper Tables</div>
      <div class="ixw-toolbar">
        <input type="file" accept=".accdb,.mdb" data-ixw-file="accdbHelper">
      </div>
      <div class="ixw-title" style="margin-top:6px;">INPUT_BASIC_ELEMENT_DATA</div>
      <div class="ixw-toolbar" style="margin:0 0 4px;"><button class="ixw-btn" data-ixw-action="load-sample-basic">Load sample</button></div>
      <textarea class="ixw-textarea small" data-ixw-field="basicText" spellcheck="false" placeholder="Paste helper table export">${h(output.basicText || '')}</textarea>
      <div class="ixw-note">Only sideload/enrichment columns are projected: ELEMENTID, FROM_NODE, TO_NODE, FROM_NODE_NAME, TO_NODE_NAME, LINE_NO, REST_PTR, ELEMENT_NAME.</div>
      <div class="ixw-title" style="margin-top:6px;">INPUT_RESTRAINTS</div>
      <div class="ixw-toolbar" style="margin:0 0 4px;"><button class="ixw-btn" data-ixw-action="load-sample-restraints">Load sample</button></div>
      <textarea class="ixw-textarea small" data-ixw-field="restraintsText" spellcheck="false" placeholder="INPUT_RESTRAINTS">${h(output.restraintsText || '')}</textarea>
      <div class="ixw-title" style="margin-top:6px;">INPUT_NODAL_COORDINATES</div>
      <div class="ixw-toolbar" style="margin:0 0 4px;"><button class="ixw-btn" data-ixw-action="load-sample-nodal">Load sample</button></div>
      <textarea class="ixw-textarea small" data-ixw-field="nodalText" spellcheck="false" placeholder="INPUT_NODAL_COORDINATES">${h(output.nodalText || '')}</textarea>
      <div class="ixw-title" style="margin-top:6px;">INPUT_USER_NODAL_COORDINATES</div>
      <div class="ixw-toolbar" style="margin:0 0 4px;"><button class="ixw-btn" data-ixw-action="load-sample-usernodal">Load sample</button></div>
      <textarea class="ixw-textarea small" data-ixw-field="userNodalText" spellcheck="false" placeholder="INPUT_USER_NODAL_COORDINATES">${h(output.userNodalText || '')}</textarea>
      <div class="ixw-toolbar actions">
        <button class="ixw-btn primary" data-ixw-action="generate-sideload">Generate sideload</button>
        <button class="ixw-btn" data-ixw-action="apply-sideload" ${output.lineIdText ? '' : 'disabled'}>Apply enrichment</button>
      </div>
      <div class="ixw-note">${h(output.sideloadStatus || '')}</div>
    </section>
    <section class="ixw-panel">
      <div class="ixw-title">Generated Sideload Inputs</div>
      <textarea class="ixw-textarea small" readonly>${h(output.lineIdText || '')}</textarea>
      <textarea class="ixw-textarea small" readonly>${h(output.nodeNameText || '')}</textarea>
      <textarea class="ixw-textarea small" readonly>${h(output.restraintTagText || '')}</textarea>
      <textarea class="ixw-textarea small" readonly>${h(output.coordinateText || '')}</textarea>
      <div class="ixw-title" style="margin-top:10px;">Enriched InputXML</div>
      <textarea class="ixw-textarea" readonly>${h(output.enrichedXmlText || '')}</textarea>
    </section>
  </div>`;
}

function renderCategorizedTab(state) {
  return `<div class="ixw-grid">
    <section class="ixw-panel">
      <div class="ixw-title">Categorized XML Conversion</div>
      <label class="ixw-note">Direction
        <select data-ixw-field="categorizedDirection" style="margin-left:8px;background:#020617;color:#dbeafe;border:1px solid rgba(148,163,184,.35);border-radius:6px;padding:5px;">
          <option value="input-to-categorized" ${state.categorizedDirection === 'input-to-categorized' ? 'selected' : ''}>InputXML to Categorized XML</option>
          <option value="categorized-to-input" ${state.categorizedDirection === 'categorized-to-input' ? 'selected' : ''}>Categorized XML to InputXML</option>
        </select>
      </label>
      <div class="ixw-toolbar">
        <input type="file" accept="${XML_OR_TXT_ACCEPT}" data-ixw-file="categorizedInput">
        <button class="ixw-btn primary" data-ixw-action="run-categorized">Convert</button>
        <button class="ixw-btn" data-ixw-action="download-categorized" ${state.categorizedOutputText ? '' : 'disabled'}>Download</button>
      </div>
      <textarea class="ixw-textarea tall" data-ixw-field="categorizedInputText" spellcheck="false" placeholder="Paste InputXML or Categorized XML">${h(state.categorizedInputText)}</textarea>
    </section>
    <section class="ixw-panel">
      <div class="ixw-title">Output</div>
      <div class="ixw-toolbar actions">
        <button class="ixw-btn" data-ixw-action="push-categorized-xmlcompare-source" ${state.categorizedOutputText ? '' : 'disabled'}>Push to XML Compare (Source)</button>
        <button class="ixw-btn" data-ixw-action="push-categorized-xmlcompare-target" ${state.categorizedOutputText ? '' : 'disabled'}>Push to XML Compare (Target)</button>
        <button class="ixw-btn" data-ixw-action="use-categorized-enrichment" ${state.categorizedOutputText && state.categorizedDirection === 'categorized-to-input' ? '' : 'disabled'}>Use in Tab 2 Enrichment</button>
      </div>
      <textarea class="ixw-textarea tall" readonly>${h(state.categorizedOutputText)}</textarea>
    </section>
  </div>`;
}

function renderMiscConfigSubtab(state) {
  return `<section class="ixw-panel">
    <div class="ixw-title">Shared Config</div>
    <div class="ixw-note">Settings/defaults shared across InputXML Workspace tabs.</div>
    <label class="ixw-note" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
      <input type="checkbox" data-ixw-action="toggle-xml-mask" ${isXmlMaskEnabled() ? 'checked' : ''}>
      <b style="color:#dbeafe;text-transform:none;letter-spacing:0;">XML_Masked</b>
      <span>When ON, every XML download in this workspace saves with a .txt extension (plain text) instead of .xml.</span>
    </label>
    <div class="ixw-title" style="margin-top:14px;">Support Mapping Config (advanced JSON)</div>
    <div class="ixw-note">This is the same underlying data as the "Support config" subtab's mapper table, shown here as raw JSON for advanced editing/export.</div>
    <textarea class="ixw-textarea small" data-option-key="supportConfigJson" data-ixw-field="supportConfigJson" spellcheck="false">${h(state.supportConfigJson)}</textarea>
  </section>`;
}

function renderMiscTopoSubtab() {
  return `<section class="ixw-panel">
    <div class="ixw-title">Ported 5B Topology</div>
    <div data-ixw-5b-host></div>
  </section>`;
}

function renderMiscSupportSubtab() {
  return `<section class="ixw-panel">
    <div class="ixw-title">Support Types</div>
    <div data-ixw-support-host>${xmlCiiRenderSupportMapperPhase()}</div>
  </section>`;
}

function renderMiscTab(state) {
  const body = state.miscSubtab === 'topo' ? renderMiscTopoSubtab()
    : state.miscSubtab === 'support' ? renderMiscSupportSubtab()
    : renderMiscConfigSubtab(state);
  return `<div class="ixw-subtabs">${MISC_SUBTABS.map(([id, label]) => `<button type="button" class="ixw-subtab ${state.miscSubtab === id ? 'active' : ''}" data-ixw-misc-subtab="${h(id)}">${h(label)}</button>`).join('')}</div>${body}`;
}

function renderBody(state) {
  if (state.activeTab === 'clean') return renderCleanTab(state);
  if (state.activeTab === 'enrich') return renderEnrichmentTab(state);
  if (state.activeTab === 'xml-to-inputxml') return `<div data-ixw-5c-host></div>`;
  if (state.activeTab === 'categorized') return renderCategorizedTab(state);
  if (state.activeTab === 'compare5d') return `<div data-ixw-5d-host></div>`;
  if (state.activeTab === 'misc') return renderMiscTab(state);
  return '';
}

function renderPopup(state) {
  return `<div class="ixw-head">
    <div><b id="${POPUP_TITLE_ID}">InputXML Workspace</b><span>CleanXML, enrichment, XML to InputXML, categorized XML, topology compare, and shared configuration.</span></div>
    <button type="button" class="ixw-close" data-ixw-close="1">Close</button>
  </div>
  <div class="ixw-tabs">${TABS.map(([id, label]) => `<button type="button" class="ixw-tab ${state.activeTab === id ? 'active' : ''}" data-ixw-tab="${h(id)}">${h(label)}</button>`).join('')}</div>
  <div class="ixw-body">${renderBody(state)}</div>`;
}

const MANUAL_TABLE_TEXT_KEYS = ['branchesText', 'componentsText', 'supportsText', 'coordinatesText'];

function collect(dialog, state) {
  dialog.querySelectorAll('[data-ixw-field]').forEach((field) => {
    const key = field.getAttribute('data-ixw-field');
    if (!key) return;
    if (['enrichInputXml', 'basicText', 'restraintsText', 'nodalText', 'userNodalText'].includes(key)) {
      state.enrichment[key === 'enrichInputXml' ? 'inputXmlText' : key] = field.value;
    } else if (MANUAL_TABLE_TEXT_KEYS.includes(key)) {
      state.manualTables[key] = field.value;
    } else {
      state[key] = field.value;
    }
  });
  return state;
}

function saveTextFile(filename, value, mime = 'text/plain') {
  const maskedName = maskedFileName(filename);
  const outMime = maskedName !== filename ? 'text/plain;charset=utf-8' : mime;
  const blob = new Blob([String(value ?? '')], { type: outMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = maskedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(String(value ?? ''));
  const area = document.createElement('textarea');
  area.value = String(value ?? '');
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return undefined;
}

function jsonTraceSnapshot() {
  try {
    const live = window.xmlCiiJsonTraceState?.getSnapshot?.();
    if (live && typeof live === 'object') return live;
  } catch {}
  try {
    const raw = localStorage.getItem('xmlCii.jsonTrace.v1');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildXmlTraceRows(state) {
  const rows = [];
  for (const node of state.cleanTables?.nodes || []) {
    if (node.dtxrPos) rows.push({ type: 'dtxr-pos', nodeNumber: node.nodeNumberRaw, branchName: node.branchName, componentType: node.componentType, position: node.position ? [node.position.x, node.position.y, node.position.z].join(' ') : '', finalValue: node.dtxrPos, status: 'applied', method: node.resolverBasis });
    if (node.dtxrPs) rows.push({ type: 'dtxr-ps', nodeNumber: node.nodeNumberRaw, branchName: node.branchName, componentType: node.componentType, finalValue: node.dtxrPs, status: 'applied', method: node.resolverBasis });
  }
  return rows;
}

function jsonTraceServices(state) {
  return {
    useJsonTraceSource: true,
    getCurrentXmlText: () => state.cleanXmlText || state.sourceXmlText || '',
    buildXmlNodeTrace: () => buildXmlTraceRows(state),
    setUseJsonTraceSource: () => {},
  };
}

function rerender(dialog, state) {
  dialog.innerHTML = renderPopup(state);
  bindPopup(dialog, state);
  bindRenderedPanels(dialog, state);
}

function buildCurrentDtxrRows(state) {
  return [...(state.dtxrRows || []), ...(state.jsonTraceDtxrRows || [])];
}

function handleAction(dialog, state, action) {
  collect(dialog, state);
  state.error = '';
  try {
    if (action === 'build-cleanxml') {
      const result = buildCleanXml(state.sourceXmlText, { sourceName: state.sourceName, dtxrRows: buildCurrentDtxrRows(state) });
      state.cleanTables = result.tables;
      state.cleanXmlText = result.cleanXmlText;
      state.status = `CleanXML built: ${cleanSummary(state)}`;
    } else if (action === 'parse-dtxr-table') {
      state.dtxrRows = parseDtxrTable(state.dtxrTableText);
      state.status = `Parsed ${state.dtxrRows.length} DTXR table row(s).`;
    } else if (action === 'use-json-trace-dtxr') {
      state.jsonTraceDtxrRows = dtxrRowsFromJsonTraceSnapshot(jsonTraceSnapshot());
      if (!state.dtxrTableText && state.jsonTraceDtxrRows.length) state.dtxrTableText = dtxrRowsToTableText(state.jsonTraceDtxrRows);
      state.status = `Loaded ${state.jsonTraceDtxrRows.length} DTXR row(s) from JSON Trace.`;
    } else if (action === 'use-cleanxml-5c') {
      state.activeTab = 'xml-to-inputxml';
      state.status = 'CleanXML selected for Tab 3 XML to InputXML.';
    } else if (action === 'use-cleanxml-enrichment') {
      state.enrichment.inputXmlText = state.cleanXmlText;
      state.activeTab = 'enrich';
      state.status = 'CleanXML loaded into Enrichment InputXML.';
    } else if (action.startsWith('parse-manual-')) {
      const specKey = action.slice('parse-manual-'.length);
      const spec = MANUAL_TABLE_SPECS[specKey];
      if (spec) {
        state.manualRows[spec.rowsKey] = parseLooseTable(state.manualTables[spec.textKey], spec.columns);
        state.status = `Parsed ${state.manualRows[spec.rowsKey].length} ${specKey} row(s).`;
      }
    } else if (action === 'build-cleanxml-from-tables') {
      const tables = buildTablesFromManualRows({
        branchRows: state.manualRows.branches,
        componentRows: state.manualRows.components,
        supportRows: state.manualRows.supports,
        coordinateRows: state.manualRows.coordinates,
      });
      state.cleanTables = tables;
      state.cleanXmlText = buildCleanXmlFromTables(tables, { sourceName: 'InputXML Workspace (manual tables)' });
      state.status = `CleanXML built from tables: ${cleanSummary(state)}`;
    } else if (action === 'download-cleanxml') {
      saveTextFile('inputxml-workspace-cleanxml.xml', state.cleanXmlText, 'application/xml');
    } else if (action === 'copy-cleanxml') {
      copyText(state.cleanXmlText);
      state.status = 'CleanXML copied.';
    } else if (action === 'load-sample-basic') {
      state.enrichment.basicText = SAMPLE_BASIC_TEXT;
      state.status = 'Loaded sample INPUT_BASIC_ELEMENT_DATA rows.';
    } else if (action === 'load-sample-restraints') {
      state.enrichment.restraintsText = SAMPLE_RESTRAINTS_TEXT;
      state.status = 'Loaded sample INPUT_RESTRAINTS rows.';
    } else if (action === 'load-sample-nodal') {
      state.enrichment.nodalText = SAMPLE_NODAL_TEXT;
      state.status = 'Loaded sample INPUT_NODAL_COORDINATES rows.';
    } else if (action === 'load-sample-usernodal') {
      state.enrichment.userNodalText = SAMPLE_USER_NODAL_TEXT;
      state.status = 'Loaded sample INPUT_USER_NODAL_COORDINATES rows.';
    } else if (action === 'generate-sideload') {
      state.enrichment = { ...state.enrichment, ...buildAccdbSideloadTables(state.enrichment) };
      state.enrichment.sideloadStatus = `Generated sideload: ${JSON.stringify(state.enrichment.diagnostics)}`;
    } else if (action === 'apply-sideload') {
      const result = applyXmlCompareSideload(state.enrichment.inputXmlText || '', state.enrichment);
      state.enrichment.enrichedXmlText = result.xmlText;
      state.enrichment.sideloadStatus = `Applied: ${JSON.stringify(result.report)}`;
    } else if (action === 'run-categorized') {
      state.categorizedOutputText = convertCategorizedInputXml(state.categorizedInputText, state.categorizedDirection, { sourceName: 'InputXML Workspace' });
      state.status = 'Categorized conversion complete.';
    } else if (action === 'download-categorized') {
      saveTextFile(categorizedFileName('inputxml-workspace.xml', state.categorizedDirection), state.categorizedOutputText, 'application/xml');
    } else if (action === 'push-categorized-xmlcompare-source' || action === 'push-categorized-xmlcompare-target') {
      const isSource = action.endsWith('source');
      const eventName = isSource ? RuntimeEvents.XML_COMPARE_SOURCE_LOADED : RuntimeEvents.XML_COMPARE_TARGET_LOADED;
      const fileName = categorizedFileName('inputxml-workspace.xml', state.categorizedDirection);
      const detail = { text: state.categorizedOutputText, fileName };
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
      // XML Compare only mounts its own listener while it is the active top-level tab, so also persist
      // the payload for it to pick up on next mount (e.g. when pushed while InputXML Workspace is open
      // over the Utilities tab and the user switches tabs afterward).
      try {
        localStorage.setItem('xml-compare-pending-external-load', JSON.stringify({ side: isSource ? 'a' : 'b', fileName, text: state.categorizedOutputText }));
      } catch {}
      state.status = `Pushed Categorized XML to XML Compare ${isSource ? 'Source' : 'Target'}.`;
    } else if (action === 'use-categorized-enrichment') {
      state.enrichment.inputXmlText = state.categorizedOutputText;
      state.activeTab = 'enrich';
      state.status = 'Categorized XML loaded into Enrichment InputXML.';
    } else if (action === 'toggle-xml-mask') {
      setXmlMaskEnabled(!isXmlMaskEnabled());
      state.status = `XML_Masked ${isXmlMaskEnabled() ? 'ON: downloads will save as .txt.' : 'OFF: downloads save as .xml.'}`;
    }
  } catch (error) {
    state.error = error?.message || String(error);
  }
  rerender(dialog, state);
}

function bindFileInputs(dialog, state) {
  dialog.querySelector('[data-ixw-file="sourceXml"]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.sourceXmlText = await file.text();
    state.sourceName = file.name;
    state.status = `Loaded ${file.name}.`;
    rerender(dialog, state);
  });
  dialog.querySelector('[data-ixw-file="accdbHelper"]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const log = [];
    const buffer = await file.arrayBuffer();
    const tables = await readAccdbNamedTables(buffer, ['INPUT_BASIC_ELEMENT_DATA', 'INPUT_RESTRAINTS', 'INPUT_NODAL_COORDINATES', 'INPUT_USER_NODAL_COORDINATES'], log);
    if (tables.INPUT_BASIC_ELEMENT_DATA) state.enrichment.basicText = rowsToTabText(tables.INPUT_BASIC_ELEMENT_DATA, BASIC_ELEMENT_COLUMNS);
    if (tables.INPUT_RESTRAINTS) state.enrichment.restraintsText = rowsToTabText(tables.INPUT_RESTRAINTS, RESTRAINT_COLUMNS);
    if (tables.INPUT_NODAL_COORDINATES) state.enrichment.nodalText = rowsToTabText(tables.INPUT_NODAL_COORDINATES, NODAL_COORD_COLUMNS);
    if (tables.INPUT_USER_NODAL_COORDINATES) state.enrichment.userNodalText = rowsToTabText(tables.INPUT_USER_NODAL_COORDINATES, USER_COORD_COLUMNS);
    const loadedCount = Object.keys(tables).length;
    state.status = loadedCount ? `ACCDB loaded: ${loadedCount} table(s). Review and click Generate sideload.` : `ACCDB load failed: ${log.map((entry) => entry.msg).join('; ') || 'no matching tables found.'}`;
    rerender(dialog, state);
  });
  dialog.querySelector('[data-ixw-file="enrichInputXml"]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.enrichment.inputXmlText = await file.text();
    state.status = `Loaded InputXML: ${file.name}.`;
    rerender(dialog, state);
  });
  dialog.querySelector('[data-ixw-file="categorizedInput"]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.categorizedInputText = await file.text();
    state.status = `Loaded: ${file.name}.`;
    rerender(dialog, state);
  });
}

function bindSubtabButtons(dialog, state, selector, stateKey, fallback) {
  dialog.querySelectorAll(selector).forEach((button) => button.addEventListener(ACTIVATE, () => {
    collect(dialog, state);
    state[stateKey] = button.getAttribute(selector.slice(1, -1)) || fallback;
    rerender(dialog, state);
  }));
}

function bindPopup(dialog, state) {
  dialog.querySelectorAll('[data-ixw-tab]').forEach((button) => button.addEventListener(ACTIVATE, () => {
    collect(dialog, state);
    state.activeTab = button.getAttribute('data-ixw-tab') || 'clean';
    rerender(dialog, state);
  }));
  bindSubtabButtons(dialog, state, '[data-ixw-clean-subtab]', 'cleanSubtab', 'cleanxml');
  bindSubtabButtons(dialog, state, '[data-ixw-misc-subtab]', 'miscSubtab', 'config');
  dialog.querySelectorAll('[data-ixw-action]').forEach((button) => button.addEventListener(ACTIVATE, () => handleAction(dialog, state, button.getAttribute('data-ixw-action'))));
  bindFileInputs(dialog, state);
}

function bindRenderedPanels(dialog, state) {
  const jsonHost = dialog.querySelector('[data-ixw-json-trace-host]');
  if (jsonHost) bindXmlCiiJsonTracePanel(jsonHost, jsonTraceServices(state));
  const host5c = dialog.querySelector('[data-ixw-5c-host]');
  if (host5c) renderXmlCiiTopology5CPanel(host5c, { root: dialog, workflowXmlText: state.cleanXmlText || state.sourceXmlText || '', supportConfigJson: state.supportConfigJson || '{}' });
  const host5d = dialog.querySelector('[data-ixw-5d-host]');
  if (host5d) renderXmlCiiInputXmlCompare5DPanel(host5d, { root: dialog });
  const host5b = dialog.querySelector('[data-ixw-5b-host]');
  if (host5b) renderXmlCiiTopology5BPanel(host5b, { root: dialog });
  const supportHost = dialog.querySelector('[data-ixw-support-host]');
  if (supportHost) bindXmlCiiSupportMapperPhase(supportHost, {
    config: (() => { try { return JSON.parse(state.supportConfigJson || '{}'); } catch { return {}; } })(),
    onSaveConfig: (config) => {
      state.supportConfigJson = JSON.stringify(config, null, 2);
      const input = dialog.querySelector('[data-ixw-field="supportConfigJson"]');
      if (input) input.value = state.supportConfigJson;
    },
  });
}

function mountPopup(root, onClose) {
  ensureModalStyle();
  const state = defaultState();
  const modal = document.createElement('div');
  modal.className = 'ixw-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'psmap-card ixw-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', POPUP_TITLE_ID);
  modal.appendChild(dialog);
  (document.body || root).appendChild(modal);
  rerender(dialog, state);
  modal.addEventListener(ACTIVATE, (event) => {
    if (event.target === modal || event.target.closest?.('[data-ixw-close="1"]')) {
      modal.remove();
      onClose();
    }
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      modal.remove();
      onClose();
    }
  });
  return modal;
}

export function installInputXmlWorkspaceTile(container) {
  ensureModalStyle(container?.ownerDocument || globalThis.document);
  const utilitiesRoot = container.querySelector('.psnm-root') || container;
  if (utilitiesRoot.querySelector('[data-inputxml-workspace-launcher]')) return null;
  const launcher = document.createElement('section');
  launcher.setAttribute('data-inputxml-workspace-launcher', '1');
  launcher.innerHTML = renderLauncher();
  utilitiesRoot.appendChild(launcher);
  let popup = null;
  launcher.querySelector('[data-ixw-open="1"]').addEventListener(ACTIVATE, () => {
    if (popup) return;
    popup = mountPopup(utilitiesRoot, () => { popup = null; });
  });
  return () => {
    if (popup) popup.remove();
    launcher.remove();
  };
}

export const _test = Object.freeze({ defaultState, renderLauncher, renderPopup, cleanSummary, buildXmlTraceRows, jsonTraceServices, tablePreview });
