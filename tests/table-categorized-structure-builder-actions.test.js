import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addChildLevel, createBlankUniversalProfile, deleteLevelAtPath } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';

const runtime = fs.readFileSync('tabs/xml-compare-table-categorized-runtime.js', 'utf8');
for (const text of ['addChildLevel', 'deleteLevelAtPath', 'add-child-level', 'remove-level', 'add-derived-column', 'remove-derived-column', 'data-source-transform-field']) {
  assert.ok(runtime.includes(text), `runtime missing ${text}`);
}

const shell = renderTableCategorizedXmlShellHtml({ activeStep: 'structure', activeTab: 'graph', profile: createBlankUniversalProfile(), sources: [{ headers: ['PS NO'], rows: [{ rawCells: ['A'], rawByHeader: { 'PS NO': 'A' } }] }], columnsConfirmed: true });
assert.ok(shell.includes('add-child-level'));
assert.ok(shell.includes('remove-level'));

const child = { levelId: 'childA', displayName: 'Child A', xmlTag: 'ChildA', keyResolver: { op: 'trim', column: 'PS NO' }, children: [] };
const added = addChildLevel(createBlankUniversalProfile(), [0], child);
assert.equal(added.levelDefinitions[0].children.length, 2);
const removed = deleteLevelAtPath(added, [0, 1]);
assert.equal(removed.levelDefinitions[0].children.length, 1);
const rootSafe = deleteLevelAtPath(added, [0]);
assert.equal(rootSafe.levelDefinitions[0].children.length, 2);

const ps = 'PS';
const source = applySourceTransformRules(parseTableSource(['PS NO', `${ps}-XYZ.1`, `${ps}-XYZ.2`, `${ps}-ABC.1`].join('\n'), { delimiterMode: 'tab' }), [{ newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }]);
const profile = { profileId: 'derived-group-test', displayName: 'Derived Group Test', levelDefinitions: [{ levelId: 'root', displayName: 'Root', levelType: 'container', creationMode: 'static', key: 'ROOT', documentRoot: true, children: [{ levelId: 'psGroup', displayName: 'PS Group', xmlTag: 'PSGroup', levelType: 'group', creationMode: 'one-per-key', keyResolver: { op: 'trim', column: 'PS_NO_Trimmed' }, children: [] }] }] };
const graph = buildCategorizedGraph(profile, [source]);
const keys = graph.nodes.map((node) => node.key);
assert.ok(keys.includes(`${ps}-XYZ`));
assert.ok(keys.includes(`${ps}-ABC`));

console.log('table-categorized-structure-builder-actions.test.js passed');
