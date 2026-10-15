import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { _test as workspaceUi } from '../tabs/inputxml-workspace/inputxml-workspace-tab.js';
import {
  appendInputXmlWorkspaceDiagnostics,
  createInputXmlWorkspaceDiagnostic,
  createInputXmlWorkspaceDiagnostics,
  serializeInputXmlWorkspaceDiagnostics,
} from '../tabs/inputxml-workspace/inputxml-workspace-diagnostics.js';
import { renderInputXmlWorkspaceDiagnosticsHtml } from '../tabs/inputxml-workspace/inputxml-workspace-diagnostics-view.js';
import {
  cleanArtifactsForSourceChange,
  cleanCategorizedForInputChange,
  cleanEnrichmentForInputChange,
  cleanGeneratedInputForSourceChange,
  cleanSideloadForSourceChange,
  enrichmentInputPreflight,
  inputXmlFrom5CResult,
  manualCleanXmlPreflight,
  routeCleanXmlTo5C,
} from '../tabs/inputxml-workspace/inputxml-workspace-orchestration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const workspaceRender = workspaceUi.renderPopup(workspaceUi.defaultState());
assert.ok(workspaceRender.includes('Clean XML'), 'Workspace should expose Clean XML as the first tab.');
assert.ok(workspaceRender.includes('2 InputXML Enrichment'), 'Workspace should expose InputXML Enrichment as Tab 2.');
assert.ok(workspaceRender.includes('3 XML to InputXML'), 'Workspace should expose XML to InputXML as Tab 3.');
assert.ok(!workspaceRender.includes('Components/Nodes'), 'Clean XML should not expose the manual Components/Nodes subtab.');
assert.ok(!workspaceRender.includes('Supports/Restraints'), 'Clean XML should not expose the manual Supports/Restraints subtab.');
assert.ok(!workspaceRender.includes('DTXR'), 'Clean XML should not expose the DTXR subtab.');

const psnmUtilityTab = fs.readFileSync(path.join(repoRoot, 'tabs', 'psnm-utility-tab.js'), 'utf8');
assert.ok(psnmUtilityTab.includes('installInputXmlWorkspaceTile'), 'Utilities tab should install InputXML Workspace tile.');

const panel5c = fs.readFileSync(path.join(repoRoot, 'tabs', 'model-converters', 'xml-cii-topology-5c-panel.js'), 'utf8');
assert.ok(panel5c.includes('state.consumeDuplicateNodes = false;'), 'InputXML_Topo should disable duplicate consuming.');
assert.ok(panel5c.includes('state.enableShortFillers = false;'), 'InputXML_Topo should disable <50mm fillers.');
assert.ok(panel5c.includes('state.enableRayFillers = false;'), 'InputXML_Topo should disable ray fillers.');
assert.ok(panel5c.includes('state.splitRayMidspanHits = false;'), 'InputXML_Topo should disable ray mid-span splitting.');

// Close button regression: must not be bound once at mount only (the old one-shot pattern), and
// must be handled by the delegated modal-level click handler so it survives every rerender.
const workspaceTabSource = fs.readFileSync(path.join(repoRoot, 'tabs', 'inputxml-workspace', 'inputxml-workspace-tab.js'), 'utf8');
assert.ok(!workspaceTabSource.includes('dialog.querySelector(\'[data-ixw-close="1"]\')?.addEventListener'), 'Close button must not be bound with the old one-shot querySelector pattern.');
assert.ok(/modal\.addEventListener\(ACTIVATE, \(event\) => \{[\s\S]*?data-ixw-close="1"/.test(workspaceTabSource), 'Close button must be handled by the delegated modal-level click handler.');

// Tab 6 Misc should expose Config/Topo/Support config as real subtabs.
const miscRender = workspaceUi.renderPopup({ ...workspaceUi.defaultState(), activeTab: 'misc' });
assert.ok(miscRender.includes('>Config<'), 'Misc tab should expose a Config subtab.');
assert.ok(miscRender.includes('>Topo<'), 'Misc tab should expose a Topo subtab.');
assert.ok(miscRender.includes('>Support config<'), 'Misc tab should expose a Support config subtab.');
assert.ok(miscRender.includes('Restraint Type Mutation'), 'Misc Config should expose editable restraint type mutation rows.');
assert.ok(miscRender.includes('data-ixw-rtm-row'), 'Restraint type mutation rows should be editable in the UI.');

// Launcher tile should show an icon.
const launcherRender = workspaceUi.renderLauncher();
assert.ok(launcherRender.includes('inputxml-workspace-launcher-icon'), 'Launcher tile should render an icon span.');

assert.ok(psnmUtilityTab.includes('installXmlBuilderUtilityTile'), 'Utilities tab should install XML Builder tile.');
const xmlBuilderSource = fs.readFileSync(path.join(repoRoot, 'tabs', 'xml-builder', 'xml-builder-utility-tile.js'), 'utf8');
assert.ok(xmlBuilderSource.includes('renderXmlBuilderTab'), 'XML Builder utility should expose a popup renderer.');
assert.ok(xmlBuilderSource.includes('renderXmlCiiTopology5BPanel'), 'XML Builder utility should include the topology canvas panel.');

const cleanXml = '<CleanXML><Branch><Node><NodeNumber>10</NodeNumber></Node></Branch></CleanXML>';
const inputXml = '<CAESARII XML_TYPE="Input" VERSION="2019"><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" /></PIPINGMODEL></CAESARII>';

const rejected = enrichmentInputPreflight(cleanXml, 'clean.xml');
assert.equal(rejected.ok, false, 'Tab 2 rejects node-based CleanXML.');
assert.equal(rejected.diagnostic.code, 'WORKSPACE_SCHEMA_REJECTED');
const accepted = enrichmentInputPreflight(inputXml, 'input.xml');
assert.equal(accepted.ok, true, 'Tab 2 accepts PIPINGELEMENT InputXML.');

const emptyManual = manualCleanXmlPreflight({ branches: [], nodes: [] }, 0);
assert.equal(emptyManual.ok, false, 'Zero-record manual CleanXML is blocked.');
assert.equal(emptyManual.diagnostic.code, 'WORKSPACE_ZERO_RECORD_OUTPUT_BLOCKED');
const noRouteManual = manualCleanXmlPreflight({ branches: [{}], nodes: [{}] }, 0);
assert.equal(noRouteManual.ok, false, 'Manual rows with no writable route are blocked.');

const cleanInvalidation = cleanArtifactsForSourceChange({ cleanXmlText: cleanXml, cleanTables: { nodes: [{}] } });
assert.equal(cleanInvalidation.patch.cleanXmlText, '', 'Source changes clear stale CleanXML text.');
assert.equal(cleanInvalidation.diagnostic.code, 'WORKSPACE_STALE_OUTPUT_INVALIDATED');
const enrichmentInvalidation = cleanEnrichmentForInputChange({ lineIdText: 'rows', enrichedXmlText: inputXml });
assert.equal(enrichmentInvalidation.patch.enrichedXmlText, '', 'Input changes clear stale enriched XML.');
assert.equal(enrichmentInvalidation.patch.lineIdText, undefined, 'Input changes preserve reusable sideload lookup rows.');
const sideloadInvalidation = cleanSideloadForSourceChange({ lineIdText: 'rows', inputXmlText: inputXml });
assert.equal(sideloadInvalidation.patch.lineIdText, '', 'Helper changes clear generated sideload rows.');
assert.equal(sideloadInvalidation.patch.inputXmlText, undefined, 'Helper changes preserve the loaded InputXML.');
const generatedInvalidation = cleanGeneratedInputForSourceChange({ inputXmlSource: '5c', inputXmlText: inputXml });
assert.equal(generatedInvalidation.patch.inputXmlText, '', 'Source XML changes clear dependent 5C InputXML.');
const uploadInvalidation = cleanGeneratedInputForSourceChange({ inputXmlSource: 'upload', inputXmlText: inputXml });
assert.equal(uploadInvalidation.patch.inputXmlText, undefined, 'Source XML changes preserve independent uploaded InputXML.');
const categorizedInvalidation = cleanCategorizedForInputChange({ categorizedOutputText: cleanXml });
assert.equal(categorizedInvalidation.patch.categorizedOutputText, '', 'Categorized input changes clear stale conversion output.');

const handoff = inputXmlFrom5CResult({ finalInputXmlText: inputXml, diagnostics: { summary: { elementCount: 1 } } });
assert.equal(handoff.ok, true, 'Positive 5C InputXML result is accepted for Tab 2 handoff.');
assert.equal(handoff.diagnostic.code, 'WORKSPACE_5C_INPUTXML_HANDOFF');
assert.equal(routeCleanXmlTo5C().activeTab, 'xml-to-inputxml', 'CleanXML enrichment shortcut routes through Tab 3.');

let diagnostics = createInputXmlWorkspaceDiagnostics();
diagnostics = appendInputXmlWorkspaceDiagnostics(diagnostics, [
  createInputXmlWorkspaceDiagnostic({ severity: 'WARNING', code: 'WORKSPACE_TEST', message: 'Evidence row.' }),
]);
assert.equal(diagnostics.summary.warning, 1, 'Workspace diagnostics summarize warning rows.');
assert.equal(JSON.parse(serializeInputXmlWorkspaceDiagnostics(diagnostics)).schema, 'inputxml-workspace-diagnostics/v1');
const diagnosticsHtml = renderInputXmlWorkspaceDiagnosticsHtml(diagnostics);
assert.ok(diagnosticsHtml.includes('inputxml_workspace_diagnostics.json'), 'Workspace exposes the diagnostics sidecar artifact.');
assert.ok(diagnosticsHtml.includes('WORKSPACE_TEST'), 'Workspace diagnostics panel renders structured codes.');
assert.ok(workspaceUi.renderPopup(workspaceUi.defaultState()).includes('inputxml_workspace_diagnostics.json'), 'Workspace popup renders its diagnostics panel.');

assert.ok(!workspaceTabSource.includes('state.enrichment.inputXmlText = state.cleanXmlText;'), 'CleanXML is no longer assigned directly to Tab 2 enrichment.');
assert.ok(workspaceTabSource.includes('const handoff = apply5CResultToWorkspace(state, result);'), 'Workspace wires the Tab 3 result through the explicit 5C handoff.');
assert.ok(workspaceTabSource.includes("sourceKind: '5c'"), 'Workspace automatically categorizes accepted 5C InputXML through the producer worker.');
assert.ok(workspaceTabSource.includes('enrichmentInputPreflight'), 'Workspace schema-gates Tab 2 enrichment.');
assert.ok(workspaceTabSource.includes("inputXmlSource: '5c'"), 'Workspace records 5C InputXML provenance.');
assert.ok(workspaceTabSource.includes('invalidateSideloadArtifacts'), 'Workspace separates helper-table invalidation from InputXML invalidation.');
assert.ok(!workspaceTabSource.includes('XML_WORKSPACE_KINDS }'), 'Workspace has no dangling XML_WORKSPACE_KINDS import.');
const panel5cSource = fs.readFileSync(path.join(repoRoot, 'tabs', 'model-converters', 'xml-cii-topology-5c-panel.js'), 'utf8');
assert.ok(panel5cSource.includes("typeof options.onResult === 'function'"), '5C panel emits an explicit result callback.');

console.log('InputXML Workspace static contract checks passed.');
