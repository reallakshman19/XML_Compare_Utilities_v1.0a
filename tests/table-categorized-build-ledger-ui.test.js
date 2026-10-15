import assert from 'node:assert/strict';

import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';

const source = applySourceTransformRules(
  parseTableSource(['PS NO\tRating\tLength', 'PS-100.1\tCL150\t1200', 'PS-100.2\tCL150\t800', 'PS-200.1\tCL300\t600'].join('\n'), { sourceId: 'S1', delimiterMode: 'tab' }),
  [{ ruleId: 'ps-root', newColumn: 'PS_ROOT', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }],
);

const profile = {
  profileId: 'ledger-ui-profile',
  displayName: 'Ledger UI Profile',
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
const html = renderTableCategorizedXmlShellHtml({ activeStep: 'preview', activeTab: 'validation', profile, sources: [source], activeSourceId: 'S1', columnsConfirmed: true, graph, validationResults: [] });

assert.ok(html.includes('data-table-categorized-build-ledger="BuildLedger.v1"'), 'preview renders BuildLedger.v1 table');
assert.ok(html.includes('Build Trace Ledger'), 'preview exposes build trace ledger heading');
assert.ok(html.includes('data-build-ledger-level-id="ps"'), 'ledger renders child level row');
assert.ok(html.includes('data-build-ledger-path="0.0"'), 'ledger renders level path');
assert.ok(html.includes('trim:PS_ROOT'), 'ledger renders key resolver column');
assert.ok(html.includes('PS-100') && html.includes('PS-200'), 'ledger renders sample keys');
assert.ok(html.includes('Build Ledger Diagnostics'), 'preview renders diagnostics card');
assert.ok(html.includes('No build-ledger diagnostics.'), 'diagnostics card shows clean state');
assert.ok(html.includes('<td>2</td>') && html.includes('<td>3</td>'), 'ledger renders node/sourceRef counts');

const emptyHtml = renderTableCategorizedXmlShellHtml({ activeStep: 'preview', activeTab: 'validation', profile, sources: [source], activeSourceId: 'S1', columnsConfirmed: true, validationResults: [] });
assert.ok(emptyHtml.includes('data-table-categorized-build-ledger-empty'), 'preview shows empty build ledger state before graph exists');
assert.ok(emptyHtml.includes('Build graph first to see resolver and sourceRef evidence.'), 'empty build ledger gives actionable guidance');

console.log('table-categorized-build-ledger-ui.test.js passed');
