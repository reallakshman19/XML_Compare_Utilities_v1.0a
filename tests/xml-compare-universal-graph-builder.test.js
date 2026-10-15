import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { normalizeUniversalCategorizerProfile } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createLinewiseUniversalCategorizedGraphPreview, createUniversalCategorizedGraphPreview, findForbiddenUxc002Changes, UNIVERSAL_CATEGORIZED_GRAPH_SCHEMA, UNIVERSAL_GRAPH_XML_EXPORT_STATUS } from '../xml-compare/universal-categorizer/universal-graph-builder.js';

const profile = normalizeUniversalCategorizerProfile({
  profileId: 'uxc-graph-builder-test',
  sources: [
    { sourceId: 'mainXml', role: 'primary', sourceKind: 'xml' },
    { sourceId: 'coordLookup', role: 'sideload', requiredColumns: ['NODE', 'GLOBAL_X', 'GLOBAL_Y'] },
    { sourceId: 'lineLookup', role: 'sideload', requiredColumns: ['FROM_NODE', 'TO_NODE', 'LINE_ID'] },
  ],
  levelDefinitions: [
    { levelId: 'documentRoot', displayName: 'DocumentRoot', children: ['element'] },
    { levelId: 'element', displayName: 'Element', children: ['node'] },
    { levelId: 'node', displayName: 'Node' },
  ],
  blockDefinitions: [
    { blockName: 'LineBlock', attachToLevelId: 'element' },
    { blockName: 'DerivedCoordinateBlock', attachToLevelId: 'node' },
  ],
  sideloadAttachments: [
    { ruleId: 'coord-to-node', sourceId: 'coordLookup', attachToLevelId: 'node', sourceKey: 'NODE', targetKey: 'nodeNumber', blockName: 'DerivedCoordinateBlock', mode: 'create-block', fieldBindings: [{ sourceField: 'GLOBAL_X', targetField: 'x' }, { sourceField: 'GLOBAL_Y', targetField: 'y' }] },
    { ruleId: 'line-to-element', sourceId: 'lineLookup', attachToLevelId: 'element', sourceKey: 'FROM_NODE+TO_NODE', targetKey: 'elementKey', blockName: 'LineBlock', mode: 'enrich-existing' },
  ],
});

const registry = createUniversalSourceRegistry(profile, {
  mainXml: { columns: ['DocumentRoot'] },
  coordLookup: { rows: [
    { NODE: '10', GLOBAL_X: '1000', GLOBAL_Y: '2000' },
    { NODE: '99', GLOBAL_X: '9000', GLOBAL_Y: '9000' },
  ] },
  lineLookup: { rows: [
    { FROM_NODE: '10', TO_NODE: '20', LINE_ID: 'LINE-100' },
  ] },
});

const graph = createUniversalCategorizedGraphPreview({
  profile,
  registry,
  targetRows: [
    { levelId: 'element', elementKey: '10+20', label: 'Element 10-20' },
    { levelId: 'node', nodeNumber: '10', label: 'Node 10' },
    { levelId: 'node', nodeNumber: '20', label: 'Node 20' },
  ],
});

assert.equal(graph.schema, UNIVERSAL_CATEGORIZED_GRAPH_SCHEMA);
assert.equal(graph.xmlExportEnabled, false);
assert.equal(graph.exportStatus, UNIVERSAL_GRAPH_XML_EXPORT_STATUS);
assert.equal(graph.summary.levels, 3);
assert.equal(graph.summary.nodes, 3);
assert.equal(graph.summary.sideloadAttachments, 2);
assert.equal(graph.levels.roots[0], 'documentRoot');

const elementNode = graph.nodeMap['element:10+20'];
assert.ok(elementNode);
assert.ok(elementNode.blocks.LineBlock);
assert.equal(elementNode.blocks.LineBlock.fields.LINE_ID, 'LINE-100');
assert.equal(elementNode.blocks.LineBlock.attachments[0].ruleId, 'line-to-element');

const node10 = graph.nodeMap['node:10'];
assert.ok(node10.blocks.DerivedCoordinateBlock);
assert.deepEqual(node10.blocks.DerivedCoordinateBlock.fields, { x: '1000', y: '2000' });
assert.equal(node10.blocks.DerivedCoordinateBlock.attachments[0].sourceKey, '10');

const node20 = graph.nodeMap['node:20'];
assert.ok(node20.blocks.DerivedCoordinateBlock, 'block shell is attached from blockDefinitions even without sideload data');
assert.deepEqual(node20.blocks.DerivedCoordinateBlock.fields, {});

assert.ok(graph.diagnostics.some((item) => item.code === 'UXC_ATTACHMENT_MISSING_TARGET_ROWS'));
assert.ok(!String(JSON.stringify(graph)).includes('xmlExportEnabled":true'));

const linewiseGraph = createLinewiseUniversalCategorizedGraphPreview();
assert.equal(linewiseGraph.xmlExportEnabled, false);
assert.ok(linewiseGraph.nodes.some((node) => node.levelId === 'node'));
assert.ok(linewiseGraph.summary.blocks >= 1);

const changedForbiddenFiles = findForbiddenUxc002Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-002 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

function changedFilesFromGit() {
  const baseRef = safeGitRef(process.env.GITHUB_BASE_REF || 'main');
  const commands = [
    `git fetch --no-tags --depth=1 origin ${baseRef}:refs/remotes/origin/${baseRef} && git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`,
    `git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`,
    `git diff --name-only --diff-filter=ACMRTUXB ${baseRef}...HEAD`,
  ];
  for (const command of commands) {
    try {
      const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
    } catch {
      // Try the next git command. This keeps the guard portable across local and CI checkouts.
    }
  }
  return [];
}

function safeGitRef(value) {
  const ref = String(value || 'main').trim();
  return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'main';
}

console.log('xml-compare-universal-graph-builder tests passed');
