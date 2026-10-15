import assert from 'node:assert/strict';
import { createLinewiseUniversalPreset, createUniversalAttachmentRule, createUniversalSideloadSource, normalizeUniversalCategorizerProfile, summarizeUniversalProfile } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';

const sideload = createUniversalSideloadSource({ sourceId: 'coord', displayName: 'Coordinates', requiredColumns: ['NODE', 'GLOBAL_X'], role: 'invalid' });
assert.equal(sideload.role, 'sideload');
assert.deepEqual(sideload.requiredColumns, ['NODE', 'GLOBAL_X']);

const attachment = createUniversalAttachmentRule({ ruleId: 'coord-node', sourceId: 'coord', attachToLevelId: 'node', sourceKey: 'NODE', targetKey: 'nodeNumber', blockName: 'DerivedCoordinateBlock', mode: 'create-block', fieldBindings: [{ sourceField: 'GLOBAL_X', targetField: 'FROM_GLOBAL_X' }] });
assert.equal(attachment.mode, 'create-block');
assert.equal(attachment.fieldBindings[0].targetField, 'FROM_GLOBAL_X');

const preset = createLinewiseUniversalPreset();
const summary = summarizeUniversalProfile(preset);
assert.equal(preset.schema, 'UniversalXmlCategorizerProfile.v1');
assert.equal(summary.sideloadSources, 3);
assert.equal(summary.levels, 4);
assert.equal(summary.blocks, 6);
assert.equal(summary.attachments, 3);
assert.ok(preset.blockDefinitions.some((block) => block.attachToLevelId === 'node' && block.blockName === 'RestraintsBlock'));

const normalized = normalizeUniversalCategorizerProfile({ profileId: 'custom', sources: [{ sourceId: 'main', role: 'primary' }], levelDefinitions: [{ levelId: 'root', children: ['line'] }] });
assert.equal(normalized.displayName, 'Universal XML Categorizer Shadow Profile');
assert.equal(normalized.sources[0].role, 'primary');
assert.deepEqual(normalized.levelDefinitions[0].children, ['line']);

console.log('xml-compare-universal-categorizer-contracts tests passed');
