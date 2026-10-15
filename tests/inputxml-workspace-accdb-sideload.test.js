import assert from 'assert';
import { applyXmlCompareSideload } from '../xml-compare/XmlCompareSideloadEnricher.js';
import {
  createXmlCompareSideloadDiagnostics,
  serializeXmlCompareSideloadDiagnostics,
} from '../xml-compare/XmlCompareSideloadDiagnostics.js';
import { renderXmlCompareSideloadPopupHtml } from '../xml-compare/XmlCompareSideloadPopup.js';
import { renderLinewiseWorkflowPopupHtml } from '../xml-compare/XmlCompareLinewiseWorkflowView.js';
import { _test as sideloadTest, RESTRAINT_COLUMNS } from '../tabs/inputxml-workspace/inputxml-workspace-sideload.js';
import { rowsToTabText, projectRows } from '../tabs/inputxml-workspace/inputxml-workspace-table.js';

const { parseBasic, buildLineIdText, buildRestraintTagText, buildCoordinateText, nodeKey } = sideloadTest;

// parseBasic + buildLineIdText round trip.
const basicText = 'ELEMENTID\tFROM_NODE\tTO_NODE\tFROM_NODE_NAME\tTO_NODE_NAME\tLINE_NO\tREST_PTR\tELEMENT_NAME\n1\t10\t20\tPS-1\tPS-2\tL100\tR1\tPIPE-1';
const basicRows = parseBasic(basicText);
assert.strictEqual(basicRows.length, 1, 'parseBasic should parse one row from the sample text.');
const lineIdText = buildLineIdText(basicRows);
assert.ok(lineIdText.includes('10\t20\tL100'), 'buildLineIdText should produce a FROM/TO/LINE_ID row.');

// buildRestraintTagText using REST_PTR-based from/to pairing.
const restPtrPairs = new Map([['R1', { from: '10', to: '20' }]]);
const restraintTagText = buildRestraintTagText([{ REST_PTR: 'R1', NODE_NUM: '20', RES_TYPEID: 'GUIDE', STIFFNESS: '1E12', GAP: '0', RES_TAG: 'G-101' }], restPtrPairs);
assert.ok(restraintTagText.includes('10\t20\t20\t8'), 'buildRestraintTagText should resolve from/to and normalize GUIDE through the native CAESAR type table.');
assert.ok(restraintTagText.includes('G-101'), 'buildRestraintTagText should preserve the tag.');

const mutationText = buildRestraintTagText([{ REST_PTR: 'R1', NODE_NUM: '20', RES_TYPEID: '17', STIFFNESS: '1E12', GAP: '0', RES_TAG: 'R-101' }], restPtrPairs);
assert.ok(mutationText.includes('10\t20\t20\t14'), 'buildRestraintTagText should apply editable default mutation rows after native normalization.');

// buildCoordinateText merges nodal + user coordinate rows, deduped by node.
const coordinateText = buildCoordinateText(
  [{ FROM_NODE: '10', TO_NODE: '20', FROM_NODE_X: '0', FROM_NODE_Y: '0', FROM_NODE_Z: '0', TO_NODE_X: '1000', TO_NODE_Y: '0', TO_NODE_Z: '0' }],
  [{ NODE: '20', NODE_X: '1000', NODE_Y: '0', NODE_Z: '0' }],
);
assert.ok(coordinateText.includes('10\t0\t0\t0'), 'buildCoordinateText should include the FROM_NODE coordinate.');
assert.strictEqual(coordinateText.split('\n').filter((line) => line.startsWith('20\t')).length, 1, 'Node 20 coordinate should only appear once despite being present in both nodal and user tables.');

assert.strictEqual(nodeKey('20.0'), '20', 'nodeKey should normalize a whole-number float to its integer string.');

// Row -> tab-text serialization step used by the new ACCDB file-loading path (parser/accdb-mdb.js's readAccdbNamedTables).
const accdbRestraintRows = [{ REST_PTR: 'R1', NODE_NUM: '20', NODE_NAME: 'PS-2', RES_TYPEID: 'GUIDE', STIFFNESS: '1E12', GAP: '0', FRIC_COEF: '0.3', CNODE: '', RES_TAG: 'G-101' }];
const serialized = rowsToTabText(accdbRestraintRows, RESTRAINT_COLUMNS);
assert.ok(serialized.startsWith('REST_PTR\tNODE_NUM\tNODE_NAME'), 'rowsToTabText should emit the ACCDB column names as a header row.');
assert.ok(serialized.includes('R1\t20\tPS-2\tGUIDE\t1E12\t0\t0.3\t\tG-101'), 'rowsToTabText should serialize the row values in column order.');

const alteredHeaderRows = [{ 'Rest Ptr': 'R2', node: '30', 'Node Name': 'PS-3', Type: 'GUIDE', Stiff: '2E12', Gap: '1', Friction: '0.2', CNode: '', Tag: 'G-102' }];
const projected = projectRows(alteredHeaderRows, RESTRAINT_COLUMNS);
assert.deepStrictEqual(projected[0], { REST_PTR: 'R2', NODE_NUM: '30', NODE_NAME: 'PS-3', RES_TYPEID: 'GUIDE', STIFFNESS: '2E12', GAP: '1', FRIC_COEF: '0.2', CNODE: '', RES_TAG: 'G-102' }, 'ACCDB/table projection should tolerate altered header casing and spacing.');

const diagnosticXml = `<ROOT>
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" />
<RESTRAINT NODE="20" TYPE="8" STIFFNESS="1" GAP="0" MU="0.3" CNODE="0" />
<RESTRAINT NODE="99" TYPE="10" STIFFNESS="1" GAP="0" MU="0.3" CNODE="0" />
</ROOT>`;
const diagnosticResult = applyXmlCompareSideload(diagnosticXml, {
  lineIdText: 'FROM_NODE\tTO_NODE\tLINE_ID\n10\t20\tL-OLD\n10\t20\tL-NEW\n30\t40\tUNMATCHED',
  nodeNameText: 'FROM_NODE\tTO_NODE\tFROM_NAME\tTO_NAME\n10\t20\tN10\tN20',
  restraintTagText: [
    'FROM_NODE\tTO_NODE\tNODE\tTYPE\tSTIFFNESS\tGAP\tMU\tCNODE\tTAG',
    '10\t20\t20\t8\t1\t0\t0.3\t0\tTAG-20',
    '1\t2\t99\t8\t1\t0\t0.3\t0\tTAG-A',
    '1\t2\t99\t9\t1\t0\t0.3\t0\tTAG-B',
  ].join('\n'),
  coordinateText: 'NODE\tX\tY\tZ\n10\t0\t0\t0',
});
assert.ok(diagnosticResult.xmlText.includes('LINE_ID="L-NEW"'), 'later duplicate LINE_ID row remains authoritative.');
assert.ok(diagnosticResult.xmlText.includes('TAG="TAG-20"'), 'exact restraint match applies the expected tag.');
assert.ok(diagnosticResult.xmlText.includes('TO_GLOBAL_X="100.000"'), 'coordinate sideload remains applied.');
assert.ok(diagnosticResult.xmlText.includes('GLOBAL_COORD_BASIS_NODE="10"'), 'coordinate basis node keeps node formatting.');

const diagnosticCodes = diagnosticResult.report.diagnostics.map((row) => row.code);
assert.ok(diagnosticCodes.includes('SIDELOAD_DUPLICATE_KEY'), 'duplicate table keys are diagnosed.');
assert.ok(diagnosticCodes.includes('SIDELOAD_PAIR_NOT_FOUND'), 'unmatched pair rows are diagnosed.');
assert.ok(diagnosticCodes.includes('SIDELOAD_AMBIGUOUS_TAG'), 'ambiguous node fallback is diagnosed.');
assert.ok(diagnosticCodes.includes('SIDELOAD_SOURCE_FIELD_IGNORED'), 'unused restraint pair columns are diagnosed.');
assert.ok(diagnosticCodes.includes('SIDELOAD_ATTRIBUTE_ADDED'), 'attribute additions are traceable.');

const diagnosticsDocument = createXmlCompareSideloadDiagnostics(diagnosticResult.report);
assert.strictEqual(diagnosticsDocument.schema, 'xml-compare-sideload-diagnostics/v1', 'dedicated diagnostics schema is stable.');
assert.ok(diagnosticsDocument.summary.warning > 0, 'diagnostics summary reports warnings.');
assert.ok(JSON.parse(serializeXmlCompareSideloadDiagnostics(diagnosticResult.report)).records.length > 0, 'diagnostics JSON serializes all records.');

const popupHtml = renderXmlCompareSideloadPopupHtml({
  open: true,
  side: 'a',
  lineIdText: '',
  nodeNameText: '',
  restraintTagText: '',
  coordinateText: '',
  lastReport: diagnosticResult.report,
});
assert.ok(popupHtml.includes('xml-compare-sideload-diagnostics'), 'popup renders a dedicated diagnostics panel.');
assert.ok(popupHtml.includes('xml_compare_sideload_diagnostics.json'), 'popup exposes the diagnostics artifact name.');
assert.ok(popupHtml.includes('SIDELOAD_DUPLICATE_KEY'), 'popup exposes structured diagnostic codes.');

const linewiseHtml = renderLinewiseWorkflowPopupHtml({
  open: true,
  tab: 'sideload',
  fileName: 'diagnostic.xml',
  text: diagnosticXml,
  lastSideloadReport: diagnosticResult.report,
  sideload: {},
});
assert.ok(linewiseHtml.includes('xml-compare-sideload-diagnostics'), 'line-wise UI renders sideload diagnostics.');
assert.ok(linewiseHtml.includes('xml_compare_sideload_diagnostics.json'), 'line-wise UI exposes the diagnostics artifact.');

console.log('ACCDB sideload adapter checks passed.');
