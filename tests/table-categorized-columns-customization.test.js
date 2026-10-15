import assert from 'node:assert/strict';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';

const ps = 'PS';
const parsed = parseTableSource(['PS NO\tX', `${ps}-XYZ.1\t1000mm`, `${ps}-XYZ.2\t1001mm`].join('\n'));
const source = applySourceTransformRules(parsed, [{ newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }]);
const html = renderTableCategorizedXmlShellHtml({ activeStep: 'columns', activeTab: 'levels', sources: [source], activeSourceId: 'S1', columnsConfirmed: true });

for (const text of ['Detected Columns (Visual Grid)', 'Column customization', 'Add new column', 'New column name', 'Source column', 'Operation', 'Find text / delimiter', 'Replace with', 'Preview result', 'PS_NO_Trimmed']) {
  assert.ok(html.includes(text), `missing ${text}`);
}
assert.ok(html.includes('Columns Confirmed. Proceed to Structure.'));
assert.ok(html.includes(`${ps}-XYZ`));

const mmSource = applySourceTransformRules(parsed, [{ newColumn: 'X_clean', sourceColumn: 'X', operation: 'replace-text', find: 'mm', replaceWith: '' }]);
const mmHtml = renderTableCategorizedXmlShellHtml({ activeStep: 'columns', activeTab: 'levels', sources: [mmSource], activeSourceId: 'S1' });
assert.ok(mmHtml.includes('X_clean'));
assert.ok(mmHtml.includes('1000'));
assert.ok(mmHtml.includes('1001'));

console.log('table-categorized-columns-customization.test.js passed');
