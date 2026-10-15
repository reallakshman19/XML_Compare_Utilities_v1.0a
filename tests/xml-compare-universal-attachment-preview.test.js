import assert from 'node:assert/strict';
import { normalizeUniversalCategorizerProfile } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createLinewiseUniversalAttachmentPreviewModel, createUniversalAttachmentPreview } from '../xml-compare/universal-categorizer/universal-attachment-preview.js';

const profile = normalizeUniversalCategorizerProfile({
  profileId: 'uxc-attachment-preview-test',
  sources: [
    { sourceId: 'mainXml', role: 'primary', sourceKind: 'xml' },
    { sourceId: 'coordLookup', role: 'sideload', requiredColumns: ['NODE', 'GLOBAL_X'] },
    { sourceId: 'lineLookup', role: 'sideload', requiredColumns: ['FROM_NODE', 'TO_NODE', 'LINE_ID'] },
  ],
  levelDefinitions: [
    { levelId: 'documentRoot', displayName: 'DocumentRoot', children: ['line'] },
    { levelId: 'element', displayName: 'Element', children: ['node'] },
    { levelId: 'node', displayName: 'Node' },
  ],
  blockDefinitions: [
    { blockName: 'DerivedCoordinateBlock', attachToLevelId: 'node' },
    { blockName: 'LineBlock', attachToLevelId: 'element' },
  ],
  sideloadAttachments: [
    { ruleId: 'coord-to-node', sourceId: 'coordLookup', attachToLevelId: 'node', sourceKey: 'NODE', targetKey: 'nodeNumber', blockName: 'DerivedCoordinateBlock', mode: 'create-block' },
    { ruleId: 'line-to-element', sourceId: 'lineLookup', attachToLevelId: 'element', sourceKey: 'FROM_NODE+TO_NODE', targetKey: 'elementKey', blockName: 'LineBlock', mode: 'enrich-existing' },
  ],
});

const registry = createUniversalSourceRegistry(profile, {
  mainXml: { columns: ['DocumentRoot'] },
  coordLookup: { rows: [
    { NODE: '10', GLOBAL_X: '1000' },
    { NODE: '', GLOBAL_X: '2000' },
    { NODE: '99', GLOBAL_X: '9000' },
  ] },
  lineLookup: { rows: [
    { FROM_NODE: '10', TO_NODE: '20', LINE_ID: 'LINE-100' },
  ] },
});

const preview = createUniversalAttachmentPreview({
  profile,
  registry,
  targetRows: [
    { levelId: 'node', nodeNumber: '10', label: 'Node 10' },
    { levelId: 'node', nodeNumber: '20', label: 'Node 20' },
    { levelId: 'element', elementKey: '10+20', label: 'Element 10-20' },
  ],
});

assert.equal(preview.schema, 'universal-attachment-preview/v1-shadow');
assert.equal(preview.rules.length, 2);

const coordPreview = preview.rules.find((rule) => rule.ruleId === 'coord-to-node');
assert.equal(coordPreview.sourceResolved, true);
assert.equal(coordPreview.targetLevel.resolved, true);
assert.equal(coordPreview.targetLevel.displayName, 'Node');
assert.equal(coordPreview.targetBlock.resolved, true);
assert.equal(coordPreview.targetBlock.blockName, 'DerivedCoordinateBlock');
assert.equal(coordPreview.matchedCount, 1);
assert.equal(coordPreview.unmatchedSourceRows.length, 1);
assert.equal(coordPreview.unmatchedSourceRows[0].reason, 'missing-source-key');
assert.equal(coordPreview.missingTargetRows.length, 1);
assert.equal(coordPreview.missingTargetRows[0].sourceKey, '99');
assert.equal(coordPreview.targetRowsWithoutSource.length, 1);
assert.equal(coordPreview.targetRowsWithoutSource[0].targetKey, '20');
assert.ok(coordPreview.diagnostics.some((item) => item.code === 'UXC_ATTACHMENT_MISSING_TARGET_ROWS'));
assert.ok(coordPreview.diagnostics.some((item) => item.code === 'UXC_ATTACHMENT_UNMATCHED_SOURCE_ROWS'));

const linePreview = preview.rules.find((rule) => rule.ruleId === 'line-to-element');
assert.deepEqual(linePreview.sourceKeyFields, ['FROM_NODE', 'TO_NODE']);
assert.equal(linePreview.targetLevel.displayName, 'Element');
assert.equal(linePreview.targetBlock.blockName, 'LineBlock');
assert.equal(linePreview.matchedRows[0].sourceKey, '10+20');
assert.equal(linePreview.matchedRows[0].targetKey, '10+20');
assert.equal(linePreview.matchedCount, 1);

const linewisePreview = createLinewiseUniversalAttachmentPreviewModel();
assert.ok(linewisePreview.registry.sources.some((source) => source.sourceId === 'lineIdLookup'));
assert.ok(linewisePreview.preview.rules.some((rule) => rule.ruleId === 'line-id-to-element' && rule.targetLevel.resolved && rule.targetBlock.resolved));

console.log('xml-compare-universal-attachment-preview tests passed');
