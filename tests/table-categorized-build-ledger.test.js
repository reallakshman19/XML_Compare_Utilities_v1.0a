import assert from 'node:assert/strict';

import { createBuildLedger, TABLE_CATEGORIZED_XML_BUILD_LEDGER_SCHEMA } from '../xml-compare/table-categorizer/table-categorized-xml-build-ledger.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';

const source = applySourceTransformRules(
  parseTableSource(['PS NO\tRating\tLength', 'PS-100.1\tCL150\t1200', 'PS-100.2\tCL150\t800', 'PS-200.1\tCL300\t600'].join('\n'), { sourceId: 'S1', delimiterMode: 'tab' }),
  [{ ruleId: 'ps-root', newColumn: 'PS_ROOT', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }],
);

const profile = {
  profileId: 'ledger-proof-profile',
  displayName: 'Ledger Proof Profile',
  levelDefinitions: [{
    levelId: 'doc', displayName: 'Document', levelType: 'container', creationMode: 'static', key: 'DOC', documentRoot: true,
    children: [{
      levelId: 'ps', displayName: 'PS', xmlTag: 'PS', levelType: 'group', creationMode: 'one-per-key', keyResolver: { op: 'trim', column: 'PS_ROOT' }, displayNameResolver: { op: 'trim', column: 'PS_ROOT' },
      fieldResolvers: { rating: { op: 'trim', column: 'Rating' }, length: { op: 'numberParser', column: 'Length' } },
      children: [],
    }],
  }],
};

const graph = buildCategorizedGraph(profile, [source]);
const ledger = createBuildLedger(profile, [source], graph);

assert.equal(ledger.schema, TABLE_CATEGORIZED_XML_BUILD_LEDGER_SCHEMA);
assert.equal(ledger.profileId, 'ledger-proof-profile');
assert.deepEqual(ledger.sourceIds, ['S1']);
assert.equal(ledger.entries.length, 2);

const root = ledger.entries.find((entry) => entry.levelId === 'doc');
assert.equal(root.path, '0');
assert.equal(root.xmlTag, 'documentRoot');
assert.equal(root.nodeCount, 1);
assert.equal(root.keyResolver.literal, 'DOC');

const ps = ledger.entries.find((entry) => entry.levelId === 'ps');
assert.equal(ps.path, '0.0');
assert.equal(ps.xmlTag, 'PS');
assert.equal(ps.keyResolver.column, 'PS_ROOT');
assert.equal(ps.displayResolver.column, 'PS_ROOT');
assert.equal(ps.fieldResolverCount, 2);
assert.equal(ps.nodeCount, 2);
assert.equal(ps.sourceRefCount, 3);
assert.equal(ps.duplicateMergeCount, 1);
assert.deepEqual(ps.sampleKeys, ['PS-100', 'PS-200']);
assert.equal(ps.blankKeyCount, 0);
assert.ok(ps.fieldResolvers.some((item) => item.name === 'rating' && item.column === 'Rating'));
assert.equal(ledger.diagnostics.some((item) => item.severity === 'ERROR'), false);

const missingKeyLedger = createBuildLedger({ profileId: 'missing', levelDefinitions: [{ levelId: 'bad', levelType: 'group', creationMode: 'one-per-key', children: [] }] }, [source], { nodes: [] });
assert.ok(missingKeyLedger.diagnostics.some((item) => item.code === 'build_ledger_missing_key_resolver'));
assert.ok(missingKeyLedger.diagnostics.some((item) => item.code === 'build_ledger_no_nodes'));

console.log('table-categorized-build-ledger.test.js passed');
