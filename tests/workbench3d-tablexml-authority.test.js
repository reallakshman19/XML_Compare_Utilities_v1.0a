import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { createNodeSetMapping } from '../workbench3d/tablexml/column-mapper.js';
import { buildNodeSetModel, serializeNodeSetXml, NODESET_PURPOSE } from '../workbench3d/tablexml/nodeset-builder.js';
import {
  TABLEXML_DIAGNOSTICS_SCHEMA,
  serializeTableXmlDiagnostics,
  tableXmlDiagnosticsFilename,
} from '../workbench3d/tablexml/tablexml-diagnostics.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const codesOf = (model) => new Set(model.diagnostics.map((record) => record.code));

// Coordinate-less tables remain supported only as disclosed comparison layout.
const nonSpatial = parseTableSource([
  'ID\tQuantity\tIGNORED',
  'A\t10\talpha',
  'A\t20\tbeta',
  '\t30\tgamma',
].join('\n'), { sourceId: 'NS', sourceName: 'non-spatial.tsv' });
const nonSpatialMapping = createNodeSetMapping(nonSpatial, {
  ID: 'node-id', Quantity: 'measure', IGNORED: 'ignore',
});
const nonSpatialModel = buildNodeSetModel(nonSpatial, nonSpatialMapping, [], 'source-table', { side: 'source' });
assert.strictEqual(nonSpatialModel.purpose, NODESET_PURPOSE);
assert.strictEqual(nonSpatialModel.coordinateMode, 'synthetic-comparison');
assert.strictEqual(nonSpatialModel.diagnosticDocument.schema, TABLEXML_DIAGNOSTICS_SCHEMA);
assert.strictEqual(nonSpatialModel.nodes.length, 3);
assert.ok(codesOf(nonSpatialModel).has('TABLEXML_SYNTHETIC_COORDINATES'));
assert.ok(codesOf(nonSpatialModel).has('TABLEXML_COLUMN_IGNORED'));
assert.ok(codesOf(nonSpatialModel).has('TABLEXML_NODE_ID_DUPLICATE_SUFFIXED'));
assert.ok(codesOf(nonSpatialModel).has('TABLEXML_NODE_ID_GENERATED'));
assert.strictEqual(nonSpatialModel.nodes[1].id, 'A#2');
assert.strictEqual(nonSpatialModel.nodes[2].id, 'N3');

const nonSpatialXml = serializeNodeSetXml(nonSpatialModel);
assert.ok(nonSpatialXml.includes('<NodeSet schema="nodeset/v1"'));
assert.ok(nonSpatialXml.includes('purpose="comparison-only"'));
assert.ok(nonSpatialXml.includes('coordinateMode="synthetic-comparison"'));
assert.ok(nonSpatialXml.includes(`diagnosticsSchema="${TABLEXML_DIAGNOSTICS_SCHEMA}"`));
assert.ok(!nonSpatialXml.includes('<CAESARII'));
assert.ok(!nonSpatialXml.includes('<PIPINGELEMENT'));

// Invalid source geometry is skipped and reported, not changed to zero.
const spatial = parseTableSource([
  'ID\tX\tY\tZ\tBORE',
  'GOOD\t100\t200\t300\t250',
  'BAD\tunset\t200\t300\tnot-a-bore',
].join('\n'), { sourceId: 'SP', sourceName: 'spatial.tsv' });
const spatialMapping = createNodeSetMapping(spatial, {
  ID: 'node-id', X: 'coord-e', Y: 'coord-n', Z: 'coord-u', BORE: 'bore',
});
const spatialModel = buildNodeSetModel(spatial, spatialMapping, [], 'spatial-table', { side: 'target' });
assert.strictEqual(spatialModel.coordinateMode, 'source');
assert.strictEqual(spatialModel.nodes.length, 1);
assert.ok(codesOf(spatialModel).has('TABLEXML_ROW_SKIPPED'));
assert.ok(codesOf(spatialModel).has('TABLEXML_BORE_READ'));
assert.deepStrictEqual([spatialModel.nodes[0].e, spatialModel.nodes[0].n, spatialModel.nodes[0].u], [100, 200, 300]);

// Exploded grain must disclose both positional-list mismatches.
const exploded = parseTableSource([
  'PARENT\tCHILDREN\tTYPES\tREFS\tX\tY\tZ',
  'P1\t/C1, /C2, /C3\tREST-100, GUIDE-100\tR1, R2, R3, R4\t0\t0\t0',
].join('\n'), { sourceId: 'EX', sourceName: 'exploded.tsv' });
const explodedMapping = createNodeSetMapping(exploded, {
  PARENT: 'node-id', CHILDREN: 'child-list', TYPES: 'support-types', REFS: 'child-ref',
  X: 'coord-e', Y: 'coord-n', Z: 'coord-u',
});
explodedMapping.grain = 'exploded';
const explodedModel = buildNodeSetModel(exploded, explodedMapping, [], 'exploded-table');
assert.strictEqual(explodedModel.nodes.length, 3);
assert.ok(codesOf(explodedModel).has('TABLEXML_EXPLODED_TYPE_COUNT_MISMATCH'));
assert.ok(codesOf(explodedModel).has('TABLEXML_EXPLODED_REF_COUNT_MISMATCH'));
const refMismatch = explodedModel.diagnostics.find((record) => record.code === 'TABLEXML_EXPLODED_REF_COUNT_MISMATCH');
assert.strictEqual(refMismatch.context.droppedRefs, 1);

// Sidecar contract is downloadable and stable.
const diagnosticJson = serializeTableXmlDiagnostics(nonSpatialModel.diagnosticDocument);
const diagnosticDocument = JSON.parse(diagnosticJson);
assert.strictEqual(diagnosticDocument.schema, TABLEXML_DIAGNOSTICS_SCHEMA);
assert.strictEqual(diagnosticDocument.purpose, 'comparison-only');
assert.strictEqual(diagnosticDocument.metadata.coordinateMode, 'synthetic-comparison');
assert.strictEqual(tableXmlDiagnosticsFilename('source'), 'source_workbench3d_table_to_xml_diagnostics.json');

// Static UI contract: no InputXML claim; dedicated collapsible/download controls.
const ui = fs.readFileSync(path.join(root, 'workbench3d/ui/table-to-xml-tab.js'), 'utf8');
const view = fs.readFileSync(path.join(root, 'workbench3d/ui/table-to-xml-diagnostics-view.js'), 'utf8');
assert.ok(ui.includes('NodeSet XML (comparison-only)'));
assert.ok(ui.includes('txml-download-diagnostics'));
assert.ok(ui.includes('tableXmlDiagnosticsPanelHtml'));
assert.ok(view.includes('data-tablexml-diagnostics'));
assert.ok(view.includes('Download diagnostics JSON'));

console.log('workbench3d-tablexml-authority.test.js passed');
