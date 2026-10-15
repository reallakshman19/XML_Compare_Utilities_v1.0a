import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { validateExportArtifactContract } from '../xml-compare/table-categorizer/core/categorized-export-contracts.js';
import { validateCategorizedGraphContract } from '../xml-compare/table-categorizer/core/categorized-graph-contracts.js';
import { validateCategorizedProfileContract } from '../xml-compare/table-categorizer/core/categorized-profile-contracts.js';
import { validateTableSourceContract } from '../xml-compare/table-categorizer/core/table-source-contracts.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const root = path.resolve('tests/fixtures/table-categorized');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const readText = (name) => fs.readFileSync(path.join(root, name), 'utf8');

assert.equal(validateTableSourceContract(parseTableSource(readText('valid-minimal-source-table.txt'), { delimiterMode: 'comma' })).ok, true);
assert.equal(validateCategorizedProfileContract(readJson('valid-universal-profile.json')).ok, true);
assert.equal(validateCategorizedProfileContract(readJson('valid-ps-mapping-profile.json')).ok, true);
assert.equal(validateCategorizedGraphContract(readJson('valid-categorized-graph.json')).ok, true);
assert.equal(validateExportArtifactContract(readJson('valid-export-artifacts.json')).ok, true);

const invalidMode = validateCategorizedProfileContract(readJson('invalid-profile-unsupported-mode.json'));
assert.equal(invalidMode.ok, false);
assert.equal(invalidMode.diagnostics[0].code, 'profile_creation_mode_invalid');

const invalidTag = validateCategorizedProfileContract(readJson('invalid-profile-bad-xml-tag.json'));
assert.equal(invalidTag.ok, false);
assert.equal(invalidTag.diagnostics[0].code, 'profile_xml_tag_invalid');

const invalidGraph = validateCategorizedGraphContract(readJson('invalid-categorized-graph-missing-node-fields.json'));
assert.equal(invalidGraph.ok, false);
assert.equal(invalidGraph.diagnostics[0].code, 'graph_node_field_missing');

const severities = ['INFO', 'WARNING', 'BLOCKER', 'ERROR'];
for (const result of [invalidMode, invalidTag, invalidGraph]) {
  assert.equal(result.diagnostics.every((item) => severities.includes(item.severity)), true);
}

const coreFiles = fs.readdirSync(path.resolve('xml-compare/table-categorizer/core')).filter((name) => name.endsWith('.js'));
const banned = /supportFamily|supportOccurrence|supportFeature|PS Mapping|gap|coordinate lookup/i;
for (const file of coreFiles) {
  assert.equal(banned.test(fs.readFileSync(path.resolve('xml-compare/table-categorizer/core', file), 'utf8')), false, file);
}

const checklist = fs.readFileSync(path.resolve('docs/table-to-categorized-xml-review-checklist.md'), 'utf8');
for (const keyword of ['table source contract', 'categorized profile contract', 'categorized graph contract', 'export artifact contract']) {
  assert.match(checklist, new RegExp(keyword, 'i'));
}

console.log('Table categorized contract fixture tests passed');
